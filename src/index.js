import request from 'request'

const defaultOptions = {
  baseURL: 'https://app.useanvil.com',
}

export default class Anvil {
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
  }

  fillPDF (castEid, payload) {
    return this.requestREST(`/api/v1/fill/${castEid}.pdf`, {
      method: 'POST',
      json: payload,
      encoding: null,
      headers: { Authorization: this.authHeader },
    })
  }

  // Private

  requestREST (url, options) {
    const optionsWithURL = {
      ...options,
      url: this.url(url),
    }
    return new Promise((resolve, reject) => {
      this.request(optionsWithURL, function (error, response, data) {
        if (error) return reject(error)
        const statusCode = response.statusCode
        resolve({ statusCode, data })
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
