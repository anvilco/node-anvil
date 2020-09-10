
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
      $organizationEid: String!,
      $files: [EtchFile!],
      $send: Boolean,
      $isTest: Boolean,
      $disableEtchCompleteEmail: Boolean,
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
        disableEtchCompleteEmail: $disableEtchCompleteEmail,
        signatureEmailSubject: $signatureEmailSubject,
        signatureEmailBody: $signatureEmailBody,
        signaturePageOptions: $signaturePageOptions,
        signers: $signers,
        fillPayload: $fillPayload
      ) ${responseQuery}
    }`,
}
