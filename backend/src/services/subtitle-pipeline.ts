import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { transcribeAudio } from './asr.js';
import { logger } from './logger.js';
import { extractAudioForASR, generateThumbnail, probeMedia } from './media-processor.js';
import { uploadR2File } from './r2.js';
import { pinyinService } from './pinyin.js';
import { translationService } from './translator.js';
import { resolveLearningWordIds } from './learning-word.js';
import { splitLongPhraseIntoCues } from './subtitle-splitter.js';
import { STAGE_DEADLINES_MS, transitionStage, type VideoProcessingJobLease } from '../queue/video.queue.js';
import { runGenerationCommit } from './revision-commit.js';
import { autoGenerateQuizForLesson } from './auto-quiz-generator.js';
import { improveVietnameseTranslations } from './gemini-translation-improver.js';
import { generateLearningTips } from './gemini-learning-tips.js';

export type PipelineStage = 'inspect_media' | 'transcribe_zh' | 'generate_pinyin' | 'translate_vi' | 'extract_vocabulary' | 'generate_quiz' | 'finalize';

const frontendStep: Record<PipelineStage, string> = {
  inspect_media: 'EXTRACTING_AUDIO',
  transcribe_zh: 'TRANSCRIBING',
  generate_pinyin: 'GENERATING_PINYIN',
  translate_vi: 'TRANSLATING',
  extract_vocabulary: 'SAVING',
  generate_quiz: 'SAVING',
  finalize: 'SAVING',};

export interface PipelineOptions {
  lease: VideoProcessingJobLease;
  signal: AbortSignal;
  rearmDeadline: (ms: number) => void;
}

/**
 * Throws an AbortError if the signal has been aborted. Pipeline code MUST
 * call this between stages (and after long awaits) to make cancellation
 * cooperative and instant.
 */
function ensureNotAborted(signal: AbortSignal, stage: PipelineStage): void {
  if (signal.aborted) {
    const reason = signal.reason instanceof Error ? signal.reason.message : `${stage} aborted`;
    const err = new Error(reason);
    err.name = 'PipelineAbortedError';
    throw err;
  }
}

export async function processLessonVideoPipeline(
  lessonId: string,
  processingJobId: string,
  videoLocalPath: string,
  options: PipelineOptions,
): Promise<void> {
  const { lease, signal, rearmDeadline } = options;
  const lesson = await LessonModel.findById(lessonId);
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (!videoLocalPath) throw new AppError(500, 'FAILED_DOWNLOAD', 'Worker chưa tải được video về thư mục tạm');

  ensureNotAborted(signal, 'inspect_media');

  const updateStage = async (stage: PipelineStage, progress: number) => {
    ensureNotAborted(signal, stage);
    // F04: stage transition must succeed (lease must still be valid). If it
    // fails, another worker has taken over — abort immediately.
    const ok = await transitionStage(lease, stage, progress);
    if (!ok) {
      const err = new Error(`Lease ${lease.leaseToken} đã bị thu hồi khi chuyển stage ${stage}`);
      err.name = 'LeaseRevokedError';
      throw err;
    }
    await Promise.all([
      LessonModel.findByIdAndUpdate(lessonId, {
        $set: { status: 'processing', processingStatus: 'PROCESSING', processingStep: frontendStep[stage], processingProgress: progress },
        $unset: { processingError: 1 },
      }),
    ]);
    // F04: rearm the deadline timer for the new stage.
    rearmDeadline(STAGE_DEADLINES_MS[stage]);
    logger.info({ videoId: lessonId, jobId: processingJobId, step: frontendStep[stage], status: 'START', leaseToken: lease.leaseToken }, '[VideoProcessing]');
  };

  const audioPath = path.join(path.dirname(videoLocalPath), 'speech.wav');
  let heartbeatInFlight = false;
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight || signal.aborted) return;
    heartbeatInFlight = true;
    void ProcessingJobModel.updateOne(
      { _id: processingJobId, leaseToken: lease.leaseToken, status: 'running' },
      { $set: { heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + env.VIDEO_LEASE_TTL_SECONDS * 1000) } },
    ).catch(error => {
      logger.warn({ videoId: lessonId, jobId: processingJobId, error: error instanceof Error ? error.message : String(error) }, '[VideoProcessing] heartbeat failed');
    }).finally(() => {
      heartbeatInFlight = false;
    });
  }, Math.min(30_000, Math.max(5_000, env.VIDEO_HEARTBEAT_INTERVAL_SECONDS * 1000 / 2)));
  heartbeat.unref();
  try {
    await updateStage('inspect_media', 10);
    let metadata;
    let thumbnailKey: string | undefined;
    try {
      metadata = await probeMedia(videoLocalPath, signal);
      ensureNotAborted(signal, 'inspect_media');
      await extractAudioForASR(videoLocalPath, audioPath, signal);
    } catch (error) {
      // F04: distinguish abort from real media failure.
      if (signal.aborted) throw error;
      throw new AppError(422, 'FAILED_MEDIA_PROCESSING', `Không thể đọc hoặc tách audio: ${error instanceof Error ? error.message : String(error)}`);
    }

    ensureNotAborted(signal, 'inspect_media');

    try {
      const tempDir = path.dirname(videoLocalPath);
      const thumbnailFilename = `thumb-${lessonId}-${randomUUID()}.jpg`;
      const generatedThumbPath = await generateThumbnail(videoLocalPath, tempDir, thumbnailFilename, '00:00:01', signal);
      thumbnailKey = `thumbnails/${lessonId}/${randomUUID()}.jpg`;
      await uploadR2File(thumbnailKey, generatedThumbPath, 'image/jpeg');
      await fs.unlink(generatedThumbPath).catch(() => undefined);
      logger.info({ videoId: lessonId, thumbnailKey }, '[VideoProcessing] Thumbnail generated and uploaded');
    } catch (thumbError) {
      if (signal.aborted) throw thumbError;
      logger.warn({ videoId: lessonId, error: thumbError instanceof Error ? thumbError.message : String(thumbError) }, '[VideoProcessing] Thumbnail generation failed, continuing without thumbnail');
    }

    ensureNotAborted(signal, 'transcribe_zh');
    await updateStage('transcribe_zh', 35);
    const segments = await transcribeAudio(audioPath);
    if (signal.aborted) throw signal.reason ?? new Error('aborted');
    if (segments.length === 0) throw new AppError(502, 'FAILED_TRANSCRIPTION_EMPTY', 'Azure Speech không trả về câu thoại');

    const beforeSplit = segments.length;
    const videoDurationMs = metadata.durationSeconds * 1000;
    const sanitizedSegments = segments
      .map((segment) => ({
        ...segment,
        startMs: Math.max(0, Math.min(segment.startMs, videoDurationMs)),
        endMs: Math.max(0, Math.min(segment.endMs, videoDurationMs)),
      }))
      .filter((segment) => segment.endMs > segment.startMs);
    const rawCues = sanitizedSegments.flatMap(segment => splitLongPhraseIntoCues({
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.zh,
      confidence: segment.confidence,
      words: segment.words,
    }));
    const sanitizedCues = rawCues
      .map((cue) => ({
        ...cue,
        startMs: Math.max(0, Math.min(cue.startMs, videoDurationMs)),
        endMs: Math.max(0, Math.min(cue.endMs, videoDurationMs)),
      }))
      .filter((cue) => cue.endMs > cue.startMs);
    const afterSplit = sanitizedCues.length;
    logger.info(
      { videoId: lessonId, jobId: processingJobId, beforeSplit, afterSplit, ratio: afterSplit / Math.max(beforeSplit, 1), videoDurationMs },
      '[VideoProcessing] Subtitle splitter: phrases → cues',
    );

    ensureNotAborted(signal, 'generate_pinyin');
    await updateStage('generate_pinyin', 60);
    let cuesWithPinyin;
    try {
      cuesWithPinyin = sanitizedCues.map(cue => ({
        cueId: randomUUID(),
        startMs: cue.startMs,
        endMs: cue.endMs,
        zh: cue.zh,
        pinyin: pinyinService.convert(cue.zh),
        tokens: pinyinService.tokenize(cue.zh).map(token => ({ text: token.text, wordId: null as Types.ObjectId | null })),
      }));
    } catch (error) {
      if (signal.aborted) throw error;
      throw new AppError(500, 'FAILED_PINYIN', `Không thể sinh Pinyin: ${error instanceof Error ? error.message : String(error)}`);
    }

    ensureNotAborted(signal, 'translate_vi');
    await updateStage('translate_vi', 75);
    const translations = await translationService.translateChineseToVietnamese(cuesWithPinyin.map(cue => cue.zh), signal);
    if (signal.aborted) throw signal.reason ?? new Error('aborted');

    // Apply Azure's literal translation first so downstream stages always
    // have a working .vi to operate on.
    const azureCues = cuesWithPinyin.map((cue, index) => ({ ...cue, vi: translations[index]! }));

    // Optional Gemini polish: send each batch through Gemini to rewrite a more
    // natural / idiomatic Vietnamese version while preserving meaning.
    // Falls back to Azure output on failure — never blocks the pipeline.
    const improvementMap = await improveVietnameseTranslations(
      azureCues.map(cue => ({ cueId: cue.cueId, zh: cue.zh, vi: cue.vi })),
    );
    const finalCues = azureCues.map(cue => ({
      ...cue,
      vi: improvementMap.get(cue.cueId) ?? cue.vi,
    }));
    const azureOnly = azureCues.map(c => c.vi);
    const improvedCount = finalCues.reduce(
      (count, c, i) => (c.vi !== azureOnly[i] ? count + 1 : count),
      0,
    );
    // True only if Gemini actually rewrote at least one cue — empty/disabled
    // cases should not get flagged as "AI-improved".
    const translationImproved = improvedCount > 0;
    logger.info(
      {
        lessonId,
        cueCount: finalCues.length,
        improvedCount,
        translationImproved,
      },
      '[pipeline] translation_vi completed (azure + gemini polish)',
    );

    ensureNotAborted(signal, 'extract_vocabulary');
    await updateStage('extract_vocabulary', 85);
    const wordIdMap = await resolveLearningWordIds(finalCues);
    if (signal.aborted) throw signal.reason ?? new Error('aborted');

    // Assign wordId to every matching token in memory
    for (const cue of finalCues) {
      for (const token of cue.tokens) {
        if (wordIdMap.has(token.text)) {
          token.wordId = wordIdMap.get(token.text)!;
        }
      }
    }

    ensureNotAborted(signal, 'generate_quiz');
    await updateStage('generate_quiz', 92);
    const questions = finalCues.slice(0, 3).map((cue, index) => ({
      questionId: `q-${index + 1}`,
      type: 'fill_blank' as const,
      prompt: `Nhập lại câu tiếng Trung: ${cue.vi}`,
      cueId: cue.cueId,
      options: [],
      acceptedAnswers: [cue.zh],
      explanationVi: `Đáp án: ${cue.zh}`,
      relatedWordIds: cue.tokens.flatMap(token => token.wordId ? [token.wordId] : []),
    }));

    ensureNotAborted(signal, 'finalize');
    await updateStage('finalize', 96);

    // F11 fix (2026-09-18): atomic commit of Subtitle + Quiz + Lesson + Job.
    // Previously these were four independent writes; a partial failure could
    // leave the lesson pointing at a subtitle revision whose quiz was never
    // written. Now runGenerationCommit wraps everything in a MongoDB transaction
    // (or compensating writes on standalone) and validates input up front so
    // we don't start a session for invalid data.
    await runGenerationCommit({
      lessonId,
      jobId: processingJobId,
      durationSeconds: metadata.durationSeconds,
      thumbnailKey,
      cues: finalCues.map(cue => ({
        cueId: cue.cueId,
        startMs: cue.startMs,
        endMs: cue.endMs,
        zh: cue.zh,
        pinyin: cue.pinyin,
        vi: cue.vi,
        tokens: cue.tokens.map(token => ({ text: token.text, wordId: token.wordId })),
      })),
      questions: questions.map(question => ({
        questionId: question.questionId,
        type: question.type,
        prompt: question.prompt,
        cueId: question.cueId,
        options: question.options,
        correctOptionId: (question as { correctOptionId?: string }).correctOptionId,
        acceptedAnswers: (question as { acceptedAnswers?: string[] }).acceptedAnswers,
        explanationVi: (question as { explanationVi?: string }).explanationVi,
        relatedWordIds: question.relatedWordIds,
      })),
      leaseToken: lease.leaseToken,
      translationImproved,
    });

    // Fire-and-forget: generate learning tips once the track is committed.
    // Saves directly via SubtitleTrackModel so we don't disturb the F11
    // transaction shape.
    setImmediate(() => {
      void generateLearningTipsAndSave({
        lessonId,
        lessonTitleVi: lesson.titleVi,
        hsk: lesson.hsk,
        cues: finalCues,
      }).catch((err) => {
        logger.error(
          { lessonId, error: err instanceof Error ? err.message : String(err) },
          '[subtitle-pipeline] generateLearningTipsAndSave threw unexpectedly',
        );
      });
    });
    // committing the basic fill_blank fallback above so admin always has a
    // usable draft. AI generation adds multiple_choice/vocabulary/grammar
    // questions when Gemini responds successfully. Status is tracked on the
    // Quiz document so the admin UI can show progress.
    setImmediate(() => {
      void autoGenerateQuizForLesson(lessonId).catch((err) => {
        logger.error(
          { lessonId, error: err instanceof Error ? err.message : String(err) },
          '[subtitle-pipeline] autoGenerateQuizForLesson threw unexpectedly',
        );
      });
    });
  } finally {
    clearInterval(heartbeat);
    await fs.unlink(audioPath).catch(() => undefined);
  }
}

/**
 * Run Gemini to produce learning tips + drill words, then persist them onto
 * the latest draft subtitle track. Saves outside the F11 transaction so
 * failures here can never break the main pipeline.
 */
async function generateLearningTipsAndSave(params: {
  lessonId: string;
  lessonTitleVi: string;
  hsk: number;
  cues: ReadonlyArray<{ cueId: string; zh: string; vi: string; pinyin?: string }>;
}): Promise<void> {
  const { lessonId, lessonTitleVi, hsk, cues } = params;
  const result = await generateLearningTips({ lessonTitleVi, hsk, cues });
  if (result.tips.length === 0 && result.drillWords.length === 0) {
    logger.info({ lessonId }, '[learning-tips] empty result, skipping save');
    return;
  }
  await SubtitleTrackModel.findOneAndUpdate(
    { lessonId, status: 'draft' },
    { $set: { learningTips: result.tips, drillWords: result.drillWords } },
    { sort: { revision: -1 } },
  );
  logger.info(
    { lessonId, tipCount: result.tips.length, drillCount: result.drillWords.length },
    '[learning-tips] saved to draft subtitle track',
  );
}
