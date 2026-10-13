// Embedded e-signing via the Anvil API: create a packet whose signer signs
// inside your own app, get the URL to show them, check on the packet, and
// download its documents.
// Docs: https://www.useanvil.com/docs/api/e-signatures
//
// Run it from a project with @anvilco/anvil installed:
//   ANVIL_API_KEY=yourKey npx tsx sign-embedded.ts your.real.email@example.com
//
// Embedded signers are not emailed; the packet appears in your dashboard's
// e-sign area.

import fs from 'fs'
import Anvil, { GraphQLResponse, RESTResponse } from '@anvilco/anvil'

// Your API key from your Anvil organization settings
const apiKey = process.env.ANVIL_API_KEY ?? ''

// A sample PDF template available to any account. See
// https://www.useanvil.com/help/tutorials/set-up-a-pdf-template
// to set up your own
const pdfTemplateID = '05xXsZko33JIO6aq5Pnr'

const signerName = 'Testy Signer'
const signerEmail = process.argv[2] ?? ''

if (!signerEmail) {
  console.log('Enter your email address as the script\'s 1st argument')
  process.exit(1)
}

async function embeddedSigning () {
  const anvilClient = new Anvil({ apiKey })

  // 1. Create the packet, with a signer who will sign in your app
  const packet: GraphQLResponse = await anvilClient.createEtchPacket({
    variables: {
      isDraft: false,
      isTest: true,
      name: `Embedded signing - ${signerName}`,
      files: [{ id: 'sampleTemplate', castEid: pdfTemplateID }],
      data: {
        payloads: {
          sampleTemplate: {
            data: { name: signerName, email: signerEmail },
          },
        },
      },
      signers: [
        {
          id: 'signer1',
          name: signerName,
          email: signerEmail,
          // 'embedded' signers sign through a URL you show them, rather
          // than one emailed to them
          signerType: 'embedded',
          fields: [{ fileId: 'sampleTemplate', fieldId: 'signature' }],
        },
      ],
    },
  })

  if (packet.errors) {
    console.log(
      'Error creating the packet:', packet.statusCode,
      JSON.stringify(packet.errors, null, 2)
    )
    return
  }

  const { eid: packetEid, documentGroup } = packet.data?.data?.createEtchPacket
  const signerEid = documentGroup.signers[0].eid
  console.log('Created packet', packetEid)

  // 2. Get the URL for the signer. Show it in an iframe or redirect to it
  const signURL = await anvilClient.generateEtchSignUrl({
    variables: {
      signerEid,
      // Your own ID for the user who is signing
      clientUserId: 'user-123',
    },
  })

  if (signURL.errors) {
    console.log(
      'Error generating the sign URL:', signURL.statusCode,
      JSON.stringify(signURL.errors, null, 2)
    )
    return
  }

  console.log('Send the signer to:', signURL.url)

  // 3. Check on the packet, e.g. after your app is told that signing is done.
  // Webhooks can tell you instead: https://www.useanvil.com/docs/api/webhooks
  const status: GraphQLResponse = await anvilClient.getEtchPacket({
    variables: { eid: packetEid },
  })
  const { status: packetStatus, numberRemainingSigners } =
    status.data?.data?.etchPacket
  console.log(
    `Packet status: ${packetStatus}, signers remaining: ${numberRemainingSigners}`
  )

  // 4. Download the packet's documents as a zip. Once everyone has signed,
  // these are the signed versions
  const download: RESTResponse = await anvilClient.downloadDocuments(documentGroup.eid)

  if (download.statusCode === 200 && download.data) {
    // The API names the zip after the packet
    const contentDisposition = download.response?.headers.get('content-disposition') ?? ''
    const filename = contentDisposition.split('"')[1] || 'documents.zip'
    // `data` is the zip binary; save it with no encoding or the file will
    // be corrupt
    fs.writeFileSync(filename, download.data, { encoding: null })
    console.log('Documents saved to', filename)
  } else {
    console.log(
      'Error downloading documents:', download.statusCode,
      JSON.stringify(download.errors, null, 2)
    )
  }
}

embeddedSigning().catch((error) => {
  console.error(error)
  process.exit(1)
})
