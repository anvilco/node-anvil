module.exports = {
  generateMutation: () => `
    mutation RemoveWeldData (
      $eid: String!,
    ) {
      removeWeldData (
        eid: $eid,
      )
    }`,
}
