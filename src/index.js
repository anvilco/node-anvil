const fs = require('fs')

const fetch = require('node-fetch')
const FormData = require('form-data')
const AbortController = require('abort-controller')
const { extractFiles } = require('extract-files')
const { RateLimiter } = require('limiter')

const UploadWithOptions = require('./UploadWithOptions')
const { version, description } = require('../package.json')

const {
  mutations: {
    createEtchPacket: {
      generateMutation: generateCreateEtchPacketMutation,
    },
    forgeSubmit: {
      generateMutation: generateForgeSubmitMutation,
    },
    generateEtchSignUrl: {
      generateMutation: generateEtchSignUrlMutation,
    },
    removeWeldData: {
      generateMutation: generateRemoveWeldDataMutation,
    },
  },
  queries: {
    etchPacket: {
      generateQuery: generateEtchPacketQuery,
    },
  },
} = require('./graphql')

const {
  isFile,
  graphQLUploadSchemaIsValid,
} = require('./validation')

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

    this.options = {
      ...defaultOptions,
      requestLimit: 1,
      requestLimitMS: 1000,
      ...options,
    }

    const { apiKey, accessToken } = this.options
    if (!(apiKey || accessToken)) throw new Error('apiKey or accessToken required')

    this.authHeader = accessToken
      ? `Bearer ${Buffer.from(accessToken, 'ascii').toString('base64')}`
      : `Basic ${Buffer.from(`${apiKey}:`, 'ascii').toString('base64')}`

    // Indicates that we have not dynamically set the Rate Limit from the API response
    this.hasSetLimiterFromResponse = false
    // Indicates that we are in the process setting the Rate Limit from an API response
    this.limiterSettingInProgress = false
    // A Promise that all early requests will have to wait for before continuing on. This
    // promise will be resolved by the first API response
    this.rateLimiterSetupPromise = new Promise((resolve) => {
      this.rateLimiterPromiseResolver = resolve
    })

    // Set our initial limiter
    this._setRateLimiter({ tokens: this.options.requestLimit, intervalMs: this.options.requestLimitMS })
  }

  _setRateLimiter ({ tokens, intervalMs }) {
    if (
      // Both must be truthy
      !(tokens && intervalMs) ||
      // Things should not be the same as they already are
      (this.limitTokens === tokens && this.limitIntervalMs === intervalMs)
    ) {
      return
    }

    const newLimiter = new RateLimiter({ tokensPerInterval: tokens, interval: intervalMs })

    // If we already had a limiter, let's try to pick up where it left off
    if (this.limiter) {
      const tokensInUse = Math.max(
        // getTokensRemaining() can return a decimal, so we round it down
        // so as to be conservative about potentially hitting the API again
        this.limitTokens - Math.floor(this.limiter.getTokensRemaining()),
        0,
      )
      const tokensToRemove = Math.min(tokens, tokensInUse)
      if (tokensToRemove) {
        newLimiter.tryRemoveTokens(tokensToRemove)
      }
      delete this.limiter
    }

    this.limitTokens = tokens
    this.limitIntervalMs = intervalMs
    this.limiter = newLimiter
  }

  /**
   * Perform some handy/necessary things for a GraphQL file upload to make it work
   * with this client and with our backend
   *
   * @param  {string|Buffer|Stream-like-thing} pathOrStreamLikeThing - Either a string path to a file,
   *   a Buffer, or a Stream-like thing that is compatible with form-data as an append.
   * @param  {object} formDataAppendOptions - User can specify options to be passed to the form-data.append
   *   call. This should be done if a stream-like thing is not one of the common types that
   *   form-data can figure out on its own.
   *
   * @return {UploadWithOptions} - A class that wraps the stream-like-thing and any options
   *   up together nicely in a way that we can also tell that it was us who did it.
   */
  static prepareGraphQLFile (pathOrStreamLikeThing, formDataAppendOptions) {
    if (typeof pathOrStreamLikeThing === 'string') {
      pathOrStreamLikeThing = fs.createReadStream(pathOrStreamLikeThing)
    }

    return new UploadWithOptions(pathOrStreamLikeThing, formDataAppendOptions)
  }

  createEtchPacket ({ variables, responseQuery, mutation }) {
    return this.requestGraphQL(
      {
        query: mutation || generateCreateEtchPacketMutation(responseQuery),
        variables,
      },
      { dataType: DATA_TYPE_JSON },
    )
  }

  downloadDocuments (documentGroupEid, clientOptions = {}) {
    const supportedDataTypes = [DATA_TYPE_STREAM, DATA_TYPE_BUFFER]
    const { dataType = DATA_TYPE_BUFFER } = clientOptions
    if (dataType && !supportedDataTypes.includes(dataType)) {
      throw new Error(`dataType must be one of: ${supportedDataTypes.join('|')}`)
    }
    return this.requestREST(
      `/api/document-group/${documentGroupEid}.zip`,
      { method: 'GET' },
      {
        ...clientOptions,
        dataType,
      },
    )
  }

  fillPDF (pdfTemplateID, payload, clientOptions = {}) {
    const supportedDataTypes = [DATA_TYPE_STREAM, DATA_TYPE_BUFFER]
    const { dataType = DATA_TYPE_BUFFER } = clientOptions
    if (dataType && !supportedDataTypes.includes(dataType)) {
      throw new Error(`dataType must be one of: ${supportedDataTypes.join('|')}`)
    }

    return this.requestREST(
      `/api/v1/fill/${pdfTemplateID}.pdf`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        ...clientOptions,
        dataType,
      },
    )
  }

  forgeSubmit ({ variables, responseQuery, mutation }) {
    return this.requestGraphQL(
      {
        query: mutation || generateForgeSubmitMutation(responseQuery),
        variables,
      },
      { dataType: DATA_TYPE_JSON },
    )
  }

  generatePDF (payload, clientOptions = {}) {
    const supportedDataTypes = [DATA_TYPE_STREAM, DATA_TYPE_BUFFER]
    const { dataType = DATA_TYPE_BUFFER } = clientOptions
    if (dataType && !supportedDataTypes.includes(dataType)) {
      throw new Error(`dataType must be one of: ${supportedDataTypes.join('|')}`)
    }

    return this.requestREST(
      '/api/v1/generate-pdf',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        ...clientOptions,
        dataType,
      },
    )
  }

  getEtchPacket ({ variables, responseQuery }) {
    return this.requestGraphQL(
      {
        query: generateEtchPacketQuery(responseQuery),
        variables,
      },
      { dataType: DATA_TYPE_JSON },
    )
  }

  async generateEtchSignUrl ({ variables }) {
    const { statusCode, data, errors } = await this.requestGraphQL(
      {
        query: generateEtchSignUrlMutation(),
        variables,
      },
      { dataType: DATA_TYPE_JSON },
    )

    return {
      statusCode,
      url: data && data.data && data.data.generateEtchSignURL,
      errors,
    }
  }

  removeWeldData ({ variables, mutation }) {
    return this.requestGraphQL(
      {
        query: mutation || generateRemoveWeldDataMutation(),
        variables,
      },
      { dataType: DATA_TYPE_JSON },
    )
  }

  async requestGraphQL ({ query, variables = {} }, clientOptions) {
    // Some helpful resources on how this came to be:
    // https://github.com/jaydenseric/graphql-upload/issues/125#issuecomment-440853538
    // https://zach.codes/building-a-file-upload-hook/
    // https://github.com/jaydenseric/graphql-react/blob/1b1234de5de46b7a0029903a1446dcc061f37d09/src/universal/graphqlFetchOptions.mjs
    // https://www.npmjs.com/package/extract-files

    const options = {
      method: 'POST',
      headers: {},
    }

    const originalOperation = { query, variables }

    const {
      clone: augmentedOperation,
      files: filesMap,
    } = extractFiles(originalOperation, '', isFile)

    const operationJSON = JSON.stringify(augmentedOperation)

    // Checks for both File uploads and Base64 uploads
    if (!graphQLUploadSchemaIsValid(originalOperation)) {
      throw new Error('Invalid File schema detected')
    }

    if (filesMap.size) {
      const abortController = new AbortController()
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
        let appendOptions = {}
        if (file instanceof UploadWithOptions) {
          appendOptions = file.options
          file = file.file
        }
        // If this is a stream-like thing, attach a listener to the 'error' event so that we
        // can cancel the API call if something goes wrong
        if (typeof file.on === 'function') {
          file.on('error', (err) => {
            console.warn(err)
            abortController.abort()
          })
        }

        // Pass in some things explicitly to the form.append so that we get the
        // desired/expected filename and mimetype, etc
        form.append(`${++i}`, file, appendOptions)
      })

      options.signal = abortController.signal
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

  async requestREST (url, fetchOptions, clientOptions) {
    const {
      response,
      statusCode,
      data,
      errors,
    } = await this._wrapRequest(
      () => this._request(url, fetchOptions),
      clientOptions,
    )

    return {
      response,
      statusCode,
      data,
      errors,
    }
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

  _request (url, options) {
    if (!url.startsWith(this.options.baseURL)) {
      url = this._url(url)
    }
    const opts = this._addDefaultHeaders(options)
    return fetch(url, opts)
  }

  _wrapRequest (retryableRequestFn, clientOptions = {}) {
    return this._throttle(async (retry) => {
      const { dataType, debug } = clientOptions
      const response = await retryableRequestFn()

      if (!this.hasSetLimiterFromResponse) {
        // OK, this is the response sets the rate-limiter values from the
        // server response:

        // Set up the new Rate Limiter
        const tokens = parseInt(response.headers.get('x-ratelimit-limit'))
        const intervalMs = parseInt(response.headers.get('x-ratelimit-interval-ms'))
        this._setRateLimiter({ tokens, intervalMs })

        // Adjust the gates that make this only happen once.
        this.hasSetLimiterFromResponse = true
        this.limiterSettingInProgress = false
        // Resolve the Promise that everyone else was waiting for
        this.rateLimiterPromiseResolver()
      }

      const { status: statusCode, statusText } = response

      if (statusCode >= 300) {
        if (statusCode === 429) {
          return retry(getRetryMS(response.headers.get('retry-after')))
        }

        try {
          const json = await response.json()
          const errors = json.errors || (json.message && [json])
          return errors ? { statusCode, errors } : { statusCode, ...json }
        } catch (err) {
          if (debug) {
            console.warn(`Problem parsing JSON response for status ${statusCode}:`)
            console.warn(err)
            console.warn('Using statusText instead')
          }
        }

        return { statusCode, statusText, errors: [statusText] }
      }

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

  _addHeaders ({ options: existingOptions, headers: newHeaders }, internalOptions = {}) {
    const { headers: existingHeaders = {} } = existingOptions
    const { defaults = false } = internalOptions

    newHeaders = defaults ? newHeaders : Object.entries(newHeaders).reduce((acc, [key, val]) => {
      if (val != null) {
        acc[key] = val
      }

      return acc
    }, {})

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
    return this._addHeaders(
      {
        options,
        headers: {
          'User-Agent': userAgent,
          Authorization: this.authHeader,
        },
      },
      { defaults: true },
    )
  }

  async _throttle (fn) {
    // If this is one of the first requests being made, we'll want to dynamically
    // set the Rate Limiter values from the API response, and hold up everyone else
    // while this is happening.
    // If we've already gone through the whole setup from the response, then nothing
    // special to do
    if (!this.hasSetLimiterFromResponse) {
      // If limiter setting is already in progress, then this request will have to wait
      if (this.limiterSettingInProgress) {
        await this.rateLimiterSetupPromise
      } else {
        // Set the gate so that subsequent calls will have to wait for the resolution
        this.limiterSettingInProgress = true
      }
    }

    const remainingRequests = await this.limiter.removeTokens(1)
    if (remainingRequests < 1) {
      await sleep(this.requestLimitMS + failBufferMS)
    }
    const retry = async (ms) => {
      await sleep(ms)
      return this._throttle(fn)
    }

    return fn(retry)
  }

  static _prepareGraphQLBase64 (data, options = {}) {
    const { filename, mimetype } = options
    if (!filename) {
      throw new Error('options.filename must be provided for Base64 upload')
    }
    if (!mimetype) {
      throw new Error('options.mimetype must be provided for Base64 upload')
    }

    if (options.bufferize) {
      const buffer = Buffer.from(data, 'base64')
      return this._prepareGraphQLBuffer(buffer, options)
    }

    return {
      data,
      filename,
      mimetype,
    }
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
