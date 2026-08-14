// Create an e-sign packet with the Anvil API.
// https://www.useanvil.com/docs/api/e-signatures
//
// Run: ANVIL_API_KEY=<key> yarn ts-node examples/create-etch-packet.ts <your.email@example.com>
import Anvil, { GraphQLResponse } from '@anvilco/anvil'

const pdfTemplateID = '05xXsZko33JIO6aq5Pnr'
const signerName = 'Testy Signer'
const signerEmail = process.argv[2] ?? ''
const anvilClient = new Anvil({ apiKey: process.env['ANVIL_API_KEY'] ?? '' })

if (!signerEmail) {
  console.log('Usage: yarn ts-node examples/create-etch-packet.ts <your.email@example.com>')
  process.exit(1)
}

const variables = {
  isDraft: false,
  // Test packets use development signatures and do not count toward billing.
  isTest: true,
  name: `Test Docs - ${signerName}`,
  files: [{ id: 'sampleTemplate', castEid: pdfTemplateID }],
  data: {
    payloads: {
      sampleTemplate: { data: { name: signerName, email: signerEmail } },
    },
  },
  signers: [{
    id: 'signer1',
    name: signerName,
    email: signerEmail,
    signerType: 'email',
    fields: [{ fileId: 'sampleTemplate', fieldId: 'signature' }],
  }],
}

async function main () {
  const { data, errors }: GraphQLResponse = await anvilClient.createEtchPacket({ variables })
  if (errors) {
    console.log('Errors:', JSON.stringify(errors, null, 2))
    return
  }
  console.log('Packet created:', data?.data['createEtchPacket'].detailsURL)
}

main()
