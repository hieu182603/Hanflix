import { ProcessingJobModel } from "../../models/processing-job.model.js"
import { sanitizeProviderMessage } from "../speech/azure-speech-batch.service.js"

/** Stable pipeline contract. Keep these names provider-independent. */
export const PROCESSING_STEPS = [
  "DOWNLOAD_SOURCE",
  "EXTRACT_AUDIO",
  "PRIMARY_TRANSCRIPTION",
  "EVALUATE_TRANSCRIPTION",
  "SEPARATE_VOCALS",
  "SECONDARY_TRANSCRIPTION",
  "NORMALIZE_TRANSCRIPT",
  "VALIDATE_TIMESTAMPS",
  "ALIGN_TIMESTAMPS",
  "SEGMENT_SUBTITLES",
  "GENERATE_PINYIN",
  "TRANSLATE",
  "EXTRACT_VOCABULARY",
  "BUILD_SUBTITLES",
  "VALIDATE_RESULT",
  "CLEANUP",
  "READY_FOR_REVIEW",
] as const

export type ProcessingStepName = typeof PROCESSING_STEPS[number]
export type ProcessingStepStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED"

export interface ProcessingStepState {
  status: ProcessingStepStatus
  startedAt?: Date
  completedAt?: Date
  attempt: number
  errorCode?: string
  errorMessage?: string
  metadata?: Record<string, unknown>
  output?: Record<string, unknown>
}

export type ProcessingStepsState = Partial<Record<ProcessingStepName, ProcessingStepState>>

function stepPath(step: ProcessingStepName, field?: string): string {
  return field ? `steps.${step}.${field}` : `steps.${step}`
}

export async function startProcessingStep(input: {
  jobId: string
  leaseToken: string
  step: ProcessingStepName
  metadata?: Record<string, unknown>
}): Promise<boolean> {
  const now = new Date()
  const result = await ProcessingJobModel.updateOne(
    { _id: input.jobId, leaseToken: input.leaseToken, status: "running", leaseExpiresAt: { $gt: now } },
    {
      $set: {
        currentStep: input.step,
        [stepPath(input.step, "status")]: "RUNNING",
        [stepPath(input.step, "startedAt")]: now,
        ...(input.metadata ? { [stepPath(input.step, "metadata")]: input.metadata } : {}),
      },
      $inc: { [stepPath(input.step, "attempt")]: 1 },
      $unset: { [stepPath(input.step, "errorCode")]: 1, [stepPath(input.step, "errorMessage")]: 1, [stepPath(input.step, "completedAt")]: 1 },
    },
  )
  return result.matchedCount === 1
}

export async function completeProcessingStep(input: {
  jobId: string
  leaseToken: string
  step: ProcessingStepName
  metadata?: Record<string, unknown>
  output?: Record<string, unknown>
}): Promise<boolean> {
  const result = await ProcessingJobModel.updateOne(
    { _id: input.jobId, leaseToken: input.leaseToken, status: "running", leaseExpiresAt: { $gt: new Date() } },
    {
      $set: {
        [stepPath(input.step, "status")]: "COMPLETED",
        [stepPath(input.step, "completedAt")]: new Date(),
        ...(input.metadata
          ? { [stepPath(input.step, "metadata")]: input.metadata }
          : {}),
        ...(input.output
          ? { [stepPath(input.step, "output")]: input.output }
          : {}),
      },
    },
  )
  return result.matchedCount === 1
}

export async function failProcessingStep(input: {
  jobId: string
  leaseToken: string
  step: ProcessingStepName
  errorCode: string
  errorMessage: string
}): Promise<boolean> {
  const result = await ProcessingJobModel.updateOne(
    { _id: input.jobId, leaseToken: input.leaseToken, status: "running", leaseExpiresAt: { $gt: new Date() }, [stepPath(input.step, "status")]: { $nin: ["COMPLETED", "SKIPPED"] } },
    {
      $set: {
        [stepPath(input.step, "status")]: "FAILED",
        [stepPath(input.step, "completedAt")]: new Date(),
        [stepPath(input.step, "errorCode")]: input.errorCode,
        [stepPath(input.step, "errorMessage")]: sanitizeProviderMessage(input.errorMessage),
        failure: {
          step: input.step,
          code: input.errorCode,
          message: sanitizeProviderMessage(input.errorMessage),
        },
      },
    },
  )
  return result.matchedCount === 1
}

export async function saveProcessingCheckpoint(input: {
  jobId: string
  leaseToken: string
  checkpoint: Record<string, unknown>
}): Promise<boolean> {
  const result = await ProcessingJobModel.updateOne(
    { _id: input.jobId, leaseToken: input.leaseToken, status: "running", leaseExpiresAt: { $gt: new Date() } },
    { $set: { checkpoint: input.checkpoint } },
  )
  return result.matchedCount === 1
}

export function hasCompletedStep(
  steps: ProcessingStepsState | null | undefined,
  step: ProcessingStepName,
): boolean {
  return (
    steps?.[step]?.status === "COMPLETED" || steps?.[step]?.status === "SKIPPED"
  )
}
