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
