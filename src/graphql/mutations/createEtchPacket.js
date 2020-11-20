
const defaultResponseQuery = `{
  id
  eid
  name
  detailsURL
  documentGroup {
    id
    eid
    status
    files
    signers {
      id
      eid
      aliasId
      routingOrder
      name
      email
      status
      signActionType
    }
  }
}`

module.exports = {
  generateMutation: (responseQuery = defaultResponseQuery) => `
    mutation CreateEtchPacket (
      $name: String,
      $files: [EtchFile!],
      $isDraft: Boolean,
      $isTest: Boolean,
      $signatureEmailSubject: String,
      $signatureEmailBody: String,
      $signatureProvider: String,
      $signaturePageOptions: JSON,
      $signers: [JSON!],
      $webhookURL: String,
      $data: JSON,
    ) {
      createEtchPacket (
        name: $name,
        files: $files,
        isDraft: $isDraft,
        isTest: $isTest,
        signatureEmailSubject: $signatureEmailSubject,
        signatureEmailBody: $signatureEmailBody,
        signatureProvider: $signatureProvider,
        signaturePageOptions: $signaturePageOptions,
        signers: $signers,
        webhookURL: $webhookURL,
        data: $data
      ) ${responseQuery}
    }`,
}
