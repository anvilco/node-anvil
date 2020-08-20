const fs = require('fs')
const path = require('path')

const fetch = require('node-fetch')
const FormData = require('form-data')
const mime = require('mime-types')
const extractFiles = require('extract-files').extractFiles
const RateLimiter = require('limiter').RateLimiter

const { version, description } = require('../package.json')

const DATA_TYPE_STREAM = 'stream'
const DATA_TYPE_BUFFER = 'buffer'
const DATA_TYPE_JSON = 'json'

const defaultOptions = {
  baseURL: 'https://app.useanvil.com',
  userAgent: `${description}/${version}`,
}

const failBufferMS = 50

const Mutation = `
  mutation CreateEtchPacket (
    $name: String,
    $organizationEid: String!,
    $files: [EtchFile!],
    $send: Boolean,
    $isTest: Boolean,
    $signatureEmailSubject: String,
    $signatureEmailBody: String,
    $signaturePageOptions: JSON,
    $signers: [JSON!],
    $fillPayload: JSON,
  ) {
    createEtchPacket (
      name: $name,
      organizationEid: $organizationEid,
      files: $files,
      send: $send,
      isTest: $isTest,
      signatureEmailSubject: $signatureEmailSubject,
      signatureEmailBody: $signatureEmailBody,
      signaturePageOptions: $signaturePageOptions,
      signers: $signers,
      fillPayload: $fillPayload
    ) {
      id
      eid
      etchTemplate {
        id
        eid
        config
        casts {
          id
          eid
          config
        }
      }
    }
  }
`

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

  static prepareFile (path) {
    const readStream = fs.createReadStream(path)
    const fileName = this.getFilename(readStream)
    const mimeType = this.getMimetype(readStream)
    return {
      name: fileName,
      mimetype: mimeType,
      file: readStream,
    }
  }

  static getFilename (thing, options = {}) {
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

  static getMimetype (thing, options = {}) {
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
          Authorization: this.authHeader,
        },
      },
      {
        ...clientOptions,
        dataType,
      },
    )
  }

  getCurrentUser () {
    const query = `
      query {
        currentUser {
          id
          email
        }
      }
    `
    const variables = {}

    return this.requestGraphQL({ query, variables })
  }

  createEtchPacket ({ variables }) {
    return this.requestGraphQL({ query: Mutation, variables }, { dataType: 'json' })
  }

  // Private

  async requestREST (url, options, clientOptions = {}) {
    return this.throttle(async (retry) => {
      const response = await this.request(url, options)
      const statusCode = response.status

      if (statusCode === 429) {
        return retry(getRetryMS(response.headers.get('retry-after')))
      }

      if (statusCode >= 300) {
        const json = await response.json()
        const errors = json.errors || (json.message && [json])

        return errors ? { statusCode, errors } : { statusCode, ...json }
      }

      const { dataType } = clientOptions
      let data
      switch (dataType) {
        case DATA_TYPE_JSON:
          data = await response.json()
          break
        case DATA_TYPE_STREAM:
          data = response.body
          break
        case DATA_TYPE_BUFFER:
          data = await response.buffer()
          break
        default:
          data = await response.buffer()
          break
      }

      return { statusCode, data }
    })
  }

  async requestGraphQL ({ query, variables = {} }, clientOptions) {
    const options = {
      method: 'POST',
      headers: {
        // 'Content-Type': 'application/json',
        Cookie: this.options.cookie,
      },
      // body: JSON.stringify({
      //   query,
      //   variables,
      // }),
    }

    // const operation = {
    //   query: Mutation,
    //   variables,
    // }

    const { clone: augmentedOperation, files: filesMap } = extractFiles({ query, variables }, '', (value) => {
      return value instanceof fs.ReadStream || value instanceof Buffer
    })

    const operationJSON = JSON.stringify(augmentedOperation)

    // const options = {
    //   url: '/graphql',
    //   method: 'POST',
    //   headers: {
    //     Accept: 'application/json',
    //   },
    // }

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

      console.log('map:', JSON.stringify(map))
      console.log('filesMap:', JSON.stringify(filesMap))

      console.log(JSON.stringify(form))
      // console.log(form.getBuffer())
      // console.log(form.toString())
      // process.exit()

      options.body = form
    } else {
      options.headers['Content-Type'] = 'application/json'
      options.body = operationJSON
    }

    const response = await this.request('/graphql', options)

    console.log({ response })

    const statusCode = response.status

    const { dataType } = clientOptions
    let data
    switch (dataType) {
      case DATA_TYPE_JSON:
        data = await response.json()
        break
      case DATA_TYPE_STREAM:
        data = response.body
        break
      case DATA_TYPE_BUFFER:
        data = await response.buffer()
        break
      default:
        data = await response.buffer()
        break
    }

    // console.log({ data })
    return {
      statusCode,
      data,
    }
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

  request (url, options) {
    if (!url.startsWith(this.options.baseURL)) {
      url = this.url(url)
    }
    const opts = this.addDefaultHeaders(options)
    return fetch(url, opts)
  }

  url (path) {
    return this.options.baseURL + path
  }

  addHeaders ({ options: existingOptions, headers: newHeaders }) {
    const { headers: existingHeaders = {} } = existingOptions
    return {
      ...existingOptions,
      headers: {
        ...existingHeaders,
        ...newHeaders,
      },
    }
  }

  addDefaultHeaders (options) {
    const { userAgent } = this.options
    return this.addHeaders({
      options,
      headers: {
        'User-Agent': userAgent,
      },
    })
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
