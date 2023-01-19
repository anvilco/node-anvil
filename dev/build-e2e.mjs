import path from 'path'
// import fs from 'fs'
// import { readdir } from 'fs/promises'
// import {fileURLToPath} from 'url'
import { execSync } from 'child_process'

import {
  root,
  isDryRun as isDryRunFn,
  getTarballNameFromOutput,
  ensureDirectory,
} from './utils.mjs'

let isDryRun = isDryRunFn()
// isDryRun = true

const e2eDir = path.join(root, 'test/e2e')
ensureDirectory(e2eDir)

// Pack the thing....
const packageName = 'node-anvil'
const options = [
  `--pack-destination ${e2eDir}`,
]

if (isDryRun) {
  options.push(
    '--dry-run',
  )
}

const args = options.join(' ')
const command = `npm pack ${args}`

let tarballName = await execSync(
  command,
  {
    cwd: root,
  },
)
tarballName = getTarballNameFromOutput(tarballName.toString())

// Rename the thing
const orginalPath = path.join(e2eDir, tarballName)
const newPath = path.join(e2eDir, `${packageName}.tgz`)

await execSync(`mv ${orginalPath} ${newPath}`)
