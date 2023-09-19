import fs from 'fs'
// We are only importing this for the type..
import { Stream } from 'stream' // eslint-disable-line no-unused-vars

import AbortController from 'abort-controller'
import { extractFiles } from 'extract-files'
import { RateLimiter } from 'limiter'

import UploadWithOptions from './UploadWithOptions'
import { version, description } from '../package.json'
import { looksLikeError, normalizeErrors } from './errors'
import { queries, mutations } from './graphql'
import {
  isFile,
  graphQLUploadSchemaIsValid,
} from './validation'

class Warning extends Error {}

let FormDataModule
let Fetch
let fetch

/**
 * @typedef AnvilOptions
 * @type {Object}
 * @property {string} [apiKey]
 * @property {string} [accessToken]
 * @property {string} [baseURL]
 * @property {string} [userAgent]
 * @property {number} [requestLimit]
 * @property {number} [requestLimitMS]
 */

/**
 * @typedef GraphQLResponse
 * @type {Object}
 * @property {number} statusCode
 * @property {GraphQLResponseData} [data]
 * @property {Array<ResponseError>} [errors]
 */

/** @typedef {{
  data: {[ key: string]: any }
}} GraphQLResponseData */

/**
 * @typedef RESTResponse
 * @type {Object}
 * @property {number} statusCode
 * @property {Buffer|Stream|Object} [data]
 * @property {Array<ResponseError>} [errors]
 * @property {any} [response] node-fetch Response
 */

/** @typedef {{
  message: string,
  status?: number,
  name?: string,
  fields?: Array<ResponseErrorField>
  [key: string]: any
}} ResponseError */

/** @typedef {{
  message: string,
  property?: string,
  [key: string]: any
}} ResponseErrorField */

// Ignoring the below since they are dynamically created depepending on what's
// inside the `src/graphql` directory.
const {
  mutations: {
    // @ts-ignore
    createEtchPacket: {
      generateMutation: generateCreateEtchPacketMutation,
    },
    // @ts-ignore
    forgeSubmit: {
      generateMutation: generateForgeSubmitMutation,
    },
    // @ts-ignore
    generateEtchSignUrl: {
      generateMutation: generateEtchSignUrlMutation,
    },
    // @ts-ignore
    removeWeldData: {
      generateMutation: generateRemoveWeldDataMutation,
    },
  },
  queries: {
    // @ts-ignore
    etchPacket: {
      generateQuery: generateEtchPacketQuery,
    },
  },
} = { queries, mutations }

const DATA_TYPE_STREAM = 'stream'
const DATA_TYPE_BUFFER = 'buffer'
const DATA_TYPE_JSON = 'json'

// Version number to use for latest versions (usually drafts)
const VERSION_LATEST = -1
// Version number to use for the latest published version.
// This is the default when a version is not provided.
const VERSION_LATEST_PUBLISHED = -2

const defaultOptions = {
  baseURL: 'https://app.useanvil.com',
  userAgent: `${description}/${version}`,
}

const FILENAME_IGNORE_MESSAGE = 'If you think you can ignore this, please pass `options.ignoreFilenameValidation` as `true`.'

const failBufferMS = 50

class Anvil {
  // {
  //   apiKey: <yourAPIKey>,
  //   accessToken: <yourAPIKey>, // OR oauth access token
  //   baseURL: 'https://app.useanvil.com'
  //   userAgent: 'Anvil API Client/2.0.0'
  // }
  /**
   * @param {AnvilOptions?} options
   */
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

  /**
   * @param {Object} options
   * @param {number} options.tokens
   * @param {number} options.intervalMs
   * @private
   */
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
   * @param  {string|Buffer|Stream|File|Blob} pathOrStreamLikeThing - Either a string path to a file,
   *   a Buffer, or a Stream-like thing that is compatible with form-data as an append.
   * @param  {Object} [formDataAppendOptions] - User can specify options to be passed to the form-data.append
   *   call. This should be done if a stream-like thing is not one of the common types that
   *   form-data can figure out on its own.
   *
   * @return {UploadWithOptions} - A class that wraps the stream-like-thing and any options
   *   up together nicely in a way that we can also tell that it was us who did it.
   */
  static prepareGraphQLFile (pathOrStreamLikeThing, { ignoreFilenameValidation, ...formDataAppendOptions } = {}) {
    if (typeof pathOrStreamLikeThing === 'string') {
      // @ts-ignore
      // no-op for this logic path. It's a path and we will load it later and it will at least
      // have the file's name as a filename to possibly use.
    } else if (
      !formDataAppendOptions ||
      (
        formDataAppendOptions && !(
          // Require the filename or the ignoreFilenameValidation option.
          formDataAppendOptions.filename || ignoreFilenameValidation
        )
      )
    ) {
      // OK, there's a chance here that a `filename` needs to be provided via formDataAppendOptions
      if (
        // Buffer has no way to get the filename
        pathOrStreamLikeThing instanceof Buffer ||
        !(
          // Some stream things have a string path in them (can also be a buffer, but we want/need string)
          (pathOrStreamLikeThing.path && typeof pathOrStreamLikeThing.path === 'string') ||
          // A File might look like this
          (pathOrStreamLikeThing.name && typeof pathOrStreamLikeThing.name === 'string')
        )
      ) {
        let message = 'For this type of input, `options.filename` must be provided to prepareGraphQLFile.' + ' ' + FILENAME_IGNORE_MESSAGE
        try {
          if (pathOrStreamLikeThing && pathOrStreamLikeThing.constructor && pathOrStreamLikeThing.constructor.name) {
            message = `When passing a ${pathOrStreamLikeThing.constructor.name} to prepareGraphQLFile, \`options.filename\` must be provided. ${FILENAME_IGNORE_MESSAGE}`
          }
        } catch (err) {
          console.error(err)
        }

        throw new Error(message)
      }
    }

    return new UploadWithOptions(pathOrStreamLikeThing, formDataAppendOptions)
  }

  /**
   * Runs the createEtchPacket mutation.
   * @param {Object} data
   * @param {Object} data.variables
   * @param {string} [data.responseQuery]
   * @param {string} [data.mutation]
   * @returns {Promise<GraphQLResponse>}
   */
  createEtchPacket ({ variables, responseQuery, mutation }) {
    return this.requestGraphQL(
      {
        query: mutation || generateCreateEtchPacketMutation(responseQuery),
        variables,
      },
      { dataType: DATA_TYPE_JSON },
    )
  }

  /**
   * @param {string} documentGroupEid
   * @param {Object} [clientOptions]
   * @returns {Promise<RESTResponse>}
   */
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

  /**
   * @param {string} pdfTemplateID
   * @param {Object} payload
   * @param {Object} [clientOptions]
   * @returns {Promise<RESTResponse>}
   */
  fillPDF (pdfTemplateID, payload, clientOptions = {}) {
    const supportedDataTypes = [DATA_TYPE_STREAM, DATA_TYPE_BUFFER]
    const { dataType = DATA_TYPE_BUFFER } = clientOptions
    if (dataType && !supportedDataTypes.includes(dataType)) {
      throw new Error(`dataType must be one of: ${supportedDataTypes.join('|')}`)
    }

    const versionNumber = clientOptions.versionNumber
    const url = versionNumber
      ? `/api/v1/fill/${pdfTemplateID}.pdf?versionNumber=${versionNumber}`
      : `/api/v1/fill/${pdfTemplateID}.pdf`

    return this.requestREST(
      url,
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

  /**
   * @param {Object} data
   * @param {Object} data.variables
   * @param {string} [data.responseQuery]
   * @param {string} [data.mutation]
   * @returns {Promise<GraphQLResponse>}
   */
  forgeSubmit ({ variables, responseQuery, mutation }) {
    return this.requestGraphQL(
      {
        query: mutation || generateForgeSubmitMutation(responseQuery),
        variables,
      },
      { dataType: DATA_TYPE_JSON },
    )
  }

  /**
   * @param {Object} payload
   * @param {Object} [clientOptions]
   * @returns {Promise<RESTResponse>}
   */
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

  /**
   * @param {Object} data
   * @param {Object} data.variables
   * @param {string} [data.responseQuery]
   * @returns {Promise<GraphQLResponse>}
   */
  getEtchPacket ({ variables, responseQuery }) {
    return this.requestGraphQL(
      {
        query: generateEtchPacketQuery(responseQuery),
        variables,
      },
      { dataType: DATA_TYPE_JSON },
    )
  }

  /**
   * @param {Object} data
   * @param {Object} data.variables
   * @returns {Promise<{url?: string, errors?: Array<ResponseError>, statusCode: number}>}
   */
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

  /**
   * @param {Object} data
   * @param {Object} data.variables
   * @param {string} [data.mutation]
   * @returns {Promise<GraphQLResponse>}
   */
  removeWeldData ({ variables, mutation }) {
    return this.requestGraphQL(
      {
        query: mutation || generateRemoveWeldDataMutation(),
        variables,
      },
      { dataType: DATA_TYPE_JSON },
    )
  }

  /**
   * @param {Object} data
   * @param {string} data.query
   * @param {Object} [data.variables]
   * @param {Object} [clientOptions]
   * @returns {Promise<GraphQLResponse>}
   */
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
      // @ts-ignore
      const abortController = new AbortController()
      Fetch ??= await import('node-fetch')
      // This is a dependency of 'node-fetch'`
      FormDataModule ??= await import('formdata-polyfill/esm.min.js')
      const form = new FormDataModule.FormData()

      form.append('operations', operationJSON)

      const map = {}
      let i = 0
      filesMap.forEach(paths => {
        map[++i] = paths
      })
      form.append('map', JSON.stringify(map))

      i = 0
      filesMap.forEach((paths, file) => {
        // Ensure that the file has been run through the prepareGraphQLFile process
        // and checks
        if (file instanceof UploadWithOptions === false) {
          file = this.constructor.prepareGraphQLFile(file)
        }
        let { filename, mimetype, ignoreFilenameValidation } = file.options || {}
        file = file.file

        if (!file) {
          throw new Error('No file provided. Options were: ' + JSON.stringify(options))
        }

        // If this is a stream-like thing, attach a listener to the 'error' event so that we
        // can cancel the API call if something goes wrong
        if (typeof file.on === 'function') {
          file.on('error', (err) => {
            console.warn(err)
            abortController.abort()
          })
        }

        // If file a path to a file?
        if (typeof file === 'string') {
          file = Fetch.fileFromSync(file, mimetype)
        } else if (file instanceof Buffer) {
          const buffer = file
          // https://developer.mozilla.org/en-US/docs/Web/API/File/File
          file = new Fetch.File(
            [buffer],
            filename,
            {
              type: mimetype,
            },
          )
        } else if (file instanceof Stream) {
          // https://github.com/node-fetch/node-fetch#post-data-using-a-file
          const stream = file
          file = {
            [Symbol.toStringTag]: 'File',
            size: fs.statSync(stream.path).size,
            stream: () => stream,
            type: mimetype,
          }

          filename ??= stream.path.split('/').pop()
        } else if (file.constructor.name !== 'File') {
          // Like a Blob or something
          if (!filename) {
            const name = file.name || file.path
            if (name) {
              filename = name.split('/').pop()
            }

            if (!filename && !ignoreFilenameValidation) {
              console.warn(new Warning('No filename provided. Please provide a filename to the file options.'))
            }
          }
        }

        // https://developer.mozilla.org/en-US/docs/Web/API/FormData/append
        form.append(`${++i}`, file, filename)
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

  /**
   * @param {string} url
   * @param {Object} fetchOptions
   * @param {Object} [clientOptions]
   * @returns {Promise<RESTResponse>}
   */
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

  async _request (...args) {
    // Only load Fetch once per module process lifetime
    Fetch = Fetch || await import('node-fetch')
    fetch = Fetch.default
    // Monkey-patch so we only try any of this once per Anvil Client instance
    this._request = this.__request
    return this._request(...args)
  }

  /**
   * @param {string} url
   * @param {Object} options
   * @returns {Promise}
   * @private
   */
  __request (url, options) {
    if (!url.startsWith(this.options.baseURL)) {
      url = this._url(url)
    }
    const opts = this._addDefaultHeaders(options)
    return fetch(url, opts)
  }

  /**
   * @param {CallableFunction} retryableRequestFn
   * @param {Object} [clientOptions]
   * @returns {Promise<*>}
   * @private
   */
  _wrapRequest (retryableRequestFn, clientOptions = {}) {
    return this._throttle(async (retry) => {
      let { dataType, debug } = clientOptions
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

      if (statusCode === 429) {
        return retry(getRetryMS(response.headers.get('retry-after')))
      }

      let json
      let isError = false

      const contentType = response.headers.get('content-type') || response.headers.get('Content-Type') || ''

      // No matter what we were expecting, if the response is JSON, let's parse it and look for
      // signs of errors
      if (contentType.toLowerCase().includes('application/json')) {
        // Re-set the dataType so we don't fall into the wrong flow later on
        dataType = DATA_TYPE_JSON
        try {
          json = await response.json()
          isError = looksLikeError({ json })
        } catch (err) {
          if (debug) {
            console.warn(`Problem parsing JSON response for status ${statusCode}:`)
            console.warn(err)
            console.warn('Using statusText instead')
          }
        }
      }

      if (isError || statusCode >= 300) {
        const errors = await normalizeErrors({ json, statusText })
        return { response, statusCode, errors }
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
          // Can't call json() twice, so we'll see if we already did that
          data = json || await response.json()
          break
        default:
          console.warn('Using default response dataType of "json". Please specify a dataType.')
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

  /**
   * @param {string} path
   * @returns {string}
   * @private
   */
  _url (path) {
    return this.options.baseURL + path
  }

  /**
   * @param {Object} headerObject
   * @param {Object} headerObject.options
   * @param {Object} headerObject.headers
   * @param {Object} [internalOptions]
   * @returns {*&{headers: {}}}
   * @private
   */
  _addHeaders ({ options: existingOptions, headers: newHeaders }, internalOptions = {}) {
    const { headers: existingHeaders = {} } = existingOptions
    const { defaults = false } = internalOptions

    newHeaders = defaults
      ? newHeaders
      : Object.entries(newHeaders).reduce((acc, [key, val]) => {
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

  /**
   * @param {Object} options
   * @returns {*}
   * @private
   */
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

  /**
   * @param {CallableFunction} fn
   * @returns {Promise<*>}
   * @private
   */
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
      await sleep(this.options.requestLimitMS + failBufferMS)
    }
    const retry = async (ms) => {
      await sleep(ms)
      return this._throttle(fn)
    }

    return fn(retry)
  }
}

Anvil.UploadWithOptions = UploadWithOptions

/**
 * @param {string} retryAfterSeconds
 * @returns {number}
 * @private
 */
function getRetryMS (retryAfterSeconds) {
  return Math.round((Math.abs(parseFloat(retryAfterSeconds)) || 0) * 1000) + failBufferMS
}

/**
 * @param {number} ms
 * @returns {Promise<any>}
 * @private
 */
function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

Anvil.VERSION_LATEST = VERSION_LATEST
Anvil.VERSION_LATEST_PUBLISHED = VERSION_LATEST_PUBLISHED

export default Anvil
