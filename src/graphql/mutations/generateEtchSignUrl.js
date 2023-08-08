export const generateMutation = () => `
  mutation GenerateEtchSignURL (
    $signerEid: String!,
    $clientUserId: String!,
  ) {
    generateEtchSignURL (
      signerEid: $signerEid,
      clientUserId: $clientUserId
    )
  }
`
