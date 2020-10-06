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
    downloadZipURL
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
