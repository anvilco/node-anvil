export const generateMutation = () => `
  mutation RemoveWeldData (
    $eid: String!,
  ) {
    removeWeldData (
      eid: $eid,
    )
  }`
