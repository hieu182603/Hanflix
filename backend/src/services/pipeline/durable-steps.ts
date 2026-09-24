import { AppError } from "../../errors/app-error.js"
import { ProcessingJobModel } from "../../models/processing-job.model.js"
import type { VideoProcessingJobLease } from "../../queue/video.queue.js"
import type {
  ProcessingStepName,
  ProcessingStepState,
} from "./processing-steps.js"
import { sanitizeProviderMessage } from "../speech/azure-speech-batch.service.js"
import { logger } from "../logger.js"

export class DurableSteps {
  constructor(
    readonly lease: VideoProcessingJobLease,
    readonly signal: AbortSignal,
    readonly steps: Partial<Record<ProcessingStepName, ProcessingStepState>>,
    readonly checkpoint: Record<string, unknown>,
    private readonly onStep: (name: ProcessingStepName) => Promise<void>,
  ) {}
  async write(
    set: Record<string, unknown>,
    inc?: Record<string, number>,
    extra: Record<string, unknown> = {},
  ) {
    this.signal.throwIfAborted()
    const result = await ProcessingJobModel.updateOne(
      {
        _id: this.lease.jobId,
        leaseToken: this.lease.leaseToken,
        status: "running",
        leaseExpiresAt: { $gt: new Date() },
        ...extra,
      },
      {
        $set: set,
        ...(inc ? { $inc: inc } : {}),
      },
    )
    if (result.matchedCount !== 1)
      throw new AppError(
        409,
        "LEASE_REVOKED",
        "Lease hoặc quyền chạy bước đã bị thu hồi",
      )
  }
  async save(key: string, value: unknown) {
    await this.write({ [`checkpoint.${key}`]: value })
    this.checkpoint[key] = value
  }
  async skip(name: ProcessingStepName, reason: string) {
    if (
      this.steps[name]?.status === "COMPLETED" ||
      this.steps[name]?.status === "SKIPPED"
    )
      return
    const state: ProcessingStepState = {
      status: "SKIPPED",
      attempt: 0,
      completedAt: new Date(),
      metadata: { reason },
    }
    await this.write({ [`steps.${name}`]: state })
    this.steps[name] = state
  }
  async run<T,>(name: ProcessingStepName, work: () => Promise<T>): Promise<T> {
    const old = this.steps[name]
    if (old?.status === "COMPLETED") {
      if (!old.output || !("value" in old.output))
        throw new AppError(
          409,
          "CHECKPOINT_OUTPUT_MISSING",
          `Bước ${name} thiếu output; không tự chạy lại`,
        )
      return old.output.value as T
    }
    if (old?.status === "SKIPPED") return undefined as T
    await this.onStep(name)
    const state: ProcessingStepState = {
      status: "RUNNING",
      attempt: (old?.attempt ?? 0) + 1,
      startedAt: new Date(),
    }
    await this.write({ currentStep: name, [`steps.${name}`]: state })
    this.steps[name] = state
    logger.info(
      {
        jobId: this.lease.jobId,
        step: name,
        attempt: state.attempt,
        status: "RUNNING",
      },
      "[PipelineV2]",
    )
    try {
      const value = await work()
      const completed = {
        ...state,
        status: "COMPLETED" as const,
        completedAt: new Date(),
        output: { value: value ?? null },
      }
      await this.write({ [`steps.${name}`]: completed })
      this.steps[name] = completed
      logger.info(
        {
          jobId: this.lease.jobId,
          step: name,
          status: "COMPLETED",
          durationMs: Date.now() - state.startedAt!.getTime(),
        },
        "[PipelineV2]",
      )
      return value
    } catch (error) {
      const code =
        error instanceof AppError ? error.code : "PROCESSING_STEP_FAILED"
      const message = sanitizeProviderMessage(error)
      await this.write({
        [`steps.${name}`]: {
          ...state,
          status: "FAILED",
          errorCode: code,
          errorMessage: message,
        },
        failure: { step: name, code, message },
      }).catch(() => undefined)
      throw error
    }
  }
}
