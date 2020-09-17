const Anvil = require('../../src/index')
const argv = require('yargs')
  .usage('Usage: $0 apiKey clientUserId signerEid')
  .demandCommand(3).argv

const [apiKey, clientUserId, signerEid] = argv._

async function main () {
  const clientOptions = {
    apiKey,
  }

  const client = new Anvil(clientOptions)

  const variables = {
    clientUserId,
    signerEid,
  }

  const { statusCode, url, errors } = await client.generateEtchSignUrl({ variables })
  console.log(
    JSON.stringify({
      statusCode,
      url,
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
