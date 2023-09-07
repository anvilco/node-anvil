const Dist = require('./dist')

// This file is mainly just for cleaning up the exports to be intuitive/commonjs
module.exports = Dist.default
// This is here just for backwards compatibilty. Should be removed at next
// major verison to avoid a breaking change
module.exports.default = Dist.default
