const defaultResponseQuery = `{
  id
  eid
  name
  etchPacketDetailsURL
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
