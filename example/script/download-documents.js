const fs = require('fs')
const path = require('path')
const Anvil = require('../../src/index')
const argv = require('yargs')
  .usage('Usage: $0 apiKey documentGroupEid')
  .demandCommand(2).argv

const [apiKey, documentGroupEid] = argv._

async function main () {
  const clientOptions = {
    apiKey,
  }

  const client = new Anvil(clientOptions)

  const { statusCode, response, data, errors } = await client.downloadDocuments(documentGroupEid)
  if (statusCode === 200) {
    const contentDisposition = response.headers.get('content-disposition')
    const fileTitle = contentDisposition.split('"')[1]
    const scriptDir = __dirname
    const outputFilePath = path.join(scriptDir, fileTitle)
    const writeStream = fs.createWriteStream(outputFilePath, { encoding: null })
    await new Promise((resolve, reject) => {
      data.pipe(writeStream)
      data.on('error', reject)
      writeStream.on('finish', resolve)
    })
    console.log(statusCode, data)
  } else {
    console.log(statusCode, JSON.stringify(errors || data, null, 2))
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
