const defaultResponseQuery = `{
  id
  eid
  payloadValue
  currentStep
  completedAt
  createdAt
  updatedAt
  signer {
    name
    email
    status
    routingOrder
  }
  weldData {
    id
    eid
    isTest
    isComplete
    agents
  }
}`

module.exports = {
  generateMutation: (responseQuery = defaultResponseQuery) => `
    mutation ForgeSubmit(
      $forgeEid: String!,
      $weldDataEid: String,
      $submissionEid: String,
      $payload: JSON!,
      $currentStep: Int,
      $complete: Boolean,
      $isTest: Boolean,
      $timezone: String,
      $groupArrayId: String,
      $groupArrayIndex: Int,
      $errorType: String,
    ) {
      forgeSubmit (
        forgeEid: $forgeEid,
        weldDataEid: $weldDataEid,
        submissionEid: $submissionEid,
        payload: $payload,
        currentStep: $currentStep,
        complete: $complete,
        isTest: $isTest,
        timezone: $timezone,
        groupArrayId: $groupArrayId,
        groupArrayIndex: $groupArrayIndex,
        errorType: $errorType
      ) ${responseQuery}
    }`,
}
