// Calls the fillPDF Anvil endpoint with data specified. Ouputs the filled PDF
// in example/script/fill.output.pdf
//
// jsonPath is a json file with your JSON payload. e.g.
// {
//   "title": "My PDF Title",
//   "fontSize": 10,
//   "textColor": "#CC0000",
//   "data": {
//     "someFieldId": "Hello World!"
//   }
// }
//
// Usage example:
//
// yarn babel-node example/script/fill-pdf.js eidabc123 apiKeydef345 ./payload.json && open example/script/fill.output.pdf

import fs from 'fs'
import path from 'path'

import { run } from './env'
import Anvil from '../../src/index'

const argv = require('yargs')
  .usage('Usage: $0 [-e local|staging|production] castEid token jsonPath.json')
  .alias('e', 'endpoint')
  .demandCommand(3).argv

const endpoints = {
  local: 'http://localhost:3000',
  production: 'https://app.useanvil.com',
}

const { endpoint: endpointKey } = argv
const [eid, apiKey, jsonPath] = argv._
const baseURL = endpoints[endpointKey || 'production']
const exampleData = JSON.parse(fs.readFileSync(jsonPath, { encoding: 'utf8' }))

async function main () {
  const client = new Anvil({
    baseURL,
    apiKey,
  })

  const { statusCode, data } = await client.fillPDF(eid, exampleData)

  if (statusCode === 200) {
    const testDir = __dirname
    fs.writeFileSync(path.join(testDir, 'fill.output.pdf'), data, { encoding: null })
  } else {
    console.log(statusCode, JSON.stringify(data, null, 2))
  }
}

run(main)
