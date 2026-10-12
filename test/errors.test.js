import {
  looksLikeJsonError,
  normalizeJsonErrors,
  normalizeNodeError,
} from '../src/errors'

describe('errors', function () {
  describe('looksLikeJsonError', function () {
    it('is true for a GraphQL errors array', function () {
      expect(looksLikeJsonError({ json: { errors: [{ message: 'problem' }] } })).to.eql(true)
    })

    it('is true for a single REST error with a message', function () {
      expect(looksLikeJsonError({ json: { message: 'problem' } })).to.eql(true)
    })

    it('is true for a single REST error with only a name', function () {
      expect(looksLikeJsonError({ json: { name: 'ValidationError', fields: [] } })).to.eql(true)
    })

    it('is false for successful data', function () {
      expect(looksLikeJsonError({ json: { data: { currentUser: { eid: 'abc' } } } })).to.eql(false)
    })

    it('is false for an empty object', function () {
      expect(looksLikeJsonError({ json: {} })).to.eql(false)
    })

    it('is false when there is no JSON', function () {
      expect(looksLikeJsonError({ json: undefined })).to.eql(false)
      expect(looksLikeJsonError({ json: null })).to.eql(false)
    })
  })

  describe('normalizeJsonErrors', function () {
    it('returns the GraphQL errors array as-is', function () {
      const errors = [
        { message: 'Not found', path: ['etchPacket'], locations: [{ line: 1, column: 3 }] },
        { message: 'Another problem' },
      ]
      expect(normalizeJsonErrors({ json: { data: null, errors } })).to.equal(errors)
    })

    it('wraps a single REST error in an array', function () {
      const error = { name: 'AssertionError', message: 'PDF did not generate properly from given HTML!' }
      expect(normalizeJsonErrors({ json: error })).to.eql([error])
    })

    it('keeps field-level details on validation errors', function () {
      const error = {
        name: 'ValidationError',
        fields: [{ message: 'Required', property: 'data' }],
      }
      const [normalized] = normalizeJsonErrors({ json: error })
      expect(normalized.fields).to.eql([{ message: 'Required', property: 'data' }])
    })

    it('falls back to the status text when there is no JSON', function () {
      expect(normalizeJsonErrors({ json: undefined, statusText: 'Bad Gateway' })).to.eql([
        { name: 'Bad Gateway', message: 'Bad Gateway' },
      ])
    })

    it('falls back to the status text when the JSON has no error fields', function () {
      expect(normalizeJsonErrors({ json: {}, statusText: 'Internal Server Error' })).to.eql([
        { name: 'Internal Server Error', message: 'Internal Server Error' },
      ])
    })

    it('defaults to "Unknown Error" without a status text', function () {
      expect(normalizeJsonErrors({ json: undefined })).to.eql([
        { name: 'Unknown Error', message: 'Unknown Error' },
      ])
    })
  })

  describe('normalizeNodeError', function () {
    it('picks the useful properties off of an Error', function () {
      const cause = new Error('root cause')
      const error = new Error('connect ECONNREFUSED', { cause })
      error.code = 'ECONNREFUSED'
      error.extra = 'not included'

      const [normalized] = normalizeNodeError({ error })
      expect(normalized).to.have.all.keys('name', 'message', 'code', 'cause', 'stack')
      expect(normalized).to.include({
        name: 'Error',
        message: 'connect ECONNREFUSED',
        code: 'ECONNREFUSED',
        cause,
      })
      expect(normalized.stack).to.be.a('string')
    })

    it('handles JSON parsing errors', function () {
      let error
      try {
        JSON.parse('')
      } catch (err) {
        error = err
      }

      const [normalized] = normalizeNodeError({ error })
      expect(normalized.name).to.eql('SyntaxError')
      expect(normalized.message).to.match(/JSON/)
    })

    it('falls back to the status text when there is no error', function () {
      expect(normalizeNodeError({ error: undefined, statusText: 'Bad Gateway' })).to.eql([
        { name: 'Bad Gateway', message: 'Bad Gateway' },
      ])
    })
  })
})
