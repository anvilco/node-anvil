const fs = require('fs')

const UploadWithOptions = require('./UploadWithOptions')

// https://www.npmjs.com/package/extract-files/v/6.0.0#type-extractablefilematcher
function isFile (value) {
  return value instanceof UploadWithOptions || value instanceof fs.ReadStream || value instanceof Buffer
}

function graphQLUploadSchemaIsValid (schema, parent, key) {
  // schema is null or undefined
  if (schema == null) {
    return true
  }

  if (key !== 'file') {
    if (schema instanceof Array) {
      return schema.every((subSchema) => graphQLUploadSchemaIsValid(subSchema, schema))
    }

    if (schema.constructor.name === 'Object') {
      return Object.entries(schema).every(([key, subSchema]) => graphQLUploadSchemaIsValid(subSchema, schema, key))
    }

    return !isFile(schema)
  }

  // OK, the key is 'file'

  // All flavors should be nested, and not top-level
  if (!(parent && parent.file === schema)) {
    return false
  }

  // Base64 Upload
  if (schema.data) {
    // Must be a string and also have the provided keys
    return (
      typeof schema.data === 'string' &&
      ['filename', 'mimetype'].every((requiredKey) => schema[requiredKey])
    )
  }

  return isFile(schema)
}

module.exports = {
  isFile,
  graphQLUploadSchemaIsValid,
}
