// Create an Etch e-sign packet via the Anvil API and send it to a signer.
// Docs: https://www.useanvil.com/docs/api/e-signatures
//
// Run it from a project with @anvilco/anvil installed:
//   ANVIL_API_KEY=yourKey node create-etch-packet.js your.real.email@example.com
//
// A signature request email is sent to the address you pass, so use your real
// email address. The new packet also appears in your dashboard's e-sign area.

import Anvil from '@anvilco/anvil'

// Your API key from your Anvil organization settings
const apiKey = process.env.ANVIL_API_KEY ?? ''

// A sample PDF template available to any account. See
// https://www.useanvil.com/help/tutorials/set-up-a-pdf-template to set up your own
const pdfTemplateID = '05xXsZko33JIO6aq5Pnr'

const signerName = 'Testy Signer'
const signerEmail = process.argv[2] ?? ''

if (!signerEmail) {
  console.log('Enter your email address as the script\'s 1st argument')
  process.exit(1)
}

async function createEtchPacket () {
  const anvilClient = new Anvil({ apiKey })

  const { statusCode, data, errors } = await anvilClient.createEtchPacket({
    variables: {
      // The packet is ready to send: an email goes to the first signer.
      // Use isDraft: true to review it in the dashboard first
      isDraft: false,

      // Test packets use development signatures and do not count toward
      // your billed packets
      isTest: true,

      name: `Test Docs - ${signerName}`,
      signatureEmailSubject: 'Custom email subject',
      signatureEmailBody: 'Custom please sign these documents....',

      files: [
        {
          // Your own ID for referencing this file in `data` and `signers` below
          id: 'sampleTemplate',
          castEid: pdfTemplateID,
        },
      ],

      data: {
        // This data fills the PDF before it is sent to any signers. IDs here
        // match the fields configured on the PDF template
        payloads: {
          sampleTemplate: {
            data: {
              name: signerName,
              email: signerEmail,
            },
          },
        },
      },

      signers: [
        // Signers sign in the order they are specified in this array
        {
          id: 'signer1',
          name: signerName,
          email: signerEmail,
          signerType: 'email',

          // The fields this signer clicks through, in this order
          fields: [
            {
              fileId: 'sampleTemplate',
              fieldId: 'signature',
            },
          ],
        },
      ],
    },
  })

  if (errors) {
    // GraphQL can return a 200 status code even when there are errors
    console.log('There were errors:', statusCode, JSON.stringify(errors, null, 2))
  } else {
    const packetDetails = data?.data?.createEtchPacket
    console.log('Visit the new packet on your dashboard:', packetDetails?.detailsURL)
  }
}

createEtchPacket().catch((error) => {
  console.error(error)
  process.exit(1)
})
