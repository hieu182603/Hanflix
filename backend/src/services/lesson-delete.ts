import { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { ProgressModel } from '../models/progress.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { deleteR2Object } from './r2.js';
import { logger } from './logger.js';

const DELETABLE_STATUSES = [
  'draft',
  'uploading',
  'processing',
  'ready_for_review',
  'published',
  'hidden',
  'failed',
] as const;

export type DeletableLessonStatus = (typeof DELETABLE_STATUSES)[number];

async function deleteR2Keys(keys: Array<string | undefined | null>): Promise<void> {
  const uniqueKeys = [...new Set(keys.filter((key): key is string => Boolean(key?.trim())))];
  await Promise.allSettled(
    uniqueKeys.map(async (key) => {
      try {
        await deleteR2Object(key);
      } catch (error) {
        logger.warn({ key, error: error instanceof Error ? error.message : String(error) }, '[admin] lesson delete R2 cleanup failed');
      }
    }),
  );
}

/**
 * Permanently remove a lesson and its related artifacts (media, jobs, subtitles, quiz, learner progress).
 * Active processing jobs are marked cancelled first so workers stop mutating the lesson.
 */
export async function purgeAdminLesson(lessonId: string): Promise<{ lessonId: string; titleVi: string }> {
  if (!Types.ObjectId.isValid(lessonId)) {
    throw new AppError(422, 'INVALID_LESSON_ID', 'lessonId không hợp lệ');
  }

  const lesson = await LessonModel.findById(lessonId)
    .select('+pendingUploadObjectKey titleVi status media thumbnailKey')
    .lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (!DELETABLE_STATUSES.includes(lesson.status as DeletableLessonStatus)) {
    throw new AppError(409, 'LESSON_NOT_DELETABLE', 'Trạng thái bài học hiện tại không cho phép xóa');
  }

  await ProcessingJobModel.updateMany(
    { lessonId, status: { $in: ['queued', 'running'] } },
    {
      $set: {
        status: 'failed',
        errorCode: 'DELETED',
        errorMessage: 'Bài học đã bị xóa bởi quản trị viên',
        completedAt: new Date(),
      },
      $unset: {
        activeKey: 1,
        lockedAt: 1,
        lockedBy: 1,
        heartbeatAt: 1,
        leaseToken: 1,
        leaseExpiresAt: 1,
        stageDeadlineAt: 1,
        stageStartedAt: 1,
      },
    },
  );

  await deleteR2Keys([
    lesson.media?.objectKey,
    lesson.pendingUploadObjectKey,
    lesson.thumbnailKey,
  ]);

  await Promise.all([
    ProcessingJobModel.deleteMany({ lessonId }),
    SubtitleTrackModel.deleteMany({ lessonId }),
    QuizModel.deleteMany({ lessonId }),
    ProgressModel.deleteMany({ lessonId }),
    QuizAttemptModel.deleteMany({ lessonId }),
  ]);

  const deleted = await LessonModel.deleteOne({ _id: lessonId });
  if (deleted.deletedCount !== 1) {
    throw new AppError(500, 'LESSON_DELETE_INCOMPLETE', 'Không thể xóa bài học');
  }

  return { lessonId, titleVi: lesson.titleVi };
}
