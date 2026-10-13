// Create an Etch e-sign packet from your own PDF via the Anvil API: upload the
// file, place the fields on it, pre-fill some of them, and send it to a signer.
// Docs: https://www.useanvil.com/docs/api/e-signatures
//
// Run it from this directory, in a project with @anvilco/anvil installed:
//   ANVIL_API_KEY=yourKey node sign-upload.js your.real.email@example.com
//
// A signature request email is sent to the address you pass, so use your real
// email address. The new packet also appears in your dashboard's e-sign area.

import Anvil from '@anvilco/anvil'

// Your API key from your Anvil organization settings
const apiKey = process.env.ANVIL_API_KEY ?? ''

// The PDF to upload. A sample NDA is included here; point this at your own
const pdfPath = './static/test-pdf-nda.pdf'

const signerName = 'Testy Signer'
const signerEmail = process.argv[2] ?? ''

if (!signerEmail) {
  console.log('Enter your email address as the script\'s 1st argument')
  process.exit(1)
}

async function createEtchPacketFromUpload () {
  const anvilClient = new Anvil({ apiKey })

  // Wraps the file for upload. It also takes a Buffer, a stream or a File;
  // pass { filename, mimetype } when they can't be worked out from the input.
  // The file is streamed to the API rather than read into memory
  const ndaFile = Anvil.prepareGraphQLFile(pdfPath)

  const { statusCode, data, errors } = await anvilClient.createEtchPacket({
    variables: {
      // The packet is ready to send: an email goes to the signer. Use
      // isDraft: true to review it in the dashboard first
      isDraft: false,

      // Test packets use development signatures and do not count toward
      // your billed packets
      isTest: true,

      name: `NDA - ${signerName}`,
      signatureEmailSubject: 'Please sign the NDA',

      files: [
        {
          // Your own ID for referencing this file in `data` and
          // `signers` below
          id: 'uploadedNDA',
          title: 'Demo NDA',
          file: ndaFile,

          // Where each field sits on the uploaded PDF, in points from
          // the top-left of the page. Set up a template in the dashboard
          // instead to place fields visually
          fields: [
            {
              id: 'effectiveDate',
              type: 'date',
              rect: { x: 326, y: 92, height: 12, width: 112 },
              format: 'MM/DD/YYYY',
              pageNum: 0,
            },
            {
              id: 'disclosingPartyName',
              type: 'fullName',
              rect: { x: 215, y: 107, height: 12, width: 140 },
              pageNum: 0,
            },
            {
              id: 'recipientName',
              type: 'fullName',
              rect: { x: 223, y: 120, height: 12, width: 140 },
              pageNum: 0,
            },
            {
              id: 'recipientEmail',
              type: 'email',
              rect: { x: 367, y: 120, height: 12, width: 166 },
              pageNum: 0,
            },
            {
              id: 'recipientSignature',
              type: 'signature',
              rect: { x: 270, y: 374, height: 22, width: 142 },
              pageNum: 1,
            },
            {
              id: 'recipientSignatureDate',
              type: 'signatureDate',
              rect: { x: 419, y: 374, height: 22, width: 80 },
              pageNum: 1,
            },
          ],
        },
      ],

      // This data fills the PDF before it is sent to the signer. IDs here
      // match the fields placed above
      data: {
        payloads: {
          uploadedNDA: {
            fontSize: 8,
            textColor: '#0000CC',
            data: {
              effectiveDate: '2026-01-30',
              disclosingPartyName: 'Acme Co.',
              recipientName: signerName,
              recipientEmail: signerEmail,
            },
          },
        },
      },

      signers: [
        {
          id: 'recipient',
          name: signerName,
          email: signerEmail,
          signerType: 'email',

          // The fields this signer clicks through, in this order
          fields: [
            { fileId: 'uploadedNDA', fieldId: 'recipientSignature' },
            { fileId: 'uploadedNDA', fieldId: 'recipientSignatureDate' },
          ],
        },
      ],
    },
  })

  if (errors) {
    // GraphQL can return a 200 status code even when there are errors
    console.log(
      'There were errors:', statusCode, JSON.stringify(errors, null, 2)
    )
  } else {
    const packetDetails = data?.data?.createEtchPacket
    console.log(
      'Visit the new packet on your dashboard:', packetDetails?.detailsURL
    )
  }
}

createEtchPacketFromUpload().catch((error) => {
  console.error(error)
  process.exit(1)
})
