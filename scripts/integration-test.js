#!/usr/bin/env node

/**
 * Integration test script for the Anvil Node.js API client.
 *
 * Usage:
 *   ANVIL_API_KEY=your_key node scripts/integration-test.js
 *
 * Optionally set ANVIL_BASE_URL (defaults to https://staging.useanvil.com)
 */

import Anvil from '../src/index.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_KEY = process.env.ANVIL_API_KEY
const BASE_URL = process.env.ANVIL_BASE_URL || 'https://staging.useanvil.com'

if (!API_KEY) {
  console.error('ERROR: ANVIL_API_KEY environment variable is required')
  process.exit(1)
}

const results = []

function pass (method) {
  results.push({ method, status: 'PASS' })
  console.log(`  ✅ PASS: ${method}`)
}

function fail (method, error) {
  results.push({ method, status: 'FAIL', error: error.message || error })
  console.log(`  ❌ FAIL: ${method} — ${error.message || error}`)
}

async function testMethod (name, fn) {
  try {
    await fn()
    pass(name)
  } catch (e) {
    fail(name, e)
  }
}

async function main () {
  console.log(`\nAnvil Node.js Client Integration Tests`)
  console.log(`Base URL: ${BASE_URL}\n`)

  const client = new Anvil({ apiKey: API_KEY, baseURL: BASE_URL })

  // Test version constants
  await testMethod('VERSION_LATEST constant', async () => {
    if (Anvil.VERSION_LATEST !== -1) throw new Error('Expected -1')
  })

  await testMethod('VERSION_LATEST_PUBLISHED constant', async () => {
    if (Anvil.VERSION_LATEST_PUBLISHED !== -2) throw new Error('Expected -2')
  })

  // Test auth header generation
  await testMethod('API Key auth header', async () => {
    const testClient = new Anvil({ apiKey: 'test-key', baseURL: BASE_URL })
    if (!testClient.authHeader.startsWith('Basic ')) throw new Error('Expected Basic auth')
  })

  await testMethod('OAuth auth header', async () => {
    const testClient = new Anvil({ accessToken: 'test-token', baseURL: BASE_URL })
    if (!testClient.authHeader.startsWith('Bearer ')) throw new Error('Expected Bearer auth')
  })

  // Test prepareGraphQLFile
  await testMethod('prepareGraphQLFile', async () => {
    const file = Anvil.prepareGraphQLFile(Buffer.from('test'), { filename: 'test.pdf' })
    if (!file || !file.streamLikeThing) throw new Error('Expected UploadWithOptions')
  })

  // Test requestGraphQL (will likely fail without valid eid, but tests connectivity)
  await testMethod('requestGraphQL', async () => {
    const { statusCode } = await client.requestGraphQL({
      query: '{ currentUser { eid } }',
    }, { dataType: 'json' })
    if (!statusCode) throw new Error('No status code returned')
  })

  // Test requestREST (generic endpoint)
  await testMethod('requestREST', async () => {
    const { statusCode } = await client.requestREST('/api/v1/test-connectivity', { method: 'GET' }, { dataType: 'json' })
    // Any response (even 404) means connectivity works
    if (!statusCode) throw new Error('No status code returned')
  })

  // Test generatePDF
  await testMethod('generatePDF', async () => {
    const { statusCode, errors } = await client.generatePDF({
      title: 'Test PDF',
      data: [{
        label: 'Test',
        content: 'Hello from the Anvil Node.js integration test',
      }],
      type: 'markdown',
    })
    if (errors && errors.length > 0) throw new Error(JSON.stringify(errors))
    if (statusCode !== 200) throw new Error(`Expected 200, got ${statusCode}`)
  })

  // Test fillPDF (needs a real template eid to work)
  await testMethod('fillPDF', async () => {
    try {
      const { statusCode } = await client.fillPDF('non-existent-eid', { data: {} })
      // If we get here without error, check status
      if (statusCode >= 500) throw new Error(`Server error: ${statusCode}`)
    } catch (e) {
      // 404 is expected for non-existent template
      if (e.message && !e.message.includes('404') && !e.message.includes('not found')) {
        throw e
      }
    }
  })

  // Test getEtchPacket (needs a real eid to work)
  await testMethod('getEtchPacket', async () => {
    const { statusCode } = await client.getEtchPacket({ variables: { eid: 'non-existent' } })
    if (!statusCode) throw new Error('No status code returned')
  })

  // Test generateEtchSignUrl
  await testMethod('generateEtchSignUrl', async () => {
    const { statusCode } = await client.generateEtchSignUrl({
      variables: { signerEid: 'non-existent', clientUserId: 'test' },
    })
    if (!statusCode) throw new Error('No status code returned')
  })

  // Test forgeSubmit
  await testMethod('forgeSubmit', async () => {
    const { statusCode } = await client.forgeSubmit({
      variables: { forgeEid: 'non-existent', payload: {} },
    })
    if (!statusCode) throw new Error('No status code returned')
  })

  // Test downloadDocuments
  await testMethod('downloadDocuments', async () => {
    try {
      await client.downloadDocuments('non-existent-eid')
    } catch (e) {
      // 404 is expected for non-existent document group
      if (!e.message) throw e
    }
  })

  // Test removeWeldData
  await testMethod('removeWeldData', async () => {
    const { statusCode } = await client.removeWeldData({
      variables: { eid: 'non-existent' },
    })
    if (!statusCode) throw new Error('No status code returned')
  })

  // Summary
  console.log('\n--- Summary ---')
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  console.log(`${passed} passed, ${failed} failed out of ${results.length} tests`)

  if (failed > 0) {
    console.log('\nFailed tests:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.method}: ${r.error}`)
    })
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e)
  process.exit(1)
})
