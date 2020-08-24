const fs = require('fs')
const { BufferPeekStream } = require('buffer-peek-stream')

// https://www.npmjs.com/package/extract-files/v/6.0.0#type-extractablefilematcher
function isFile (value) {
  return value instanceof fs.ReadStream || value instanceof Buffer || value instanceof BufferPeekStream
}

function findFiles (schema, parent, collection = []) {
  if (!schema) {
    return collection
  }

  if (schema instanceof Array) {
    schema.forEach((subSchema) => findFiles(subSchema, schema, collection))
  } else if (schema.constructor.name === 'Object') {
    Object.entries(schema).map(([_key, subSchema]) => findFiles(subSchema, schema, collection))
  } else if (isFile(schema)) {
    collection.push([schema, parent])
  }

  return collection
}

function graphQLUploadSchemaIsValid (schema, filesAndParents) {
  filesAndParents = filesAndParents || findFiles(schema)

  for (const [file, parent] of filesAndParents) {
    if (!parent) {
      return false
    }

    if (parent.file !== file) {
      return false
    }

    if (!['name', 'mimetype'].every((requiredKey) => parent[requiredKey])) {
      return false
    }
  }

  return true
}

function validateGraphQLUploadSchema (schema, filesAndParents) {
  if (!graphQLUploadSchemaIsValid(schema, filesAndParents)) {
    throw new Error('Invalid File schema detected')
  }
}

module.exports = {
  isFile,
  findFiles,
  graphQLUploadSchemaIsValid,
  validateGraphQLUploadSchema,
}
