import mongoose, { Types, type ClientSession } from 'mongoose';
import { env } from '../config/env.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { AppError } from '../errors/app-error.js';
import { logger } from './logger.js';

/**
 * F11 fix (2026-09-18): unified revision commit helper.
 *
 * Background:
 *   Before this helper, the pipeline + admin save endpoints mutated Lesson,
 *   SubtitleTrack and Quiz as INDEPENDENT operations. If one write failed
 *   (network blip, duplicate-key, validator), the others still committed and
 *   the database ended up in a half-written state:
 *     - SubtitleTrack wrote revision N with new cues, but QuizModel.findOneAndUpdate
 *       failed → lesson points to a subtitle that doesn't match any quiz
 *     - LessonModel.findByIdAndUpdate succeeded but ProcessingJobModel update
 *       failed → user sees lesson as `ready_for_review` forever
 *     - During PATCH /subtitles, the question links to "dirty" tokens but the
 *       Lesson.contentDirty flag is updated in a separate query (lost update)
 *
 * This module provides two helpers:
 *   - `runGenerationCommit` — used by subtitle-pipeline.ts to atomically:
 *       1) validate the lease is still valid
 *       2) write SubtitleTrack (revision N) with cues
 *       3) write Quiz (revision N) with questions
 *       4) transition Lesson to ready_for_review + activeSubtitleRevision / activeQuizRevision
 *       5) mark ProcessingJob completed
 *   - `runEditorCommit` — used by admin PATCH /subtitles and /quiz:
 *       1) update SubtitleTrack / Quiz draft with new cues/questions
 *       2) sync Lesson.contentDirty flag + contentDirtyReason
 *
 * The helpers use MongoDB transactions when supported (DISABLE_TRANSACTIONS=false
 * AND topology reports ReplicaSetWithPrimary or Sharded). When transactions are
 * not available (DISABLE_TRANSACTIONS=true, standalone Mongo, or flaky Atlas
 * free tier), they run sequentially. The lease guard is checked FIRST so a
 * stale worker never writes partial state. The duplicate-key index on
 * (lessonId, revision) ensures retries converge to the same revision slot.
 */
export interface SubtitleCueInput {
  cueId: string;
  startMs: number;
  endMs: number;
  zh: string;
  pinyin: string;
  vi: string;
  tokens?: Array<{ text: string; wordId: Types.ObjectId | null }>;
}

export interface QuizQuestionInput {
  questionId: string;
  type: 'multiple_choice' | 'fill_blank';
  prompt: string;
  cueId?: string;
  options: Array<{ optionId: string; text: string }>;
  correctOptionId?: string;
  acceptedAnswers?: string[];
  explanationVi?: string;
  relatedWordIds?: Types.ObjectId[];
}

export interface GenerationCommitInput {
  lessonId: string;
  jobId: string;
  durationSeconds: number;
  thumbnailKey?: string;
  cues: SubtitleCueInput[];
  questions: QuizQuestionInput[];
  leaseToken: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDoc = any;

export interface GenerationCommitResult {
  lesson: AnyDoc;
  subtitle: AnyDoc;
  quiz: AnyDoc;
}

export interface EditorCommitInput {
  lessonId: string;
  subtitle?: {
    revision: number;
    cues: SubtitleCueInput[];
    dirty?: { reason: string; zhChangedCount: number };
  };
  quiz?: {
    revision: number;
    questions: QuizQuestionInput[];
  };
}

export interface EditorCommitResult {
  lesson: AnyDoc;
  subtitle?: AnyDoc | null;
  quiz?: AnyDoc | null;
}

interface TopologyProbe {
  supportsTransactions: boolean;
  reason: string;
}

/**
 * Detect whether the current MongoDB deployment supports transactions.
 * Atlas / replica sets → true. Standalone Mongo / single-node docker → false.
 * F11: respect explicit opt-out via DISABLE_TRANSACTIONS env (Atlas M0 free
 * tier throws "ConflictingOperationInProgress" on the second session even
 * though it advertises ReplicaSetWithPrimary).
 */
export function probeTransactionSupport(): TopologyProbe {
  if (env.DISABLE_TRANSACTIONS) {
    return { supportsTransactions: false, reason: 'opt-out-via-env' };
  }
  const connection = mongoose.connection;
  if (connection.readyState !== 1) {
    return { supportsTransactions: false, reason: 'connection-not-ready' };
  }
  const descriptionType = (connection as unknown as { client?: { topology?: { description?: { type?: string } } } })
    .client?.topology?.description?.type;
  if (descriptionType === 'ReplicaSetWithPrimary' || descriptionType === 'Sharded') {
    return { supportsTransactions: true, reason: descriptionType };
  }
  return { supportsTransactions: false, reason: descriptionType ?? 'unknown' };
}

async function withOptionalSession<T>(
  work: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  const probe = probeTransactionSupport();
  if (!probe.supportsTransactions) {
    logger.warn({ reason: probe.reason }, '[F11] transactions not supported, using sequential writes');
    return work(null);
  }
  // F11: one session per logical transaction. We do NOT retry on the same
  // session because the MongoDB driver's transactionNumber counter persists
  // across startTransaction() calls; the second call would conflict with
  // the first on Atlas shared clusters ("ConflictingOperationInProgress").
  const session = await mongoose.startSession({ causalConsistency: false });
  try {
    session.startTransaction();
    try {
      const result = await work(session);
      await session.commitTransaction();
      return result;
    } catch (error: unknown) {
      await session.abortTransaction().catch(() => undefined);
      throw error;
    }
  } finally {
    await session.endSession();
  }
}

/**
 * F11: commit a generation result atomically.
 * Order: lease check → subtitle write → quiz write → lesson write → job complete.
 * The lease check FIRST prevents a stale worker from writing partial state when
 * running without transactions.
 */
export async function runGenerationCommit(input: GenerationCommitInput): Promise<GenerationCommitResult> {
  const { lessonId, jobId, durationSeconds, thumbnailKey, cues, questions, leaseToken } = input;

  // Pre-flight validations (outside any session — fast to fail).
  const lesson = await LessonModel.findById(lessonId);
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (cues.length === 0) throw new AppError(422, 'CONTENT_INCOMPLETE', 'Phụ đề không có câu nào');
  if (questions.length === 0) throw new AppError(422, 'CONTENT_INCOMPLETE', 'Bài tập không có câu hỏi nào');
  const lastCue = cues[cues.length - 1]!;
  if (lastCue.endMs > durationSeconds * 1000) {
    throw new AppError(422, 'INVALID_CUE_TIME', 'Câu phụ đề cuối vượt thời lượng video');
  }

  return withOptionalSession(async (sess) => {
    // Step 1: read existing draft revisions inside the session.
    const [existingSubtitle, existingQuiz] = await Promise.all([
      SubtitleTrackModel.findOne({ lessonId, status: 'draft' }).sort({ revision: -1 }).session(sess),
      QuizModel.findOne({ lessonId, status: 'draft' }).sort({ revision: -1 })
        .select('+questions.correctOptionId +questions.acceptedAnswers +questions.explanationVi')
        .session(sess),
    ]);
    const nextSubtitleRevision = (existingSubtitle?.revision ?? 0) + 1;
    const nextQuizRevision = (existingQuiz?.revision ?? 0) + 1;

    // Step 2: lease guard. Throw LEASE_REVOKED BEFORE writing anything.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leaseCheck = await ProcessingJobModel.findOne(
      { _id: jobId, leaseToken, status: 'running' } as any,
      null,
      { session: sess as any },
    );
    if (!leaseCheck) {
      throw new AppError(409, 'LEASE_REVOKED', 'Lease bị thu hồi trước khi commit hoàn tất');
    }

    // Step 3: write subtitle (upsert by unique lessonId+revision index).
    const subtitle = await SubtitleTrackModel.findOneAndUpdate(
      { lessonId, revision: nextSubtitleRevision },
      { $set: { lessonId, revision: nextSubtitleRevision, status: 'draft', cues, generatedBy: 'pipeline' } },
      { upsert: true, returnDocument: 'after', session: sess as any },
    );
    if (!subtitle) throw new AppError(500, 'SUBTITLE_WRITE_FAILED', 'Không thể lưu phụ đề');

    // Step 4: write quiz.
    const quiz = await QuizModel.findOneAndUpdate(
      { lessonId, revision: nextQuizRevision },
      { $set: { lessonId, revision: nextQuizRevision, status: 'draft', questions } },
      { upsert: true, returnDocument: 'after', session: sess as any },
    );
    if (!quiz) throw new AppError(500, 'QUIZ_WRITE_FAILED', 'Không thể lưu bài tập');

    // Step 5: update lesson to point at the new revisions + transition status.
    const updatedLesson = await LessonModel.findOneAndUpdate(
      { _id: lessonId },
      {
        $set: {
          durationSeconds: Math.max(60, Math.min(300, Math.round(durationSeconds))),
          ...(thumbnailKey ? { thumbnailKey } : {}),
          activeSubtitleRevision: subtitle.revision,
          activeQuizRevision: quiz.revision,
          status: 'ready_for_review',
          processingStatus: 'READY',
          processingStep: 'COMPLETED',
          processingProgress: 100,
        },
        $unset: { processingError: 1 },
      },
      { returnDocument: 'after', session: sess as any },
    );
    if (!updatedLesson) throw new AppError(500, 'LESSON_WRITE_FAILED', 'Không thể cập nhật bài học');

    // Step 6: mark the job completed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobResult = await ProcessingJobModel.updateOne(
      { _id: jobId, leaseToken, status: 'running' } as any,
      {
        $set: { status: 'completed', stage: 'finalize', stageProgress: 100, completedAt: new Date(), heartbeatAt: new Date() },
        $unset: { activeKey: 1, lockedAt: 1, lockedBy: 1, leaseToken: 1, leaseExpiresAt: 1, stageDeadlineAt: 1, stageStartedAt: 1, errorCode: 1, errorMessage: 1 },
      },
      { session: sess as any },
    );
    if (jobResult.matchedCount === 0) {
      throw new AppError(409, 'LEASE_REVOKED', 'Lease bị thu hồi trước khi commit hoàn tất');
    }
    return { lesson: updatedLesson, subtitle, quiz };
  });
}

/**
 * F11: commit an editor save (PATCH /subtitles or PATCH /quiz) atomically.
 * Updates subtitle + quiz + sets contentDirty in one transaction.
 */
export async function runEditorCommit(input: EditorCommitInput): Promise<EditorCommitResult> {
  const { lessonId, subtitle, quiz } = input;
  if (!subtitle && !quiz) throw new AppError(422, 'EMPTY_COMMIT', 'Phải cung cấp subtitle hoặc quiz để cập nhật');
  return withOptionalSession(async (sess) => {
    const lesson = await LessonModel.findById(lessonId).session(sess);
    if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');

    let updatedSubtitle: AnyDoc | null = null;
    let updatedQuiz: AnyDoc | null = null;
    let shouldMarkDirty = false;
    let dirtyReason: string | undefined;

    if (subtitle) {
      updatedSubtitle = await SubtitleTrackModel.findOneAndUpdate(
        { lessonId, revision: subtitle.revision, status: 'draft' },
        { $set: { cues: subtitle.cues } },
        { returnDocument: 'after', session: sess as any },
      );
      if (!updatedSubtitle) throw new AppError(409, 'SUBTITLE_NOT_FOUND', 'Không tìm thấy phụ đề nháp ở revision này');
      if (subtitle.dirty && subtitle.dirty.zhChangedCount > 0) {
        shouldMarkDirty = true;
        dirtyReason = subtitle.dirty.reason;
      }
    }
    if (quiz) {
      updatedQuiz = await QuizModel.findOneAndUpdate(
        { lessonId, revision: quiz.revision, status: 'draft' },
        { $set: { questions: quiz.questions } },
        { returnDocument: 'after', session: sess as any },
      );
      if (!updatedQuiz) throw new AppError(409, 'QUIZ_NOT_FOUND', 'Không tìm thấy bài tập nháp ở revision này');
      const hasUnlinked = quiz.questions.some(q => !q.relatedWordIds || q.relatedWordIds.length === 0);
      if (hasUnlinked) {
        shouldMarkDirty = true;
        dirtyReason = dirtyReason ?? 'Bài tập có câu hỏi chưa liên kết từ vựng';
      }
    }

    let updatedLesson = lesson;
    if (shouldMarkDirty) {
      updatedLesson = await LessonModel.findOneAndUpdate(
        { _id: lessonId },
        { $set: { contentDirty: true, ...(dirtyReason ? { contentDirtyReason: dirtyReason } : {}) } },
        { returnDocument: 'after', session: sess as any },
      ) ?? lesson;
    }
    return { lesson: updatedLesson, subtitle: updatedSubtitle, quiz: updatedQuiz };
  });
}
