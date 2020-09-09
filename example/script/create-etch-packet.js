const path = require('path')
const Anvil = require('../../src/index')
const argv = require('yargs')
  .usage('Usage: $0 apiKey orgEid castEid fileName')
  .demandCommand(4).argv

const [apiKey, orgEid, castEid, fileName] = argv._
const pathToFile = path.resolve(__dirname, fileName)

async function main () {
  const clientOptions = {
    apiKey,
  }

  const client = new Anvil(clientOptions)

  // Example where pathToFile will be used to create a new Stream. Can also
  // pass an existing Stream or Buffer
  const streamFile = Anvil.prepareGraphQLFile(pathToFile)

  const variables = {
    organizationEid: orgEid,
    send: true,
    isTest: true,
    signatureEmailSubject: 'Test Create Packet',
    signers: [
      {
        id: 'signerOne',
        name: 'Sally Signer',
        email: 'sally@example.com',
        fields: [
          {
            fileId: 'fileUpload',
            fieldId: 'aDateField',
          },
          {
            fileId: 'fileUpload',
            fieldId: 'aSignatureField',
          },
        ],
        signerType: 'embedded',
        redirectURL: 'https://useanvil.com/etch-free-e-signatures',
      },
      {
        id: 'signerTwo',
        name: 'Scotty Signer',
        email: 'scotty@example.com',
        fields: [
          {
            fileId: 'fileUpload',
            fieldId: 'anotherSignatureField',
          },
          {
            fileId: 'preExistingCastReference',
            fieldId: 'signature1',
          },
          {
            fileId: 'preExistingCastReference',
            fieldId: 'signatureDate1',
          },
        ],
        signerType: 'embedded',
        redirectURL: 'https://useanvil.com/pdf-filling-api',
      },
    ],
    fillPayload: {
      payloads: {
        fileUpload: {
          textColor: '#CC0000',
          data: {
            myShortText: 'Something Filled',
          },
        },
        preExistingCastReference: {
          textColor: '#00CC00',
          data: {
            name: {
              firstName: 'Robin',
              lastName: 'Smith',
            },
            dateOfBirth: '2020-09-01',
            socialSecurityNumber: '456454567',
            primaryPhone: {
              num: '5554443333',
            },
          },
        },
      },
    },
    files: [
      {
        id: 'fileUpload',
        title: 'Important PDF One',
        file: streamFile,
        fields: [
          {
            id: 'myShortText',
            type: 'shortText',
            pageNum: 0,
            rect: {
              x: 20,
              y: 100,
              width: 100,
              height: 30,
            },
          },
          {
            id: 'aDateField',
            type: 'signatureDate',
            pageNum: 1,
            name: 'Some Date',
            rect: {
              x: 200,
              y: 170,
              width: 100,
              height: 30,
            },
          },
          {
            id: 'aSignatureField',
            type: 'signature',
            name: 'Some Sig',
            pageNum: 1,
            rect: {
              x: 200,
              y: 120,
              width: 100,
              height: 30,
            },
          },
          {
            id: 'anotherSignatureField',
            type: 'signature',
            name: 'Another Sig',
            pageNum: 1,
            rect: {
              x: 200,
              y: 400,
              width: 100,
              height: 30,
            },
          },
        ],
      },
      {
        id: 'preExistingCastReference',
        castEid: castEid,
      },
    ],
  }

  const { statusCode, data, errors } = await client.createEtchPacket({ variables })
  console.log(
    JSON.stringify({
      statusCode,
      data,
      errors,
    }, null, 2),
  )
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.log(err.stack || err.message)
    process.exit(1)
  })
