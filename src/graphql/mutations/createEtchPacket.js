
const defaultResponseQuery = `{
  id
  eid
  name
  documentGroup {
    id
    eid
    status
    files
    signers {
      id
      eid
      name
      email
    }
  }
}`

module.exports = {
  getMutation: (responseQuery = defaultResponseQuery) => `
    mutation CreateEtchPacket (
      $name: String,
      $files: [EtchFile!],
      $draft: Boolean,
      $isTest: Boolean,
      $signatureEmailSubject: String,
      $signatureEmailBody: String,
      $signaturePageOptions: JSON,
      $signers: [JSON!],
      $data: JSON,
    ) {
      createEtchPacket (
        name: $name,
        files: $files,
        draft: $draft,
        isTest: $isTest,
        signatureEmailSubject: $signatureEmailSubject,
        signatureEmailBody: $signatureEmailBody,
        signaturePageOptions: $signaturePageOptions,
        signers: $signers,
        data: $data
      ) ${responseQuery}
    }`,
}
