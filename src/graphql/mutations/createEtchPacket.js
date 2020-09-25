
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
      aliasId
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
      $isDraft: Boolean,
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
        isDraft: $isDraft,
        isTest: $isTest,
        signatureEmailSubject: $signatureEmailSubject,
        signatureEmailBody: $signatureEmailBody,
        signaturePageOptions: $signaturePageOptions,
        signers: $signers,
        data: $data
      ) ${responseQuery}
    }`,
}
