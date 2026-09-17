import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { LessonModel } from '../models/lesson.model.js';
import {
  claimNextVideoProcessingJob,
  failOrRequeueVideoProcessingJob,
  getVideoQueueMetrics,
} from '../queue/video.queue.js';
import { downloadR2Object } from '../services/r2.js';
import { logger } from '../services/logger.js';
import { processLessonVideoPipeline } from '../services/subtitle-pipeline.js';

const workerId = `${process.pid}-${randomUUID()}`;
let timer: NodeJS.Timeout | undefined;
let running = false;

async function processNextJob(): Promise<boolean> {
  if (running) return false;
  running = true;
  try {
    const job = await claimNextVideoProcessingJob(workerId);
    if (!job) return false;
    const lesson = await LessonModel.findById(job.lessonId).select('media.objectKey').lean();
    const objectKey = job.objectKey || lesson?.media?.objectKey;
    if (!objectKey) {
      await failOrRequeueVideoProcessingJob(job._id.toString(), 'FAILED_DOWNLOAD', 'Processing job không có R2 object key');
      return true;
    }
    const extension = objectKey.endsWith('.webm') ? 'webm' : 'mp4';
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanflix-'));
    const localPath = path.join(tempDir, `input.${extension}`);
    const startedAt = Date.now();
    logger.info({ videoId: job.lessonId, jobId: job._id, step: 'DOWNLOAD', status: 'START' }, '[VideoProcessing]');
    try {
      try {
        await downloadR2Object(objectKey, localPath);
      } catch (error) {
        throw Object.assign(new Error(`Không thể tải video từ R2: ${error instanceof Error ? error.message : String(error)}`), { code: 'FAILED_DOWNLOAD' });
      }
      await processLessonVideoPipeline(job.lessonId.toString(), job._id.toString(), localPath);
      logger.info({ videoId: job.lessonId, jobId: job._id, status: 'SUCCESS', durationMs: Date.now() - startedAt }, '[VideoProcessing]');
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'PROCESSING_FAILED';
      const message = error instanceof Error ? error.message : 'Lỗi xử lý video không xác định';
      const updated = await failOrRequeueVideoProcessingJob(job._id.toString(), code, message);
      await LessonModel.findByIdAndUpdate(job.lessonId, updated?.status === 'failed'
        ? { $set: { status: 'failed', processingStatus: 'FAILED', processingStep: 'FAILED', processingError: message } }
        : { $set: { status: 'processing', processingStatus: 'QUEUED', processingStep: 'QUEUED', processingError: message } });
      logger.error({ videoId: job.lessonId, jobId: job._id, step: job.stage, status: 'FAILED', error: message }, '[VideoProcessing]');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    return true;
  } finally {
    running = false;
  }
}

export function wakeVideoProcessingWorker() {
  if (env.VIDEO_WORKER_MODE === 'disabled') return;
  setImmediate(() => void processNextJob());
}

export function startVideoProcessingWorker() {
  if (env.VIDEO_WORKER_MODE === 'disabled' || timer) return;
  wakeVideoProcessingWorker();
  timer = setInterval(() => void processNextJob(), env.VIDEO_PROCESSING_POLL_MS);
  timer.unref();
  logger.info({ workerId, mode: env.VIDEO_WORKER_MODE }, '[VideoProcessing] worker started');
}

export async function stopVideoProcessingWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
  while (running) await new Promise(resolve => setTimeout(resolve, 100));
}

export async function getVideoWorkerStatus() {
  return { workerId, running, mode: env.VIDEO_WORKER_MODE, ...(await getVideoQueueMetrics()) };
}

const isDirectExecution = process.argv[1]?.endsWith('video-processing.worker.js') || process.argv[1]?.endsWith('video-processing.worker.ts');
if (isDirectExecution) {
  (async () => {
    await connectDatabase();
    startVideoProcessingWorker();
    const shutdown = async () => {
      await stopVideoProcessingWorker();
      await disconnectDatabase();
      process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown());
    process.on('SIGINT', () => void shutdown());
  })().catch(error => {
    logger.fatal({ error: error instanceof Error ? error.message : String(error) }, '[VideoProcessing] worker failed');
    process.exit(1);
  });
}
