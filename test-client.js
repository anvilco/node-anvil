#!/usr/bin/env node

/**
 * Runs every client method against a real Anvil environment (staging by default)
 * and prints a pass or fail for each.
 *
 * Usage:
 *   ANVIL_API_KEY=<your staging API key> yarn test-client
 *
 * Environment variables:
 *   ANVIL_API_KEY           Required. An API key for the environment being tested.
 *   ANVIL_BASE_URL          Optional. Defaults to https://staging.useanvil.com
 *   ANVIL_PDF_TEMPLATE_ID   Optional. The PDF template to fill. Defaults to the first one
 *                           in your organization that has example data.
 *   ANVIL_FORGE_EID         Optional. The webform (Forge) in a Workflow to submit to.
 *                           Defaults to the first one in your organization.
 *
 * Everything this creates is test data: the Etch packet is a test packet, and the
 * Workflow submission is a test submission that gets removed at the end.
 */

const path = require('path')

// The built client, i.e. what gets published. Run `yarn build` first.
const Anvil = require('./index')

const API_KEY = process.env.ANVIL_API_KEY
const BASE_URL = process.env.ANVIL_BASE_URL || 'https://staging.useanvil.com'
const PDF_TEMPLATE_ID = process.env.ANVIL_PDF_TEMPLATE_ID
const FORGE_EID = process.env.ANVIL_FORGE_EID

const PDF_TO_SIGN = path.join(__dirname, 'test', 'assets', 'dummy.pdf')

const results = []

class Skip extends Error {}

async function check (method, fn) {
  try {
    const detail = await fn()
    results.push({ method, status: 'PASS' })
    console.log(`  PASS  ${method}${detail ? ` (${detail})` : ''}`)
  } catch (err) {
    const status = err instanceof Skip ? 'SKIP' : 'FAIL'
    results.push({ method, status, reason: err.message })
    console.log(`  ${status}  ${method}: ${err.message}`)
  }
}

function skipUnless (value, reason) {
  if (!value) throw new Skip(reason)
}

// Throws unless the response was a success with no errors
function assertOK ({ statusCode, errors }) {
  if (errors && errors.length) {
    throw new Error(`${statusCode}: ${errors.map((error) => error.message).join('; ')}`)
  }
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Expected a 2xx status, got ${statusCode}`)
  }
}

function assertPDF (data) {
  if (!Buffer.isBuffer(data) || data.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error('Expected PDF data')
  }
  return `${data.length} bytes`
}

async function main () {
  if (!API_KEY) {
    console.error('ANVIL_API_KEY is required. Usage: ANVIL_API_KEY=<your API key> yarn test-client')
    process.exit(1)
  }

  console.log(`Testing the Anvil Node client against ${BASE_URL}\n`)

  const client = new Anvil({ apiKey: API_KEY, baseURL: BASE_URL })

  // What the later steps need, found as we go
  let castEid = PDF_TEMPLATE_ID
  let castData
  let forgeEid = FORGE_EID
  let etchPacketEid
  let documentGroupEid
  let signerEid
  let weldDataEid

  await check('import (ESM) and require (CommonJS)', async () => {
    // Importing the package by its own name goes through the "exports" map in package.json,
    // the same way a consumer's import or require does. eslint's resolver doesn't know Node
    // resolves a package's own name from inside it.
    // eslint-disable-next-line import/no-unresolved
    const { default: AnvilESM } = await import('@anvilco/anvil')
    // eslint-disable-next-line import/no-unresolved
    const AnvilCJS = require('@anvilco/anvil')
    if (AnvilESM !== Anvil) throw new Error('import gave something other than the Anvil class')
    if (AnvilCJS !== Anvil) throw new Error('require gave something other than the Anvil class')

    // And the class from the ESM entry point works
    const esmClient = new AnvilESM({ apiKey: API_KEY, baseURL: BASE_URL })
    const result = await esmClient.requestGraphQL({ query: '{ currentUser { eid } }' }, { dataType: 'json' })
    assertOK(result)
    return 'both give the same class'
  })

  await check('requestGraphQL', async () => {
    const result = await client.requestGraphQL({
      query: `
        query TestClient {
          currentUser { eid }
          organization {
            eid
            casts(limit: 50) { items { eid exampleData } }
            forges(isArchived: false) { eid }
          }
        }
      `,
    }, { dataType: 'json' })
    assertOK(result)

    const { currentUser, organization } = result.data.data
    if (!currentUser || !organization) throw new Error('Expected currentUser and organization')

    const forges = organization.forges || []
    forgeEid = forgeEid || (forges[0] && forges[0].eid)

    if (castEid) {
      // The API won't fill a PDF with empty data, so use the template's example data
      const castResult = await client.requestGraphQL({
        query: 'query TestClientCast ($eid: String!) { cast(eid: $eid) { exampleData } }',
        variables: { eid: castEid },
      }, { dataType: 'json' })
      assertOK(castResult)
      castData = castResult.data.data.cast && castResult.data.data.cast.exampleData
    } else {
      const casts = (organization.casts && organization.casts.items) || []
      const cast = casts.find(({ exampleData }) =>
        exampleData && Object.keys(exampleData).length,
      )
      castEid = cast && cast.eid
      castData = cast && cast.exampleData
    }

    return `organization ${organization.eid}`
  })

  await check('requestREST', async () => {
    const result = await client.requestREST('/api/v1/generate-pdf', {
      method: 'POST',
      body: JSON.stringify({ title: 'requestREST', data: [{ content: 'Sent with requestREST' }] }),
      headers: { 'Content-Type': 'application/json' },
    }, { dataType: 'buffer' })
    assertOK(result)
    return assertPDF(result.data)
  })

  await check('generatePDF (markdown)', async () => {
    const result = await client.generatePDF({
      title: 'Markdown',
      data: [
        { label: 'Hello', content: 'From the Anvil Node client' },
        { table: { firstRowHeaders: true, rows: [['Method', 'Status'], ['generatePDF', 'PASS']] } },
      ],
    })
    assertOK(result)
    return assertPDF(result.data)
  })

  await check('generatePDF (HTML)', async () => {
    const result = await client.generatePDF({
      title: 'HTML',
      type: 'html',
      data: {
        html: '<h1>Hello</h1><p>From the Anvil Node client</p>',
        css: 'h1 { color: #4c5bf1; }',
      },
    })
    assertOK(result)
    return assertPDF(result.data)
  })

  await check('fillPDF', async () => {
    skipUnless(castEid, 'No PDF template with example data found. Set ANVIL_PDF_TEMPLATE_ID.')
    const result = await client.fillPDF(castEid, { data: castData || {} })
    assertOK(result)
    return `${castEid}, ${assertPDF(result.data)}`
  })

  await check('fillPDF (VERSION_LATEST)', async () => {
    skipUnless(castEid, 'No PDF template with example data found. Set ANVIL_PDF_TEMPLATE_ID.')
    const result = await client.fillPDF(
      castEid,
      { data: castData || {} },
      { versionNumber: Anvil.VERSION_LATEST },
    )
    assertOK(result)
    return assertPDF(result.data)
  })

  await check('createEtchPacket', async () => {
    const result = await client.createEtchPacket({
      variables: {
        name: 'Anvil Node client test',
        isTest: true,
        // Send it right away, so it has signers that can sign
        isDraft: false,
        files: [{
          id: 'testFile',
          title: 'Test File',
          file: Anvil.prepareGraphQLFile(PDF_TO_SIGN),
          fields: [{
            id: 'signature',
            type: 'signature',
            pageNum: 0,
            rect: { x: 100, y: 100, width: 150, height: 30 },
          }],
        }],
        signers: [{
          id: 'signer',
          name: 'Test Signer',
          email: 'test-signer@example.com',
          // Signs through a URL from generateEtchSignUrl rather than by email
          signerType: 'embedded',
          fields: [{ fileId: 'testFile', fieldId: 'signature' }],
        }],
      },
    })
    assertOK(result)

    const packet = result.data.data.createEtchPacket
    etchPacketEid = packet.eid
    documentGroupEid = packet.documentGroup && packet.documentGroup.eid
    signerEid = packet.documentGroup && packet.documentGroup.signers[0].eid
    return etchPacketEid
  })

  await check('getEtchPacket', async () => {
    skipUnless(etchPacketEid, 'createEtchPacket failed')
    const result = await client.getEtchPacket({ variables: { eid: etchPacketEid } })
    assertOK(result)
    if (result.data.data.etchPacket.eid !== etchPacketEid) throw new Error('Got a different packet back')
    return result.data.data.etchPacket.status
  })

  await check('generateEtchSignUrl', async () => {
    skipUnless(signerEid, 'createEtchPacket failed')
    const result = await client.generateEtchSignUrl({
      variables: { signerEid, clientUserId: 'anvil-node-test-client' },
    })
    assertOK(result)
    if (!/^https?:\/\//.test(result.url || '')) throw new Error(`Expected a URL, got ${result.url}`)
    return 'got a URL'
  })

  await check('downloadDocuments', async () => {
    skipUnless(documentGroupEid, 'createEtchPacket failed')
    const result = await client.downloadDocuments(documentGroupEid)
    assertOK(result)
    // Zip files start with "PK"
    if (result.data.subarray(0, 2).toString() !== 'PK') throw new Error('Expected a zip file')
    return `${result.data.length} bytes`
  })

  await check('forgeSubmit', async () => {
    skipUnless(forgeEid, 'No webform (Forge) found in your organization. Set ANVIL_FORGE_EID.')
    const result = await client.forgeSubmit({
      variables: { forgeEid, payload: {}, isTest: true },
    })
    assertOK(result)
    weldDataEid = result.data.data.forgeSubmit.weldData.eid
    return `${forgeEid}, created ${weldDataEid}`
  })

  await check('removeWeldData', async () => {
    skipUnless(weldDataEid, 'forgeSubmit did not create a submission')
    const result = await client.removeWeldData({ variables: { eid: weldDataEid } })
    assertOK(result)
    if (result.data.data.removeWeldData !== true) throw new Error('Expected true')
    return `removed ${weldDataEid}`
  })

  const count = (status) => results.filter((result) => result.status === status).length
  console.log(`\n${count('PASS')} passed, ${count('FAIL')} failed, ${count('SKIP')} skipped`)

  if (count('FAIL')) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
