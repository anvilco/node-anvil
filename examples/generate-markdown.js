// Generate a PDF from Markdown-structured data via the Anvil API.
// Docs: https://www.useanvil.com/docs/api/generate-pdf#markdown-to-pdf
//
// Run it from a project with @anvilco/anvil installed:
//   ANVIL_API_KEY=yourKey node generate-markdown.js

import fs from 'fs'
import Anvil from '@anvilco/anvil'

// Your API key from your Anvil organization settings
const apiKey = process.env.ANVIL_API_KEY ?? ''

async function generateMarkdownPDF () {
  const anvilClient = new Anvil({ apiKey })

  const { statusCode, data, errors } = await anvilClient.generatePDF({
    title: 'Example Invoice',
    data: [{
      label: 'Name',
      content: 'Sally Jones',
    }, {
      content: 'Lorem **ipsum** dolor sit _amet_, consectetur adipiscing elit, sed [do eiusmod](https://www.useanvil.com/docs) tempor incididunt ut labore et dolore magna aliqua.\n\n* Sagittis eu volutpat odio facilisis.\n\n* Erat nam at lectus urna.',
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
  })

  if (statusCode === 200 && data) {
    // `data` is the generated PDF binary; save it with no encoding or the file
    // will be corrupt
    fs.writeFileSync('generate-markdown-output.pdf', data, { encoding: null })
    console.log('Generated PDF saved to generate-markdown-output.pdf')
  } else {
    console.log('Error generating PDF:', statusCode, JSON.stringify(errors, null, 2))
  }
}

generateMarkdownPDF().catch((error) => {
  console.error(error)
  process.exit(1)
})
