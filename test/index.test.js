import fs from 'fs'
import path from 'path'

import { Readable } from 'stream'
import { ReadableStream } from 'stream/web'

import { FormData } from 'undici'

import Anvil from '../index'

const assetsDir = path.join(__dirname, 'assets')

function mockNodeFetchResponse (options = {}) {
  const { headers: headersIn = {}, ...rest } = options
  const {
    status,
    statusText,
    json,
    buffer,
    arrayBuffer,
    headers = {
      'x-ratelimit-limit': 1,
      'x-ratelimit-interval-ms': 1000,
      ...headersIn,
    },
    body,
  } = rest

  const mock = {
    status,
    statusText: statusText || ((status && status >= 200 && status < 300) ? 'OK' : 'Please specify error statusText for testing'),
  }

  mock.json = typeof json === 'function' ? json : () => json
  if (json) {
    headers['content-type'] = 'application/json'
  }

  mock.buffer = typeof buffer === 'function' ? buffer : () => buffer instanceof Buffer ? buffer : Buffer.from(buffer)
  if (arrayBuffer) {
    mock.arrayBuffer = typeof buffer === 'function' ? arrayBuffer : () => arrayBuffer
  } else {
    mock.arrayBuffer = () => {
      const buffer = mock.buffer()
      const ab = new ArrayBuffer(buffer.length)
      const view = new Uint8Array(ab)
      for (let i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i]
      }
      return ab
    }
  }

  mock.body = body

  mock.headers = {
    get: (header) => headers[header],
  }

  return mock
}

function fakeThrottle (fn) {
  return fn(() => fakeThrottle(fn))
}

describe('Anvil API Client', function () {
  beforeEach(function () {
    sinon.stub(Anvil.prototype, '_throttle').callsFake(fakeThrottle)
  })
  afterEach(function () {
    sinon.restore()
  })

  describe('constructor', function () {
    it('throws an error when no options specified', async function () {
      expect(() => new Anvil()).to.throw('options are required')
    })

    it('throws an error when no apiKey or accessToken specified', async function () {
      expect(() => new Anvil({})).to.throw('apiKey or accessToken required')
    })

    it('builds a Basic auth header when apiKey passed in', async function () {
      const apiKey = 'abc123'
      const client = new Anvil({ apiKey })
      expect(client.authHeader).to.equal(`Basic ${Buffer.from(`${apiKey}:`, 'ascii').toString('base64')}`)
    })

    it('builds a Bearer auth header when accessToken passed in', async function () {
      const accessToken = 'def345'
      const client = new Anvil({ accessToken })
      expect(client.authHeader).to.equal(`Bearer ${Buffer.from(accessToken, 'ascii').toString('base64')}`)
    })

    it('puts a trailing colon after the apiKey before encoding', async function () {
      const client = new Anvil({ apiKey: 'abc123' })
      const decoded = Buffer.from(client.authHeader.replace('Basic ', ''), 'base64').toString('ascii')
      expect(decoded).to.equal('abc123:')
    })

    it('does not put a trailing colon after the accessToken', async function () {
      const client = new Anvil({ accessToken: 'def345' })
      const decoded = Buffer.from(client.authHeader.replace('Bearer ', ''), 'base64').toString('ascii')
      expect(decoded).to.equal('def345')
    })

    describe('when the accessToken is a JWT', function () {
      function base64url (object) {
        return Buffer.from(JSON.stringify(object)).toString('base64')
          .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
      }

      const header = base64url({ alg: 'HS256', typ: 'JWT' })
      const payload = base64url({ sub: 'user123', aud: 'https://app.useanvil.com' })

      it('sends the JWT as-is', async function () {
        const accessToken = `${header}.${payload}.c2lnbmF0dXJl`
        const client = new Anvil({ accessToken })
        expect(client.authHeader).to.equal(`Bearer ${accessToken}`)
      })

      it('sends an unsigned JWT as-is', async function () {
        const accessToken = `${base64url({ alg: 'none' })}.${payload}.`
        const client = new Anvil({ accessToken })
        expect(client.authHeader).to.equal(`Bearer ${accessToken}`)
      })

      it('base64 encodes a token that only looks like a JWT', async function () {
        for (const accessToken of [
          'a.b.c',
          `${header}.${payload}`,
          `${header}.${payload}.sig.extra`,
          `${base64url({ typ: 'JWT' })}.${payload}.sig`,
          `${header}.${base64url('a string')}.sig`,
          `${header}.not-json.sig`,
        ]) {
          const client = new Anvil({ accessToken })
          expect(client.authHeader).to.equal(`Bearer ${Buffer.from(accessToken, 'ascii').toString('base64')}`)
        }
      })
    })

    it('prefers the accessToken when both apiKey and accessToken passed in', async function () {
      const client = new Anvil({ apiKey: 'abc123', accessToken: 'def345' })
      expect(client.authHeader).to.equal(`Bearer ${Buffer.from('def345', 'ascii').toString('base64')}`)
    })

    it('defaults the baseURL to production', async function () {
      const client = new Anvil({ apiKey: 'abc123' })
      expect(client.options.baseURL).to.equal('https://app.useanvil.com')
      expect(client._url('/graphql')).to.equal('https://app.useanvil.com/graphql')
    })

    it('accepts a custom baseURL', async function () {
      const client = new Anvil({ apiKey: 'abc123', baseURL: 'https://staging.useanvil.com' })
      expect(client.options.baseURL).to.equal('https://staging.useanvil.com')
      expect(client._url('/graphql')).to.equal('https://staging.useanvil.com/graphql')
    })

    it('accepts baseUrl as another spelling of baseURL', async function () {
      const client = new Anvil({ apiKey: 'abc123', baseUrl: 'https://staging.useanvil.com' })
      expect(client.options.baseURL).to.equal('https://staging.useanvil.com')
      expect(client.options).to.not.have.property('baseUrl')
    })

    it('prefers baseURL when both spellings are given', async function () {
      const client = new Anvil({ apiKey: 'abc123', baseURL: 'https://a.example.com', baseUrl: 'https://b.example.com' })
      expect(client.options.baseURL).to.equal('https://a.example.com')
    })

    it('starts with a limit of 1 request per second', async function () {
      const client = new Anvil({ apiKey: 'abc123' })
      expect(client.limitTokens).to.equal(1)
      expect(client.limitIntervalMs).to.equal(1000)
    })

    it('accepts custom starting rate limits', async function () {
      const client = new Anvil({ apiKey: 'abc123', requestLimit: 5, requestLimitMS: 500 })
      expect(client.limitTokens).to.equal(5)
      expect(client.limitIntervalMs).to.equal(500)
    })
  })

  describe('version constants', function () {
    it('exposes VERSION_LATEST as -1', function () {
      expect(Anvil.VERSION_LATEST).to.equal(-1)
    })

    it('exposes VERSION_LATEST_PUBLISHED as -2', function () {
      expect(Anvil.VERSION_LATEST_PUBLISHED).to.equal(-2)
    })
  })

  describe('REST endpoints', function () {
    let client

    beforeEach(async function () {
      client = new Anvil({ apiKey: 'abc123' })
      sinon.stub(client, '_request')
    })

    describe('requestREST', function () {
      let options, clientOptions, data, result

      it('returns statusCode and data when specified', async function () {
        options = {
          method: 'POST',
        }
        clientOptions = {
          dataType: 'json',
        }
        data = { result: 'ok' }

        client._request.callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: 200,
              json: data,
              headers: { 'content-type': 'application/json' },
            }),
          )
        })
        const result = await client.requestREST('/test', options, clientOptions)

        expect(client._request).to.have.been.calledOnce
        expect(result.statusCode).to.eql(200)
        expect(result.data).to.eql(data)
      })

      it('rejects promise when error', async function () {
        options = { method: 'POST' }

        client._request.callsFake((url, options) => {
          throw new Error('problem')
        })

        await expect(client.requestREST('/test', options)).to.eventually.have.been.rejectedWith('problem')
      })

      it('handles various error response structures', async function () {
        options = {
          method: 'GET',
        }
        clientOptions = {
          dataType: 'json',
        }

        const errors = [
          {
            name: 'AssertionError',
            message: 'PDF did not generate properly from given HTML!',
          },
          {
            name: 'ValidationError',
            fields: [{ message: 'Required', property: 'data' }],
          },
        ]

        for (const error of errors) {
          client._request.callsFake((url, options) => {
            return Promise.resolve(
              mockNodeFetchResponse({
                // Some calls (like those to GraphQL) will return 200 / OKs but actually contain
                // errors
                status: 200,
                statusText: 'OK',
                json: () => error,
                headers: { 'content-type': 'application/json' },
              }),
            )
          })

          const result = await client.requestREST('/some-endpoint', options, clientOptions)
          expect(result.statusCode).to.eql(200)
          expect(result.errors).to.eql([error])
        }
      })

      it('recovers when JSON parsing of error response fails AND gives default error structure', async function () {
        options = {
          method: 'GET',
        }
        clientOptions = {
          dataType: 'json',
        }

        client._request.callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: 404,
              statusText: 'Not Found',
              json: () => JSON.parse('will not parse'),
            }),
          )
        })

        const result = await client.requestREST('/non-existing-endpoint', options, clientOptions)
        expect(result.statusCode).to.eql(404)
        expect(result.errors).to.be.an('array').of.length(1)
        expect(result.errors[0]).to.include({
          name: 'SyntaxError',
          code: undefined,
          cause: undefined,
        })
        // The wording of this message changed in Node 20
        expect(result.errors[0].message).to.match(/^Unexpected token/)
      })

      it('sets the rate limiter from the response headers', async function () {
        // Originally, these are true
        expect(client.hasSetLimiterFromResponse).to.eql(false)
        expect(client.limiterSettingInProgress).to.eql(false)
        expect(client.rateLimiterSetupPromise).to.be.an.instanceof(Promise)
        expect(client.limitTokens).to.eql(1)
        expect(client.limitIntervalMs).to.eql(1000)

        client._request.callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: 200,
              json: data,
              headers: {
                'x-ratelimit-limit': 42,
                'x-ratelimit-interval-ms': 4200,
              },
            }),
          )
        })

        const result = await client.requestREST('/test', options, clientOptions)

        // Afterwards, these are true
        expect(client._request).to.have.been.calledOnce
        expect(result.statusCode).to.eql(200)
        expect(result.data).to.eql(data)

        expect(client.hasSetLimiterFromResponse).to.eql(true)
        expect(client.limitTokens).to.eql(42)
        expect(client.limitIntervalMs).to.eql(4200)
      })

      it('retries when a 429 response', async function () {
        options = { method: 'POST' }
        clientOptions = { dataType: 'json' }
        data = { result: 'ok' }

        client._request.onCall(0).callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: 429,
              headers: {
                'retry-after': '0.2', // in seconds
              },
            }),
          )
        })

        client._request.onCall(1).callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: 200,
              json: data,
            }),
          )
        })

        result = await client.requestREST('/test', options, clientOptions)

        expect(client._request).to.have.been.calledTwice
        expect(result.statusCode).to.eql(200)
        expect(result.data).to.eql(data)
      })
    })

    describe('fillPDF', function () {
      def('statusCode', 200)

      beforeEach(async function () {
        client._request.callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: $.statusCode,
              buffer: $.buffer,
              json: $.json,
            }),
          )
        })
      })

      context('everything goes well', function () {
        def('buffer', 'This would be PDF data...')
        def('payload', {
          title: 'Test',
          fontSize: 8,
          textColor: '#CC0000',
          data: {
            helloId: 'hello!',
          },
        })

        it('returns data', async function () {
          const payload = $.payload
          const result = await client.fillPDF('cast123', payload)

          expect(result.statusCode).to.eql(200)
          expect(result.data.toString()).to.eql('This would be PDF data...')

          expect(client._request).to.have.been.calledOnce

          const [url, options] = client._request.lastCall.args
          expect(url).to.eql('/api/v1/fill/cast123.pdf')
          expect(options).to.eql({
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
              'Content-Type': 'application/json',
            },
          })
        })

        it('works with `versionNumber`', async function () {
          const payload = $.payload
          const result = await client.fillPDF('cast123', payload, { versionNumber: 5 })

          expect(result.statusCode).to.eql(200)
          expect(result.data.toString()).to.eql('This would be PDF data...')

          expect(client._request).to.have.been.calledOnce

          const [url, options] = client._request.lastCall.args
          expect(url).to.eql('/api/v1/fill/cast123.pdf?versionNumber=5')
          expect(options).to.eql({
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
              'Content-Type': 'application/json',
            },
          })
        })
      })

      context('server 400s with errors array in JSON', function () {
        const errors = [{ message: 'problem' }]
        def('statusCode', 400)
        def('json', { errors })

        it('finds errors and puts them in response', async function () {
          const result = await client.fillPDF('cast123', {})

          expect(client._request).to.have.been.calledOnce
          expect(result.statusCode).to.eql(400)
          expect(result.errors).to.eql(errors)
        })
      })

      context('server 401s with single error in response', function () {
        const error = { name: 'AuthorizationError', message: 'problem' }
        def('statusCode', 401)
        def('json', error)

        it('finds error and puts it in the response', async function () {
          const result = await client.fillPDF('cast123', {})

          expect(client._request).to.have.been.calledOnce
          expect(result.statusCode).to.eql(401)
          expect(result.errors).to.eql([error])
        })
      })
    })

    describe('generatePDF', function () {
      def('statusCode', 200)

      beforeEach(async function () {
        client._request.callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: $.statusCode,
              buffer: $.buffer,
              json: $.json,
            }),
          )
        })
      })

      context('everything goes well', function () {
        def('buffer', 'This would be PDF data...')

        it('returns data', async function () {
          const payload = {
            title: 'Test',
            data: [{
              label: 'hello!',
            }],
          }

          const result = await client.generatePDF(payload)

          expect(result.statusCode).to.eql(200)
          expect(result.data.toString()).to.eql('This would be PDF data...')

          expect(client._request).to.have.been.calledOnce

          const [url, options] = client._request.lastCall.args
          expect(url).to.eql('/api/v1/generate-pdf')
          expect(options).to.eql({
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
              'Content-Type': 'application/json',
            },
          })
        })
      })

      context('server 400s with errors array in JSON', function () {
        const errors = [{ message: 'problem' }]
        def('statusCode', 400)
        def('json', { errors })

        it('finds errors and puts them in response', async function () {
          const result = await client.generatePDF('cast123', {})

          expect(client._request).to.have.been.calledOnce
          expect(result.statusCode).to.eql(400)
          expect(result.errors).to.eql(errors)
        })
      })

      context('server 401s with single error in response', function () {
        const error = { name: 'AuthorizationError', message: 'Not logged in.' }
        def('statusCode', 401)
        def('json', error)

        it('finds error and puts it in the response', async function () {
          const result = await client.generatePDF('cast123', {})

          expect(client._request).to.have.been.calledOnce
          expect(result.statusCode).to.eql(401)
          expect(result.errors).to.eql([error])
        })
      })
    })

    describe('downloadDocuments', function () {
      def('statusCode', 200)
      def('buffer', 'This would be Zip file data buffer...')
      def('body', () => new ReadableStream({
        start (controller) {
          controller.enqueue(Buffer.from('This would be Zip file data stream'))
          controller.close()
        },
      }))
      def('nodeFetchResponse', () => mockNodeFetchResponse({
        status: $.statusCode,
        buffer: $.buffer,
        body: $.body,
        json: $.json,
      }))

      beforeEach(async function () {
        client._request.callsFake((url, options) => {
          return Promise.resolve($.nodeFetchResponse)
        })
      })

      context('everything goes well', function () {
        it('returns data as buffer', async function () {
          const { statusCode, response, data, errors } = await client.downloadDocuments('docGroupEid123')
          expect(data).to.be.an.instanceOf(Buffer)
          expect(statusCode).to.eql(200)
          expect(response).to.deep.eql($.nodeFetchResponse)
          expect(data.toString()).to.eql($.buffer)
          expect(errors).to.be.undefined
        })

        it('returns data asn arrayBuffer', async function () {
          const { statusCode, response, data, errors } = await client.downloadDocuments('docGroupEid123', { dataType: 'arrayBuffer' })
          expect(data).to.be.an.instanceOf(ArrayBuffer)
          expect(statusCode).to.eql(200)
          expect(response).to.deep.eql($.nodeFetchResponse)
          expect(Buffer.from(data).toString()).to.eql($.buffer)
          expect(errors).to.be.undefined
        })

        it('returns data as stream', async function () {
          const { statusCode, response, data, errors } = await client.downloadDocuments('docGroupEid123', { dataType: 'stream' })
          expect(statusCode).to.eql(200)
          expect(response).to.deep.eql($.nodeFetchResponse)
          // A Node stream, made from the response's web stream
          expect(data).to.be.an.instanceof(Readable)
          const chunks = []
          for await (const chunk of data) chunks.push(chunk)
          expect(Buffer.concat(chunks).toString()).to.eql('This would be Zip file data stream')
          expect(errors).to.be.undefined
        })
      })

      context('unsupported options', function () {
        it('raises appropriate error', async function () {
          try {
            await client.downloadDocuments('docGroupEid123', { dataType: 'json' })
          } catch (e) {
            expect(e.message).to.eql('dataType must be one of: stream|buffer|arrayBuffer')
          }
        })
      })

      context('server 400s with errors array in JSON', function () {
        const errors = [{ message: 'problem' }]
        def('statusCode', 400)
        def('json', { errors })

        it('finds errors and puts them in response', async function () {
          const { statusCode, errors } = await client.downloadDocuments('docGroupEid123')

          expect(client._request).to.have.been.calledOnce
          expect(statusCode).to.eql(400)
          expect(errors).to.eql(errors)
        })
      })

      context('server 401s with single error in response', function () {
        const error = { name: 'AuthorizationError', message: 'problem' }
        def('statusCode', 401)
        def('json', error)

        it('finds error and puts it in the response', async function () {
          const { statusCode, errors } = await client.downloadDocuments('docGroupEid123')

          expect(client._request).to.have.been.calledOnce
          expect(statusCode).to.eql(401)
          expect(errors).to.eql([error])
        })
      })
    })
  })

  describe('GraphQL', function () {
    const client = new Anvil({ apiKey: 'abc123' })

    describe('requestGraphQL', function () {
      beforeEach(function () {
        sinon.stub(client, '_wrapRequest')
        client._wrapRequest.callsFake(async () => ({}))
        sinon.stub(client, '_request')
      })

      describe('without files', function () {
        it('stringifies query and variables', async function () {
          const query = { foo: 'bar' }
          const variables = { baz: 'bop' }
          const clientOptions = { yo: 'mtvRaps' }

          await client.requestGraphQL({ query, variables }, clientOptions)

          expect(client._wrapRequest).to.have.been.calledOnce

          const [fn, clientOptionsReceived] = client._wrapRequest.lastCall.args
          expect(clientOptions).to.eql(clientOptionsReceived)

          fn()

          expect(client._request).to.have.been.calledOnce
          const [, options] = client._request.lastCall.args
          const {
            method,
            headers,
            body,
          } = options

          expect(method).to.eql('POST')
          expect(headers).to.eql({ 'Content-Type': 'application/json' })
          expect(body).to.eql(JSON.stringify({ query, variables }))
        })
      })

      describe('with files', function () {
        beforeEach(function () {
          sinon.spy(FormData.prototype, 'append')
        })

        describe('schema is good', function () {
          const query = { foo: 'bar', baz: null }
          const clientOptions = { yo: 'mtvRaps' }

          afterEach(function () {
            if ($.willFail) {
              expect(client._wrapRequest).to.not.have.been.called
              return
            }

            expect(client._wrapRequest).to.have.been.calledOnce

            const [fn, clientOptionsReceived] = client._wrapRequest.lastCall.args
            expect(clientOptions).to.eql(clientOptionsReceived)

            fn()

            expect(client._request).to.have.been.calledOnce
            const [, options] = client._request.lastCall.args

            const {
              method,
              headers,
              body,
              signal,
            } = options

            expect(method).to.eql('POST')
            if ($.isInlineUpload) {
              expect(headers).to.eql({
                'Content-Type': 'application/json',
              })
              // Vars are untouched
              expect(JSON.parse(body).variables).to.eql($.variables)
            } else {
              expect(headers).to.eql({}) // node-fetch will add appropriate header
              expect(body).to.be.an.instanceof(FormData)
              expect(signal).to.be.an.instanceof(AbortSignal)
              expect(
                FormData.prototype.append.withArgs(
                  'map',
                  JSON.stringify({ 1: ['variables.aNested.file'] }),
                ),
              ).calledOnce
            }
          })

          context('using a Buffer', function () {
            def('variables', () => ({
              aNested: {
                file: Anvil.prepareGraphQLFile(Buffer.from(''), { filename: 'test.pdf' }),
              },
            }))

            it('creates a FormData and appends the files map when prepareGraphQLFile was used', async function () {
              await client.requestGraphQL({ query, variables: $.variables }, clientOptions)
            })

            context('file is a Buffer', function () {
              def('willFail', () => true)
              def('variables', () => ({
                aNested: {
                  file: Buffer.from(''),
                },
              }))

              it('throws an error creating a FormData and appending to the files map when a raw Buffer is used', async function () {
                await expect(client.requestGraphQL({ query, variables: $.variables }, clientOptions))
                  .to.eventually.be.rejectedWith('When passing a Buffer to prepareGraphQLFile, `options.filename` must be provided')
              })
            })
          })

          context('file is a Stream', function () {
            def('variables', () => {
              const file = fs.createReadStream(path.join(assetsDir, 'dummy.pdf'))
              return {
                aNested: {
                  file,
                },
              }
            })

            it('creates a FormData and appends the files map', async function () {
              await client.requestGraphQL({ query, variables: $.variables }, clientOptions)
            })
          })

          context('file is a base64 upload', function () {
            def('isInlineUpload', () => true)
            def('variables', () => {
              return {
                aNested: {
                  file: {
                    data: Buffer.from('Base64 Data').toString('base64'),
                    filename: 'omgwow.pdf',
                    mimetype: 'application/pdf',
                  },
                },
              }
            })

            it('does not touch the variables at all', async function () {
              await client.requestGraphQL({ query, variables: $.variables }, clientOptions)
            })
          })

          context('file is a URL upload', function () {
            def('isInlineUpload', () => true)
            def('variables', () => {
              return {
                aNested: {
                  file: {
                    url: 'https://example.com/omgwow.pdf',
                    filename: 'omgwow.pdf',
                  },
                },
              }
            })

            it('does not touch the variables at all', async function () {
              await client.requestGraphQL({ query, variables: $.variables }, clientOptions)
            })

            context('without a filename', function () {
              def('variables', () => {
                return {
                  aNested: {
                    file: {
                      url: 'https://example.com/omgwow.pdf',
                    },
                  },
                }
              })

              it('does not touch the variables at all', async function () {
                await client.requestGraphQL({ query, variables: $.variables }, clientOptions)
              })
            })
          })
        })

        describe('schema is not good', function () {
          context('file is not a stream or buffer', function () {
            it('throws error about the schema', async function () {
              const query = { foo: 'bar' }
              const variables = {
                file: 'i am not a file',
              }

              await expect(client.requestGraphQL({ query, variables })).to.eventually.be.rejectedWith('Invalid File schema detected')
            })
          })
        })
      })
    })

    describe('createEtchPacket', function () {
      beforeEach(function () {
        sinon.stub(client, 'requestGraphQL')
      })

      context('mutation is specified', function () {
        it('calls requestGraphQL with overridden mutation', async function () {
          const variables = { foo: 'bar' }
          const mutationOverride = 'createEtchPacketOverride()'

          await client.createEtchPacket({ variables, mutation: mutationOverride })

          expect(client.requestGraphQL).to.have.been.calledOnce
          const [options, clientOptions] = client.requestGraphQL.lastCall.args

          const {
            query,
            variables: variablesReceived,
          } = options

          expect(variables).to.eql(variablesReceived)
          expect(query).to.include(mutationOverride)
          expect(clientOptions).to.eql({ dataType: 'json' })
        })
      })

      context('no responseQuery specified', function () {
        it('calls requestGraphQL with default responseQuery', async function () {
          const variables = { foo: 'bar' }

          await client.createEtchPacket({ variables })

          expect(client.requestGraphQL).to.have.been.calledOnce
          const [options, clientOptions] = client.requestGraphQL.lastCall.args

          const {
            query,
            variables: variablesReceived,
          } = options

          expect(variables).to.eql(variablesReceived)
          expect(query).to.include('documentGroup {') // "documentGroup" is in the default responseQuery
          expect(clientOptions).to.eql({ dataType: 'json' })
        })
      })

      context('responseQuery specified', function () {
        it('calls requestGraphQL with overridden responseQuery', async function () {
          const variables = { foo: 'bar' }
          const responseQuery = 'onlyInATest {}'

          await client.createEtchPacket({ variables, responseQuery })

          expect(client.requestGraphQL).to.have.been.calledOnce
          const [options, clientOptions] = client.requestGraphQL.lastCall.args

          const {
            query,
            variables: variablesReceived,
          } = options

          expect(variables).to.eql(variablesReceived)
          expect(query).to.include(responseQuery)
          expect(clientOptions).to.eql({ dataType: 'json' })
        })
      })
    })

    describe('generateEtchSignUrl', function () {
      def('statusCode', 200)
      beforeEach(async function () {
        sinon.stub(client, '_request')
        client._request.callsFake((url, options) => {
          return Promise.resolve($.nodeFetchResponse)
        })
      })

      context('everything goes well', function () {
        def('data', {
          data: {
            generateEtchSignURL: 'http://www.testing.com',
          },
        })
        def('nodeFetchResponse', () => mockNodeFetchResponse({
          status: $.statusCode,
          json: $.data,
        }))

        it('returns url successfully', async function () {
          const variables = { clientUserId: 'foo', signerEid: 'bar' }
          const { statusCode, url, errors } = await client.generateEtchSignUrl({ variables })
          expect(statusCode).to.eql(200)
          expect(url).to.be.eql($.data.data.generateEtchSignURL)
          expect(errors).to.be.undefined
        })
      })

      context('generate URL failures', function () {
        def('data', {
          data: {},
        })
        def('nodeFetchResponse', () => mockNodeFetchResponse({
          status: $.statusCode,
          json: $.data,
        }))

        it('returns undefined url', async function () {
          const variables = { clientUserId: 'foo', signerEid: 'bar' }
          const { statusCode, url, errors } = await client.generateEtchSignUrl({ variables })
          expect(statusCode).to.eql(200)
          expect(url).to.be.undefined
          expect(errors).to.be.undefined
        })
      })
    })

    describe('method names', function () {
      // Each method with an acronym in its name is also available with the acronym in
      // plain camel case, and vice versa
      const ACRONYMS = { PDF: ['Pdf'], URL: ['Url'], REST: ['Rest'], GraphQL: ['Graphql', 'GraphQl'] }
      const twinsOf = (name) => {
        const twins = []
        for (const [acronym, camels] of Object.entries(ACRONYMS)) {
          const spellings = [acronym, ...camels]
          const spelled = spellings.find((spelling) => name.includes(spelling))
          if (!spelled) continue
          for (const spelling of spellings) {
            const twin = name.split(spelled).join(spelling)
            if (twin !== name) twins.push(twin)
          }
        }
        return twins
      }
      const publicMethods = (target) => Object.getOwnPropertyNames(target)
        .filter((name) => !name.startsWith('_') && !['constructor', 'prototype'].includes(name))
        .filter((name) => typeof Object.getOwnPropertyDescriptor(target, name).value === 'function')

      for (const [label, target] of [['instance', Anvil.prototype], ['static', Anvil]]) {
        it(`every ${label} method has its twin`, function () {
          const names = publicMethods(target)
          expect(names.length).to.be.above(0)
          for (const name of names) {
            for (const twin of twinsOf(name)) {
              expect(target[twin], `${name} should also be available as ${twin}`).to.be.a('function')
            }
          }
        })
      }

      const TWINS = [
        ['fillPDF', 'fillPdf'],
        ['generatePDF', 'generatePdf'],
        ['generateEtchSignUrl', 'generateEtchSignURL'],
        ['requestGraphQL', 'requestGraphql'],
        ['requestGraphQL', 'requestGraphQl'],
        ['requestREST', 'requestRest'],
      ]

      for (const [original, twin] of TWINS) {
        it(`${twin} calls ${original} with the same arguments`, async function () {
          sinon.stub(client, original).resolves('the result')
          const result = await client[twin]('arg1', { arg: 2 }, 'arg3')
          expect(client[original]).to.have.been.calledOnceWithExactly('arg1', { arg: 2 }, 'arg3')
          expect(result).to.eql('the result')
        })
      }

      for (const twin of ['prepareGraphqlFile', 'prepareGraphQlFile']) {
        it(`${twin} calls prepareGraphQLFile with the same arguments`, function () {
          sinon.stub(Anvil, 'prepareGraphQLFile').returns('the result')
          const result = Anvil[twin]('path.pdf', { filename: 'a.pdf' })
          expect(Anvil.prepareGraphQLFile).to.have.been.calledOnceWithExactly('path.pdf', { filename: 'a.pdf' })
          expect(result).to.eql('the result')
        })
      }
    })

    describe('getEtchPacket', function () {
      def('variables', { eid: 'etchPacketEid123' })
      beforeEach(function () {
        sinon.stub(client, 'requestGraphQL')
      })

      context('no responseQuery specified', function () {
        it('calls requestGraphQL with default responseQuery', async function () {
          await client.getEtchPacket({ variables: $.variables })

          expect(client.requestGraphQL).to.have.been.calledOnce
          const [options, clientOptions] = client.requestGraphQL.lastCall.args

          const {
            query,
            variables: variablesReceived,
          } = options

          expect($.variables).to.eql(variablesReceived)
          expect(query).to.include('documentGroup {')
          expect(clientOptions).to.eql({ dataType: 'json' })
        })
      })

      context('responseQuery specified', function () {
        it('calls requestGraphQL with overridden responseQuery', async function () {
          const responseQuery = 'myCustomResponseQuery'
          await client.getEtchPacket({ variables: $.variables, responseQuery })

          expect(client.requestGraphQL).to.have.been.calledOnce
          const [options, clientOptions] = client.requestGraphQL.lastCall.args

          const {
            query,
            variables: variablesReceived,
          } = options

          expect($.variables).to.eql(variablesReceived)
          expect(query).to.include(responseQuery)
          expect(clientOptions).to.eql({ dataType: 'json' })
        })
      })
    })

    describe('forgeSubmit', function () {
      beforeEach(function () {
        sinon.stub(client, 'requestGraphQL')
      })

      it('calls requestGraphQL with overridden mutation', async function () {
        const variables = { foo: 'bar' }
        const mutationOverride = 'forgeSubmitOverride()'

        await client.forgeSubmit({ variables, mutation: mutationOverride })

        expect(client.requestGraphQL).to.have.been.calledOnce
        const [options, clientOptions] = client.requestGraphQL.lastCall.args

        const {
          query,
          variables: variablesReceived,
        } = options

        expect(variables).to.eql(variablesReceived)
        expect(query).to.include(mutationOverride)
        expect(clientOptions).to.eql({ dataType: 'json' })
      })

      it('calls requestGraphQL with default responseQuery', async function () {
        const variables = { foo: 'bar' }
        await client.forgeSubmit({ variables })

        expect(client.requestGraphQL).to.have.been.calledOnce
        const [options, clientOptions] = client.requestGraphQL.lastCall.args

        const {
          query,
          variables: variablesReceived,
        } = options

        expect(variables).to.eql(variablesReceived)
        expect(query).to.include('signer {')
        expect(clientOptions).to.eql({ dataType: 'json' })
      })

      it('calls requestGraphQL with overridden responseQuery', async function () {
        const variables = { foo: 'bar' }
        const customResponseQuery = 'myCustomResponseQuery'
        await client.forgeSubmit({ variables, responseQuery: customResponseQuery })

        expect(client.requestGraphQL).to.have.been.calledOnce
        const [options, clientOptions] = client.requestGraphQL.lastCall.args

        const {
          query,
          variables: variablesReceived,
        } = options

        expect(variables).to.eql(variablesReceived)
        expect(query).to.include(customResponseQuery)
        expect(clientOptions).to.eql({ dataType: 'json' })
      })
    })

    describe('removeWeldData', function () {
      beforeEach(function () {
        sinon.stub(client, 'requestGraphQL')
      })

      it('calls requestGraphQL with overridden mutation', async function () {
        const variables = { foo: 'bar' }
        const mutationOverride = 'removeWeldDataOverride()'

        await client.removeWeldData({ variables, mutation: mutationOverride })

        expect(client.requestGraphQL).to.have.been.calledOnce
        const [options, clientOptions] = client.requestGraphQL.lastCall.args

        const {
          query,
          variables: variablesReceived,
        } = options

        expect(variables).to.eql(variablesReceived)
        expect(query).to.include(mutationOverride)
        expect(clientOptions).to.eql({ dataType: 'json' })
      })
    })
  })

  describe('prepareGraphQLFile', function () {
    it('works', function () {
      expect(() =>
        Anvil.prepareGraphQLFile(Buffer.from('test')),
      ).to.throw('When passing a Buffer to prepareGraphQLFile, `options.filename` must be provided. If you think you can ignore this, please pass `options.ignoreFilenameValidation` as `true`.')

      let uploadWithOptions = Anvil.prepareGraphQLFile(Buffer.from('test'), { ignoreFilenameValidation: true })
      expect(uploadWithOptions).to.be.ok
      expect(uploadWithOptions.streamLikeThing).to.be.ok
      expect(uploadWithOptions.formDataAppendOptions).to.eql({})

      uploadWithOptions = Anvil.prepareGraphQLFile(Buffer.from('test'), { filename: 'test.pdf' })
      expect(uploadWithOptions).to.be.ok
      expect(uploadWithOptions.streamLikeThing).to.be.ok
      expect(uploadWithOptions.formDataAppendOptions).to.include({
        filename: 'test.pdf',
      })
    })

    it('returns an UploadWithOptions', function () {
      const uploadWithOptions = Anvil.prepareGraphQLFile(Buffer.from('test'), { filename: 'test.pdf' })
      expect(uploadWithOptions).to.be.an.instanceof(Anvil.UploadWithOptions)
      expect(uploadWithOptions.file).to.equal(uploadWithOptions.streamLikeThing)
      expect(uploadWithOptions.options).to.equal(uploadWithOptions.formDataAppendOptions)
    })

    it('accepts a path to a file without a filename', function () {
      const filePath = path.join(assetsDir, 'dummy.pdf')
      const uploadWithOptions = Anvil.prepareGraphQLFile(filePath)
      expect(uploadWithOptions.file).to.equal(filePath)
      expect(uploadWithOptions.options).to.eql({})
    })

    it('accepts a file stream without a filename', function () {
      const stream = fs.createReadStream(path.join(assetsDir, 'dummy.pdf'))
      const uploadWithOptions = Anvil.prepareGraphQLFile(stream)
      expect(uploadWithOptions.file).to.equal(stream)
      stream.destroy()
    })

    it('accepts a File-like object with a name without a filename', function () {
      const file = { name: 'from-a-file.pdf' }
      const uploadWithOptions = Anvil.prepareGraphQLFile(file)
      expect(uploadWithOptions.file).to.equal(file)
    })

    it('requires a filename for things that do not have a name or path', function () {
      class Blobby {}
      expect(() => Anvil.prepareGraphQLFile(new Blobby()))
        .to.throw('When passing a Blobby to prepareGraphQLFile, `options.filename` must be provided.')
    })

    it('passes the filename and mimetype through, but not ignoreFilenameValidation', function () {
      const uploadWithOptions = Anvil.prepareGraphQLFile(Buffer.from('test'), {
        filename: 'test.pdf',
        mimetype: 'application/pdf',
        ignoreFilenameValidation: true,
      })
      expect(uploadWithOptions.options).to.eql({
        filename: 'test.pdf',
        mimetype: 'application/pdf',
      })
    })
  })
})
