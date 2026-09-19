import { Types } from 'mongoose';
import { QuizModel } from '../models/quiz.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import {
  generateQuizWithGemini,
  type GeneratedQuestion,
  type QuestionKind,
} from './quiz-generator.js';

/**
 * Auto-generate quiz for a freshly processed lesson.
 *
 * Behavior:
 *   - Loads the latest draft quiz + latest draft subtitle track for the lesson.
 *   - Updates quiz.aiGenerationStatus = 'running' (or 'skipped' if disabled).
 *   - Calls Gemini with the subtitle cues as context.
 *   - Replaces the quiz questions with the AI output. The admin can still
 *     edit the result via the existing PUT /lessons/:id/quiz endpoint.
 *   - Updates aiGenerationStatus = 'completed' on success or 'failed' with error.
 *
 * This runs fire-and-forget (do NOT await) so the video processing pipeline
 * can move forward while Gemini answers in the background. Errors are logged
 * and persisted to the Quiz document; we never throw upward.
 */
export async function autoGenerateQuizForLesson(lessonId: string): Promise<void> {
  const lessonObjectId = new Types.ObjectId(lessonId);

  if (!env.QUIZ_AUTO_GENERATION_ENABLED) {
    await markAiStatus(lessonObjectId, 'skipped', 'Auto-generation disabled via env');
    return;
  }
  if (!env.GEMINI_API_KEY) {
    await markAiStatus(lessonObjectId, 'skipped', 'Gemini API key not configured');
    return;
  }

  const kinds = parseKindsFromEnv();
  if (kinds.length === 0) {
    await markAiStatus(lessonObjectId, 'skipped', 'No question kinds configured');
    return;
  }

  const startedAt = new Date();

  // Load lesson early so we can compute the target question count (taking
  // any per-lesson override into account) before we mark the quiz as running.
  const lessonForCount = await LessonModel.findById(lessonObjectId)
    .select('hsk autoGenerateQuizCount')
    .lean();
  if (!lessonForCount) {
    logger.warn({ lessonId }, '[auto-quiz] lesson not found, skipping');
    return;
  }
  const targetQuestionCount = resolveQuestionCount(
    lessonForCount.hsk,
    lessonForCount.autoGenerateQuizCount,
  );

  // Mark "running" before doing any I/O so admin UI sees the status change.
  const runningResult = await QuizModel.findOneAndUpdate(
    { lessonId: lessonObjectId, status: 'draft' },
    {
      $set: {
        aiGenerationStatus: 'running',
        aiGenerationStartedAt: startedAt,
        aiGenerationKinds: kinds,
        aiGenerationQuestionCount: targetQuestionCount,
        aiGenerationError: undefined,
      },
    },
    { sort: { revision: -1 } },
  ).lean();
  if (!runningResult) {
    logger.warn({ lessonId }, '[auto-quiz] no draft quiz to enrich, skipping');
    return;
  }

  try {
    const [lesson, subtitle] = await Promise.all([
      LessonModel.findById(lessonObjectId)
        .select('hsk titleVi autoGenerateQuizCount')
        .lean(),
      SubtitleTrackModel.findOne({ lessonId: lessonObjectId, status: 'draft' })
        .sort({ revision: -1 })
        .select('cues')
        .lean(),
    ]);

    if (!lesson) {
      throw new Error('Lesson not found during quiz auto-generation');
    }
    if (!subtitle || subtitle.cues.length === 0) {
      throw new Error('No subtitle cues available for quiz generation');
    }

    const cues = subtitle.cues
      .filter((cue) => cue.zh && cue.vi)
      .slice(0, 80)
      .map((cue) => ({
        cueId: cue.cueId,
        startMs: cue.startMs,
        endMs: cue.endMs,
        zh: cue.zh,
        pinyin: cue.pinyin,
        vi: cue.vi,
      }));

    const questionCount = resolveQuestionCount(lesson.hsk, lesson.autoGenerateQuizCount);
    // Reflect the HSK-derived target on the quiz doc so the admin sees the
    // final intended count even before the response arrives.
    await QuizModel.updateOne(
      { lessonId: lessonObjectId, status: 'draft' },
      { $set: { aiGenerationQuestionCount: questionCount } },
    );
    logger.info(
      {
        lessonId,
        hsk: lesson.hsk,
        autoGenerateQuizCount: lesson.autoGenerateQuizCount ?? null,
        kinds,
        questionCount,
        cueCount: cues.length,
      },
      '[auto-quiz] requesting Gemini to generate quiz questions',
    );

    const generated = await generateQuizWithGemini({
      hsk: lesson.hsk,
      kinds,
      questionCount,
      cues,
      lessonTitleVi: lesson.titleVi,
    });

    if (generated.length === 0) {
      // Gemini responded but every question was filtered out. Don't overwrite
      // the existing fall-back fill_blank quiz (admin still has a usable draft).
      await QuizModel.findOneAndUpdate(
        { lessonId: lessonObjectId, status: 'draft' },
        {
          $set: {
            aiGenerationStatus: 'completed',
            aiGenerationCompletedAt: new Date(),
            aiGenerationQuestionCount: 0,
            aiGenerationError: 'AI trả về rỗng; giữ nguyên bài tập fallback',
          },
        },
        { sort: { revision: -1 } },
      );
      return;
    }

    const mappedQuestions = generated.map((q, index) => mapToQuizQuestion(q, index));

    // Replace the existing draft questions. Keep revision/status untouched.
    await QuizModel.findOneAndUpdate(
      { lessonId: lessonObjectId, status: 'draft' },
      {
        $set: {
          questions: mappedQuestions,
          aiGenerationStatus: 'completed',
          aiGenerationCompletedAt: new Date(),
          aiGenerationQuestionCount: mappedQuestions.length,
          aiGenerationError: undefined,
        },
      },
      { sort: { revision: -1 } },
    );

    logger.info(
      { lessonId, generatedCount: mappedQuestions.length },
      '[auto-quiz] successfully replaced draft questions with AI output',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ lessonId, error: message }, '[auto-quiz] generation failed');
    await QuizModel.findOneAndUpdate(
      { lessonId: lessonObjectId, status: 'draft' },
      {
        $set: {
          aiGenerationStatus: 'failed',
          aiGenerationCompletedAt: new Date(),
          aiGenerationError: message.slice(0, 1000),
        },
      },
      { sort: { revision: -1 } },
    );
  }
}

/**
 * Question count target by HSK level.
 *
 * Heuristic rationale:
 *   - HSK 1-2: short vocabulary, simple sentences; 3 questions is enough to
 *     cover the basics without overwhelming beginners.
 *   - HSK 3-4: intermediate; 5 questions hits the "medium" sweet spot.
 *   - HSK 5-6: advanced; 6-7 questions test grammar + vocabulary adequately.
 *   - HSK 7-9: near-native; 7 questions matches what the existing manual
 *     editor typically produces.
 *
 * Returns a value within the safe Gemini request bounds (1-15) so we never
 * overflow the schema validator upstream.
 */
export function computeQuestionCountForHsk(hsk: number): number {
  // Guard against NaN/Infinity/0/negative; fall back to medium (5).
  if (!Number.isFinite(hsk) || hsk < 1) return 5;
  if (hsk > 9) return 5;
  if (hsk <= 2) return 3;
  if (hsk <= 4) return 5;
  if (hsk <= 6) return 6;
  return 7;
}

/**
 * Final question count, respecting an optional per-lesson override.
 *
 * If `override` is a positive integer, that wins (clamped to [1, 15]).
 * Otherwise we fall back to the HSK heuristic.
 */
export function resolveQuestionCount(
  hsk: number,
  override: number | undefined | null,
): number {
  if (typeof override === 'number' && Number.isFinite(override) && override >= 1) {
    return Math.min(15, Math.floor(override));
  }
  return computeQuestionCountForHsk(hsk);
}

function mapToQuizQuestion(question: GeneratedQuestion, index: number) {
  return {
    questionId: question.questionId || `ai-q-${Date.now()}-${index}`,
    type: question.type,
    prompt: question.prompt,
    cueId: question.cueId,
    options: question.options ?? [],
    ...(question.type === 'multiple_choice'
      ? { correctOptionId: question.correctOptionId }
      : { acceptedAnswers: question.acceptedAnswers ?? [] }),
    explanationVi: question.explanationVi,
    relatedWordIds: [] as Types.ObjectId[],
  };
}

function parseKindsFromEnv(): QuestionKind[] {
  const allowed: QuestionKind[] = ['comprehension', 'vocabulary', 'grammar', 'cloze'];
  return env.QUIZ_AUTO_GENERATION_KINDS
    .split(',')
    .map((kind) => kind.trim())
    .filter((kind): kind is QuestionKind =>
      allowed.includes(kind as QuestionKind),
    );
}

async function markAiStatus(
  lessonId: Types.ObjectId,
  status: 'skipped' | 'failed',
  reason: string,
): Promise<void> {
  await QuizModel.findOneAndUpdate(
    { lessonId, status: 'draft' },
    {
      $set: {
        aiGenerationStatus: status,
        aiGenerationError: reason.slice(0, 1000),
        aiGenerationCompletedAt: new Date(),
      },
    },
    { sort: { revision: -1 } },
  );
}
