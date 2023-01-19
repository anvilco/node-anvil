
const defaultResponseQuery = `{
  eid
  name
  status
  isTest
  isFree
  containsFillData
  payload
  numberRemainingSigners
  detailsURL
  webhookURL
  documentGroup {
    eid
    status
    files
    signers {
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
    mutation CreateEtchPacket(
      $name: String,
      $organizationEid: String,
      $files: [EtchFile!],
      $isDraft: Boolean,
      $isTest: Boolean,
      $signatureEmailSubject: String,
      $signatureEmailBody: String,
      $signatureProvider: String,
      $signaturePageOptions: JSON,
      $signers: [JSON!],
      $data: JSON,
      $webhookURL: String,
      $replyToName: String,
      $replyToEmail: String,
      $enableEmails: JSON,
      $createCastTemplatesFromUploads: Boolean,
      $duplicateCasts: Boolean,
      $mergePDFs: Boolean
    ) {
      createEtchPacket(
        name: $name,
        organizationEid: $organizationEid,
        files: $files,
        isDraft: $isDraft,
        isTest: $isTest,
        signatureEmailSubject: $signatureEmailSubject,
        signatureEmailBody: $signatureEmailBody,
        signatureProvider: $signatureProvider,
        signaturePageOptions: $signaturePageOptions,
        signers: $signers,
        data: $data,
        webhookURL: $webhookURL,
        replyToName: $replyToName,
        replyToEmail: $replyToEmail,
        enableEmails: $enableEmails,
        createCastTemplatesFromUploads: $createCastTemplatesFromUploads,
        duplicateCasts: $duplicateCasts,
        mergePDFs: $mergePDFs
      ) ${responseQuery}
    }`,
}
