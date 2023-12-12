// This file is mainly just for cleaning up the exports to be intuitive/commonjs
module.exports = require('./dist/Anvil.js').default
// This is here just for backwards compatibilty. Should be removed at next
// major verison to avoid a breaking change
module.exports.default = require('./dist/Anvil.js').default
