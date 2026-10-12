import fs from 'fs'
import http from 'http'
import path from 'path'

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
      }
      requests.push(recorded)

      const {
        status = 200,
        headers = {},
        json,
        body,
        delayMS = 0,
      } = (await handler(recorded, requests.length - 1)) || {}

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
        close: () => new Promise((resolve) => server.close(resolve)),
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

    it('does not send more requests per interval than the server allows', async function () {
      this.timeout(5000)
      const intervalMs = 400
      handler = () => ({
        json: { data: { ok: true } },
        headers: { 'x-ratelimit-limit': '2', 'x-ratelimit-interval-ms': String(intervalMs) },
      })
      const client = createClient({ requestLimit: 2, requestLimitMS: intervalMs })

      await Promise.all([1, 2, 3, 4].map(() =>
        client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' }),
      ))

      expect(server.requests).to.have.length(4)
      const start = server.requests[0].receivedAt
      const inFirstInterval = server.requests.filter(({ receivedAt }) => receivedAt - start < intervalMs)
      expect(inFirstInterval).to.have.length.at.most(2)
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

      await expect(
        client.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' }),
      ).to.be.rejectedWith(/ECONNREFUSED/)
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
})
