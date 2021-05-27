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

Fills a PDF template with your JSON data.

First, you will need to have [uploaded a PDF to Anvil](https://useanvil.com/docs/api/fill-pdf#creating-a-pdf-template). You can find the PDF template's id on the `API Info` tab of your PDF template's page:

<img width="725" alt="pdf-template-id" src="https://user-images.githubusercontent.com/69169/73693549-4a598280-468b-11ea-81a3-5df4472de8a4.png">

An example:

```js
const fs = require('fs')

// PDF template you uploaded to Anvil
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

// Be sure to write the file as raw bytes
fs.writeFileSync('filled.pdf', data, { encoding: null })
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

##### generatePDF(payload[, options])

Dynamically generate a new PDF with your JSON data. Useful for agreements, invoices, disclosures, or any other text-heavy documents. This does not require you do anything in the Anvil UI other than setup your API key, just send it data, get a PDF. See [the generate PDF docs](https://useanvil.com/api/generate-pdf) for full details.

An example:

```js
const fs = require('fs')

// Your API key from your Anvil organization settings
const apiKey = '7j2JuUWmN4fGjBxsCltWaybHOEy3UEtt'

// JSON data for the new PDF
const payload = {
  title: 'Example Invoice',
  data: [{
    label: 'Name',
    content: 'Sally Jones',
  }, {
    content: 'Lorem **ipsum** dolor sit _amet_',
  }, {
    table: {
      firstRowHeaders: true,
      rows: [
        ['Description', 'Quantity', 'Price'],
        ['4x Large Widgets', '4', '$40.00'],
        ['10x Medium Sized Widgets in dark blue', '10', '$100.00'],
        ['10x Small Widgets in white', '6', '$60.00'],
      ],
    },
  }],
}
// The 'options' parameter is optional
const options = {
  "dataType": "buffer"
}
const anvilClient = new Anvil({ apiKey })
const { statusCode, data } = await anvilClient.generatePDF(payload, options)

// Be sure to write the file as raw bytes
fs.writeFileSync('generated.pdf', data, { encoding: null })
```

* `payload` (Object) - The JSON data that will fill the PDF template
  * `title` (String) - _optional_ Set the title encoded into the PDF document
  * `data` (Array of Objects) - The data that generates the PDF. See [the docs](https://useanvil.com/docs/api/generate-pdf#supported-format-of-data) for all supported objects
    * For example `[{ "label": "Hello World!", "content": "Test" }]`
* `options` (Object) - _optional_ Any additional options for the request
  * `dataType` (Enum[String]) - _optional_ Set the type of the `data` value that is returned in the resolved `Promise`. Defaults to `'buffer'`, but `'stream'` is also supported.
* Returns a `Promise` that resolves to an `Object`
  * `statusCode` (Number) - the HTTP status code; `200` is success
  * `data` (Buffer | Stream) - The raw binary data of the filled PDF if success. Will be either a Buffer or a Stream, depending on `dataType` option supplied to the request.
  * `errors` (Array of Objects) - Will be present if status >= 400. See Errors
    * `message` (String)

##### createEtchPacket(options)

Creates an Etch Packet and optionally sends it to the first signer.
* `options` (Object) - An object with the following structure:
  * `variables` (Object) - See the [API Documentation](#api-documentation) area for details. See [Examples](#examples) area for examples.
  * `responseQuery` (String) - _optional_ A GraphQL Query compliant query to use for the data desired in the mutation response. Can be left out to use default.
  * `mutation` (String) - _optional_ If you'd like complete control of the GraphQL mutation, you can pass in a GraphQL Mutation compliant string that will be used in the mutation call. This string should also include your response query, as the `responseQuery` param is ignored if `mutation` is passed. Example:
    ```graphql
      mutation CreateEtchPacket (
        $name: String,
        ...
      ) {
        createEtchPacket (
          name: $name,
          ...
        ) {
          id
          eid
          ...
        }
      }
    ```

##### getEtchPacket(options)

Gets the details of an Etch Packet.
* `options` (Object) - An object with the following structure:
  * `variables` (Object) - Requires `eid`
    * `eid` (String) - your Etch Packet eid
  * `responseQuery` (String) - _optional_ A GraphQL Query compliant query to use for the data desired in the query response. Can be left out to use default.

##### generateEtchSignUrl(options)

Generates an Etch sign URL for an Etch Packet signer. The Etch Packet and its signers must have already been created.
* `options` (Object) - An object with the following structure:
  * `variables` (Object) - Requires `clientUserId` and `signerEid`
    * `clientUserId` (String) - your user eid
    * `signerEid` (String) - the eid of the Etch Packet signer, found in the response of the `createEtchPacket` instance method

##### downloadDocuments(documentGroupEid[, options])

Returns a Buffer or Stream of the document group specified by the documentGroupEid in Zip file format.
* `documentGroupEid` (string) - the eid of the document group to download
* `options` (Object) - _optional_ Any additional options for the request
  * `dataType` (Enum[String]) - _optional_ Set the type of the `data` value that is returned in the resolved `Promise`. Defaults to `'buffer'`, but `'stream'` is also supported.
* Returns a `Promise` that resolves to an `Object`
   * `statusCode` (Number) - the HTTP status code, `200` is success
   * `response` (Object) - the Response object resulting from the client's request to the Anvil app
   * `data` (Buffer | Stream) - The raw binary data of the downloaded documents if success. Will be in the format of either a Buffer or a Stream, depending on `dataType` option supplied to the request.
   * `errors` (Array of Objects) - Will be present if status >= 400. See Errors
      * `message` (String)

### Class Methods

##### prepareGraphQLFile(pathOrStreamLikeThing[, options])
A nice helper to prepare a Stream-backed or Buffer-backed file upload for use with our GraphQL API.
* `pathOrStreamLikeThing` (String | Stream | Buffer) - An existing `Stream`, `Buffer` or other Stream-like thing supported by [FormData.append](https://github.com/form-data/form-data#void-append-string-field-mixed-value--mixed-options-) OR a string representing a fully resolved path to a file to be read into a new `Stream`.
* `options` (Object) - Anything supported by [FormData.append](https://github.com/form-data/form-data#void-append-string-field-mixed-value--mixed-options-). Likely required when providing a non-common stream. From the `form-data` docs:
  > Form-Data can recognize and fetch all the required information from common types of streams (fs.readStream, http.response and mikeal's request), for some other types of streams you'd need to provide "file"-related information manually
* Returns an `Object` that is properly formatted to be coerced by the client for use against our GraphQL API wherever an `Upload` type is required.

### Types

##### Options

Options for the Anvil Client. Defaults are shown after each option key.

```js
{
  apiKey: <your_api_key>, // Required. Your API key from your Anvil  organization settings
}
```

### Rate Limits

Our API has request rate limits in place. The initial request made by this client will parse the limits for your account from the response headers, and then handle the throttling of subsequent requests for you automatically. In the event that this client still receives a `429 Too Many Requests` error response, it will wait the specified duration then retry the request. The client attempts to avoid `429` errors by throttling requests after the number of requests within the specified time period has been reached.

See the [Anvil API docs](https://useanvil.com/docs/api/fill-pdf) for more information on the specifics of the rate limits.

## API Documentation

Our general API Documentation can be found [here](https://www.useanvil.com/api/). It's the best resource for up-to-date information about our API and its capabilities.

See the [PDF filling API docs](https://useanvil.com/docs/api/fill-pdf) for more information about the `fillPDF` method.

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
