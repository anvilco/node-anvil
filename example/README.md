# Anvil API Client Examples

## fill-pdf.js script

Calls the fillPDF Anvil endpoint with data specified to fill a PDF with the Anvil API. Outputs the filled PDF in `example/script/fill.output.pdf`

Usage example:

```sh
# Fills a PDF then opens it in preview
yarn node example/script/fill-pdf.js <pdfTemplateID> <apiKey> <inputJSONFile>

# An example
yarn node example/script/fill-pdf.js idabc123 apiKeydef345 ./payload.json && open example/script/fill.output.pdf
```

`payload.json` is a json file with the JSON data used to fill the PDF. e.g.

```json
{
  "title": "My PDF Title",
  "fontSize": 10,
  "textColor": "#CC0000",
  "data": {
    "someFieldId": "Hello World!"
  }
}
```

## create-etch-packet.js script

Calls the createEtchPacket Anvil endpoint with data specified to generate an Etch Packet with the Anvil API. Returns 
the status and the generated packet. 

Usage example:

```sh
# Creates an Etch Packet with given information, either a castEid or filename must be supplied
yarn node example/script/create-etch-packet.js <apiKey> <castEid> <filename>

# An example
yarn node example/script/create-etch-packet.js WHG3ylq0EE930IR2LZDtgoqgl55M3TwQ 99u7QvvHr8hDQ4BW9GYv ../../../simple-anvil-finovate-non-qualified.pdf
```

## generate-etch-sign-url.js script

Calls the generateEtchSignUrl Anvil endpoint with data specified to generate an Etch sign link with the Anvil API. Returns the sign link.

Usage example:

```sh
# Generates a sign link for the given signer and client.
yarn node example/script/generate-etch-sign-url.js <apiKey> <clientUserId> <signerEid>

# An example
yarn node example/script/generate-etch-sign-url.js WHG3ylq0EE930IR2LZDtgoqgl55M3TwQ eBim2Vsv2GqCTJxpjTru ZTlbNhxP2lGkNFsNzcus
```
