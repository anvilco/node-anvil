// See if the JSON looks like it's got errors
function looksLikeError ({ json }) {
  return !!(json && (json.errors || json.message || json.name))
}

// Should return an array
function normalizeErrors ({ json, statusText = 'Unknown Error' }) {
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

module.exports = {
  looksLikeError,
  normalizeErrors,
}
