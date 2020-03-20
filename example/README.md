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
