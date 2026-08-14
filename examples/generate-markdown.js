// Generate a PDF from Markdown with the Anvil API.
// https://www.useanvil.com/docs/api/generate-pdf
//
// Run: ANVIL_API_KEY=<key> node examples/generate-markdown.js
const fs = require('fs')
const Anvil = require('@anvilco/anvil')

const anvilClient = new Anvil({ apiKey: process.env.ANVIL_API_KEY })

const exampleData = {
  title: 'Example Invoice',
  data: [{
    label: 'Name',
    content: 'Sally Jones',
  }, {
    content: 'Lorem **ipsum** dolor sit _amet_, consectetur adipiscing elit.',
  }, {
    table: {
      firstRowHeaders: true,
      rows: [
        ['Description', 'Quantity', 'Price'],
        ['4x Large Widgets', '4', '$40.00'],
        ['10x Medium Widgets', '10', '$100.00'],
      ],
    },
  }],
}

async function main () {
  const { statusCode, data, errors } = await anvilClient.generatePDF(exampleData)
  if (statusCode !== 200) {
    console.log('Errors:', JSON.stringify(errors, null, 2))
    return
  }
  fs.writeFileSync('generate-markdown-output.pdf', data, { encoding: null })
  console.log('Saved generate-markdown-output.pdf')
}

main()
