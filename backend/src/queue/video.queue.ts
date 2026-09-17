import { env } from '../config/env.js';
import { ProcessingJobModel } from '../models/processing-job.model.js';

export interface VideoProcessingJobData {
  lessonId: string;
  objectKey: string;
}

const activeKey = (lessonId: string) => `lesson:${lessonId}`;

export async function addVideoProcessingJob(data: VideoProcessingJobData) {
  const existing = await ProcessingJobModel.findOne({ lessonId: data.lessonId, status: { $in: ['queued', 'running'] } });
  if (existing) return existing;
  try {
    return await ProcessingJobModel.create({
      lessonId: data.lessonId,
      objectKey: data.objectKey,
      activeKey: activeKey(data.lessonId),
      status: 'queued',
      stage: 'inspect_media',
      stageProgress: 0,
      nextAttemptAt: new Date(),
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const concurrent = await ProcessingJobModel.findOne({ activeKey: activeKey(data.lessonId) });
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
      $unset: { lockedAt: 1, lockedBy: 1, heartbeatAt: 1, errorCode: 1, errorMessage: 1, completedAt: 1 },
    },
    { returnDocument: 'after', sort: { createdAt: -1 } },
  );
}

export async function claimNextVideoProcessingJob(workerId: string) {
  const staleBefore = new Date(Date.now() - env.VIDEO_PROCESSING_TIMEOUT_MINUTES * 60_000);
  await ProcessingJobModel.updateMany(
    { status: 'running', attempts: { $lt: env.VIDEO_PROCESSING_MAX_RETRIES }, $or: [{ heartbeatAt: { $lt: staleBefore } }, { heartbeatAt: { $exists: false }, lockedAt: { $lt: staleBefore } }] },
    {
      $set: { status: 'queued', nextAttemptAt: new Date(), errorCode: 'STALE_JOB_RECOVERED' },
      $unset: { lockedAt: 1, lockedBy: 1, heartbeatAt: 1 },
    },
  );
  await ProcessingJobModel.updateMany(
    { status: 'running', attempts: { $gte: env.VIDEO_PROCESSING_MAX_RETRIES }, $or: [{ heartbeatAt: { $lt: staleBefore } }, { heartbeatAt: { $exists: false }, lockedAt: { $lt: staleBefore } }] },
    {
      $set: { status: 'failed', completedAt: new Date(), errorCode: 'STALE_JOB_EXHAUSTED', errorMessage: 'Job quá hạn và đã hết số lần thử' },
      $unset: { activeKey: 1, lockedAt: 1, lockedBy: 1, heartbeatAt: 1 },
    },
  );

  return ProcessingJobModel.findOneAndUpdate(
    {
      status: 'queued',
      attempts: { $lt: env.VIDEO_PROCESSING_MAX_RETRIES },
      nextAttemptAt: { $lte: new Date() },
    },
    {
      $set: { status: 'running', lockedAt: new Date(), heartbeatAt: new Date(), lockedBy: workerId, startedAt: new Date() },
      $inc: { attempts: 1 },
    },
    { returnDocument: 'after', sort: { createdAt: 1 } },
  );
}

export async function failOrRequeueVideoProcessingJob(jobId: string, code: string, message: string) {
  const job = await ProcessingJobModel.findById(jobId);
  if (!job) return null;
  const exhausted = job.attempts >= env.VIDEO_PROCESSING_MAX_RETRIES;
  job.status = exhausted ? 'failed' : 'queued';
  job.errorCode = code;
  job.errorMessage = message.slice(0, 1000);
  job.lockedAt = undefined;
  job.lockedBy = undefined;
  job.heartbeatAt = undefined;
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
