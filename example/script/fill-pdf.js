// Calls the fillPDF Anvil endpoint with data specified to fill a PDF with the
// Anvil API. Outputs the filled PDF in `example/script/fill.output.pdf`
//
// Usage example:
//
// # Fills a PDF then opens it in preview
// yarn node example/script/fill-pdf.js <pdfTemplateID> <apiKey> <inputJSONFile>
//
// # An example
// yarn node example/script/fill-pdf.js idabc123 apiKeydef345 ./payload.json && open example/script/fill.output.pdf
//
// `payload.json` is a json file with the JSON data used to fill the PDF. e.g.
//
// {
//   "title": "My PDF Title",
//   "fontSize": 10,
//   "textColor": "#CC0000",
//   "data": {
//     "someFieldId": "Hello World!"
//   }
// }

const fs = require('fs')
const path = require('path')
const Anvil = require('../../src/index')
const argv = require('yargs')
  .usage('Usage: $0 pdfTemplateID apiKey jsonPath.json')
  .option('user-agent', {
    alias: 'a',
    type: 'string',
    description: 'Set the User-Agent on any requests made (default is "Anvil API Client")',
  })
  .option('stream', {
    alias: 's',
    type: 'boolean',
    description: 'Return the data as a stream (default is buffer)',
  })
  .demandCommand(3).argv

const [eid, apiKey, jsonPath] = argv._
const returnAStream = argv.stream
const userAgent = argv['user-agent']

const baseURL = 'https://app.useanvil.com'
const exampleData = JSON.parse(fs.readFileSync(jsonPath, { encoding: 'utf8' }))

async function main () {
  const clientOptions = {
    baseURL,
    apiKey,
  }
  if (userAgent) {
    clientOptions.userAgent = userAgent
  }

  const client = new Anvil(clientOptions)

  const fillOptions = {}
  if (returnAStream) {
    fillOptions.dataType = 'stream'
  }

  const { statusCode, data, errors } = await client.fillPDF(eid, exampleData, fillOptions)

  if (statusCode === 200) {
    const scriptDir = __dirname
    const outputFilePath = path.join(scriptDir, 'fill.output.pdf')

    if (returnAStream) {
      const writeStream = fs.createWriteStream(outputFilePath, { encoding: null })
      await new Promise((resolve, reject) => {
        data.pipe(writeStream)
        data.on('error', reject)
        writeStream.on('finish', resolve)
      })
    } else {
      fs.writeFileSync(outputFilePath, data, { encoding: null })
    }
  } else {
    console.log(statusCode, JSON.stringify(errors || data, null, 2))
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.log(err.stack || err.message)
    process.exit(1)
  })
