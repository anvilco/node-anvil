const defaultResponseQuery = `{
  id
  eid
  name
  status
  isTest
  numberRemainingSigners
  webhookURL
  detailsURL
  completedAt
  archivedAt
  createdAt
  updatedAt
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

export const generateQuery = (responseQuery = defaultResponseQuery) => `
  query EtchPacket (
    $eid: String!,
  ) {
    etchPacket (
      eid: $eid,
    ) ${responseQuery}
  }
`
