const fs = require('fs')
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

  // Stream example. Can also use prepareGraphQLBuffer for Buffers
  const streamFile = Anvil.prepareGraphQLStream(pathToFile)

  // Base64 data example. Filename and mimetype are required with a Base64 upload.
  const base64Data = fs.readFileSync(pathToFile, { encoding: 'base64' })
  const base64File = Anvil.prepareGraphQLBase64(base64Data, { filename: fileName, mimetype: 'application/pdf' })

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
        id: 'base64upload',
        title: 'Important PDF 2',
        base64File: base64File,
        fields: [
          {
            aliasId: 'anotherSignatureField',
            type: 'signature',
            pageNum: 1,
            rect: {
              x: 203.88,
              y: 171.66,
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
  console.log({
    statusCode,
    data,
    errors,
  })
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.log(err.stack || err.message)
    process.exit(1)
  })
