const defaultResponseQuery = `{
  id
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
  createdAt
  updatedAt
  archivedAt
  completedAt
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
  generateQuery: (responseQuery = defaultResponseQuery) => `
    query GetEtchPacket (
      $eid: String!,
    ) {
      etchPacket (
        eid: $eid,
      ) ${responseQuery}
    }
  `,
}
