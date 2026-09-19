import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { LessonModel } from '../models/lesson.model.js';
import {
  abortProcessingJob,
  claimNextVideoProcessingJob,
  expireProcessingJob,
  failOrRequeueVideoProcessingJob,
  heartbeatProcessingJob,
  getVideoQueueMetrics,
  type VideoProcessingJobLease,
} from '../queue/video.queue.js';
import { downloadR2Object } from '../services/r2.js';
import { logger } from '../services/logger.js';
import { processLessonVideoPipeline } from '../services/subtitle-pipeline.js';
import { NotificationService } from '../services/notification.service.js';

const workerId = `${process.pid}-${randomUUID()}`;
let timer: NodeJS.Timeout | undefined;
let running = false;

async function processNextJob(): Promise<boolean> {
  if (running) return false;
  running = true;
  let lease: VideoProcessingJobLease | null = null;
  // F04: AbortController wired to every I/O operation in the pipeline.
  // Three ways this can fire:
  //   1) The job's stageDeadlineAt passes (enforced by the deadline timer below).
  //   2) The lease's heartbeat fails (another worker claimed it back).
  //   3) The worker's parent process receives SIGTERM/SIGINT (graceful shutdown).
  const abortController = new AbortController();
  const { signal } = abortController;
  let deadlineTimer: NodeJS.Timeout | undefined;
  try {
    lease = await claimNextVideoProcessingJob(workerId);
    if (!lease) return false;
    const lesson = await LessonModel.findById(lease.lessonId).select('media.objectKey').lean();
    const objectKey = lease.objectKey || lesson?.media?.objectKey;
    if (!objectKey) {
      await failOrRequeueVideoProcessingJob(lease.jobId, 'FAILED_DOWNLOAD', 'Processing job không có R2 object key', lease.leaseToken);
      return true;
    }
    const extension = objectKey.endsWith('.webm') ? 'webm' : 'mp4';
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hanflix-'));
    const localPath = path.join(tempDir, `input.${extension}`);
    const startedAt = Date.now();

    // F04: stage deadline timer. Fires `abort()` if the pipeline doesn't reach
    // the next stage transition (which refreshes stageDeadlineAt) in time.
    const armDeadline = (ms: number) => {
      if (deadlineTimer) clearTimeout(deadlineTimer);
      deadlineTimer = setTimeout(() => {
        logger.warn({ videoId: lease!.lessonId, jobId: lease!.jobId, deadlineMs: ms }, '[VideoProcessing] stage deadline exceeded — aborting');
        abortController.abort(new Error('STAGE_DEADLINE_EXCEEDED'));
      }, ms);
      deadlineTimer.unref();
    };
    armDeadline(env.VIDEO_STAGE_DEADLINE_INSPECT_MS);

    // F04: lease heartbeat loop. Renews leaseExpiresAt + heartbeatAt every
    // VIDEO_HEARTBEAT_INTERVAL_SECONDS. If a heartbeat update returns false
    // (lease revoked), we abort the pipeline so we don't keep working a job
    // another worker has reclaimed.
    let heartbeatStopped = false;
    const heartbeatLoop = async () => {
      while (!heartbeatStopped && !signal.aborted) {
        await new Promise<void>(resolve => setTimeout(resolve, env.VIDEO_HEARTBEAT_INTERVAL_SECONDS * 1000));
        if (heartbeatStopped || signal.aborted) break;
        if (!lease) break;
        const ok = await heartbeatProcessingJob(lease);
        if (!ok) {
          logger.warn({ videoId: lease.lessonId, jobId: lease.jobId }, '[VideoProcessing] heartbeat rejected — lease revoked, aborting');
          abortController.abort(new Error('LEASE_REVOKED'));
          break;
        }
      }
    };

    logger.info({ videoId: lease.lessonId, jobId: lease.jobId, step: 'DOWNLOAD', status: 'START', leaseExpiresAt: lease.leaseExpiresAt }, '[VideoProcessing]');
    try {
      const heartbeatPromise = void heartbeatLoop();
      try {
        await downloadR2Object(objectKey, localPath);
        if (signal.aborted) throw signal.reason ?? new Error('aborted');
      } catch (error) {
        if (signal.aborted) {
          // Distinguish "user/system cancelled" from "real error".
          const reason = signal.reason instanceof Error ? signal.reason.message : 'aborted';
          if (reason === 'STAGE_DEADLINE_EXCEEDED') {
            await expireProcessingJob(lease, 'inspect_media');
          } else if (reason === 'LEASE_REVOKED') {
            await abortProcessingJob(lease, 'Lease bị thu hồi bởi worker khác');
          } else {
            await abortProcessingJob(lease, 'Đã hủy xử lý video');
          }
          return true;
        }
        throw Object.assign(new Error(`Không thể tải video từ R2: ${error instanceof Error ? error.message : String(error)}`), { code: 'FAILED_DOWNLOAD' });
      }
      // Pass the lease + signal into the pipeline so every stage can:
      //   - extend its stageDeadlineAt via heartbeatProcessingJob()
      //   - abort cooperatively via signal.aborted
      //   - re-arm the deadline timer on each stage transition
      await processLessonVideoPipeline(lease.lessonId, lease.jobId, localPath, {
        lease,
        signal,
        rearmDeadline: armDeadline,
      });
      logger.info({ videoId: lease.lessonId, jobId: lease.jobId, status: 'SUCCESS', durationMs: Date.now() - startedAt }, '[VideoProcessing]');

      // Notify admins that video processing completed
      try {
        const lessonDoc = await LessonModel.findById(lease.lessonId).select('titleVi titleZh').lean();
        const lessonTitle = lessonDoc?.titleVi || lessonDoc?.titleZh || 'Bài học mới';
        await NotificationService.notifyAdmins({
          type: 'video_pipeline',
          category: 'system',
          title: {
            vi: `Video "${lessonTitle}" đã xử lý hoàn tất!`,
            en: `Video "${lessonTitle}" processing finished!`,
            zh: `视频 "${lessonTitle}" 自动处理已完成！`,
          },
          message: {
            vi: 'Phụ đề AI, phiên âm Pinyin và bộ câu hỏi trắc nghiệm đã được sinh thành công. Vui lòng duyệt xuất bản.',
            en: 'Subtitles, Pinyin, and interactive quiz generated successfully. Please review and publish.',
            zh: 'AI 字幕提取、拼音标注及随堂测试已生成完毕，请审核并发布课程。',
          },
          actionUrl: `/admin/lessons/${lease.lessonId}`,
          actionText: {
            vi: 'Duyệt bài học',
            en: 'Review Lesson',
            zh: '审核课程',
          },
          metadata: { lessonId: lease.lessonId, jobId: lease.jobId },
        });
      } catch (notifyErr) {
        logger.error({ err: notifyErr }, '[VideoProcessing] Failed to send admin completion notification');
      }
    } catch (error) {
      if (signal.aborted) {
        const reason = signal.reason instanceof Error ? signal.reason.message : 'aborted';
        if (reason === 'STAGE_DEADLINE_EXCEEDED') {
          // Already handled by the timer path above. If we reach here, the
          // pipeline raised its own abort error after the timer fired.
          await expireProcessingJob(lease, 'inspect_media');
        } else if (reason === 'LEASE_REVOKED') {
          await abortProcessingJob(lease, 'Lease bị thu hồi bởi worker khác');
        } else {
          await abortProcessingJob(lease, 'Đã hủy xử lý video');
        }
        return true;
      }
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'PROCESSING_FAILED';
      const message = error instanceof Error ? error.message : 'Lỗi xử lý video không xác định';
      const updated = await failOrRequeueVideoProcessingJob(lease.jobId, code, message, lease.leaseToken);
      await LessonModel.findByIdAndUpdate(lease.lessonId, updated?.status === 'failed'
        ? { $set: { status: 'failed', processingStatus: 'FAILED', processingStep: 'FAILED', processingError: message } }
        : { $set: { status: 'processing', processingStatus: 'QUEUED', processingStep: 'QUEUED', processingError: message } });
      logger.error({ videoId: lease.lessonId, jobId: lease.jobId, step: 'pipeline', status: 'FAILED', error: message }, '[VideoProcessing]');

      // Notify admins if job permanently failed
      if (updated?.status === 'failed') {
        try {
          await NotificationService.notifyAdmins({
            type: 'video_pipeline',
            category: 'system',
            title: {
              vi: 'Xử lý video thất bại',
              en: 'Video processing failed',
              zh: '视频自动处理失败',
            },
            message: {
              vi: `Tiến trình xử lý video gặp lỗi: ${message}`,
              en: `Video processing pipeline failed: ${message}`,
              zh: `视频处理流水线遇到错误：${message}`,
            },
            actionUrl: `/admin/lessons/${lease.lessonId}`,
            metadata: { lessonId: lease.lessonId, jobId: lease.jobId, code },
          });
        } catch (notifyErr) {
          logger.error({ err: notifyErr }, '[VideoProcessing] Failed to send admin failure notification');
        }
      }
    } finally {
      heartbeatStopped = true;
      if (deadlineTimer) clearTimeout(deadlineTimer);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    return true;
  } finally {
    running = false;
  }
}

export function wakeVideoProcessingWorker() {
  if (env.VIDEO_WORKER_MODE !== 'embedded') return;
  if (running) return;
  // Catch + log to avoid an unhandled rejection killing the whole process when
  // MongoDB or R2 transiently fails (DatabaseDifferCase, network blip, etc.).
  setImmediate(() => {
    processNextJob().catch(error => {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[VideoProcessing] poll failed - will retry on next tick',
      );
    });
  });
}

export function startVideoProcessingWorker() {
  if (env.VIDEO_WORKER_MODE !== 'embedded' || timer) return;
  wakeVideoProcessingWorker();
  timer = setInterval(() => {
    processNextJob().catch(error => {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[VideoProcessing] poll failed - will retry on next tick',
      );
    });
  }, env.VIDEO_PROCESSING_POLL_MS);
  timer.unref();
  logger.info({ workerId, mode: env.VIDEO_WORKER_MODE, leaseTtlSeconds: env.VIDEO_LEASE_TTL_SECONDS, heartbeatSeconds: env.VIDEO_HEARTBEAT_INTERVAL_SECONDS }, '[VideoProcessing] worker started');
}

export async function stopVideoProcessingWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
  while (running) await new Promise(resolve => setTimeout(resolve, 100));
}

export async function getVideoWorkerStatus() {
  const queueMetrics = await getVideoQueueMetrics();
  return {
    workerId,
    running,
    mode: env.VIDEO_WORKER_MODE,
    readiness: env.VIDEO_WORKER_MODE === 'disabled'
      ? 'worker-disabled'
      : env.VIDEO_WORKER_MODE === 'standalone'
        ? 'worker-standalone-process'
        : running ? 'worker-busy' : 'worker-idle',
    ...queueMetrics,
  };
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
