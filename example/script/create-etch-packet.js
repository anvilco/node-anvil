const fs = require('fs')
const path = require('path')
const Anvil = require('../../src/index')
const argv = require('yargs')
  .usage('Usage: $0 apiKey orgEid castEid, fileName')
  .option('user-agent', {
    alias: 'a',
    type: 'string',
    description: 'Set the User-Agent on any requests made (default is "Anvil API Client")',
  })
  .demandCommand(4).argv

const [apiKey, orgEid, castEid, fileName] = argv._
const userAgent = argv['user-agent']

const pathToFile = path.resolve(__dirname, fileName)

async function main () {
  const clientOptions = {
    apiKey,
  }
  if (userAgent) {
    clientOptions.userAgent = userAgent
  }

  const client = new Anvil(clientOptions)

  const fileStream = await Anvil.addStream(pathToFile)
  const base64File = fs.readFileSync(pathToFile, { encoding: 'base64' })
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
        file: fileStream,
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
        base64File: {
          filename: fileName,
          mimetype: 'application/pdf',
          data: base64File,
        },
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

  console.log(statusCode, JSON.stringify(errors || data, null, 2))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.log(err.stack || err.message)
    process.exit(1)
  })
