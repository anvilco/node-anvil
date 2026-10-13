import { File } from 'buffer'
import fs from 'fs'
import { basename } from 'path'
import { performance } from 'perf_hooks'
import { Readable as NodeReadable, Stream } from 'stream'

import { Agent, fetch, FormData } from 'undici'

import UploadWithOptions from './UploadWithOptions'
import { version, description } from '../package.json'
import { looksLikeJsonError, normalizeNodeError, normalizeJsonErrors } from './errors'
import { queries, mutations } from './graphql'
import {
  isFile,
  graphQLUploadSchemaIsValid,
} from './validation'

class Warning extends Error {}

let extractFiles

/**
 * @typedef AnvilOptions
 * @type {Object}
 * @property {string} [apiKey]
 * @property {string} [accessToken]
 * @property {string} [baseURL]
 * @property {string} [userAgent]
 * @property {number} [requestLimit]
 * @property {number} [requestLimitMS]
 * @property {import('undici').Dispatcher} [dispatcher] An undici dispatcher to send requests
 *   with, e.g. a ProxyAgent. Defaults to an Agent of the client's own.
 */

/**
 * @typedef GraphQLResponse
 * @type {Object}
 * @property {number} statusCode
 * @property {GraphQLResponseData} [data]
 * @property {Array<ResponseError | NodeError>} [errors]
 */

/** @typedef {{
  data: {[ key: string]: any }
}} GraphQLResponseData */

/**
 * @typedef RESTResponse
 * @type {Object}
 * @property {number} statusCode
 * @property {Buffer|ArrayBuffer|Stream|Object} [data]
 * @property {Array<ResponseError | NodeError>} [errors]
 * @property {import('undici').Response} [response] The fetch Response
 */

/** @typedef {{
  name: string;
  message: string;
  stack: string;
  code: string;
  cause?: any;
}} NodeError */

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

/** @typedef {{
  path: string
}} Readable */

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
const DATA_TYPE_ARRAY_BUFFER = 'arrayBuffer'
const DATA_TYPE_JSON = 'json'

const SUPPORTED_BINARY_DATA_TYPES = Object.freeze([
  DATA_TYPE_STREAM,
  DATA_TYPE_BUFFER,
  DATA_TYPE_ARRAY_BUFFER,
])

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

// Our own connection pool. Without one, undici uses a process-wide default that, on
// Node 20, Node's own older copy of undici takes over as soon as anything touches the
// global fetch, FormData or Headers. That copy doesn't notice when a chunked response is
// cut short, and would hand back truncated data as a success.
const defaultDispatcher = new Agent()

// Three dot-separated base64url segments. The signature can be empty.
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/

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

    if (accessToken) {
      // Anvil's OAuth access tokens are JWTs, which the API wants as-is. Anything
      // else is base64 encoded, which the API still accepts for backwards compatibility.
      this.authHeader = isJWT(accessToken)
        ? `Bearer ${accessToken}`
        : `Bearer ${Buffer.from(accessToken, 'ascii').toString('base64')}`
    } else {
      this.authHeader = `Basic ${Buffer.from(`${apiKey}:`, 'ascii').toString('base64')}`
    }

    // Indicates that we have not dynamically set the Rate Limit from the API response
    this.hasSetLimiterFromResponse = false
    // Indicates that we are in the process setting the Rate Limit from an API response
    this.limiterSettingInProgress = false
    // A Promise that all early requests will have to wait for before continuing on. This
    // promise will be resolved by the first API response
    this.rateLimiterSetupPromise = new Promise((resolve) => {
      this.rateLimiterPromiseResolver = resolve
    })

    // When the requests in the current rate limit window were sent, oldest first
    /** @type {number[]} */
    this.requestTimes = []

    // Set our initial limits, falling back to 1 request per second if those given are invalid
    this.limitTokens = 1
    this.limitIntervalMs = 1000
    this._setRateLimiter({ tokens: this.options.requestLimit, intervalMs: this.options.requestLimitMS })
  }

  /**
   * @param {Object} options
   * @param {number} options.tokens
   * @param {number} options.intervalMs
   * @private
   */
  _setRateLimiter ({ tokens, intervalMs }) {
    // Both must be positive numbers
    if (!(tokens > 0 && intervalMs > 0)) {
      return
    }

    // requestTimes carries over, so requests already sent still count against the new limits
    this.limitTokens = tokens
    this.limitIntervalMs = intervalMs
  }

  /**
   * Perform some handy/necessary things for a GraphQL file upload to make it work
   * with this client and with our backend
   *
   * @param  {string|Buffer|Readable|File|Blob} pathOrStreamLikeThing - Either a string path to a file,
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
          // Require the filename or the ignoreFilenameValidation option. This is an escape hatch
          // for things we didn't anticipate to cause problems
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
          // @ts-ignore
          (pathOrStreamLikeThing.path && typeof pathOrStreamLikeThing.path === 'string') ||
          // A File might look like this
          // @ts-ignore
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
    const { dataType = DATA_TYPE_BUFFER } = clientOptions
    if (dataType && !SUPPORTED_BINARY_DATA_TYPES.includes(dataType)) {
      throw new Error(`dataType must be one of: ${SUPPORTED_BINARY_DATA_TYPES.join('|')}`)
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
    const { dataType = DATA_TYPE_BUFFER } = clientOptions
    if (dataType && !SUPPORTED_BINARY_DATA_TYPES.includes(dataType)) {
      throw new Error(`dataType must be one of: ${SUPPORTED_BINARY_DATA_TYPES.join('|')}`)
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
    const { dataType = DATA_TYPE_BUFFER } = clientOptions
    if (dataType && !SUPPORTED_BINARY_DATA_TYPES.includes(dataType)) {
      throw new Error(`dataType must be one of: ${SUPPORTED_BINARY_DATA_TYPES.join('|')}`)
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
   * @returns {Promise<{url?: string, errors?: Array<ResponseError | NodeError>, statusCode: number}>}
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

    extractFiles ??= (await import('extract-files/extractFiles.mjs')).default

    const {
      clone: augmentedOperation,
      files: filesMap,
    } = extractFiles(originalOperation, isFile)

    const operationJSON = JSON.stringify(augmentedOperation)

    // Checks for both File uploads and Base64 uploads
    if (!graphQLUploadSchemaIsValid(originalOperation)) {
      throw new Error('Invalid File schema detected')
    }

    if (filesMap.size) {
      const abortController = new AbortController()
      // If a file stream errors, cancel the API call
      const abortRequest = (err) => {
        console.warn(err)
        abortController.abort()
      }
      const abortOnError = (stream) => stream.on('error', abortRequest)
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
        // Ensure that the file has been run through the prepareGraphQLFile process
        // and checks
        if (file instanceof UploadWithOptions === false) {
          file = Anvil.prepareGraphQLFile(file)
        }
        let { filename, mimetype, ignoreFilenameValidation } = file.options || {}
        file = file.file

        if (!file) {
          throw new Error('No file provided. Options were: ' + JSON.stringify(options))
        }

        // If this is a stream-like thing, cancel the API call if something goes wrong with it
        if (typeof file.on === 'function') {
          abortOnError(file)
        }

        // If file a path to a file?
        if (typeof file === 'string') {
          const filePath = file
          filename ??= basename(filePath)
          // Only opened when the request is sent, and streamed rather than read into memory.
          // Opened again if the request is retried.
          file = new StreamedFile(() => abortOnError(fs.createReadStream(filePath)), {
            name: filename,
            size: fs.statSync(filePath).size,
            type: mimetype,
            onError: abortRequest,
          })
        } else if (file instanceof Buffer) {
          // https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob
          file = new Blob([file], { type: mimetype })
        } else if (file instanceof Stream) {
          const stream = file
          // @ts-ignore
          const streamPath = typeof stream.path === 'string' ? stream.path : undefined
          filename ??= streamPath && basename(streamPath)

          let getStream
          let size
          let canSend
          if (streamPath) {
            // A file stream: we know its size, and can open it again if the request is retried
            // @ts-ignore
            const { start = 0, end = Infinity } = stream
            const fileSize = fs.statSync(streamPath).size
            size = Math.max(Math.min(end + 1, fileSize) - start, 0)
            let used = false
            getStream = () => {
              if (!used) {
                used = true
                return stream
              }
              return abortOnError(fs.createReadStream(streamPath, { start, end }))
            }
          } else {
            // Any other stream can only be read once, and is sent without a size
            let used = false
            canSend = () => {
              if (used) {
                throw new Error(`Can't send ${filename || 'a stream'} again because its stream has already been read. To upload a file in a request that may be retried, pass a path, a file stream or a Buffer.`)
              }
            }
            getStream = () => {
              canSend()
              used = true
              return stream
            }
          }
          file = new StreamedFile(getStream, { name: filename, size, type: mimetype, onError: abortRequest, canSend })
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
        // Passing an undefined filename would name the file "undefined". A StreamedFile
        // carries its own name, and passing one would make FormData copy it into a plain
        // File, which reads the whole file into memory and loses the stream.
        if (filename === undefined || file instanceof StreamedFile) {
          form.append(`${++i}`, file)
        } else {
          form.append(`${++i}`, file, filename)
        }
      })

      options.signal = abortController.signal
      options.body = form
      // When following redirects, fetch keeps a copy of the body to send again, and that
      // copy would buffer every file in memory. The API doesn't redirect uploads.
      options.redirect = 'error'
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

  /**
   * @param {string} url
   * @param {Object} options
   * @returns {Promise<import('undici').Response>}
   * @private
   */
  _request (url, options) {
    if (!url.startsWith(this.options.baseURL)) {
      url = this._url(url)
    }
    const opts = {
      dispatcher: this.options.dispatcher || defaultDispatcher,
      ...this._addDefaultHeaders(options),
    }
    // fetch needs this to send a stream body
    if (isStreamBody(opts.body) && !opts.duplex) {
      opts.duplex = 'half'
    }
    // Refuse up front to send a file whose stream has already been read, with a clear error.
    // An error thrown while the body is being sent would not reach the caller.
    if (opts.body instanceof FormData) {
      for (const value of opts.body.values()) {
        if (value instanceof StreamedFile) {
          value.checkCanSend()
        }
      }
    }
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
      let response
      try {
        response = await retryableRequestFn()
      } catch (err) {
        if (!this.hasSetLimiterFromResponse) {
          // There won't be a response to set the limits from, so let any requests waiting for
          // one go ahead at the starting limits, rather than waiting forever
          this.limiterSettingInProgress = false
          this.rateLimiterPromiseResolver()
        }
        throw err
      }

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
      let nodeError

      const contentType = response.headers.get('content-type') || response.headers.get('Content-Type') || ''

      // No matter what we were expecting, if the response is JSON, let's parse it and look for
      // signs of errors
      if (contentType.toLowerCase().includes('application/json')) {
        // Re-set the dataType so we don't fall into the wrong flow later on
        dataType = DATA_TYPE_JSON
        try {
          json = await response.json()
          isError = looksLikeJsonError({ json })
        } catch (err) {
          nodeError = err
          if (debug) {
            console.warn(`Problem parsing JSON response for status ${statusCode}:`)
            console.warn(err)
          }
        }
      }

      if (nodeError || isError || statusCode >= 300) {
        const errors = nodeError ? normalizeNodeError({ error: nodeError }) : normalizeJsonErrors({ json, statusText })
        return { response, statusCode, errors }
      }

      let data

      switch (dataType) {
        case DATA_TYPE_STREAM:
          // fetch gives a web ReadableStream, but we've always returned a Node stream
          data = response.body ? NodeReadable.fromWeb(response.body) : NodeReadable.from([])
          break
        case DATA_TYPE_BUFFER:
          // fetch only gives an ArrayBuffer, so convert it to a Node Buffer
          data = Buffer.from(await response.arrayBuffer())
          break
        case DATA_TYPE_ARRAY_BUFFER:
          data = await response.arrayBuffer()
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

    await this._waitForRateLimit()
    const retry = async (ms) => {
      await sleep(ms)
      return this._throttle(fn)
    }

    return fn(retry)
  }

  /**
   * Waits until another request would keep us within limitTokens requests in any
   * limitIntervalMs. The API counts requests the same way, over a sliding window, so
   * this avoids 429s without holding back requests that are within the limit.
   * @returns {Promise<void>}
   * @private
   */
  async _waitForRateLimit () {
    for (;;) {
      // Not Date.now(), so that changes to the system clock can't hold requests up
      const now = performance.now()
      // Requests sent before this no longer count. The buffer allows for requests that
      // were sent further apart than they arrive.
      const windowStart = now - this.limitIntervalMs - failBufferMS
      while (this.requestTimes.length && this.requestTimes[0] <= windowStart) {
        this.requestTimes.shift()
      }

      if (this.requestTimes.length < this.limitTokens) {
        this.requestTimes.push(now)
        return
      }

      // Wait for the oldest request to leave the window, then check again
      await sleep(this.requestTimes[0] - windowStart)
    }
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
 * Whether a token is a JWT: three base64url segments where the header and
 * payload decode to JSON objects. This is a bit stricter than the API's check,
 * so anything it says yes to, the API will treat as a JWT too.
 * @param {string} token
 * @returns {boolean}
 * @private
 */
function isJWT (token) {
  if (typeof token !== 'string' || !JWT_RE.test(token)) {
    return false
  }

  const [header, payload] = token.split('.').slice(0, 2).map(decodeJSONSegment)
  return !!(header && payload && typeof header.alg === 'string')
}

/**
 * @param {string} segment
 * @returns {Object|undefined}
 * @private
 */
function decodeJSONSegment (segment) {
  try {
    const decoded = JSON.parse(Buffer.from(segment, 'base64').toString('utf8'))
    return decoded && typeof decoded === 'object' ? decoded : undefined
  } catch (err) {
    return undefined
  }
}

/**
 * A File whose contents come from a stream. FormData only accepts real Files, and reads
 * them with stream() and size, so the file is sent without reading it all into memory.
 * @private
 */
class StreamedFile extends File {
  /**
   * @param {() => any} getStream A function that returns a Node stream, opened when the file is sent
   * @param {Object} options
   * @param {string} [options.name]
   * @param {number} [options.size] Leave out if unknown. The request is then sent chunked.
   * @param {string} [options.type]
   * @param {(err: Error) => void} options.onError Called if the stream fails while being sent
   * @param {() => void} [options.canSend] Throws if the file can't be sent (again)
   */
  constructor (getStream, { name, size, type, onError, canSend }) {
    // Without a name, the part would have no filename and the API would treat it as text
    super([], name || 'blob', { type: type || '' })
    this.getStream = getStream
    this.streamedSize = size
    this.onError = onError
    this.canSend = canSend
  }

  // @ts-ignore File's size is a number; this one is unknown for streams without a path
  get size () {
    return this.streamedSize
  }

  checkCanSend () {
    if (this.canSend) {
      this.canSend()
    }
  }

  // FormData only handles chunks that are bytes, and stops at an empty one.
  // This must never throw: undici doesn't catch errors from a body being sent, so one
  // would be an unhandled rejection. Errors cancel the request through onError instead.
  // @ts-ignore File's stream() returns a web ReadableStream; FormData is fine with any async iterable
  async * stream () {
    try {
      for await (const chunk of this.getStream()) {
        const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
        if (bytes.length) {
          yield bytes
        }
      }
    } catch (err) {
      this.onError(err)
    }
  }
}

/**
 * @param {any} body
 * @returns {boolean}
 * @private
 */
function isStreamBody (body) {
  return !!body && (body instanceof Stream || typeof body.getReader === 'function')
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
