const path = require('path')
const Anvil = require('../../src/index')
const argv = require('yargs')
  .usage('Usage: $0 apiKey orgEid castEid, fileName')
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
    send: false,
    isTest: true,
    signers: [
      {
        id: 'signerOne',
        name: 'Sally Signer',
        email: 'sally@example.com',
        fields: [
          {
            fileId: 'fileOne',
            fieldId: 'aDateField',
          },
          {
            fileId: 'fileOne',
            fieldId: 'aSignatureField',
          },
        ],
      },
      {
        id: 'signerTwo',
        name: 'Scotty Signer',
        email: 'scotty@example.com',
        fields: [
          {
            fileId: 'base64upload',
            fieldId: 'anotherSignatureField',
          },
        ],
      },
    ],
    files: [
      {
        id: 'fileUpload',
        title: 'Important PDF One',
        file: streamFile,
        fields: [
          {
            aliasId: 'aDateField',
            type: 'signatureDate',
            pageNum: 1,
            rect: {
              x: 203.88,
              y: 171.66,
              width: 33.94,
              height: 27.60,
            },
          },
          {
            aliasId: 'aSignatureField',
            type: 'signature',
            pageNum: 1,
            rect: {
              x: 203.88,
              y: 121.66,
              width: 33.94,
              height: 27.60,
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

  // Show this to the world?
  const responseQuery = `{
    id
    eid
    payload
    etchTemplate {
      id
      eid
      config
      casts {
        id
        eid
        config
      }
    }
  }`

  const { statusCode, data, errors } = await client.createEtchPacket({ variables, responseQuery })
  console.log(
    JSON.stringify({
      statusCode,
      data,
      errors,
    }),
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
