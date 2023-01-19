const defaultResponseQuery = `{
  id
  eid
  status
  resolvedPayload
  payload
  payloadValue
  currentStep
  totalSteps
  continueURL
  reviewData
  completionPercentage
  isExcluded
  touchedByUser
  requestMeta
  createdAt
  updatedAt
  completedAt
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
      $enforcePayloadValidOnCreate: Boolean,
      $currentStep: Int,
      $complete: Boolean,
      $isTest: Boolean,
      $timezone: String,
      $webhookURL: String,
      $groupArrayId: String,
      $groupArrayIndex: Int,
      $errorType: String
    ) {
      forgeSubmit(
        forgeEid: $forgeEid,
        weldDataEid: $weldDataEid,
        submissionEid: $submissionEid,
        payload: $payload,
        enforcePayloadValidOnCreate: $enforcePayloadValidOnCreate,
        currentStep: $currentStep,
        complete: $complete,
        isTest: $isTest,
        timezone: $timezone,
        webhookURL: $webhookURL,
        groupArrayId: $groupArrayId,
        groupArrayIndex: $groupArrayIndex,
        errorType: $errorType
      ) ${responseQuery}
    }`,
}
