// Should return an array
async function normalizeErrors ({ response, statusText, statusCode, debug }) {
  try {
    const json = await response.json()
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
  } catch (err) {
    if (debug) {
      console.warn(`Problem parsing JSON response for status ${statusCode}:`)
      console.warn(err)
      console.warn('Using statusText instead')
    }
  }

  // Hmm, ok. Default way
  return [{ name: statusText, message: statusText }]
}

module.exports = {
  normalizeErrors,
}
