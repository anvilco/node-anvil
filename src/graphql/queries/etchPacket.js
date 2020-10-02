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
      routingOrder
      name
      email
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
