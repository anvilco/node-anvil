// See our invoice template repo for a more complete HTML to PDF example:
// https://github.com/anvilco/html-pdf-invoice-template

// Calls the generatePDF Anvil endpoint with HTML and CSS data specified to
// generate a PDF with the Anvil API. Outputs the generated PDF in
// `example/script/generate.output.pdf`
//
// Usage examples:
//
// # Generates a PDF
// yarn node example/script/generate-html-to-pdf.js <apiKey>
//
// # Generates a PDF with default data, then open the new PDF in preview
// yarn node example/script/generate-html-to-pdf.js 5vqCxtgNsA2uzgMH0ps4cyQyadhA2Wdt && open example/script/generate.output.pdf

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

const [apiKey] = argv._
const returnAStream = argv.stream
const userAgent = argv['user-agent']

const baseURL = 'https://app.useanvil.com'

const exampleData = {
  title: 'Example HTML to PDF',
  type: 'html',
  data: {
    html: `
      <h1 class='header-one'>What is Lorem Ipsum?</h1>
      <p>
        Lorem Ipsum is simply dummy text of the printing and typesetting
        industry. Lorem Ipsum has been the industry's standard dummy text
        ever since the <strong>1500s</strong>, when an unknown printer took
        a galley of type and scrambled it to make a type specimen book.
      </p>
      <h3 class='header-two'>Where does it come from?</h3>
      <p>
        Contrary to popular belief, Lorem Ipsum is not simply random text.
        It has roots in a piece of classical Latin literature from
        <i>45 BC</i>, making it over <strong>2000</strong> years old.
      </p>
    `,
    css: `
      body { font-size: 14px; color: #171717; }
      .header-one { text-decoration: underline; }
      .header-two { font-style: underline; }
    `,
  },
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
