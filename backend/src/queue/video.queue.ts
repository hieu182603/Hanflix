import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { LessonModel } from '../models/lesson.model.js';
import type { ClientSession } from 'mongoose';

export interface VideoProcessingJobData {
  lessonId: string;
  objectKey: string;
}

export interface AddVideoProcessingJobOptions {
  session?: ClientSession | null;
}

/**
 * F04 fix (2026-09-18): lease token + heartbeat helpers.
 *
 * Background:
 *   Previously every update to a `running` job matched on `status: 'running'` only.
 *   That allowed two race scenarios:
 *     (a) Worker A claims job J, but A's process is paused (GC pause, OS sleep,
 *         machine reboot). Worker B's claim cycle sees `heartbeatAt < staleBefore`
 *         and resets J back to `queued`. Worker A then wakes up and writes stage
 *         progress to J — overwriting B's claim.
 *     (b) Two workers (embedded + standalone) both reach the same MongoDB at the
 *         same instant and both think they own J. Heartbeats overwrite each other.
 *
 * Fix:
 *   - At claim time, every job gets a fresh `leaseToken` (UUID v4) AND a
 *     `leaseExpiresAt` (now + VIDEO_LEASE_TTL_SECONDS).
 *   - Every mutation the worker performs on the job MUST present the same
 *     `leaseToken` in the filter. If the token doesn't match, the mutation is a
 *     no-op and the caller learns about it via `matchedCount === 0`.
 *   - Heartbeat extends `leaseExpiresAt` and updates `heartbeatAt`.
 *   - Cooperative cancellation: workers pass an AbortSignal into the pipeline; if
 *     it fires, the pipeline MUST call `releaseLease()` which marks the job
 *     `failed` (with code 'ABORTED') and frees the activeKey so another attempt
 *     can pick it up immediately.
 */
export interface VideoProcessingJobLease {
  jobId: string;
  lessonId: string;
  objectKey: string | null;
  leaseToken: string;
  leaseExpiresAt: Date;
}

export interface StageDeadlineMap {
  inspect_media: number;
  transcribe_zh: number;
  generate_pinyin: number;
  translate_vi: number;
  extract_vocabulary: number;
  generate_quiz: number;
  finalize: number;
}

export const STAGE_DEADLINES_MS: StageDeadlineMap = {
  inspect_media: env.VIDEO_STAGE_DEADLINE_INSPECT_MS,
  transcribe_zh: env.VIDEO_STAGE_DEADLINE_TRANSCRIBE_MS,
  generate_pinyin: env.VIDEO_STAGE_DEADLINE_PINYIN_MS,
  translate_vi: env.VIDEO_STAGE_DEADLINE_TRANSLATE_MS,
  extract_vocabulary: env.VIDEO_STAGE_DEADLINE_VOCABULARY_MS,
  generate_quiz: env.VIDEO_STAGE_DEADLINE_QUIZ_MS,
  finalize: env.VIDEO_STAGE_DEADLINE_FINALIZE_MS,
};

const activeKey = (lessonId: string) => `lesson:${lessonId}`;

export async function addVideoProcessingJob(
  data: VideoProcessingJobData,
  options: AddVideoProcessingJobOptions = {},
) {
  const session = options.session;
  const existing = await ProcessingJobModel.findOne({ lessonId: data.lessonId, status: { $in: ['queued', 'running'] } }).session(session ?? null);
  if (existing) return existing;
  try {
    return await ProcessingJobModel.create(
      [
        {
          lessonId: data.lessonId,
          objectKey: data.objectKey,
          activeKey: activeKey(data.lessonId),
          status: 'queued',
          stage: 'inspect_media',
          stageProgress: 0,
          nextAttemptAt: new Date(),
        },
      ],
      { session },
    ).then(([doc]) => doc);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const concurrent = await ProcessingJobModel.findOne({ activeKey: activeKey(data.lessonId) }).session(session ?? null);
      if (concurrent) return concurrent;
    }
    throw error;
  }
}

export async function retryVideoProcessingJob(lessonId: string, objectKey: string) {
  return ProcessingJobModel.findOneAndUpdate(
    { lessonId, status: 'failed' },
    {
      $set: {
        objectKey,
        activeKey: activeKey(lessonId),
        status: 'queued',
        stage: 'inspect_media',
        stageProgress: 0,
        nextAttemptAt: new Date(),
        attempts: 0,
      },
      $unset: { lockedAt: 1, lockedBy: 1, heartbeatAt: 1, leaseToken: 1, leaseExpiresAt: 1, stageDeadlineAt: 1, stageStartedAt: 1, errorCode: 1, errorMessage: 1, completedAt: 1 },
    },
    { returnDocument: 'after', sort: { createdAt: -1 } },
  );
}

/**
 * F04: claim a job with a fresh lease token. If another worker has already
 * claimed everything, returns null. The returned lease object must be threaded
 * into every subsequent call so the queue can detect stale claims.
 */
export async function claimNextVideoProcessingJob(workerId: string): Promise<VideoProcessingJobLease | null> {
  const staleBefore = new Date(Date.now() - env.VIDEO_PROCESSING_TIMEOUT_MINUTES * 60_000);
  const leaseExpiresAt = new Date(Date.now() + env.VIDEO_LEASE_TTL_SECONDS * 1000);
  const leaseToken = randomUUID();

  // F04: stale-recoverable jobs (still have retry budget) go back to queued.
  // We also clear the lease fields so the new claim starts clean.
  await ProcessingJobModel.updateMany(
    {
      status: 'running',
      attempts: { $lt: env.VIDEO_PROCESSING_MAX_RETRIES },
      $or: [
        { leaseExpiresAt: { $lt: new Date() } },
        { leaseExpiresAt: { $exists: false }, heartbeatAt: { $lt: staleBefore } },
      ],
    },
    {
      $set: { status: 'queued', nextAttemptAt: new Date(), errorCode: 'STALE_JOB_RECOVERED' },
      $unset: { lockedAt: 1, lockedBy: 1, heartbeatAt: 1, leaseToken: 1, leaseExpiresAt: 1, stageDeadlineAt: 1, stageStartedAt: 1 },
    },
  );

  // F04: stale jobs that have exhausted retries → mark failed + sync lesson.
  const exhaustedResult = await ProcessingJobModel.updateMany(
    {
      status: 'running',
      attempts: { $gte: env.VIDEO_PROCESSING_MAX_RETRIES },
      $or: [
        { leaseExpiresAt: { $lt: new Date() } },
        { leaseExpiresAt: { $exists: false }, heartbeatAt: { $lt: staleBefore } },
      ],
    },
    {
      $set: { status: 'failed', completedAt: new Date(), errorCode: 'STALE_JOB_EXHAUSTED', errorMessage: 'Job quá hạn và đã hết số lần thử' },
      $unset: { activeKey: 1, lockedAt: 1, lockedBy: 1, heartbeatAt: 1, leaseToken: 1, leaseExpiresAt: 1, stageDeadlineAt: 1, stageStartedAt: 1 },
    },
  );
  if (exhaustedResult.modifiedCount > 0) {
    const failedJobs = await ProcessingJobModel.find({
      status: 'failed',
      errorCode: 'STALE_JOB_EXHAUSTED',
      lessonId: { $exists: true },
    }).select('_id lessonId').lean();
    for (const job of failedJobs) {
      await LessonModel.updateOne(
        { _id: job.lessonId, status: 'processing' },
        {
          $set: {
            status: 'failed',
            processingStatus: 'FAILED',
            processingStep: 'FAILED',
            processingError: 'Job quá hạn và đã hết số lần thử',
          },
        },
      );
    }
  }

  // F04: atomic claim — set leaseToken + leaseExpiresAt + lockedBy in one
  // operation. If two workers race, MongoDB serializes the findOneAndUpdate so
  // only one gets the doc. The lease token guarantees that subsequent writes
  // from a worker can be authorized precisely.
  const claimed = await ProcessingJobModel.findOneAndUpdate(
    {
      status: 'queued',
      attempts: { $lt: env.VIDEO_PROCESSING_MAX_RETRIES },
      nextAttemptAt: { $lte: new Date() },
    },
    {
      $set: {
        status: 'running',
        lockedAt: new Date(),
        heartbeatAt: new Date(),
        lockedBy: workerId,
        leaseToken,
        leaseExpiresAt,
        stage: 'inspect_media',
        stageStartedAt: new Date(),
        stageDeadlineAt: new Date(Date.now() + STAGE_DEADLINES_MS.inspect_media),
        startedAt: new Date(),
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: 'after', sort: { createdAt: 1 } },
  );
  if (!claimed) return null;
  return {
    jobId: claimed._id.toString(),
    lessonId: claimed.lessonId.toString(),
    objectKey: claimed.objectKey ?? null,
    leaseToken,
    leaseExpiresAt,
  };
}

/**
 * F04: heartbeat — extends the lease AND advances stage deadline.
 * Returns false if the lease has been revoked (matchedCount === 0), which
 * tells the worker that another process has taken over.
 */
export async function heartbeatProcessingJob(
  lease: VideoProcessingJobLease,
  nextStageDeadlineAt?: Date,
): Promise<boolean> {
  const newExpiry = new Date(Date.now() + env.VIDEO_LEASE_TTL_SECONDS * 1000);
  const update: Record<string, unknown> = {
    heartbeatAt: new Date(),
    leaseExpiresAt: newExpiry,
  };
  if (nextStageDeadlineAt) update.stageDeadlineAt = nextStageDeadlineAt;
  const result = await ProcessingJobModel.updateOne(
    { _id: lease.jobId, leaseToken: lease.leaseToken, status: 'running' },
    { $set: update },
  );
  return result.matchedCount === 1;
}

/**
 * F04: cooperative cancel — mark job failed with code 'ABORTED' so the admin
 * sees a clear error and can retry. We DO NOT bump attempts (cancellation is
 * not a "real" failure) but we DO free the activeKey so the next attempt can
 * be created cleanly.
 */
export async function abortProcessingJob(lease: VideoProcessingJobLease, reason: string): Promise<void> {
  await ProcessingJobModel.updateOne(
    { _id: lease.jobId, leaseToken: lease.leaseToken, status: 'running' },
    {
      $set: {
        status: 'failed',
        completedAt: new Date(),
        errorCode: 'ABORTED',
        errorMessage: reason.slice(0, 1000),
      },
      $unset: { activeKey: 1, lockedAt: 1, lockedBy: 1, heartbeatAt: 1, leaseToken: 1, leaseExpiresAt: 1, stageDeadlineAt: 1, stageStartedAt: 1 },
    },
  );
  // Sync lesson to failed so admin sees the cancel.
  await LessonModel.updateOne(
    { _id: lease.lessonId, status: 'processing' },
    {
      $set: {
        status: 'failed',
        processingStatus: 'FAILED',
        processingStep: 'ABORTED',
        processingError: reason.slice(0, 1000),
      },
    },
  );
}

/**
 * F04: deadline exceeded — same as abort but with a different error code so
 * admins can distinguish "user cancelled" from "FFmpeg hung for 30 minutes".
 */
export async function expireProcessingJob(lease: VideoProcessingJobLease, stage: string): Promise<void> {
  const message = `Stage "${stage}" vượt quá deadline cho phép`;
  await ProcessingJobModel.updateOne(
    { _id: lease.jobId, leaseToken: lease.leaseToken, status: 'running' },
    {
      $set: {
        status: 'failed',
        completedAt: new Date(),
        errorCode: 'STAGE_DEADLINE_EXCEEDED',
        errorMessage: message,
      },
      $unset: { activeKey: 1, lockedAt: 1, lockedBy: 1, heartbeatAt: 1, leaseToken: 1, leaseExpiresAt: 1, stageDeadlineAt: 1, stageStartedAt: 1 },
    },
  );
  await LessonModel.updateOne(
    { _id: lease.lessonId, status: 'processing' },
    {
      $set: {
        status: 'failed',
        processingStatus: 'FAILED',
        processingStep: 'DEADLINE_EXCEEDED',
        processingError: message,
      },
    },
  );
}

/**
 * F04: stage transition with lease validation. Updates stage, stageStartedAt,
 * stageProgress, and stageDeadlineAt in one atomic operation. Returns false
 * if the lease has been revoked, in which case the worker MUST abort the
 * pipeline immediately.
 */
export async function transitionStage(
  lease: VideoProcessingJobLease,
  stage: keyof StageDeadlineMap,
  stageProgress: number,
): Promise<boolean> {
  const deadlineAt = new Date(Date.now() + STAGE_DEADLINES_MS[stage]);
  const result = await ProcessingJobModel.updateOne(
    { _id: lease.jobId, leaseToken: lease.leaseToken, status: 'running' },
    {
      $set: {
        stage,
        stageProgress,
        stageStartedAt: new Date(),
        stageDeadlineAt: deadlineAt,
        heartbeatAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + env.VIDEO_LEASE_TTL_SECONDS * 1000),
      },
    },
  );
  return result.matchedCount === 1;
}

export async function failOrRequeueVideoProcessingJob(
  jobId: string,
  code: string,
  message: string,
  leaseToken?: string,
) {
  const filter: Record<string, unknown> = { _id: jobId };
  // F04: if a leaseToken is provided, the update only proceeds when the token
  // matches. Otherwise (legacy code paths), we fall back to status filter.
  if (leaseToken) filter.leaseToken = leaseToken;
  else filter.status = 'running';

  const job = await ProcessingJobModel.findOne(filter);
  if (!job) return null;
  const exhausted = job.attempts >= env.VIDEO_PROCESSING_MAX_RETRIES;
  job.status = exhausted ? 'failed' : 'queued';
  job.errorCode = code;
  job.errorMessage = message.slice(0, 1000);
  job.lockedAt = undefined;
  job.lockedBy = undefined;
  job.heartbeatAt = undefined;
  job.leaseToken = undefined;
  job.leaseExpiresAt = undefined;
  job.stageDeadlineAt = undefined;
  job.stageStartedAt = undefined;
  if (exhausted) {
    job.activeKey = undefined;
    job.completedAt = new Date();
  } else {
    job.nextAttemptAt = new Date(Date.now() + Math.min(5000 * 2 ** Math.max(0, job.attempts - 1), 60_000));
  }
  return job.save();
}

export async function getVideoQueueMetrics() {
  const [waiting, active, completed, failed] = await Promise.all([
    ProcessingJobModel.countDocuments({ status: 'queued' }),
    ProcessingJobModel.countDocuments({ status: 'running' }),
    ProcessingJobModel.countDocuments({ status: 'completed' }),
    ProcessingJobModel.countDocuments({ status: 'failed' }),
  ]);
  return { status: 'mongodb', waiting, active, completed, failed };
}
