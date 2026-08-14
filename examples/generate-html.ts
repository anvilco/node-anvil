// Generate a PDF from HTML and CSS with the Anvil API.
// https://www.useanvil.com/docs/api/generate-pdf
//
// Run: ANVIL_API_KEY=<key> yarn ts-node examples/generate-html.ts
import fs from 'fs'
import Anvil from '@anvilco/anvil'

const anvilClient = new Anvil({ apiKey: process.env['ANVIL_API_KEY'] ?? '' })

const exampleData = {
  title: 'Example HTML to PDF',
  type: 'html',
  data: {
    html: `
      <h1>What is Lorem Ipsum?</h1>
      <p>
        Lorem Ipsum is simply dummy text of the printing and typesetting
        industry, and has been the standard ever since the <strong>1500s</strong>.
      </p>
    `,
    css: 'body { font-size: 14px; color: #171717; }',
  },
}

async function main () {
  const { statusCode, data, errors } = await anvilClient.generatePDF(exampleData)
  if (statusCode !== 200 || !data) {
    console.log('Errors:', JSON.stringify(errors, null, 2))
    return
  }
  fs.writeFileSync('generate-html-output.pdf', data, { encoding: null })
  console.log('Saved generate-html-output.pdf')
}

main()
