// Fill a PDF template with the Anvil API.
// https://www.useanvil.com/docs/api/fill-pdf
//
// Run: ANVIL_API_KEY=<key> yarn ts-node examples/fill.ts
import fs from 'fs'
import Anvil from '@anvilco/anvil'

// Sample template available to anyone; make your own at
// https://www.useanvil.com/help/tutorials/set-up-a-pdf-template
const pdfTemplateID = '05xXsZko33JIO6aq5Pnr'
const anvilClient = new Anvil({ apiKey: process.env['ANVIL_API_KEY'] ?? '' })

const exampleData = {
  title: 'My PDF Title',
  fontSize: 10,
  textColor: '#333333',
  data: {
    shortText: 'Hello World!',
    name: { firstName: 'Robin', lastName: 'Smith' },
    email: 'robin@example.com',
  },
}

async function main () {
  const { statusCode, data, errors } = await anvilClient.fillPDF(pdfTemplateID, exampleData)
  if (statusCode !== 200 || !data) {
    console.log('Errors:', JSON.stringify(errors, null, 2))
    return
  }
  // `data` is the filled PDF binary; save with no encoding or the file corrupts.
  fs.writeFileSync('fill-output.pdf', data, { encoding: null })
  console.log('Saved fill-output.pdf')
}

main()
