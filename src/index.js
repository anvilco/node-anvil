const request = require('request')
const RateLimiter = require('limiter').RateLimiter

const defaultOptions = {
  baseURL: 'https://app.useanvil.com',
}

const failBufferMS = 50

class Anvil {
  // {
  //   apiKey: <yourAPIKey>,
  //   accessToken: <yourAPIKey>, // OR oauth access token
  //   baseURL: 'https://app.useanvil.com'
  // }
  constructor (options) {
    if (!options) throw new Error('options are required')
    this.options = Object.assign({}, defaultOptions, options)
    if (!options.apiKey && !options.accessToken) throw new Error('apiKey or accessToken required')

    const { apiKey, accessToken } = this.options
    this.authHeader = accessToken
      ? `Bearer ${Buffer.from(accessToken, 'ascii').toString('base64')}`
      : `Basic ${Buffer.from(`${apiKey}:`, 'ascii').toString('base64')}`

    // Production apiKey rate limits: 200 in 5 seconds
    this.requestLimit = 200
    this.requestLimitMS = 5000
    this.limiter = new RateLimiter(this.requestLimit, this.requestLimitMS, true)
  }

  fillPDF (pdfTemplateID, payload) {
    return this.requestREST(`/api/v1/fill/${pdfTemplateID}.pdf`, {
      method: 'POST',
      json: payload,
      encoding: null,
      headers: { Authorization: this.authHeader },
    })
  }

  // Private

  async requestREST (url, options) {
    const optionsWithURL = {
      ...options,
      url: this.url(url),
    }

    return this.throttle(async (retry) => {
      const { response, data } = await this.requestPromise(optionsWithURL)
      const statusCode = response.statusCode
      if (statusCode === 429) {
        return retry(getRetryMS(response.headers['retry-after']))
      }
      if (statusCode >= 300) {
        const isObject = data && data.constructor.name === 'Object'
        if (isObject && data.errors) return { statusCode, ...data }
        else if (isObject && data.message) return { statusCode, errors: [data] }
      }
      return { statusCode, data }
    })
  }

  throttle (fn) {
    return new Promise((resolve, reject) => {
      this.limiter.removeTokens(1, async (err, remainingRequests) => {
        if (err) reject(err)
        if (remainingRequests < 1) {
          await sleep(this.requestLimitMS + failBufferMS)
        }
        const retry = async (ms) => {
          await sleep(ms)
          return this.throttle(fn)
        }
        try {
          resolve(await fn(retry))
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  requestPromise (options) {
    return new Promise((resolve, reject) => {
      this.request(options, function (error, response, data) {
        if (error) return reject(error)
        resolve({ response, data })
      })
    })
  }

  request (options, cb) {
    return request(options, cb)
  }

  url (path) {
    return this.options.baseURL + path
  }
}

function getRetryMS (retryAfterSeconds) {
  return Math.round((Math.abs(parseFloat(retryAfterSeconds)) || 0) * 1000) + failBufferMS
}

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

module.exports = Anvil
