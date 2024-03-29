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
