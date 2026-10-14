// Validates the client's GraphQL operations against the Anvil schema that ships with
// @anvilco/types, so a query or mutation that no longer matches the API fails the build
// rather than a request. Run `yarn build` first: it reads the built dist/graphql.
import { createRequire } from 'module'
import path from 'path'

import { buildSchema, parse, validate } from 'graphql'

import { root } from './utils.mjs'

const require = createRequire(import.meta.url)
const schema = buildSchema(require('fs').readFileSync(require.resolve('@anvilco/types/schema.graphql'), 'utf8'))
const { queries, mutations } = require(path.join(root, 'dist/graphql'))

const operations = [
  ...Object.entries(queries).map(([name, module]) => [name, module.generateQuery()]),
  ...Object.entries(mutations).map(([name, module]) => [name, module.generateMutation()]),
]

let failed = false
for (const [name, document] of operations) {
  const errors = validate(schema, parse(document))
  if (errors.length) {
    failed = true
    console.error(`✗ ${name}`)
    for (const error of errors) console.error(`    ${error.message}`)
  } else {
    console.log(`✓ ${name}`)
  }
}

if (failed) {
  console.error('\nSome operations do not match the Anvil schema in @anvilco/types.')
  process.exit(1)
}
