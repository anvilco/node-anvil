module.exports = {
  generateQuery: () => `
    query GetPDFInfo (
      $castEid: String,
      $file: Upload,
    ) {
      getPDFInfo (
        castEid: $castEid,
        file: $file,
      )
    }
  `,
}
