import Anvil from '../src/index'

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
      let options, response, data, result
      it('returns statusCode and data when specified', async function () {
        options = { method: 'POST' }
        response = { statusCode: 200 }
        data = { result: 'ok' }
        client.request.callsFake((options, cb) => cb(null, response, data))
        result = await client.requestREST('/test', options)
        expect(result).to.eql({
          statusCode: response.statusCode,
          data,
        })
      })

      it('rejects promise when error', async function () {
        options = { method: 'POST' }
        client.request.callsFake((options, cb) => cb(new Error('problem')))
        expect(client.requestREST('/test', options)).to.have.been.rejectedWith('problem')
      })
    })

    describe('fillPDF', function () {
      let response, data, result, payload

      beforeEach(async function () {
        response = { statusCode: 200 }
        data = 'The PDF file'
        client.request.callsFake((options, cb) => cb(null, response, data))
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
        expect(client.request.lastCall.args[0]).to.eql({
          encoding: null,
          headers: {
            Authorization: client.authHeader,
          },
          json: payload,
          method: 'POST',
          url: 'https://app.useanvil.com/api/v1/fill/cast123.pdf',
        })
      })
    })
  })
})
