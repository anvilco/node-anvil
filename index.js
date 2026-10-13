const Dist = require('./dist')

// This file is mainly just for cleaning up the exports to be intuitive/commonjs
module.exports = Dist.default
// TypeScript projects that are CommonJS and don't use esModuleInterop compile
// `import Anvil from '@anvilco/anvil'` to `require('@anvilco/anvil').default`,
// so this stays. ES modules get index.mjs instead; see "exports" in package.json.
module.exports.default = Dist.default
