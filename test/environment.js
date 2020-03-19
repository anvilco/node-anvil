require('@babel/register')({
  ignore: [/node_modules/],
})

var sinon = require('sinon')
var chai = require('chai')
var sinonChai = require('sinon-chai')
var chaiAsPromised = require('chai-as-promised')

chai.use(sinonChai)
chai.use(chaiAsPromised)

global.chai = chai
global.sinon = sinon
global.expect = chai.expect
global.should = chai.should()
