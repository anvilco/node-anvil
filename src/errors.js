/**
 * What the client's methods reject with when the API responds with an error and
 * `throwOnError` is on. It reads the same as python-anvil's AnvilRequestError.
 */
export class AnvilRequestError extends Error {
  /**
   * @param {Object} options
   * @param {Array<import('@anvilco/types').ResponseError | import('@anvilco/types').RuntimeError>} options.errors
   *   The normalized errors, the same as a method resolves with when `throwOnError` is off
   * @param {number} [options.statusCode] The HTTP status code. GraphQL errors usually come with a 200.
   * @param {any} [options.data] Any data the API returned alongside the errors. A GraphQL
   *   response can be partially successful.
   * @param {import('undici').Response} [options.response] The fetch Response, e.g. for its headers
   */
  constructor ({ errors, statusCode, data, response }) {
    const description = [].concat(errors || []).map(formatError).join('; ') || 'Unknown Error'
    super(statusCode ? `${statusCode}: ${description}` : description)
    this.name = 'AnvilRequestError'
    /** The HTTP status code. GraphQL errors usually come with a 200. */
    this.statusCode = statusCode
    /** The normalized errors, the same as a method resolves with when `throwOnError` is off */
    this.errors = errors
    /** Any data the API returned alongside the errors, e.g. a partially successful GraphQL query's */
    this.data = data
    /** The fetch Response, e.g. for the rate limit headers */
    this.response = response
  }
}

// One line describing a normalized error, including a validation error's fields, e.g.
// "ValidationError (data: Required)"
function formatError (error) {
  if (!error || typeof error !== 'object') {
    return String(error)
  }

  const description = [error.name, error.message].filter(Boolean).join(': ') || 'Unknown Error'
  const details = (Array.isArray(error.fields) ? error.fields : [])
    .filter((field) => field && typeof field === 'object')
    .map((field) => field.property ? `${field.property}: ${field.message}` : String(field.message))
    .join(', ')

  return details ? `${description} (${details})` : description
}

// See if the JSON looks like it's got errors
export function looksLikeJsonError ({ json }) {
  return !!(json && (json.errors || json.message || json.name))
}

// Should return an array
export function normalizeJsonErrors ({ json, statusText = 'Unknown Error' }) {
  if (json) {
    // Normal, GraphQL way
    if (json.errors) {
      return json.errors
    }

    // Alternative way from some REST calls:
    // {
    //   "name": "AssertionError",
    //   "message": "PDF did not generate properly from given HTML!"
    // }
    //
    // OR
    //
    // {
    //   "name": "ValidationError",
    //   "fields":[{ "message": "Required", "property": "data" }]
    // }
    if (json.message || json.name) {
      return [json]
    }
  }

  // Hmm, ok. Default way
  return [{ name: statusText, message: statusText }]
}

// Should return an array
export function normalizeNodeError ({ error, statusText = 'Unknown Error' }) {
  if (error) {
    return [pickError(error)]
  }

  // Hmm, ok. Default way
  return [{ name: statusText, message: statusText }]
}

function pickError (error) {
  return (({ name, message, code, cause, stack }) => ({ name, message, code, cause, stack }))(error)
}
