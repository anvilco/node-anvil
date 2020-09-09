'use strict'

module.exports = {
  diff: true,
  delay: false,
  extension: ['js'],
  package: './package.json',
  reporter: 'spec',
  slow: 75,
  timeout: 2000,
  spec: './test/**/*.test.js',
  require: [
    './test/environment.js',
  ],
  file: './test/setup.js',
  ui: 'bdd-lazy-var/getter',
  exit: true,
}
