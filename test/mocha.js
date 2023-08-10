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
  // Silly, Mocha. Don't run all the tests you can find...
  ignore: './test/**/node_modules/**/*',
  require: [
    // https://mochajs.org/#-require-module-r-module
    '@babel/register',
    './test/environment.js',
  ],
  file: './test/setup.js',
  ui: 'bdd-lazy-var/getter',
  exit: true,
}
