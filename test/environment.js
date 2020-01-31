require('@babel/register')({
  ignore: [/node_modules/],
})

require('@babel/polyfill')
var sinon = require('sinon')
var chai = require('chai')
var sinonChai = require('sinon-chai')

chai.use(sinonChai)

global.chai = chai
global.sinon = sinon
global.expect = chai.expect
global.should = chai.should()
