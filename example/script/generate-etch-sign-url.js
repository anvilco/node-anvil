const Anvil = require('../../src/index')
const argv = require('yargs')
  .usage('Usage: $0 apiKey signerEid clientUserId')
  .demandCommand(3).argv

const [apiKey, signerEid, clientUserId] = argv._

async function main () {
  const clientOptions = {
    apiKey,
  }

  const client = new Anvil(clientOptions)

  const variables = {
    signerEid,
    clientUserId,
  }

  const { statusCode, data, errors } = await client.generateEtchSignUrl({ variables })
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
