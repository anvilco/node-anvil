const fs = require('fs')
const path = require('path')
const Anvil = require('../../src/index')
const argv = require('yargs')
  .usage('Usage: $0 apiKey documentGroupEid')
  .option('stream', {
    alias: 's',
    type: 'boolean',
    description: 'Return the data as a stream (default is buffer)',
  })
  .demandCommand(2).argv

const [apiKey, documentGroupEid] = argv._
const returnAStream = argv.stream

async function main () {
  const clientOptions = {
    apiKey,
  }

  const client = new Anvil(clientOptions)

  const downloadOptions = {}
  if (returnAStream) downloadOptions.dataType = 'stream'

  const { statusCode, response, data, errors } = await client.downloadDocuments(documentGroupEid, downloadOptions)
  if (statusCode === 200) {
    const contentDisposition = response.headers.get('content-disposition')
    const fileTitle = contentDisposition.split('"')[1]
    const scriptDir = __dirname
    const outputFilePath = path.join(scriptDir, fileTitle)

    if (returnAStream) {
      const writeStream = fs.createWriteStream(outputFilePath, { encoding: null })
      await new Promise((resolve, reject) => {
        data.pipe(writeStream)
        data.on('error', reject)
        writeStream.on('finish', resolve)
      })
    } else {
      fs.writeFileSync(outputFilePath, data, { encoding: null })
    }

    console.log(statusCode)
  } else {
    console.log(statusCode, JSON.stringify(errors, null, 2))
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.log(err.stack || err.message)
    process.exit(1)
  })
