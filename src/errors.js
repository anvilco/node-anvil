// Should return an array
function normalizeErrors ({ json, statusText, debug }) {
  const errors = json.errors || (json.message && [json])
  // Normal, GraphQL way
  if (json.errors) {
    return errors
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

  return [{ name: statusText, message: statusText }]
}

module.exports = {
  normalizeErrors,
}
