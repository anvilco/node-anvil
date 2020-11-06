// Calls the generatePDF Anvil endpoint with data specified to generate a PDF
// with the Anvil API. Outputs the generated PDF in `example/script/generate.output.pdf`
//
// Usage examples:
//
// # Generates a PDF
// yarn node example/script/generate-pdf.js <apiKey> [<inputJSONFile>]
//
// # Generates a PDF with default data, then open the new PDF in preview
// yarn node example/script/generate-pdf.js 5vqCxtgNsA2uzgMH0ps4cyQyadhA2Wdt && open example/script/generate.output.pdf
//
// # Generate a PDF with your payload, then open the new PDF in preview
// yarn node example/script/generate-pdf.js apiKeydef345 ./payload.json && open example/script/generate.output.pdf
//
// `payload.json` is an optional JSON file with the JSON data used to generate the PDF. e.g.
//
// {
//   "title": "My PDF Title",
//   "data": [{
//     "label": "Hello World!",
//     "content": "Lorem **ipsum** dolor sit _amet_."
//   }]
// }

const fs = require('fs')
const path = require('path')
const Anvil = require('../../src/index')
const argv = require('yargs')
  .usage('Usage: $0 apiKey')
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
  .demandCommand(1).argv

const [apiKey, jsonPath] = argv._
const returnAStream = argv.stream
const userAgent = argv['user-agent']

const baseURL = 'https://app.useanvil.com'

const exampleData = jsonPath
  ? JSON.parse(fs.readFileSync(jsonPath, { encoding: 'utf8' }))
  : {
    title: 'Example Invoice',
    data: [{
      label: 'Name',
      content: 'Sally Jones',
    }, {
      content: 'Lorem **ipsum** dolor sit _amet_, consectetur adipiscing elit, sed [do eiusmod](https://www.useanvil.com/docs) tempor incididunt ut labore et dolore magna aliqua. Ut placerat orci nulla pellentesque dignissim enim sit amet venenatis.\n\nMi eget mauris pharetra et ultrices neque ornare aenean.\n\n* Sagittis eu volutpat odio facilisis.\n\n* Erat nam at lectus urna.',
    }, {
      table: {
        firstRowHeaders: true,
        rows: [
          ['Description', 'Quantity', 'Price'],
          ['4x Large Widgets', '4', '$40.00'],
          ['10x Medium Sized Widgets in dark blue', '10', '$100.00'],
          ['10x Small Widgets in white', '6', '$60.00'],
        ],
      },
    }],
  }

async function main () {
  const clientOptions = {
    baseURL,
    apiKey,
  }
  if (userAgent) {
    clientOptions.userAgent = userAgent
  }

  const client = new Anvil(clientOptions)

  const generateOptions = {}
  if (returnAStream) {
    generateOptions.dataType = 'stream'
  }

  const { statusCode, data, errors } = await client.generatePDF(exampleData, generateOptions)

  if (statusCode === 200) {
    const scriptDir = __dirname
    const outputFilePath = path.join(scriptDir, 'generate.output.pdf')

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
