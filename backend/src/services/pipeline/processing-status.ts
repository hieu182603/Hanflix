import { sanitizeProviderMessage } from "../speech/azure-speech-batch.service.js"
import { redactLogValue } from "../logger.js"

/** Public admin projection: never return leases, provider URLs, or transcript checkpoints. */
export function processingStatusDto(job: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of [
    "_id",
    "lessonId",
    "pipelineVersion",
    "mediaType",
    "status",
    "currentStep",
    "stage",
    "stageProgress",
    "attempts",
    "createdAt",
    "updatedAt",
    "startedAt",
    "completedAt",
    "heartbeatAt",
    "nextAttemptAt",
    "errorCode",
  ]) {
    if (job[key] !== undefined) result[key] = job[key]
  }
  if (job.processingMetrics) result.processingMetrics = redactLogValue(job.processingMetrics)
  if (job.errorMessage)
    result.errorMessage = sanitizeProviderMessage(job.errorMessage)
  const checkpoint = job.checkpoint as Record<string, unknown> | undefined
  result.warnings = Array.isArray(checkpoint?.warnings)
    ? checkpoint.warnings.map(sanitizeProviderMessage)
    : []
  result.steps = Object.fromEntries(
    Object.entries(
      (job.steps ?? {}) as Record<string, Record<string, unknown>>,
    ).map(([name, step]) => [
      name,
      {
        status: step.status,
        attempt: step.attempt,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        errorCode: step.errorCode,
        ...(step.errorMessage
          ? { errorMessage: sanitizeProviderMessage(step.errorMessage) }
          : {}),
      },
    ]),
  )
  return result
}
