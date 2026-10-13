import fs from 'fs'
import http from 'http'
import net from 'net'
import path from 'path'
import { Readable } from 'stream'

import { Agent } from 'undici'

import Anvil from '../index'

const assetsDir = path.join(__dirname, 'assets')

const RATE_LIMIT_HEADERS = {
  'x-ratelimit-limit': '10',
  'x-ratelimit-interval-ms': '1000',
}

// These tests run the real client (no stubbed _request or _throttle) against a
// local HTTP server so we can see exactly what goes over the wire.
//
// `handler` receives the recorded request and returns a response description:
//   { status = 200, headers = {}, json, body, delayMS = 0 }
function startServer (handler) {
  const requests = []

  const server = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', async () => {
      const recorded = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks),
        receivedAt: Date.now(),
        // Identifies the connection, to see whether requests reuse them
        connection: req.socket.remotePort,
      }
      requests.push(recorded)

      const {
        status = 200,
        headers = {},
        json,
        body,
        delayMS = 0,
        destroy = false,
      } = (await handler(recorded, requests.length - 1)) || {}

      // Drop the connection without responding
      if (destroy) {
        req.socket.destroy()
        return
      }

      if (delayMS) {
        await new Promise((resolve) => setTimeout(resolve, delayMS))
      }

      const responseHeaders = { ...RATE_LIMIT_HEADERS, ...headers }
      if (json !== undefined) {
        responseHeaders['content-type'] = 'application/json'
      }
      res.writeHead(status, responseHeaders)
      recorded.respondedAt = Date.now()
      res.end(json !== undefined ? JSON.stringify(json) : body)
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        baseURL: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise((resolve) => {
          server.close(resolve)
          // Node 18 waits for keep-alive connections to time out otherwise
          server.closeAllConnections()
        }),
      })
    })
  })
}

function decodeAuthHeader (header, scheme) {
  return Buffer.from(header.replace(`${scheme} `, ''), 'base64').toString('ascii')
}

describe('Anvil API Client over HTTP', function () {
  let server
  let handler

  // A generous starting limit so the client doesn't throttle requests that
  // aren't about throttling.
  function createClient (options = {}) {
    return new Anvil({
      apiKey: 'test-api-key',
      baseURL: server.baseURL,
      requestLimit: 10,
      requestLimitMS: 1000,
      ...options,
    })
  }

  beforeEach(async function () {
    handler = () => ({ json: { data: { ok: true } } })
    server = await startServer((...args) => handler(...args))
  })

  afterEach(async function () {
    await server.close()
  })

  describe('baseURL', function () {
    it('sends fillPDF to {baseURL}/api/v1/fill/{id}.pdf', async function () {
      handler = () => ({ body: '%PDF-1.7' })
      const client = createClient()

      const { statusCode, data } = await client.fillPDF('castEid123', { data: {} })

      expect(statusCode).to.eql(200)
      expect(data.toString()).to.eql('%PDF-1.7')
      expect(server.requests).to.have.length(1)
      expect(server.requests[0].method).to.eql('POST')
      expect(server.requests[0].url).to.eql('/api/v1/fill/castEid123.pdf')
    })

    it('passes VERSION_LATEST through to fillPDF as versionNumber=-1', async function () {
      handler = () => ({ body: '%PDF-1.7' })
      const client = createClient()

      await client.fillPDF('castEid123', { data: {} }, { versionNumber: Anvil.VERSION_LATEST })

      expect(server.requests[0].url).to.eql('/api/v1/fill/castEid123.pdf?versionNumber=-1')
    })

    it('sends generatePDF to {baseURL}/api/v1/generate-pdf', async function () {
      handler = () => ({ body: '%PDF-1.7' })
      const client = createClient()
      const payload = { title: 'Test', data: [{ label: 'Hello', content: 'World' }] }

      await client.generatePDF(payload)

      expect(server.requests[0].method).to.eql('POST')
      expect(server.requests[0].url).to.eql('/api/v1/generate-pdf')
      expect(server.requests[0].headers['content-type']).to.eql('application/json')
      expect(JSON.parse(server.requests[0].body.toString())).to.eql(payload)
    })

    it('sends downloadDocuments to {baseURL}/api/document-group/{eid}.zip', async function () {
      handler = () => ({ body: 'zip data' })
      const client = createClient()

      const { data } = await client.downloadDocuments('docGroupEid123')

      expect(data.toString()).to.eql('zip data')
      expect(server.requests[0].method).to.eql('GET')
      expect(server.requests[0].url).to.eql('/api/document-group/docGroupEid123.zip')
    })

    it('sends GraphQL requests to {baseURL}/graphql', async function () {
      const client = createClient()

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })
      await client.createEtchPacket({ variables: { name: 'Test' } })
      await client.getEtchPacket({ variables: { eid: 'packetEid123' } })
      await client.generateEtchSignUrl({ variables: { signerEid: 'signerEid123', clientUserId: 'user123' } })
      await client.forgeSubmit({ variables: { forgeEid: 'forgeEid123', payload: {} } })
      await client.removeWeldData({ variables: { eid: 'weldDataEid123' } })

      expect(server.requests).to.have.length(6)
      for (const request of server.requests) {
        expect(request.method).to.eql('POST')
        expect(request.url).to.eql('/graphql')
        expect(request.headers['content-type']).to.eql('application/json')
      }
    })

    it('uses a full URL as-is when it already starts with the baseURL', async function () {
      const client = createClient()

      await client.requestREST(`${server.baseURL}/api/v1/some-endpoint`, { method: 'GET' }, { dataType: 'json' })

      expect(server.requests[0].url).to.eql('/api/v1/some-endpoint')
    })
  })

  describe('headers', function () {
    it('sends Basic auth with the API key and a trailing colon', async function () {
      const client = createClient({ apiKey: 'my-api-key' })

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      const { authorization } = server.requests[0].headers
      expect(authorization).to.match(/^Basic /)
      expect(decodeAuthHeader(authorization, 'Basic')).to.eql('my-api-key:')
    })

    it('sends Bearer auth with the access token', async function () {
      const client = createClient({ apiKey: undefined, accessToken: 'my-access-token' })

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      const { authorization } = server.requests[0].headers
      expect(authorization).to.match(/^Bearer /)
      expect(decodeAuthHeader(authorization, 'Bearer')).to.eql('my-access-token')
    })

    it('sends Bearer auth with a JWT access token as-is', async function () {
      const accessToken = [
        Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
        Buffer.from(JSON.stringify({ sub: 'user123' })).toString('base64url'),
        'c2lnbmF0dXJl',
      ].join('.')
      const client = createClient({ apiKey: undefined, accessToken })

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(server.requests[0].headers.authorization).to.eql(`Bearer ${accessToken}`)
    })

    it('sends the default User-Agent', async function () {
      const { version, description } = require('../package.json')
      const client = createClient()

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(server.requests[0].headers['user-agent']).to.eql(`${description}/${version}`)
    })

    it('sends a custom User-Agent', async function () {
      const client = createClient({ userAgent: 'my-app/1.0' })

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(server.requests[0].headers['user-agent']).to.eql('my-app/1.0')
    })
  })

  describe('rate limiting', function () {
    it('updates the limiter from the first response headers', async function () {
      handler = () => ({
        json: { data: { ok: true } },
        headers: { 'x-ratelimit-limit': '7', 'x-ratelimit-interval-ms': '700' },
      })
      const client = createClient()
      expect(client.limitTokens).to.eql(10)
      expect(client.limitIntervalMs).to.eql(1000)

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(client.hasSetLimiterFromResponse).to.eql(true)
      expect(client.limitTokens).to.eql(7)
      expect(client.limitIntervalMs).to.eql(700)
    })

    it('only reads the limits from the first response', async function () {
      handler = (request, index) => ({
        json: { data: { ok: true } },
        headers: index === 0
          ? { 'x-ratelimit-limit': '7', 'x-ratelimit-interval-ms': '700' }
          : { 'x-ratelimit-limit': '3', 'x-ratelimit-interval-ms': '300' },
      })
      const client = createClient()

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })
      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(client.limitTokens).to.eql(7)
      expect(client.limitIntervalMs).to.eql(700)
    })

    it('keeps the starting limits when the response has no rate limit headers', async function () {
      handler = () => ({
        json: { data: { ok: true } },
        headers: { 'x-ratelimit-limit': '', 'x-ratelimit-interval-ms': '' },
      })
      const client = createClient()

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(client.hasSetLimiterFromResponse).to.eql(true)
      expect(client.limitTokens).to.eql(10)
      expect(client.limitIntervalMs).to.eql(1000)
    })

    it('holds concurrent requests until the first response sets the limits', async function () {
      handler = (request, index) => ({
        json: { data: { index } },
        // Give the other requests plenty of time to sneak out if they were going to
        delayMS: index === 0 ? 150 : 0,
      })
      const client = createClient()

      const results = await Promise.all([1, 2, 3].map(() =>
        client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' }),
      ))

      expect(results.map(({ statusCode }) => statusCode)).to.eql([200, 200, 200])
      expect(server.requests).to.have.length(3)
      const [first, ...rest] = server.requests
      for (const request of rest) {
        expect(request.receivedAt).to.be.at.least(first.respondedAt)
      }
    })

    it('never sends more requests in any interval than the server allows', async function () {
      this.timeout(5000)
      const intervalMs = 300
      handler = () => ({
        json: { data: { ok: true } },
        headers: { 'x-ratelimit-limit': '2', 'x-ratelimit-interval-ms': String(intervalMs) },
      })
      const client = createClient({ requestLimit: 2, requestLimitMS: intervalMs })

      await Promise.all([1, 2, 3, 4, 5, 6].map(() =>
        client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' }),
      ))

      // The API counts requests over a sliding window, so check every window, not just
      // the ones starting at the first request
      const times = server.requests.map(({ receivedAt }) => receivedAt)
      expect(times).to.have.length(6)
      for (const time of times) {
        const inWindow = times.filter((other) => other >= time && other - time < intervalMs)
        expect(inWindow).to.have.length.at.most(2)
      }
    })

    it('sends the first request right away', async function () {
      // The default starting limit of 1 request per second
      const client = new Anvil({ apiKey: 'test-api-key', baseURL: server.baseURL })

      const start = Date.now()
      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(Date.now() - start).to.be.below(300)
    })

    it('does not hold back requests that are within the limit', async function () {
      handler = () => ({
        json: { data: { ok: true } },
        headers: { 'x-ratelimit-limit': '5', 'x-ratelimit-interval-ms': '1000' },
      })
      const client = new Anvil({ apiKey: 'test-api-key', baseURL: server.baseURL })

      const start = Date.now()
      for (let i = 0; i < 5; i++) {
        await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })
      }

      expect(server.requests).to.have.length(5)
      expect(Date.now() - start).to.be.below(500)
    })

    it('waits for the interval from the server, not requestLimitMS', async function () {
      handler = () => ({
        json: { data: { ok: true } },
        headers: { 'x-ratelimit-limit': '1', 'x-ratelimit-interval-ms': '200' },
      })
      // requestLimitMS defaults to 1000
      const client = new Anvil({ apiKey: 'test-api-key', baseURL: server.baseURL })

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })
      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      const waitedMS = server.requests[1].receivedAt - server.requests[0].receivedAt
      // 200ms interval + 50ms buffer
      expect(waitedMS).to.be.within(240, 700)
    })

    it('lets waiting requests go ahead when the first request fails', async function () {
      handler = (request, index) => index === 0 ? { destroy: true, delayMS: 50 } : { json: { data: { ok: true } } }
      const client = createClient()

      const results = await Promise.allSettled([1, 2, 3].map(() =>
        client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' }),
      ))

      expect(results[0].status).to.eql('rejected')
      expect(results[0].reason.message).to.eql('fetch failed')
      expect(results.slice(1).map(({ status, value }) => status === 'fulfilled' && value.statusCode)).to.eql([200, 200])
    })

    it('accepts null client options, even on the first request', async function () {
      // This used to throw before the request was sent, which left the gate for the
      // first response closed and every later request waiting on it forever
      const client = createClient()

      const first = await client.requestREST('/api/v1/generate-pdf', { method: 'GET' }, null)
      expect(first.statusCode).to.eql(200)

      const { statusCode } = await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })
      expect(statusCode).to.eql(200)
      expect(server.requests).to.have.length(2)
    })

    it('falls back to 1 request per second when the starting limits are invalid', async function () {
      const client = createClient({ requestLimit: 0, requestLimitMS: -5 })
      expect(client.limitTokens).to.eql(1)
      expect(client.limitIntervalMs).to.eql(1000)

      const { statusCode } = await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(statusCode).to.eql(200)
    })

    it('retries a 429 after retry-after seconds plus a 50ms buffer', async function () {
      handler = (request, index) => index === 0
        ? { status: 429, headers: { 'retry-after': '0.3' } }
        : { json: { data: { ok: true } } }
      const client = createClient()

      const { statusCode, data, errors } = await client.requestGraphQL(
        { query: '{ currentUser { eid } }' },
        { dataType: 'json' },
      )

      expect(statusCode).to.eql(200)
      expect(data).to.eql({ data: { ok: true } })
      expect(errors).to.be.undefined
      expect(server.requests).to.have.length(2)

      const waitedMS = server.requests[1].receivedAt - server.requests[0].respondedAt
      // 300ms from retry-after + 50ms buffer. Allow a little timer slop below, more above.
      expect(waitedMS).to.be.within(340, 700)
    })

    it('retries a 429 after only the 50ms buffer when there is no retry-after', async function () {
      handler = (request, index) => index === 0
        ? { status: 429 }
        : { json: { data: { ok: true } } }
      const client = createClient()

      const { statusCode } = await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(statusCode).to.eql(200)
      const waitedMS = server.requests[1].receivedAt - server.requests[0].respondedAt
      expect(waitedMS).to.be.within(40, 300)
    })

    it('keeps retrying until the request is not rate limited', async function () {
      handler = (request, index) => index < 3
        ? { status: 429, headers: { 'retry-after': '0' } }
        : { json: { data: { ok: true } } }
      const client = createClient()

      const { statusCode } = await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(statusCode).to.eql(200)
      expect(server.requests).to.have.length(4)
    })
  })

  describe('connections', function () {
    // A response body that is never read holds on to its connection, so the next
    // request has to open another. Bodies that nothing will use are read and discarded.
    const bigBody = 'x'.repeat(200 * 1024)
    const connections = () => new Set(server.requests.map(({ connection }) => connection)).size

    it('reuses the connection after retrying a 429 that had a body', async function () {
      handler = (request, index) => index < 3
        ? { status: 429, headers: { 'retry-after': '0' }, body: bigBody }
        : { json: { data: { ok: true } } }
      const client = createClient()

      const { statusCode } = await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(statusCode).to.eql(200)
      expect(server.requests).to.have.length(4)
      expect(connections()).to.eql(1)
    })

    it('reuses the connection after a non-JSON error response to a GraphQL request', async function () {
      handler = (request, index) => index === 0
        ? { status: 502, body: bigBody }
        : { json: { data: { ok: true } } }
      const client = createClient()

      const { errors } = await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })
      expect(errors).to.eql([{ name: 'Bad Gateway', message: 'Bad Gateway' }])
      // undici returns the connection to its pool a tick after the body has been read
      await new Promise((resolve) => setTimeout(resolve, 20))
      const { statusCode } = await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(statusCode).to.eql(200)
      expect(connections()).to.eql(1)
    })
  })

  describe('errors', function () {
    it('returns GraphQL errors from a 200 response', async function () {
      const errors = [{ message: 'Not Found', path: ['etchPacket'] }]
      handler = () => ({ json: { data: { etchPacket: null }, errors } })
      const client = createClient()

      const result = await client.getEtchPacket({ variables: { eid: 'nope' } })

      expect(result.statusCode).to.eql(200)
      expect(result.errors).to.eql(errors)
      expect(result.data).to.be.undefined
    })

    it('returns a REST validation error with its fields', async function () {
      const error = { name: 'ValidationError', fields: [{ message: 'Required', property: 'data' }] }
      handler = () => ({ status: 400, json: error })
      const client = createClient()

      const result = await client.generatePDF({})

      expect(result.statusCode).to.eql(400)
      expect(result.errors).to.eql([error])
    })

    it('uses the status text for a non-JSON error response', async function () {
      handler = () => ({ status: 502, headers: { 'content-type': 'text/html' }, body: '<html>Bad Gateway</html>' })
      const client = createClient()

      const result = await client.fillPDF('castEid123', { data: {} })

      expect(result.statusCode).to.eql(502)
      expect(result.errors).to.eql([{ name: 'Bad Gateway', message: 'Bad Gateway' }])
    })

    it('uses the status text for an empty error response', async function () {
      handler = () => ({ status: 500 })
      const client = createClient()

      const result = await client.downloadDocuments('docGroupEid123')

      expect(result.statusCode).to.eql(500)
      expect(result.errors).to.eql([{ name: 'Internal Server Error', message: 'Internal Server Error' }])
    })

    it('returns a parsing error for an empty JSON response', async function () {
      handler = () => ({ headers: { 'content-type': 'application/json' } })
      const client = createClient()

      const result = await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(result.statusCode).to.eql(200)
      expect(result.errors).to.have.length(1)
      expect(result.errors[0].name).to.eql('SyntaxError')
    })

    it('rejects when the server cannot be reached', async function () {
      const client = createClient()
      await server.close()

      const error = await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })
        .then(() => null, (err) => err)

      expect(error).to.be.an.instanceof(TypeError)
      expect(error.message).to.eql('fetch failed')
      expect(error.cause.code).to.eql('ECONNREFUSED')
    })
  })

  describe('file uploads', function () {
    function getPart (request, name) {
      const boundary = request.headers['content-type'].split('boundary=')[1]
      const parts = request.body.toString('latin1').split(`--${boundary}`)
      return parts.find((part) => part.includes(`name="${name}"`))
    }

    function getPartBody (part) {
      return part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')
    }

    it('sends a prepared Buffer as a multipart GraphQL upload', async function () {
      const client = createClient()
      const file = Anvil.prepareGraphQLFile(Buffer.from('%PDF-1.7 buffer'), {
        filename: 'from-buffer.pdf',
        mimetype: 'application/pdf',
      })

      await client.createEtchPacket({
        variables: {
          files: [{ id: 'file1', title: 'File', file }],
        },
      })

      const [request] = server.requests
      expect(request.url).to.eql('/graphql')
      expect(request.headers['content-type']).to.match(/^multipart\/form-data; boundary=/)

      const operations = JSON.parse(getPartBody(getPart(request, 'operations')))
      expect(operations.variables.files[0]).to.eql({ id: 'file1', title: 'File', file: null })
      expect(operations.query).to.include('createEtchPacket')

      const map = JSON.parse(getPartBody(getPart(request, 'map')))
      expect(map).to.eql({ 1: ['variables.files.0.file'] })

      const filePart = getPart(request, '1')
      expect(filePart).to.include('filename="from-buffer.pdf"')
      expect(filePart).to.include('Content-Type: application/pdf')
      expect(getPartBody(filePart)).to.eql('%PDF-1.7 buffer')
    })

    it('sends a file stream using its own filename', async function () {
      const client = createClient()
      const file = fs.createReadStream(path.join(assetsDir, 'dummy.pdf'))

      await client.requestGraphQL({
        query: 'mutation Upload($file: Upload!) { upload(file: $file) }',
        variables: { input: { file } },
      }, { dataType: 'json' })

      const [request] = server.requests
      const map = JSON.parse(getPartBody(getPart(request, 'map')))
      expect(map).to.eql({ 1: ['variables.input.file'] })
      expect(getPart(request, '1')).to.include('filename="dummy.pdf"')
      expect(Buffer.from(getPartBody(getPart(request, '1')), 'latin1'))
        .to.eql(fs.readFileSync(path.join(assetsDir, 'dummy.pdf')))
    })

    it('sends several files with one map entry each', async function () {
      const client = createClient()

      await client.createEtchPacket({
        variables: {
          files: [
            { id: 'a', file: Anvil.prepareGraphQLFile(Buffer.from('a'), { filename: 'a.pdf' }) },
            { id: 'b', file: Anvil.prepareGraphQLFile(Buffer.from('b'), { filename: 'b.pdf' }) },
          ],
        },
      })

      const [request] = server.requests
      const map = JSON.parse(getPartBody(getPart(request, 'map')))
      expect(map).to.eql({
        1: ['variables.files.0.file'],
        2: ['variables.files.1.file'],
      })
      expect(getPart(request, '1')).to.include('filename="a.pdf"')
      expect(getPart(request, '2')).to.include('filename="b.pdf"')
    })

    it('sends a file from a path using its own filename, with a Content-Length', async function () {
      const client = createClient()
      const filePath = path.join(assetsDir, 'dummy.pdf')

      await client.createEtchPacket({
        variables: { files: [{ id: 'file1', file: Anvil.prepareGraphQLFile(filePath) }] },
      })

      const [request] = server.requests
      expect(request.headers['content-length']).to.eql(String(request.body.length))
      expect(getPart(request, '1')).to.include('filename="dummy.pdf"')
      expect(Buffer.from(getPartBody(getPart(request, '1')), 'latin1')).to.eql(fs.readFileSync(filePath))
    })

    it('sends a stream that has no path, using the given filename', async function () {
      const client = createClient()
      const file = Anvil.prepareGraphQLFile(Readable.from([Buffer.from('%PDF-1.7 '), Buffer.from('streamed')]), {
        filename: 'from-a-stream.pdf',
        mimetype: 'application/pdf',
      })

      await client.createEtchPacket({ variables: { files: [{ id: 'file1', file }] } })

      const [request] = server.requests
      // Its size isn't known up front, so the request is chunked
      expect(request.headers['transfer-encoding']).to.eql('chunked')
      const filePart = getPart(request, '1')
      expect(filePart).to.include('filename="from-a-stream.pdf"')
      expect(filePart).to.include('Content-Type: application/pdf')
      expect(getPartBody(filePart)).to.eql('%PDF-1.7 streamed')
    })

    it('does not name a file "undefined" when there is no filename', async function () {
      const client = createClient()
      const file = Anvil.prepareGraphQLFile(Buffer.from('data'), { ignoreFilenameValidation: true })

      await client.createEtchPacket({ variables: { files: [{ id: 'file1', file }] } })

      const filePart = getPart(server.requests[0], '1')
      expect(filePart).to.include('filename="blob"')
      expect(getPartBody(filePart)).to.eql('data')
    })

    it('sends a stream of strings', async function () {
      const client = createClient()
      const file = Anvil.prepareGraphQLFile(Readable.from(['%PDF-1.7 ', '', 'from strings']), { filename: 'strings.pdf' })

      await client.createEtchPacket({ variables: { files: [{ id: 'file1', file }] } })

      expect(getPartBody(getPart(server.requests[0], '1'))).to.eql('%PDF-1.7 from strings')
    })

    it('sends only the part of a file stream between its start and end', async function () {
      const client = createClient()
      const filePath = path.join(assetsDir, 'dummy.pdf')
      const file = fs.createReadStream(filePath, { start: 10, end: 99 })

      await client.createEtchPacket({ variables: { files: [{ id: 'file1', file }] } })

      const [request] = server.requests
      expect(request.headers['content-length']).to.eql(String(request.body.length))
      expect(Buffer.from(getPartBody(getPart(request, '1')), 'latin1')).to.eql(fs.readFileSync(filePath).subarray(10, 100))
    })

    it('names a stream with no path or filename "blob"', async function () {
      const client = createClient()
      const file = Anvil.prepareGraphQLFile(Readable.from([Buffer.from('data')]), { ignoreFilenameValidation: true })

      await client.createEtchPacket({ variables: { files: [{ id: 'file1', file }] } })

      expect(getPart(server.requests[0], '1')).to.include('filename="blob"')
    })

    describe('when the upload is retried after a 429', function () {
      const filePath = path.join(assetsDir, 'dummy.pdf')

      beforeEach(function () {
        handler = (request, index) => index === 0
          ? { status: 429, headers: { 'retry-after': '0' } }
          : { json: { data: { ok: true } } }
      })

      it('sends a file from a path in full again', async function () {
        const client = createClient()

        const { statusCode } = await client.createEtchPacket({
          variables: { files: [{ id: 'file1', file: Anvil.prepareGraphQLFile(filePath) }] },
        })

        expect(statusCode).to.eql(200)
        expect(server.requests).to.have.length(2)
        expect(Buffer.from(getPartBody(getPart(server.requests[1], '1')), 'latin1')).to.eql(fs.readFileSync(filePath))
      })

      it('sends a file stream in full again', async function () {
        const client = createClient()

        const { statusCode } = await client.createEtchPacket({
          variables: { files: [{ id: 'file1', file: fs.createReadStream(filePath) }] },
        })

        expect(statusCode).to.eql(200)
        expect(server.requests).to.have.length(2)
        expect(Buffer.from(getPartBody(getPart(server.requests[1], '1')), 'latin1')).to.eql(fs.readFileSync(filePath))
      })

      it('fails, rather than sending an empty file, for a stream that can only be read once', async function () {
        const client = createClient()
        const file = Anvil.prepareGraphQLFile(Readable.from([Buffer.from('data')]), { filename: 'once.pdf' })

        const error = await client.createEtchPacket({ variables: { files: [{ id: 'file1', file }] } })
          .then(() => null, (err) => err)

        expect(server.requests).to.have.length(1)
        expect(error.message).to.match(/^Can't send once.pdf again because its stream has already been read/)
      })
    })

    it('cancels the request, rather than crashing, when a stream fails while being sent', async function () {
      const client = createClient()
      let unhandled
      const onUnhandled = (err) => { unhandled = err }
      process.on('unhandledRejection', onUnhandled)
      const stream = new Readable({
        read () {
          this.push(Buffer.from('data'))
          this.destroy(new Error('disk on fire'))
        },
      })
      const file = Anvil.prepareGraphQLFile(stream, { filename: 'bad.pdf' })
      sinon.stub(console, 'warn')

      const error = await client.createEtchPacket({ variables: { files: [{ id: 'file1', file }] } })
        .then(() => null, (err) => err)
      await new Promise((resolve) => setImmediate(resolve))
      process.off('unhandledRejection', onUnhandled)

      // fetch rejects with a DOMException, which chai doesn't count as an Error
      expect(error.name).to.eql('AbortError')
      expect(console.warn).to.have.been.calledWith(sinon.match({ message: 'disk on fire' }))
      expect(unhandled).to.be.undefined
    })

    it('does not follow redirects for uploads', async function () {
      handler = () => ({ status: 307, headers: { location: '/graphql-elsewhere' } })
      const client = createClient()

      await expect(client.createEtchPacket({
        variables: { files: [{ id: 'file1', file: Anvil.prepareGraphQLFile(Buffer.from('data'), { filename: 'a.pdf' }) }] },
      })).to.be.rejectedWith('fetch failed')

      expect(server.requests).to.have.length(1)
    })

    it('sends a base64 upload as plain JSON', async function () {
      const client = createClient()
      const file = {
        data: Buffer.from('%PDF-1.7').toString('base64'),
        filename: 'base64.pdf',
        mimetype: 'application/pdf',
      }

      await client.createEtchPacket({ variables: { files: [{ id: 'file1', file }] } })

      const [request] = server.requests
      expect(request.headers['content-type']).to.eql('application/json')
      expect(JSON.parse(request.body.toString()).variables.files[0].file).to.eql(file)
    })
  })

  describe('responses', function () {
    it('returns a Node stream for dataType stream', async function () {
      handler = () => ({ body: 'zip data' })
      const client = createClient()

      const { data } = await client.downloadDocuments('docGroupEid123', { dataType: 'stream' })

      expect(data).to.be.an.instanceof(Readable)
      const chunks = []
      for await (const chunk of data) chunks.push(chunk)
      expect(Buffer.concat(chunks).toString()).to.eql('zip data')
    })

    it('sends a stream body passed to requestREST', async function () {
      handler = () => ({ json: { ok: true } })
      const client = createClient()

      const { statusCode } = await client.requestREST('/api/v1/upload', {
        method: 'POST',
        body: Readable.from([Buffer.from('streamed '), Buffer.from('body')]),
      }, { dataType: 'json' })

      expect(statusCode).to.eql(200)
      expect(server.requests[0].body.toString()).to.eql('streamed body')
    })

    it('sends requests with the dispatcher option', async function () {
      let dispatched = 0
      class CountingAgent extends Agent {
        dispatch (options, handler) {
          dispatched++
          return super.dispatch(options, handler)
        }
      }
      const client = createClient({ dispatcher: new CountingAgent() })

      await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

      expect(dispatched).to.eql(1)
      expect(server.requests).to.have.length(1)
    })

    it('follows a redirect to another host without sending the Authorization header', async function () {
      const storage = await startServer(() => ({ body: 'zip data' }))
      handler = () => ({ status: 302, headers: { location: `${storage.baseURL}/signed/docs.zip` } })
      const client = createClient()

      try {
        const { statusCode, data } = await client.downloadDocuments('docGroupEid123')

        expect(statusCode).to.eql(200)
        expect(data.toString()).to.eql('zip data')
        expect(server.requests[0].headers.authorization).to.match(/^Basic /)
        expect(storage.requests[0].url).to.eql('/signed/docs.zip')
        expect(storage.requests[0].headers.authorization).to.be.undefined
      } finally {
        await storage.close()
      }
    })

    // https://github.com/anvilco/anvil/issues/4626
    describe('chunked responses', function () {
      const json = JSON.stringify({ data: { weldData: { eid: 'x'.repeat(2000) } } })
      const chunk = (string) => `${Buffer.byteLength(string).toString(16)}\r\n${string}\r\n`
      const head = 'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n'

      let rawServer
      let writes

      // A raw TCP server, so we control exactly how the response is split into packets
      beforeEach(async function () {
        rawServer = net.createServer((socket) => {
          socket.once('data', async () => {
            socket.setNoDelay(true)
            for (const write of writes.slice(0, -1)) {
              socket.write(write)
              await new Promise((resolve) => setTimeout(resolve, 20))
            }
            // Close in the same write as the last bytes
            socket.end(writes[writes.length - 1])
          })
        })
        await new Promise((resolve) => rawServer.listen(0, '127.0.0.1', resolve))
      })

      afterEach(function () {
        rawServer.close()
      })

      function createRawClient () {
        return new Anvil({
          apiKey: 'test-api-key',
          baseURL: `http://127.0.0.1:${rawServer.address().port}`,
          requestLimit: 10,
        })
      }

      for (const [description, ending] of [
        ['in one packet', ['0\r\n\r\n']],
        ['split "0\\r\\n\\r" | "\\n"', ['0\r\n\r', '\n']],
        ['split "0\\r\\n" | "\\r\\n"', ['0\r\n', '\r\n']],
        ['followed by a trailer', ['0\r\nX-Done: yes\r\n\r\n']],
      ]) {
        it(`reads a complete response whose last chunk arrives ${description}`, async function () {
          writes = [
            head + 'Content-Type: application/octet-stream\r\n\r\n',
            chunk(json.slice(0, 1000)) + chunk(json.slice(1000)),
            ...ending,
          ]
          const client = createRawClient()

          const { statusCode, data } = await client.requestREST('/graphql', { method: 'POST' }, { dataType: 'stream' })
          // Like a busy app, don't read the body until after the connection has closed
          await new Promise((resolve) => setTimeout(resolve, 100))
          const chunks = []
          for await (const chunk of data) chunks.push(chunk)
          const text = Buffer.concat(chunks).toString()

          expect(statusCode).to.eql(200)
          expect(text).to.eql(json)
        })
      }

      it('fails when the connection closes before the response is complete', async function () {
        writes = [head + 'Content-Type: application/pdf\r\n\r\n', chunk('%PDF-1.7 the first part')]
        const client = createRawClient()

        await expect(client.fillPDF('castEid123', { data: {} })).to.be.rejectedWith(/terminated/)
      })

      it('returns an error when the connection closes before a JSON response is complete', async function () {
        writes = [head + 'Content-Type: application/json\r\n\r\n', chunk(json.slice(0, 1000))]
        const client = createRawClient()

        const { statusCode, errors } = await client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })

        expect(statusCode).to.eql(200)
        expect(errors).to.have.length(1)
        expect(errors[0].message).to.eql('terminated')
      })
    })
  })
})
