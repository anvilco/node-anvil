const fs = require('fs')
const path = require('path')

const fetch = require('node-fetch')
const FormData = require('form-data')
const mime = require('mime-types')
const { extractFiles } = require('extract-files')
const { RateLimiter } = require('limiter')

const { version, description } = require('../package.json')

const {
  mutations: {
    createEtchPacket: {
      getMutation: getCreateEtchPacketMutation,
    },
  },
} = require('./graphql')

const DATA_TYPE_STREAM = 'stream'
const DATA_TYPE_BUFFER = 'buffer'
const DATA_TYPE_JSON = 'json'

const defaultOptions = {
  baseURL: 'https://app.useanvil.com',
  userAgent: `${description}/${version}`,
}

const failBufferMS = 50

class Anvil {
  // {
  //   apiKey: <yourAPIKey>,
  //   accessToken: <yourAPIKey>, // OR oauth access token
  //   baseURL: 'https://app.useanvil.com'
  //   userAgent: 'Anvil API Client/2.0.0'
  // }
  constructor (options) {
    if (!options) throw new Error('options are required')
    if (!options.apiKey && !options.accessToken) throw new Error('apiKey or accessToken required')

    this.options = Object.assign({}, defaultOptions, options)

    const { apiKey, accessToken } = this.options
    this.authHeader = accessToken
      ? `Bearer ${Buffer.from(accessToken, 'ascii').toString('base64')}`
      : `Basic ${Buffer.from(`${apiKey}:`, 'ascii').toString('base64')}`

    // Production apiKey rate limits: 200 in 5 seconds
    this.requestLimit = 200
    this.requestLimitMS = 5000
    this.limiter = new RateLimiter(this.requestLimit, this.requestLimitMS, true)
  }

  static addStream (pathOrStream) {
    if (typeof pathOrStream === 'string') {
      pathOrStream = fs.createReadStream(pathOrStream)
    }
    return this._prepareFile(pathOrStream)
  }

  static addBuffer (pathOrBuffer) {
    if (typeof pathOrBuffer === 'string') {
      pathOrBuffer = fs.readFileSync(pathOrBuffer)
    }
    return this._prepareFile(pathOrBuffer)
  }

  fillPDF (pdfTemplateID, payload, clientOptions = {}) {
    const supportedDataTypes = [DATA_TYPE_STREAM, DATA_TYPE_BUFFER]
    const { dataType = DATA_TYPE_BUFFER } = clientOptions
    if (dataType && !supportedDataTypes.includes(dataType)) {
      throw new Error(`dataType must be one of: ${supportedDataTypes.join('|')}`)
    }

    return this._requestREST(
      `/api/v1/fill/${pdfTemplateID}.pdf`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
      },
      {
        ...clientOptions,
        dataType,
      },
    )
  }

  // Just here for now to highlight authentication questions/concerns
  getCurrentUser () {
    const query = `
      query {
        currentUser {
          id
          email
        }
      }
    `
    return this._requestGraphQL({ query })
  }

  // QUESTION: maybe we want to keeep responseQuery to ourselves while we figure out how we want it to
  // feel to the Users?
  createEtchPacket ({ variables, responseQuery }) {
    return this._requestGraphQL(
      {
        query: getCreateEtchPacketMutation(responseQuery),
        variables,
      },
      { dataType: 'json' },
    )
  }

  // ******************************************************************************
  //     ___      _           __
  //    / _ \____(_)  _____ _/ /____
  //   / ___/ __/ / |/ / _ `/ __/ -_)
  //  /_/  /_/ /_/|___/\_,_/\__/\__/
  //
  // ALL THE BELOW CODE IS CONSIDERED PRIVATE, AND THE API OR INTERNALS MAY CHANGE AT ANY TIME
  // USERS OF THIS MODULE SHOULD NOT USE ANY OF THESE METHODS DIRECTLY
  // ******************************************************************************

  async _requestREST (url, options, clientOptions) {
    const {
      response,
      statusCode,
      data,
      errors,
    } = await this._wrapRequest(
      () => this._request(url, options),
      clientOptions,
    )

    return {
      response,
      statusCode,
      data,
      errors,
    }
  }

  async _requestGraphQL ({ query, variables = {} }, clientOptions) {
    // Some helpful resources on how this came to be:
    // https://github.com/jaydenseric/graphql-upload/issues/125#issuecomment-440853538
    // https://zach.codes/building-a-file-upload-hook/
    // https://github.com/jaydenseric/graphql-react/blob/1b1234de5de46b7a0029903a1446dcc061f37d09/src/universal/graphqlFetchOptions.mjs
    // https://www.npmjs.com/package/extract-files

    const options = {
      method: 'POST',
      headers: {
        // FIXME: How does /graphql auth work?
        Cookie: this.options.cookie,
      },
    }

    const operation = { query, variables }

    const {
      clone: augmentedOperation,
      files: filesMap,
    } = extractFiles(operation, '', isExtractableFile)

    const operationJSON = JSON.stringify(augmentedOperation)

    if (filesMap.size) {
      const form = new FormData()

      form.append('operations', operationJSON)

      const map = {}
      let i = 0
      filesMap.forEach(paths => {
        map[++i] = paths
      })
      form.append('map', JSON.stringify(map))

      i = 0
      filesMap.forEach((paths, file) => {
        form.append(`${++i}`, file)
      })

      options.body = form
    } else {
      options.headers['Content-Type'] = 'application/json'
      options.body = operationJSON
    }

    const {
      statusCode,
      data,
      errors,
    } = await this._wrapRequest(
      () => this._request('/graphql', options),
      clientOptions,
    )

    return {
      statusCode,
      data,
      errors,
    }
  }

  _request (url, options) {
    if (!url.startsWith(this.options.baseURL)) {
      url = this._url(url)
    }
    const opts = this._addDefaultHeaders(options)
    return fetch(url, opts)
  }

  async _wrapRequest (retryableRequestFn, clientOptions = {}) {
    return this._throttle(async (retry) => {
      const response = await retryableRequestFn()
      const statusCode = response.status

      if (statusCode >= 300) {
        if (statusCode === 429) {
          return retry(getRetryMS(response.headers.get('retry-after')))
        }

        const json = await response.json()
        const errors = json.errors || (json.message && [json])

        return errors ? { statusCode, errors } : { statusCode, ...json }
      }

      const { dataType } = clientOptions
      let data

      switch (dataType) {
        case DATA_TYPE_STREAM:
          data = response.body
          break
        case DATA_TYPE_BUFFER:
          data = await response.buffer()
          break
        case DATA_TYPE_JSON:
          data = await response.json()
          break
        default:
          console.warn('Using default response dataType of "json". Please specifiy a dataType.')
          data = await response.json()
          break
      }

      return {
        response,
        data,
        statusCode,
      }
    })
  }

  _url (path) {
    return this.options.baseURL + path
  }

  _addHeaders ({ options: existingOptions, headers: newHeaders }) {
    const { headers: existingHeaders = {} } = existingOptions
    return {
      ...existingOptions,
      headers: {
        ...existingHeaders,
        ...newHeaders,
      },
    }
  }

  _addDefaultHeaders (options) {
    const { userAgent } = this.options
    return this._addHeaders({
      options,
      headers: {
        'User-Agent': userAgent,
      },
    })
  }

  _throttle (fn) {
    return new Promise((resolve, reject) => {
      this.limiter.removeTokens(1, async (err, remainingRequests) => {
        if (err) reject(err)
        if (remainingRequests < 1) {
          await sleep(this.requestLimitMS + failBufferMS)
        }
        const retry = async (ms) => {
          await sleep(ms)
          return this._throttle(fn)
        }
        try {
          resolve(await fn(retry))
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  static _prepareFile (streamOrBuffer) {
    const fileName = this._getFilename(streamOrBuffer)
    const mimeType = this._getMimetype(streamOrBuffer)
    return {
      name: fileName,
      mimetype: mimeType,
      file: streamOrBuffer,
    }
  }

  static _getFilename (thing, options = {}) {
    // Very heavily influenced by:
    // https://github.com/form-data/form-data/blob/55d90ce4a4c22b0ea0647991d85cb946dfb7395b/lib/form_data.js#L217

    if (typeof options.filepath === 'string') {
      // custom filepath for relative paths
      return path.normalize(options.filepath).replace(/\\/g, '/')
    } else if (options.filename || thing.name || thing.path) {
      // custom filename take precedence
      // formidable and the browser add a name property
      // fs- and request- streams have path property
      return path.basename(options.filename || thing.name || thing.path)
    } else if (thing.readable && Object.prototype.hasOwnProperty.call(thing, 'httpVersion')) {
      // or try http response
      return path.basename(thing.client._httpMessage.path || '')
    }
  }

  static _getMimetype (thing, options = {}) {
    // Very heavily influenced by:
    // https://github.com/form-data/form-data/blob/55d90ce4a4c22b0ea0647991d85cb946dfb7395b/lib/form_data.js#L243

    // use custom content-type above all
    if (typeof options.mimeType === 'string') {
      return options.mimeType
    }

    // or try `name` from formidable, browser
    if (thing.name || thing.path) {
      return mime.lookup(thing.name || thing.path)
    }

    // or try `path` from fs-, request- streams
    if (thing.path) {
      mime.lookup(thing.path)
    }

    // or if it's http-reponse
    if (thing.readable && Object.prototype.hasOwnProperty.call(thing, 'httpVersion')) {
      return thing.headers['content-type'] || thing.headers['Content-Type']
    }

    // or guess it from the filepath or filename
    if ((options.filepath || options.filename)) {
      mime.lookup(options.filepath || options.filename)
    }

    // fallback to the default content type if `value` is not simple value
    if (typeof thing === 'object') {
      return 'application/octet-stream'
    }
  }
}

// https://www.npmjs.com/package/extract-files/v/6.0.0#type-extractablefilematcher
function isExtractableFile (value) {
  return value instanceof fs.ReadStream || value instanceof Buffer
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
