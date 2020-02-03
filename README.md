# Anvil API Client for Node

[Anvil](https://useanvil.com) is a suite of tools for managing document-based workflows, including webforms that fill PDFs and request signatures, and a PDF filling API.

At this time, the node client supports only Anvil's [PDF filling API](https://useanvil.com/pdf-filling-api) that allows you to fill any PDF with JSON data.

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
const eid = 'kA6Da9CuGqUtc6QiBDRR'
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
const { statusCode, data } = await anvilClient.fillPDF(eid, exampleData)

console.log(statusCode) // => 200

// Data will be the filled PDF raw byes
fs.writeFileSync('output.pdf', data, { encoding: null })
```

## API

### new Anvil({ apiKey })

Creates an Anvil client instance.

* `apiKey` (String) - your API key from your Anvil organization settings

```js
const anvilClient = new Anvil({ apiKey })
```

### Anvil::fillPDF(pdfTemplateEID, payload)

Fills a PDF with your JSON data.

First, you will need to have uploaded a PDF to Anvil. You can find the PDF template's eid on the `API Info` tab of your PDF template's page:

<img width="725" alt="pdf-template-id" src="https://user-images.githubusercontent.com/69169/73583957-d8dec180-4449-11ea-9ea3-d426677cb881.png">

An example:

```js
const eid = 'kA6Da9CuGqUtc6QiBDRR'
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
const anvilClient = new Anvil({ apiKey })
const { statusCode, data } = await anvilClient.fillPDF(eid, payload)
```

* `pdfTemplateEID` (String) - The eid of your PDF template from the Anvil UI
* `payload` (Object) - The JSON data that will fill the PDF template
  * `title` (String) - _optional_ Set the title encoded into the PDF document
  * `fontSize` (Number) - _optional_ Set the fontSize of all filled text. Default is 10.
  * `color` (String) - _optional_ Set the text color of all filled text. Default is dark blue.
  * `data` (Object) - The data to fill the PDF. The keys in this object will correspond to a field's ID in the PDF. These field IDs and their types are available on the `API Info` tab on your PDF template's page in the Anvil dashboard.
    * For example `{ "someFieldId": "Hello World!" }`
  }
* Returns a `Promise` that resolves to an `Object`
  * `statusCode` (Number) - the HTTP status code; `200` is success
  * `data` (Buffer) - The raw binary data of the filled PDF if success
  * `errors` (Array of Objects) - Will be present if status >= 400. See Errors
    * `message` (String)

### Rate Limits

Our API has request rate limits in place. This API client handles `429 Too Many Requests` errors by waiting until it can retry again, then retrying the request. The client attempts to avoid `429` errors by throttling requests after the number of requests within the specified time period has been reached.

See the [Anvil API docs](https://app.useanvil.com/api/fill-pdf) for more information on the specifics of the rate limits.

### More Info

See the [PDF filling API docs](https://app.useanvil.com/api/fill-pdf) for more information.

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
