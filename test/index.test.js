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
      sinon.stub(client, 'request')
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

        client.request.callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: 200,
              json: data,
            }),
          )
        })
        const result = await client.requestREST('/test', options, clientOptions)
        expect(result).to.eql({
          statusCode: 200,
          data,
        })
      })

      it('rejects promise when error', async function () {
        options = { method: 'POST' }

        client.request.callsFake((url, options) => {
          throw new Error('problem')
        })

        await expect(client.requestREST('/test', options)).to.eventually.have.been.rejectedWith('problem')
      })

      it('retries when a 429 response', async function () {
        options = { method: 'POST' }
        clientOptions = { dataType: 'json' }
        data = { result: 'ok' }
        const successResponse = { statusCode: 200 }

        client.request.onCall(0).callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: 429,
              headers: {
                'retry-after': '0.2', // in seconds
              },
            }),
          )
        })

        client.request.onCall(1).callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: 200,
              json: data,
            }),
          )
        })
        result = await client.requestREST('/test', options, clientOptions)
        expect(client.request).to.have.been.calledTwice
        expect(result).to.eql({
          statusCode: successResponse.statusCode,
          data,
        })
      })
    })

    describe('fillPDF', function () {
      let response, data, result, payload

      beforeEach(async function () {
        response = { statusCode: 200 }
        data = 'The PDF file'
        client.request.callsFake((url, options) => {
          return Promise.resolve(
            mockNodeFetchResponse({
              status: response.statusCode,
              buffer: data,
              json: data,
            }),
          )
        })
      })

      it('returns statusCode and data when specified', async function () {
        payload = {
          title: 'Test',
          fontSize: 8,
          textColor: '#CC0000',
          data: {
            helloId: 'hello!',
          },
        }

        result = await client.fillPDF('cast123', payload)
        expect(result).to.eql({
          statusCode: response.statusCode,
          data,
        })

        expect(client.request).to.have.been.calledOnce
        const [url, options] = client.request.lastCall.args
        expect(url).to.eql('/api/v1/fill/cast123.pdf')
        expect(options).to.eql({
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json',
            Authorization: client.authHeader,
          },
        })
      })

      it('returns errors when not status code 200', async function () {
        response = { statusCode: 400 }
        data = { errors: [{ message: 'problem' }] }
        payload = {}

        result = await client.fillPDF('cast123', payload)
        expect(result).to.eql({
          statusCode: response.statusCode,
          errors: data.errors,
        })
        expect(client.request).to.have.been.calledOnce
      })

      it('returns errors when not status code 200 and single error', async function () {
        response = { statusCode: 401 }
        data = { name: 'AuthorizationError', message: 'problem' }
        payload = {}

        result = await client.fillPDF('cast123', payload)
        expect(result).to.eql({
          statusCode: response.statusCode,
          errors: [data],
        })
        expect(client.request).to.have.been.calledOnce
      })
    })
  })
})
