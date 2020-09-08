
const defaultResponseQuery = `{
  id
  eid
  name
  documentGroup {
    id
    eid
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
      $organizationEid: String!,
      $files: [EtchFile!],
      $send: Boolean,
      $isTest: Boolean,
      $signatureEmailSubject: String,
      $signatureEmailBody: String,
      $signaturePageOptions: JSON,
      $signers: [JSON!],
      $fillPayload: JSON,
    ) {
      createEtchPacket (
        name: $name,
        organizationEid: $organizationEid,
        files: $files,
        send: $send,
        isTest: $isTest,
        signatureEmailSubject: $signatureEmailSubject,
        signatureEmailBody: $signatureEmailBody,
        signaturePageOptions: $signaturePageOptions,
        signers: $signers,
        fillPayload: $fillPayload
      ) ${responseQuery}
    }`,
}
