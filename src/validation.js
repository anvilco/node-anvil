const fs = require('fs')

// https://www.npmjs.com/package/extract-files/v/6.0.0#type-extractablefilematcher
function isFile (value) {
  return value instanceof fs.ReadStream || value instanceof Buffer
}

function graphQLUploadSchemaIsValid (schema, parent, key) {
  if (typeof schema === 'undefined') {
    return true
  }

  // Not a great/easy/worthwhile way to determine if a string is base64-encoded data,
  // so our best proxy is to check the keyname
  if (key !== 'base64File') {
    if (schema instanceof Array) {
      return schema.every((subSchema) => graphQLUploadSchemaIsValid(subSchema, schema))
    }

    if (schema.constructor.name === 'Object') {
      return Object.entries(schema).every(([key, subSchema]) => graphQLUploadSchemaIsValid(subSchema, schema, key))
    }

    if (!isFile(schema)) {
      return true
    }
  }

  // All flavors should be nested, and not top-level
  if (!parent) {
    return false
  }

  // File Upload
  if (key === 'file') {
    if (parent.file !== schema) {
      return false
    }

    return ['name', 'mimetype'].every((requiredKey) => parent[requiredKey])
  }

  // Base64 Upload
  if (key === 'base64File') {
    if (parent.base64File !== schema) {
      return false
    }

    return ['filename', 'mimetype'].every((requiredKey) => schema[requiredKey])
  }

  return false
}

module.exports = {
  isFile,
  graphQLUploadSchemaIsValid,
}
