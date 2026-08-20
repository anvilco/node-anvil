// Generate a PDF from HTML and CSS via the Anvil API.
// Docs: https://www.useanvil.com/docs/api/generate-pdf#html--css-to-pdf
//
// Run it from a project with @anvilco/anvil installed:
//   ANVIL_API_KEY=yourKey node generate-html.js

import fs from 'fs'
import Anvil from '@anvilco/anvil'

// Your API key from your Anvil organization settings
const apiKey = process.env.ANVIL_API_KEY ?? ''

async function generateHTMLPDF () {
  const anvilClient = new Anvil({ apiKey })

  const { statusCode, data, errors } = await anvilClient.generatePDF({
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
        .header-two { font-style: italic; }
      `,
    },
  })

  if (statusCode === 200 && data) {
    // `data` is the generated PDF binary; save it with no encoding or the file
    // will be corrupt
    fs.writeFileSync('generate-html-output.pdf', data, { encoding: null })
    console.log('Generated PDF saved to generate-html-output.pdf')
  } else {
    console.log('Error generating PDF:', statusCode, JSON.stringify(errors, null, 2))
  }
}

generateHTMLPDF().catch((error) => {
  console.error(error)
  process.exit(1)
})
