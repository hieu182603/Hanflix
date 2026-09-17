import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { transcribeAudio } from './asr.js';
import { logger } from './logger.js';
import { extractAudioForASR, probeMedia } from './media-processor.js';
import { pinyinService } from './pinyin.js';
import { translationService } from './translator.js';
import { resolveLearningWordIds } from './learning-word.js';

export type PipelineStage = 'inspect_media' | 'transcribe_zh' | 'generate_pinyin' | 'translate_vi' | 'extract_vocabulary' | 'generate_quiz' | 'finalize';

const frontendStep: Record<PipelineStage, string> = {
  inspect_media: 'EXTRACTING_AUDIO',
  transcribe_zh: 'TRANSCRIBING',
  generate_pinyin: 'GENERATING_PINYIN',
  translate_vi: 'TRANSLATING',
  extract_vocabulary: 'SAVING',
  generate_quiz: 'SAVING',
  finalize: 'SAVING',
};

export async function processLessonVideoPipeline(lessonId: string, processingJobId: string, videoLocalPath: string): Promise<void> {
  const lesson = await LessonModel.findById(lessonId);
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học');
  if (!videoLocalPath) throw new AppError(500, 'FAILED_DOWNLOAD', 'Worker chưa tải được video về thư mục tạm');

  const updateStage = async (stage: PipelineStage, progress: number) => {
    await Promise.all([
      ProcessingJobModel.findByIdAndUpdate(processingJobId, {
        $set: { stage, stageProgress: progress, status: 'running', heartbeatAt: new Date() },
      }),
      LessonModel.findByIdAndUpdate(lessonId, {
        $set: { status: 'processing', processingStatus: 'PROCESSING', processingStep: frontendStep[stage], processingProgress: progress },
        $unset: { processingError: 1 },
      }),
    ]);
    logger.info({ videoId: lessonId, jobId: processingJobId, step: frontendStep[stage], status: 'START' }, '[VideoProcessing]');
  };

  const audioPath = path.join(path.dirname(videoLocalPath), 'speech.wav');
  let heartbeatInFlight = false;
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = true;
    void ProcessingJobModel.updateOne(
      { _id: processingJobId, status: 'running' },
      { $set: { heartbeatAt: new Date() } },
    ).catch(error => {
      logger.warn({ videoId: lessonId, jobId: processingJobId, error: error instanceof Error ? error.message : String(error) }, '[VideoProcessing] heartbeat failed');
    }).finally(() => {
      heartbeatInFlight = false;
    });
  }, Math.min(30_000, Math.max(5_000, env.VIDEO_PROCESSING_POLL_MS * 2)));
  heartbeat.unref();
  try {
    await updateStage('inspect_media', 10);
    let metadata;
    try {
      metadata = await probeMedia(videoLocalPath);
      await extractAudioForASR(videoLocalPath, audioPath);
    } catch (error) {
      throw new AppError(422, 'FAILED_MEDIA_PROCESSING', `Không thể đọc hoặc tách audio: ${error instanceof Error ? error.message : String(error)}`);
    }

    await updateStage('transcribe_zh', 35);
    const segments = await transcribeAudio(audioPath);
    if (segments.length === 0) throw new AppError(502, 'FAILED_TRANSCRIPTION_EMPTY', 'Azure Speech không trả về câu thoại');

    await updateStage('generate_pinyin', 60);
    let cuesWithPinyin;
    try {
      cuesWithPinyin = segments.map(segment => ({
        cueId: randomUUID(),
        startMs: segment.startMs,
        endMs: segment.endMs,
        zh: segment.zh,
        pinyin: pinyinService.convert(segment.zh),
        tokens: pinyinService.tokenize(segment.zh).map(token => ({ text: token.text, wordId: null as Types.ObjectId | null })),
      }));
    } catch (error) {
      throw new AppError(500, 'FAILED_PINYIN', `Không thể sinh Pinyin: ${error instanceof Error ? error.message : String(error)}`);
    }

    await updateStage('translate_vi', 75);
    const translations = await translationService.translateChineseToVietnamese(cuesWithPinyin.map(cue => cue.zh));
    const finalCues = cuesWithPinyin.map((cue, index) => ({ ...cue, vi: translations[index]! }));

    await updateStage('extract_vocabulary', 85);
    const wordIdMap = await resolveLearningWordIds(finalCues);

    // Assign wordId to every matching token in memory
    for (const cue of finalCues) {
      for (const token of cue.tokens) {
        if (wordIdMap.has(token.text)) {
          token.wordId = wordIdMap.get(token.text)!;
        }
      }
    }

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

    await updateStage('finalize', 96);
    const [subtitleTrack] = await Promise.all([
      SubtitleTrackModel.findOneAndUpdate(
        { lessonId: lesson._id, revision: 1 },
        { $set: { lessonId: lesson._id, revision: 1, status: 'draft', cues: finalCues, generatedBy: 'pipeline' } },
        { upsert: true, returnDocument: 'after' },
      ),
      QuizModel.findOneAndUpdate(
        { lessonId: lesson._id, revision: 1 },
        { $set: { lessonId: lesson._id, revision: 1, status: 'draft', questions } },
        { upsert: true, returnDocument: 'after' },
      ),
    ]);

    await Promise.all([
      LessonModel.findByIdAndUpdate(lessonId, {
        $set: {
          durationSeconds: Math.max(60, Math.min(300, Math.round(metadata.durationSeconds))),
          activeSubtitleRevision: subtitleTrack.revision,
          status: 'ready_for_review',
          processingStatus: 'READY',
          processingStep: 'COMPLETED',
          processingProgress: 100,
        },
        $unset: { processingError: 1 },
      }),
      ProcessingJobModel.findByIdAndUpdate(processingJobId, {
        $set: { status: 'completed', stage: 'finalize', stageProgress: 100, completedAt: new Date(), heartbeatAt: new Date() },
        $unset: { activeKey: 1, lockedAt: 1, lockedBy: 1, errorCode: 1, errorMessage: 1 },
      }),
    ]);
  } finally {
    clearInterval(heartbeat);
    await fs.unlink(audioPath).catch(() => undefined);
  }
}
