const fs = require('fs')

// https://www.npmjs.com/package/extract-files/v/6.0.0#type-extractablefilematcher
function isFile (value) {
  return value instanceof fs.ReadStream || value instanceof Buffer
}

function graphQLUploadSchemaIsValid (schema, parent) {
  if (schema instanceof Array) {
    return schema.every((subSchema) => graphQLUploadSchemaIsValid(subSchema, schema))
  }

  if (schema.constructor.name === 'Object') {
    return Object.entries(schema).every(([_key, subSchema]) => graphQLUploadSchemaIsValid(subSchema, schema))
  }

  if (!isFile(schema)) {
    return true
  }

  if (!parent) {
    return false
  }

  if (parent.file !== schema) {
    return false
  }

  return ['name', 'mimetype'].every((requiredKey) => parent[requiredKey])
}

module.exports = {
  isFile,
  graphQLUploadSchemaIsValid,
}
