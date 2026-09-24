import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { transcribeAudio, transcribeAudioFromUrl } from './asr.js';
import { logger } from './logger.js';
import { extractAudioForASR, extractAudioForSeparation, generateThumbnail, probeMedia } from './media-processor.js';
import { createVideoDownloadUrl, downloadR2Object, uploadR2File } from './r2.js';
import { pinyinService } from './pinyin.js';
import { translationService } from './translator.js';
import { resolveLearningWordIds } from './learning-word.js';
import { splitLongPhraseIntoCues } from './subtitle-splitter.js';
import { STAGE_DEADLINES_MS, transitionStage, type VideoProcessingJobLease } from '../queue/video.queue.js';
import { runGenerationCommit } from './revision-commit.js';
import { autoGenerateQuizForLesson, resolveQuestionCount } from './auto-quiz-generator.js';
import { improveVietnameseTranslations } from './gemini-translation-improver.js';
import { generateLearningTips } from './gemini-learning-tips.js';
import { generatePlaybackDerivative } from './playback-derivative.js';
import { evaluateTranscription } from './pipeline/asr-quality.js';
import { mediaComputeProvider } from './media-compute.js';
import { progressForStage } from './pipeline/progress.js';
import { detectMediaType } from './pipeline/media-type-detector.js';
import { completeProcessingStep, hasCompletedStep, saveProcessingCheckpoint, startProcessingStep, type ProcessingStepName } from './pipeline/processing-steps.js';

export type PipelineStage = 'inspect_media' | 'transcribe_zh' | 'generate_pinyin' | 'translate_vi' | 'extract_vocabulary' | 'generate_quiz' | 'finalize' | 'parse_lyrics' | 'align_karaoke' | 'detect_chapters' | 'diarize_speakers';

const frontendStep: Partial<Record<PipelineStage, string>> = {
  inspect_media: 'EXTRACTING_AUDIO',
  transcribe_zh: 'TRANSCRIBING',
  generate_pinyin: 'GENERATING_PINYIN',
  translate_vi: 'TRANSLATING',
  extract_vocabulary: 'SAVING',
  generate_quiz: 'SAVING',
  finalize: 'SAVING',
  parse_lyrics: 'EXTRACTING_AUDIO',
  align_karaoke: 'TRANSCRIBING',
  detect_chapters: 'TRANSCRIBING',
  diarize_speakers: 'TRANSCRIBING',
};

const pipelineStepForStage: Record<PipelineStage, ProcessingStepName> = {
  inspect_media: 'EXTRACT_AUDIO',
  transcribe_zh: 'PRIMARY_TRANSCRIPTION',
  generate_pinyin: 'GENERATE_PINYIN',
  translate_vi: 'TRANSLATE',
  extract_vocabulary: 'EXTRACT_VOCABULARY',
  generate_quiz: 'BUILD_SUBTITLES',
  finalize: 'VALIDATE_RESULT',
  parse_lyrics: 'PRIMARY_TRANSCRIPTION',
  align_karaoke: 'ALIGN_TIMESTAMPS',
  detect_chapters: 'NORMALIZE_TRANSCRIPT',
  diarize_speakers: 'PRIMARY_TRANSCRIPTION',
};

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
  if (env.VIDEO_PROCESSING_PIPELINE_V2) {
    const { processPipelineV2 } = await import('./pipeline/video-pipeline-v2.js');
    return processPipelineV2(lessonId, processingJobId, videoLocalPath, options);
  }
  const { lease, signal, rearmDeadline } = options;
  const lesson = await LessonModel.findById(lessonId);
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (!videoLocalPath) throw new AppError(500, 'FAILED_DOWNLOAD', 'Worker chưa tải được video về thư mục tạm');

  ensureNotAborted(signal, 'inspect_media');

  const pipelineJob = typeof (ProcessingJobModel as unknown as { findById?: unknown }).findById === 'function'
    ? await ProcessingJobModel.findById(processingJobId).select('artifacts checkpoint steps').lean()
    : null;
  const pipelineArtifacts = (pipelineJob?.artifacts ?? {}) as Record<string, unknown>;
  const cachedAsrAudioKey = typeof pipelineArtifacts.asrAudioKey === 'string' ? pipelineArtifacts.asrAudioKey : undefined;

  let activePipelineStep: ProcessingStepName | undefined;
  const updateStage = async (stage: PipelineStage, progress: number) => {
    ensureNotAborted(signal, stage);
    const normalizedProgress = progressForStage(stage, progress);
    // F04: stage transition must succeed (lease must still be valid). If it
    // fails, another worker has taken over — abort immediately.
    const ok = await transitionStage(lease, stage, normalizedProgress);
    if (!ok) {
      const err = new Error(`Lease ${lease.leaseToken} đã bị thu hồi khi chuyển stage ${stage}`);
      err.name = 'LeaseRevokedError';
      throw err;
    }
    const nextPipelineStep = pipelineStepForStage[stage];
    if (activePipelineStep && activePipelineStep !== nextPipelineStep) {
      await completeProcessingStep({ jobId: processingJobId, leaseToken: lease.leaseToken, step: activePipelineStep });
    }
    if (activePipelineStep !== nextPipelineStep) {
      const started = await startProcessingStep({
        jobId: processingJobId,
        leaseToken: lease.leaseToken,
        step: nextPipelineStep,
        metadata: { legacyStage: stage },
      });
      if (!started) throw new AppError(409, 'LEASE_REVOKED', 'Lease bị thu hồi khi ghi checkpoint pipeline');
      activePipelineStep = nextPipelineStep;
    }
    await Promise.all([
      LessonModel.findByIdAndUpdate(lessonId, {
        $set: { status: 'processing', processingStatus: 'PROCESSING', processingStep: frontendStep[stage], processingProgress: normalizedProgress },
        $unset: { processingError: 1 },
      }),
    ]);
    // F04: rearm the deadline timer for the new stage.
    rearmDeadline(STAGE_DEADLINES_MS[stage]);
    logger.info({ videoId: lessonId, jobId: processingJobId, step: frontendStep[stage], status: 'START', leaseToken: lease.leaseToken }, '[VideoProcessing]');
  };

  const audioPath = path.join(path.dirname(videoLocalPath), 'speech.wav');
  const separationSourcePath = path.join(path.dirname(videoLocalPath), 'music-source.wav');
  const vocalsPath = path.join(path.dirname(videoLocalPath), 'vocals.wav');
  const vocalsAsrPath = path.join(path.dirname(videoLocalPath), 'vocals-asr.wav');
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
    let thumbnailKey: string | undefined = lesson.thumbnailKey ?? undefined;
    try {
      metadata = await probeMedia(videoLocalPath, signal, { maxDurationSeconds: lesson.contentMode === 'podcast' ? env.VIDEO_MAX_DURATION_PODCAST_SECONDS : 600 });
      ensureNotAborted(signal, 'inspect_media');
      if (cachedAsrAudioKey && env.VIDEO_PROCESSING_PIPELINE_V2) {
        await downloadR2Object(cachedAsrAudioKey, audioPath);
      } else {
        await extractAudioForASR(videoLocalPath, audioPath, signal);
        if (env.VIDEO_PROCESSING_PIPELINE_V2 && lesson.media?.objectKey) {
          const asrArtifactKey = `processing/${lessonId}/audio/asr.wav`;
          try {
            await uploadR2File(asrArtifactKey, audioPath, 'audio/wav');
            await ProcessingJobModel.updateOne(
              { _id: processingJobId, leaseToken: lease.leaseToken },
              { $set: { 'artifacts.asrAudioKey': asrArtifactKey } },
            );
          } catch (artifactError) {
            logger.warn({ lessonId, jobId: processingJobId, error: artifactError instanceof Error ? artifactError.message : String(artifactError) }, '[VideoProcessing] ASR artifact upload failed; continuing with local audio');
          }
        }
      }
    } catch (error) {
      // F04: distinguish abort from real media failure.
      if (signal.aborted) throw error;
      throw new AppError(422, 'FAILED_MEDIA_PROCESSING', `Không thể đọc hoặc tách audio: ${error instanceof Error ? error.message : String(error)}`);
    }

    ensureNotAborted(signal, 'inspect_media');

    if (!thumbnailKey && !lesson.media?.mimeType?.startsWith('audio/')) try {
      const tempDir = path.dirname(videoLocalPath);
      const thumbnailFilename = `thumb-${lessonId}-${randomUUID()}.jpg`;
      const generatedThumbPath = await generateThumbnail(videoLocalPath, tempDir, thumbnailFilename, '00:00:01', signal);
      const uploadedThumbnailKey = `thumbnails/${lessonId}/${randomUUID()}.jpg`;
      await uploadR2File(uploadedThumbnailKey, generatedThumbPath, 'image/jpeg');
      thumbnailKey = uploadedThumbnailKey;
      await fs.unlink(generatedThumbPath).catch(() => undefined);
      logger.info({ videoId: lessonId, thumbnailKey }, '[VideoProcessing] Thumbnail generated and uploaded');
    } catch (thumbError) {
      if (signal.aborted) throw thumbError;
      logger.warn({ videoId: lessonId, error: thumbError instanceof Error ? thumbError.message : String(thumbError) }, '[VideoProcessing] Thumbnail generation failed, continuing without thumbnail');
    }

    // CONTENT MODE (2026-09-22): rẽ nhánh pipeline theo contentMode.
    // Default 'lesson' giữ nguyên code cũ 100% backward compatible.
    const contentMode = (lesson.contentMode ?? 'lesson') as 'lesson' | 'song' | 'podcast' | 'drama';

    if (contentMode === 'song') {
      return await runSongPipeline({
        lessonId,
        processingJobId,
        audioPath,
        videoLocalPath,
        metadata,
        thumbnailKey,
        lesson,
        lease,
        signal,
        rearmDeadline,
        updateStage,
        generatePlaybackKey: async () => {
          if (!env.PLAYBACK_DERIVATIVE_ENABLED || lesson.media?.mimeType?.startsWith('audio/')) return undefined;
          const existing = await LessonModel.findById(lessonId).select('playbackVersion').lean();
          const currentVersion = existing?.playbackVersion ?? 0;
          const derivative = await generatePlaybackDerivative({
            lessonId,
            sourcePath: videoLocalPath,
            currentVersion,
            signal,
          });
          return derivative ? { playbackKey: derivative.playbackKey, playbackVersion: derivative.playbackVersion } : undefined;
        },
      });
    }

    if (contentMode === 'podcast') {
      return await runPodcastPipeline({
        lessonId,
        processingJobId,
        audioPath,
        videoLocalPath,
        metadata,
        thumbnailKey,
        lesson,
        lease,
        signal,
        rearmDeadline,
        updateStage,
        generatePlaybackKey: async () => {
          if (!env.PLAYBACK_DERIVATIVE_ENABLED || lesson.media?.mimeType?.startsWith('audio/')) return undefined;
          const existing = await LessonModel.findById(lessonId).select('playbackVersion').lean();
          const currentVersion = existing?.playbackVersion ?? 0;
          const derivative = await generatePlaybackDerivative({
            lessonId,
            sourcePath: videoLocalPath,
            currentVersion,
            signal,
          });
          return derivative ? { playbackKey: derivative.playbackKey, playbackVersion: derivative.playbackVersion } : undefined;
        },
      });
    }

    if (contentMode === 'drama') {
      return await runDramaPipeline({
        lessonId,
        processingJobId,
        audioPath,
        videoLocalPath,
        metadata,
        thumbnailKey,
        lesson,
        lease,
        signal,
        rearmDeadline,
        updateStage,
        generatePlaybackKey: async () => {
          if (!env.PLAYBACK_DERIVATIVE_ENABLED || lesson.media?.mimeType?.startsWith('audio/')) return undefined;
          const existing = await LessonModel.findById(lessonId).select('playbackVersion').lean();
          const currentVersion = existing?.playbackVersion ?? 0;
          const derivative = await generatePlaybackDerivative({
            lessonId,
            sourcePath: videoLocalPath,
            currentVersion,
            signal,
          });
          return derivative ? { playbackKey: derivative.playbackKey, playbackVersion: derivative.playbackVersion } : undefined;
        },
      });
    }

    // === LESSON (mặc định — code path cũ, không thay đổi) ===
    ensureNotAborted(signal, 'transcribe_zh');
    const checkpointJob = typeof (ProcessingJobModel as unknown as { findById?: unknown }).findById === 'function'
      ? await ProcessingJobModel.findById(processingJobId).select('steps checkpoint').lean()
      : null;
    const checkpoint = (checkpointJob?.checkpoint ?? {}) as Record<string, unknown>;
    const cachedSegments = Array.isArray(checkpoint.segments) ? checkpoint.segments as Awaited<ReturnType<typeof transcribeAudio>> : undefined;
    const canReuseTranscription = hasCompletedStep(checkpointJob?.steps as Record<string, { status?: string }> | undefined, 'PRIMARY_TRANSCRIPTION') && Boolean(cachedSegments?.length);
    if (!canReuseTranscription) await updateStage('transcribe_zh', 35);
    let segments = canReuseTranscription ? cachedSegments! : undefined;
    if (!segments) {
      if (env.VIDEO_PROCESSING_PIPELINE_V2 && env.AZURE_SPEECH_BATCH_ENABLED && lesson.media?.objectKey) {
        const asrArtifactKey = `processing/${lessonId}/audio/asr.wav`;
        try {
          await uploadR2File(asrArtifactKey, audioPath, 'audio/wav');
          const asrUrl = await createVideoDownloadUrl(asrArtifactKey, env.R2_ASR_SIGNED_URL_TTL_SECONDS);
          segments = await transcribeAudioFromUrl(asrUrl, signal);
          await ProcessingJobModel.updateOne(
            { _id: processingJobId, leaseToken: lease.leaseToken },
            { $set: { 'artifacts.asrAudioKey': asrArtifactKey, 'processingMetrics.azureAsrRequests': 1 } },
          );
        } catch (error) {
          // Keep existing local fast-transcription behavior as a controlled
          // compatibility fallback while Batch Whisper is being rolled out.
          logger.warn({ lessonId, jobId: processingJobId, error: error instanceof Error ? error.message : String(error) }, '[VideoProcessing] batch ASR unavailable; falling back to local Azure transcription');
          segments = await transcribeAudio(audioPath, signal);
        }
      } else {
        segments = await transcribeAudio(audioPath, signal);
      }
    }
    ensureNotAborted(signal, 'transcribe_zh');
    if (!segments.length) throw new AppError(502, 'FAILED_TRANSCRIPTION_EMPTY', 'Azure Speech không trả về câu thoại');
    const primaryQuality = evaluateTranscription({
      segments: segments.map(segment => ({ text: segment.zh, startMs: segment.startMs, endMs: segment.endMs })),
      audioDurationMs: metadata.durationSeconds * 1000,
      goodThreshold: env.ASR_GOOD_THRESHOLD,
      retryThreshold: env.ASR_RETRY_THRESHOLD,
    });
    const mediaDetection = detectMediaType({
      requested: (lesson.mediaType ?? undefined) as 'AUTO' | 'MOVIE' | 'PODCAST' | 'MUSIC' | undefined,
      contentMode,
      hasVideo: Boolean(metadata.width && metadata.height),
      durationSeconds: metadata.durationSeconds,
      transcriptionQuality: primaryQuality.status,
    });
    await ProcessingJobModel.updateOne(
      { _id: processingJobId, leaseToken: lease.leaseToken },
      { $set: { 'processingMetrics.transcriptionQuality': primaryQuality, 'processingMetrics.mediaDetection': mediaDetection, 'checkpoint.transcriptionQuality': primaryQuality, mediaType: mediaDetection.mediaType } },
    );
    await LessonModel.findByIdAndUpdate(lessonId, { $set: { mediaType: mediaDetection.mediaType } });
    if (primaryQuality.status === 'BAD' && env.VIDEO_PROCESSING_PIPELINE_V2 && env.MEDIA_COMPUTE_PROVIDER === 'local') {
      try {
        await updateStage('inspect_media', 22);
        await extractAudioForSeparation(videoLocalPath, separationSourcePath, signal);
        await mediaComputeProvider.separateVocals(separationSourcePath, vocalsPath, signal);
        await extractAudioForASR(vocalsPath, vocalsAsrPath, signal);
        const secondarySegments = await transcribeAudio(vocalsAsrPath, signal);
        const secondaryQuality = evaluateTranscription({
          segments: secondarySegments.map(segment => ({ text: segment.zh, startMs: segment.startMs, endMs: segment.endMs })),
          audioDurationMs: metadata.durationSeconds * 1000,
          goodThreshold: env.ASR_GOOD_THRESHOLD,
          retryThreshold: env.ASR_RETRY_THRESHOLD,
        });
        await ProcessingJobModel.updateOne(
          { _id: processingJobId, leaseToken: lease.leaseToken },
          { $set: { 'processingMetrics.secondaryTranscriptionQuality': secondaryQuality, 'processingMetrics.demucsRuns': 1 } },
        );
        if (secondaryQuality.score > primaryQuality.score && secondarySegments.length) segments = secondarySegments;
      } catch (error) {
        logger.warn({ lessonId, jobId: processingJobId, error: error instanceof Error ? error.message : String(error) }, '[VideoProcessing] vocal separation fallback unavailable; retaining primary transcript');
      }
    }
    if (!canReuseTranscription) {
      await saveProcessingCheckpoint({
        jobId: processingJobId,
        leaseToken: lease.leaseToken,
        checkpoint: { ...checkpoint, segments },
      });
      await completeProcessingStep({
        jobId: processingJobId,
        leaseToken: lease.leaseToken,
        step: 'PRIMARY_TRANSCRIPTION',
        metadata: { provider: 'legacy-or-batch-asr', segmentCount: segments.length },
      });
    }

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
    const cachedPinyin = Array.isArray(checkpoint.cuesWithPinyin) ? checkpoint.cuesWithPinyin as Array<{
      cueId: string; startMs: number; endMs: number; zh: string; pinyin: string;
      tokens: Array<{ text: string; wordId: Types.ObjectId | null }>;
    }> : undefined;
    const canReusePinyin = hasCompletedStep(checkpointJob?.steps as Record<string, { status?: string }> | undefined, 'GENERATE_PINYIN') && Boolean(cachedPinyin?.length);
    if (!canReusePinyin) await updateStage('generate_pinyin', 60);
    let cuesWithPinyin;
    try {
      cuesWithPinyin = canReusePinyin ? cachedPinyin! : sanitizedCues.map(cue => ({
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
    if (!canReusePinyin) {
      await saveProcessingCheckpoint({ jobId: processingJobId, leaseToken: lease.leaseToken, checkpoint: { ...checkpoint, segments, cuesWithPinyin } });
      await completeProcessingStep({ jobId: processingJobId, leaseToken: lease.leaseToken, step: 'GENERATE_PINYIN', metadata: { cueCount: cuesWithPinyin.length } });
    }

    ensureNotAborted(signal, 'translate_vi');
    const cachedTranslated = Array.isArray(checkpoint.finalCues) ? checkpoint.finalCues as Array<typeof cuesWithPinyin[number] & { vi: string }> : undefined;
    const canReuseTranslation = hasCompletedStep(checkpointJob?.steps as Record<string, { status?: string }> | undefined, 'TRANSLATE') && Boolean(cachedTranslated?.length);
    if (!canReuseTranslation) await updateStage('translate_vi', 75);
    const translations = canReuseTranslation ? cachedTranslated!.map(cue => cue.vi) : await translationService.translateChineseToVietnamese(cuesWithPinyin.map(cue => cue.zh), signal);
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
    const finalCues = canReuseTranslation ? cachedTranslated! : azureCues.map(cue => ({
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
    if (!canReuseTranslation) {
      await saveProcessingCheckpoint({ jobId: processingJobId, leaseToken: lease.leaseToken, checkpoint: { ...checkpoint, segments, cuesWithPinyin, finalCues } });
      await completeProcessingStep({ jobId: processingJobId, leaseToken: lease.leaseToken, step: 'TRANSLATE', metadata: { cueCount: finalCues.length } });
    }

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
    const questions = finalCues.slice(0, resolveQuestionCount(lesson.hsk, lesson.autoGenerateQuizCount)).map((cue, index) => ({
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

    // F12 fix (2026-09-19): build a `+faststart` playback derivative so the
    // browser can begin painting before downloading the whole file. This
    // step is idempotent — if the lesson already has the same
    // `playbackVersion` we skip it. Failure is non-fatal: the lesson still
    // publishes against the original media key.
    let playbackKey: string | undefined;
    let playbackVersion: number | undefined;
    if (env.PLAYBACK_DERIVATIVE_ENABLED) {
      const existing = await LessonModel.findById(lessonId).select('playbackVersion').lean();
      const currentVersion = existing?.playbackVersion ?? 0;
      const derivative = await generatePlaybackDerivative({
        lessonId,
        sourcePath: videoLocalPath,
        currentVersion,
        signal,
      });
      if (derivative) {
        playbackKey = derivative.playbackKey;
        playbackVersion = derivative.playbackVersion;
      }
    }

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
      ...(playbackKey && playbackVersion ? { playbackKey, playbackVersion } : {}),
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
    await fs.unlink(separationSourcePath).catch(() => undefined);
    await fs.unlink(vocalsPath).catch(() => undefined);
    await fs.unlink(vocalsAsrPath).catch(() => undefined);
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

// =============================================================================
// CONTENT MODE (2026-09-22) — Song / Podcast / Drama pipelines
// =============================================================================
// Mỗi mode là một function độc lập, được gọi từ processLessonVideoPipeline sau
// khi extract audio xong. Chia sẻ các helper: updateStage, generatePlaybackKey.
// =============================================================================

type ModePipelineParams = {
  lessonId: string;
  processingJobId: string;
  audioPath: string;
  videoLocalPath: string;
  metadata: { durationSeconds: number };
  thumbnailKey?: string;
  lesson: { _id: unknown; titleVi: string; hsk: number; contentMode?: string };
  lease: VideoProcessingJobLease;
  signal: AbortSignal;
  rearmDeadline: (ms: number) => void;
  updateStage: (stage: PipelineStage, progress: number) => Promise<void>;
  generatePlaybackKey: () => Promise<{ playbackKey: string; playbackVersion: number } | undefined>;
};

/**
 * SONG pipeline:
 *   parse_lyrics → align_karaoke → generate_pinyin → translate_vi → finalize
 *
 * Khác biệt so với lesson:
 *   - Lấy lyricsRaw từ lesson (admin upload LRC) thay vì ASR để transcribe.
 *   - Word-level timing cho karaoke highlight (karaokeTokens).
 *   - Không sinh quiz (bài hát không phù hợp).
 */
async function runSongPipeline(p: ModePipelineParams): Promise<void> {
  const { lessonId, audioPath, lesson, signal, updateStage, generatePlaybackKey } = p;

  await updateStage('parse_lyrics', 20);
  const { parseLyricsSmart } = await import('./song/lyrics-parser.service.js');
  const { alignLyricsToAudio, alignAsrOnly } = await import('./song/karaoke-aligner.service.js');
  const lyricsRaw = (lesson as { lyricsRaw?: string }).lyricsRaw;
  const parsed = lyricsRaw?.trim() ? parseLyricsSmart(lyricsRaw) : undefined;
  const durationMs = Math.round(p.metadata.durationSeconds * 1000);
  if (parsed && !parsed.hasTimestamps) {
    throw new AppError(422, 'LYRICS_TIMESTAMPS_REQUIRED', 'Lời bài hát cần định dạng LRC [mm:ss.xx] để đồng bộ chính xác.');
  }
  const lyricCues = parsed?.cues.map(cue => ({ ...cue, endMs: Math.min(cue.endMs, durationMs) }))
    .filter(cue => cue.startMs < cue.endMs) ?? [];
  if (parsed && !lyricCues.length) throw new AppError(422, 'INVALID_LYRICS', 'Không có dòng LRC nằm trong thời lượng bài hát');
  await updateStage('align_karaoke', 35);
  let aligned;
  try {
    aligned = parsed ? await alignLyricsToAudio(audioPath, lyricCues, signal) : await alignAsrOnly(audioPath, signal);
  } catch (error) {
    if (signal.aborted || !parsed) throw error;
    // Valid LRC remains usable when speech recognition cannot hear through music.
    aligned = { cues: lyricCues.map(cue => ({ ...cue, zh: cue.text, pinyin: '', tokens: [] })), matchRatio: 0, source: 'lrc+asr' as const };
    logger.warn({ lessonId }, '[Song] ASR unavailable; retaining supplied LRC timing');
  }
  aligned.cues = aligned.cues.map(cue => ({ ...cue, startMs: Math.max(0, cue.startMs), endMs: Math.min(cue.endMs, durationMs) }))
    .filter(cue => cue.endMs > cue.startMs && cue.zh.trim());
  if (!aligned.cues.length) throw new AppError(422, 'CONTENT_INCOMPLETE', 'Không nhận diện được lời bài hát. Hãy bổ sung LRC rồi thử lại.');

  await updateStage('generate_pinyin', 55);
  const cuesWithPinyin = aligned.cues.map(cue => ({
    cueId: randomUUID(),
    startMs: cue.startMs,
    endMs: cue.endMs,
    zh: cue.zh,
    pinyin: pinyinService.convert(cue.zh),
    karaokeTokens: cue.tokens.map(token => ({
      text: token.text,
      startMs: token.startMs,
      endMs: token.endMs,
      wordId: null as Types.ObjectId | null,
    })),
  }));

  await updateStage('translate_vi', 70);
  const translations = await translationService.translateChineseToVietnamese(cuesWithPinyin.map(c => c.zh), signal);
  const azureCues = cuesWithPinyin.map((c, i) => ({ ...c, vi: translations[i] ?? '' }));
  const improvementMap = await improveVietnameseTranslations(
    azureCues.map(c => ({ cueId: c.cueId, zh: c.zh, vi: c.vi })),
  );
  const finalCues = azureCues.map(c => ({ ...c, vi: improvementMap.get(c.cueId) ?? c.vi }));

  const enrichedCues = await enrichModeCues(finalCues, p);
  await updateStage('finalize', 90);
  const playback = await generatePlaybackKey();
  ensureNotAborted(signal, 'finalize');
  await runGenerationCommit({
    lessonId,
    jobId: p.processingJobId,
    durationSeconds: p.metadata.durationSeconds,
    thumbnailKey: p.thumbnailKey,
    ...(playback ? { playbackKey: playback.playbackKey, playbackVersion: playback.playbackVersion } : {}),
    cues: enrichedCues,
    questions: [], // SONG không sinh quiz
    leaseToken: p.lease.leaseToken,
    translationImproved: improvementMap.size > 0,
  });
}

/**
 * PODCAST pipeline:
 *   transcribe_zh (long audio) → detect_chapters → generate_pinyin → translate_vi → finalize
 *
 * Khác biệt:
 *   - Transcribe audio dài (cấu hình deadline riêng).
 *   - Gemini chapter detection → lưu vào lesson.chapters.
 *   - Cue có thêm `chapterId` để PodcastPlayer nhảy chapter.
 *   - Không auto quiz (podcast dài, không phù hợp).
 */
async function runPodcastPipeline(p: ModePipelineParams): Promise<void> {
  const { lessonId, audioPath, lesson, signal, updateStage, generatePlaybackKey } = p;

  await updateStage('transcribe_zh', 30);
  const segments = await transcribeAudio(audioPath, signal);
  if (segments.length === 0) throw new AppError(502, 'FAILED_TRANSCRIPTION_EMPTY', 'Azure Speech không trả về câu thoại');

  await updateStage('detect_chapters', 45);
  const { detectChapters } = await import('./podcast/chapter-detector.service.js');
  const detectedChapters = await detectChapters({
    segments: segments.map(s => ({ startMs: s.startMs, endMs: s.endMs, text: s.zh })),
    durationMs: p.metadata.durationSeconds * 1000,
  }, signal);

  logger.info({ lessonId, chapterCount: detectedChapters.length }, '[Podcast] detect_chapters done');

  await updateStage('generate_pinyin', 60);
  const videoDurationMs = p.metadata.durationSeconds * 1000;
  const splitSegments = segments.flatMap(seg => splitLongPhraseIntoCues({ ...seg, text: seg.zh }));
  const cues = splitSegments.map(seg => {
    const chapter = detectedChapters.find(c => seg.startMs >= c.startMs && seg.startMs < c.endMs);
    return {
      cueId: randomUUID(),
      startMs: Math.max(0, Math.min(seg.startMs, videoDurationMs)),
      endMs: Math.max(0, Math.min(seg.endMs, videoDurationMs)),
      zh: seg.zh,
      pinyin: pinyinService.convert(seg.zh),
      chapterId: chapter?.chapterId,
    };
  }).filter(c => c.endMs > c.startMs);

  await updateStage('translate_vi', 75);
  const translations = await translationService.translateChineseToVietnamese(cues.map(c => c.zh), signal);
  const azureCues = cues.map((c, i) => ({ ...c, vi: translations[i] ?? '' }));
  const improvementMap = await improveVietnameseTranslations(
    azureCues.map(c => ({ cueId: c.cueId, zh: c.zh, vi: c.vi })),
  );
  const finalCues = azureCues.map(c => ({ ...c, vi: improvementMap.get(c.cueId) ?? c.vi }));

  const enrichedCues = await enrichModeCues(finalCues, p);
  await updateStage('finalize', 90);
  const playback = await generatePlaybackKey();
  ensureNotAborted(signal, 'finalize');
  await runGenerationCommit({
    lessonId,
    jobId: p.processingJobId,
    durationSeconds: p.metadata.durationSeconds,
    thumbnailKey: p.thumbnailKey,
    ...(playback ? { playbackKey: playback.playbackKey, playbackVersion: playback.playbackVersion } : {}),
    cues: enrichedCues,
    chapters: detectedChapters,
    questions: [],
    leaseToken: p.lease.leaseToken,
    translationImproved: improvementMap.size > 0,
  });
}

/**
 * DRAMA pipeline:
 *   transcribe_zh + diarize_speakers → generate_pinyin → translate_vi → finalize
 *
 * Khác biệt:
 *   - ASR với diarization enabled (Azure) → mỗi segment có speakerId.
 *   - Cue có `speakerId` → DramaPlayer hiển thị tên + màu nhân vật.
 *   - Auto-assign characters với speakerId → admin rename sau.
 */
async function runDramaPipeline(p: ModePipelineParams): Promise<void> {
  const { lessonId, audioPath, signal, updateStage, generatePlaybackKey } = p;

  await updateStage('diarize_speakers', 35);
  const { diarizeAudio } = await import('./drama/speaker-diarization.service.js');
  const diarized = await diarizeAudio(audioPath, signal);
  const existingCharacters = (await LessonModel.findById(lessonId).select('characters').lean())?.characters ?? [];
  const defaultColors = ['#B91B1C', '#1D4ED8', '#15803D', '#A16207', '#7E22CE', '#0E7490'];
  const characters = diarized.speakers.map((speakerId, index) => {
    const existing = existingCharacters.find(c => c.speakerId === speakerId);
    return { speakerId, displayName: existing?.displayName ?? `Nhân vật ${index + 1}`, color: existing?.color ?? defaultColors[index % defaultColors.length], avatarUrl: existing?.avatarUrl ?? undefined, descriptionVi: existing?.descriptionVi ?? undefined };
  });

  await updateStage('generate_pinyin', 55);
  const videoDurationMs = p.metadata.durationSeconds * 1000;
  const splitSegments = diarized.segments.flatMap(seg => splitLongPhraseIntoCues(seg).map(cue => ({ ...cue, text: cue.zh, speakerId: seg.speakerId })));
  const cues = splitSegments.map(seg => ({
    cueId: randomUUID(),
    startMs: Math.max(0, Math.min(seg.startMs, videoDurationMs)),
    endMs: Math.max(0, Math.min(seg.endMs, videoDurationMs)),
    zh: seg.text,
    pinyin: pinyinService.convert(seg.text),
    speakerId: seg.speakerId,
  })).filter(c => c.endMs > c.startMs);

  await updateStage('translate_vi', 75);
  const translations = await translationService.translateChineseToVietnamese(cues.map(c => c.zh), signal);
  const azureCues = cues.map((c, i) => ({ ...c, vi: translations[i] ?? '' }));
  const improvementMap = await improveVietnameseTranslations(
    azureCues.map(c => ({ cueId: c.cueId, zh: c.zh, vi: c.vi })),
  );
  const finalCues = azureCues.map(c => ({ ...c, vi: improvementMap.get(c.cueId) ?? c.vi }));

  const enrichedCues = await enrichModeCues(finalCues, p);
  await updateStage('finalize', 90);
  const playback = await generatePlaybackKey();
  ensureNotAborted(signal, 'finalize');
  await runGenerationCommit({
    lessonId,
    jobId: p.processingJobId,
    durationSeconds: p.metadata.durationSeconds,
    thumbnailKey: p.thumbnailKey,
    ...(playback ? { playbackKey: playback.playbackKey, playbackVersion: playback.playbackVersion } : {}),
    cues: enrichedCues,
    characters,
    questions: [],
    leaseToken: p.lease.leaseToken,
    translationImproved: improvementMap.size > 0,
  });
}

async function enrichModeCues<T extends { zh: string; pinyin: string; vi: string }>(cues: T[], p: ModePipelineParams) {
  await p.updateStage('extract_vocabulary', 85);
  const enriched = cues.map(cue => ({ ...cue, tokens: pinyinService.tokenize(cue.zh).map(t => ({ text: t.text, wordId: null as Types.ObjectId | null })) }));
  const wordIds = await resolveLearningWordIds(enriched);
  ensureNotAborted(p.signal, 'extract_vocabulary');
  for (const cue of enriched) for (const token of cue.tokens) token.wordId = wordIds.get(token.text) ?? null;
  return enriched;
}
