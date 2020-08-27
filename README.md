# Anvil API Client for Node

[Anvil](https://useanvil.com) is a suite of tools for managing document-based workflows:

1. Anvil [Workflows](https://useanvil.com) converts your PDF forms into simple, intuitive websites that fill the PDFs and gather signatures for you.
2. Anvil [PDF Filling API](https://useanvil.com/pdf-filling-api) allows you to fill any PDF with JSON data.

Currently, this node client only supports our PDF filling API.

## Usage

```sh
yarn add @anvilco/anvil
```

```sh
npm install @anvilco/anvil
```

A basic example converting your JSON to a filled PDF, then saving the PDF to a file:

```js
import fs from 'fs'
import Anvil from '@anvilco/anvil'

// The ID of the PDF template to fill
const pdfTemplateID = 'kA6Da9CuGqUtc6QiBDRR'
// Your API key from your Anvil organization settings
const apiKey = '7j2JuUWmN4fGjBxsCltWaybHOEy3UEtt'

// JSON data to fill the PDF
const exampleData = {
  "title": "My PDF Title",
  "fontSize": 10,
  "textColor": "#CC0000",
  "data": {
    "someFieldId": "Hello World!"
  }
}
const anvilClient = new Anvil({ apiKey })
const { statusCode, data } = await anvilClient.fillPDF(pdfTemplateID, exampleData)

console.log(statusCode) // => 200

// Data will be the filled PDF raw bytes
fs.writeFileSync('output.pdf', data, { encoding: null })
```

## API

### Instance Methods

##### new Anvil(options)

Creates an Anvil client instance.

* `options` (Object) - [Options](#options) for the Anvil Client instance.

```js
const anvilClient = new Anvil({ apiKey: 'abc123' })
```
<br />

##### fillPDF(pdfTemplateID, payload[, options])

Fills a PDF with your JSON data.

First, you will need to have [uploaded a PDF to Anvil](https://useanvil.com/api/fill-pdf). You can find the PDF template's id on the `API Info` tab of your PDF template's page:

<img width="725" alt="pdf-template-id" src="https://user-images.githubusercontent.com/69169/73693549-4a598280-468b-11ea-81a3-5df4472de8a4.png">

An example:

```js
const pdfTemplateID = 'kA6Da9CuGqUtc6QiBDRR'
// Your API key from your Anvil organization settings
const apiKey = '7j2JuUWmN4fGjBxsCltWaybHOEy3UEtt'

// JSON data to fill the PDF
const payload = {
  "title": "My PDF Title",
  "fontSize": 10,
  "textColor": "#CC0000",
  "data": {
    "someFieldId": "Hello World!"
  }
}
// The 'options' parameter is optional
const options = {
  "dataType": "buffer"
}
const anvilClient = new Anvil({ apiKey })
const { statusCode, data } = await anvilClient.fillPDF(pdfTemplateID, payload, options)
```

* `pdfTemplateID` (String) - The id of your PDF template from the Anvil UI
* `payload` (Object) - The JSON data that will fill the PDF template
  * `title` (String) - _optional_ Set the title encoded into the PDF document
  * `fontSize` (Number) - _optional_ Set the fontSize of all filled text. Default is 10.
  * `color` (String) - _optional_ Set the text color of all filled text. Default is dark blue.
  * `data` (Object) - The data to fill the PDF. The keys in this object will correspond to a field's ID in the PDF. These field IDs and their types are available on the `API Info` tab on your PDF template's page in the Anvil dashboard.
    * For example `{ "someFieldId": "Hello World!" }`
* `options` (Object) - _optional_ Any additional options for the request
  * `dataType` (Enum[String]) - _optional_ Set the type of the `data` value that is returned in the resolved `Promise`. Defaults to `'buffer'`, but `'stream'` is also supported.
* Returns a `Promise` that resolves to an `Object`
  * `statusCode` (Number) - the HTTP status code; `200` is success
  * `data` (Buffer | Stream) - The raw binary data of the filled PDF if success. Will be either a Buffer or a Stream, depending on `dataType` option supplied to the request.
  * `errors` (Array of Objects) - Will be present if status >= 400. See Errors
    * `message` (String)

##### createEtchPacket(variables[, responseQuery])

Creates an Etch Packet and optionally sends it to the first signer. See the [API Documentation](#api-documentation) area for details. See [Examples](#examples) area for examples.

### Class Methods

##### prepareGraphQLStream(pathOrStream[, options])
A nice helper to prepare a Stream-backed file upload for use with our GraphQL API.
* `pathOrStream` (Stream | String) - Either an existing `Stream` or a string representing a fully resolved path to a file to be read into a new `Stream`.
* `options` (Object) - [UploadOptions](#uploadoptions) for the resulting object.
* Returns an `Object` that is properly formatted to be coerced by the client for use against our GraphQL API wherever an `Upload` type is required.

##### prepareGraphQLBuffer(pathOrBuffer[, options])
A nice helper to prepare a Buffer-backed file upload for use with our GraphQL API.
* `pathOrBuffer` (Buffer | String) - Either an existing `Buffer` or a string representing a fully resolved path to a file to be read into a new `Buffer`.
* `options` (Object) - [UploadOptions](#uploadoptions) for the resulting object.
* Returns an `Object` that is properly formatted to be coerced by the client for use against our GraphQL API wherever an `Upload` type is required.

##### prepareGraphQLBase64(data, options)
A nice helper to prepare a Base64-encoded-string-backed upload for use with our GraphQL API.
* `data` (String) - A `base64`-encoded string.
* `options` (Object) - [UploadOptions](#uploadoptions) for the resulting object. Also supports a `bufferize (Boolean)` option - set to `true` to convert the data to a `Buffer` and then call `prepareGraphQLBuffer`.
* Returns an `Object` that is properly formatted to be coerced by the client for use against our GraphQL API wherever a `Base64Upload` type is required.

### Types

##### Options

Options for the Anvil Client. Defaults are shown after each option key.

```js
{
  apiKey: <your_api_key> // Required. Your API key from your Anvil organization settings
}
```

##### UploadOptions

Options for the upload preparation class methods.
```js
{
  filename: <filename>, // String
  mimetype: <mimetype> // String
}
```

### Rate Limits

Our API has request rate limits in place. This API client handles `429 Too Many Requests` errors by waiting until it can retry again, then retrying the request. The client attempts to avoid `429` errors by throttling requests after the number of requests within the specified time period has been reached.

See the [Anvil API docs](https://useanvil.com/api/fill-pdf) for more information on the specifics of the rate limits.

## API Documentation

Our general API Documentation can be found [here](https://www.useanvil.com/api/). It's the best resource for up-to-date information about our API and its capabilities.

See the [PDF filling API docs](https://useanvil.com/api/fill-pdf) for more information about the `fillPDF` method.

## Examples

Check out the [example](https://github.com/anvilco/node-anvil/tree/master/example) folder for running usage examples!

## Development

First install the dependencies

```sh
yarn install
```

Running tests

```sh
yarn test
yarn test:watch
```

Building with babel will output in the `/lib` directory.

```sh
yarn test

# Watches the `src` and `test` directories
yarn test:watch
```
