import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../models/processing-job.model.js', () => ({ ProcessingJobModel: { updateMany: vi.fn(), findOneAndUpdate: vi.fn() } }));
vi.mock('../models/lesson.model.js', () => ({ LessonModel: { updateOne: vi.fn() } }));
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { claimNextVideoProcessingJob } from './video.queue.js';
beforeEach(() => vi.clearAllMocks());
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
