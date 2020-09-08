const Anvil = require('../src/index')

function mockNodeFetchResponse (options = {}) {
  const {
    status,
    json,
    buffer,
    headers,
  } = options

  const mock = {
    status,
  }

  if (json) {
    mock.json = () => json
  }

  if (buffer) {
    mock.buffer = () => buffer
  }

  if (headers) {
    mock.headers = {
      get: (header) => headers[header],
    }
  }

  return mock
}

describe('Anvil API Client', function () {
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

        it('returns data', async function () {
          const payload = {
            title: 'Test',
            fontSize: 8,
            textColor: '#CC0000',
            data: {
              helloId: 'hello!',
            },
          }

          const result = await client.fillPDF('cast123', payload)

          expect(result.statusCode).to.eql(200)
          expect(result.data).to.eql('This would be PDF data...')

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
  })

  describe('GraphQL', function () {

  })
})
