import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../models/processing-job.model.js', () => ({ ProcessingJobModel: { updateMany: vi.fn(), updateOne: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() } }));
vi.mock('../models/lesson.model.js', () => ({ LessonModel: { updateOne: vi.fn() } }));
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { claimNextVideoProcessingJob, expireProcessingJob, transitionStage } from './video.queue.js';
beforeEach(() => vi.clearAllMocks());
const lease = { jobId: 'job', lessonId: 'lesson', objectKey: 'source', leaseToken: 'owner', leaseExpiresAt: new Date(Date.now() + 120000) };
it('expires the actual active step and keeps completed translations intact', async () => {
  vi.mocked(ProcessingJobModel.findOne).mockReturnValue({ lean: async () => ({ currentStep: 'BUILD_SUBTITLES', stage: 'finalize', steps: { BUILD_SUBTITLES: { status: 'RUNNING' }, TRANSLATE: { status: 'COMPLETED' } } }) } as never);
  vi.mocked(ProcessingJobModel.updateOne).mockResolvedValue({ matchedCount: 1 } as never);
  await expireProcessingJob(lease);
  const [filter, update] = vi.mocked(ProcessingJobModel.updateOne).mock.calls[0]!;
  expect(filter).toEqual({ _id: 'job', leaseToken: 'owner', status: 'running' });
  expect(update.$set).toMatchObject({ status: 'failed', 'steps.BUILD_SUBTITLES.status': 'FAILED', failure: { step: 'BUILD_SUBTITLES', code: 'STAGE_DEADLINE_EXCEEDED' } });
  expect(update.$set).not.toHaveProperty('steps.TRANSLATE.status');
  expect(update.$set?.errorMessage).not.toContain('inspect_media');
  expect(LessonModel.updateOne).toHaveBeenCalledWith({ _id: 'lesson', status: 'processing' }, expect.objectContaining({ $set: expect.objectContaining({ processingStep: 'FAILED' }) }));
});
it('does not alter a lesson after the job lease was replaced', async () => {
  vi.mocked(ProcessingJobModel.findOne).mockReturnValue({ lean: async () => ({ currentStep: 'BUILD_SUBTITLES' }) } as never);
  vi.mocked(ProcessingJobModel.updateOne).mockResolvedValue({ matchedCount: 0 } as never);
  await expireProcessingJob(lease);
  expect(LessonModel.updateOne).not.toHaveBeenCalled();
});
it('persists the extended deadline used by the playback timer', async () => {
  vi.mocked(ProcessingJobModel.updateOne).mockResolvedValue({ matchedCount: 1 } as never);
  const before = Date.now();
  await transitionStage(lease, 'finalize', 73, 900000);
  const deadline = vi.mocked(ProcessingJobModel.updateOne).mock.calls[0]![1].$set?.stageDeadlineAt as Date;
  expect(deadline.getTime()).toBeGreaterThanOrEqual(before + 900000);
  expect(deadline.getTime()).toBeLessThanOrEqual(Date.now() + 900000);
});
it('clears previous progress and errors when claiming a retry', async () => {
  vi.mocked(ProcessingJobModel.updateMany).mockResolvedValue({ modifiedCount: 0 } as never);
  vi.mocked(ProcessingJobModel.findOneAndUpdate).mockResolvedValue({ _id: 'job', lessonId: 'lesson', objectKey: 'video.mp4' } as never);
  await claimNextVideoProcessingJob('test-worker');
  expect(ProcessingJobModel.findOneAndUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    $set: expect.objectContaining({ status: 'running', stage: 'inspect_media', stageProgress: 0 }),
    $unset: { errorCode: 1, errorMessage: 1 },
  }), expect.anything());
  expect(LessonModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ _id: 'lesson' }), {
    $set: { status: 'processing', processingStatus: 'PROCESSING', processingStep: 'DOWNLOADING', processingProgress: 0 },
    $unset: { processingError: 1 },
  });
});
