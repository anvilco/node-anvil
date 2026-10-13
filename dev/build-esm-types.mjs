// Copies the generated types (types/src/*.d.ts, which describe the CommonJS build) to
// types/esm/*.d.mts, for the ESM entry point (index.mjs, typed by index.d.mts).
//
// TypeScript treats a .d.ts in this package as CommonJS. Importing one from ESM, under
// Node16 module resolution, gives `module.exports` rather than the default export, so
// `import Anvil from '@anvilco/anvil'` would not be constructable. A .d.mts is ESM
// whatever the package says, so the copies describe the ESM entry point exactly.
import fs from 'fs'
import path from 'path'

import { root } from './utils.mjs'

const sourceDir = path.join(root, 'types/src')
const outDir = path.join(root, 'types/esm')

fs.rmSync(outDir, { recursive: true, force: true })

function copyDir (from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const name of fs.readdirSync(from)) {
    const fromPath = path.join(from, name)
    if (fs.statSync(fromPath).isDirectory()) {
      copyDir(fromPath, path.join(to, name))
    } else if (name.endsWith('.d.ts')) {
      let text = fs.readFileSync(fromPath, 'utf8')
      // Relative imports must point at the .d.mts copies, and ESM needs the extension
      text = text.replace(/(from |import\()(['"])(\.\.?\/[^'"]+?)(\.js)?\2/g, '$1$2$3.mjs$2')
      // The source map is for the .d.ts, not this copy
      text = text.replace(/^\/\/# sourceMappingURL=.*\n?/m, '')
      fs.writeFileSync(path.join(to, name.replace(/\.d\.ts$/, '.d.mts')), text)
    }
  }
}

copyDir(sourceDir, outDir)
