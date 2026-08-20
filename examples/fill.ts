// Fill a PDF template with your data via the Anvil API.
// Docs: https://www.useanvil.com/docs/api/fill-pdf
//
// Run it from a project with @anvilco/anvil installed:
//   ANVIL_API_KEY=yourKey npx tsx fill.ts

import fs from 'fs'
import Anvil from '@anvilco/anvil'

// Your API key from your Anvil organization settings
const apiKey = process.env.ANVIL_API_KEY ?? ''

// A sample PDF template available to any account. See
// https://www.useanvil.com/help/tutorials/set-up-a-pdf-template to set up your own
const pdfTemplateID = '05xXsZko33JIO6aq5Pnr'

async function fillPDF () {
  const anvilClient = new Anvil({ apiKey })

  const { statusCode, data, errors } = await anvilClient.fillPDF(pdfTemplateID, {
    title: 'My PDF Title',
    fontSize: 10,
    textColor: '#333333',
    // IDs here match the fields configured on the PDF template
    data: {
      shortText: 'Hello World!',
      date: '2024-01-15',
      name: { firstName: 'Robin', mi: 'W', lastName: 'Smith' },
      email: 'testy@example.com',
      phone: { num: '5554443333', region: 'US', baseRegion: 'US' },
      usAddress: {
        street1: '123 Main St #234',
        city: 'San Francisco',
        state: 'CA',
        zip: '94106',
        country: 'US',
      },
      ssn: '456454567',
      ein: '897654321',
      checkbox: true,
      decimalNumber: 12345.67,
      dollar: 123.45,
      integer: 12345,
      percent: 50.3,
      longText: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    },
  })

  if (statusCode === 200 && data) {
    // `data` is the filled PDF binary; save it with no encoding or the file
    // will be corrupt
    fs.writeFileSync('fill-output.pdf', data, { encoding: null })
    console.log('Filled PDF saved to fill-output.pdf')
  } else {
    console.log('Error filling PDF:', statusCode, JSON.stringify(errors, null, 2))
  }
}

fillPDF().catch((error) => {
  console.error(error)
  process.exit(1)
})
