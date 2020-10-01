const fs = require('fs')

const IGNORE_FILES = ['index.js']

module.exports = fs.readdirSync(__dirname)
  .filter((fileName) => (fileName.endsWith('.js') && !fileName.startsWith('.') && !IGNORE_FILES.includes(fileName)))
  .reduce((acc, fileName) => {
    const queryName = fileName.slice(0, fileName.length - 3)
    acc[queryName] = require(`./${queryName}`)
    return acc
  }, {})
