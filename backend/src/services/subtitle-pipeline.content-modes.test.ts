import { beforeEach, expect, it, vi } from 'vitest';
import { processLessonVideoPipeline } from './subtitle-pipeline.js';
import { LessonModel } from '../models/lesson.model.js';
import { transcribeAudio } from './asr.js';
import { runGenerationCommit } from './revision-commit.js';
import { generateThumbnail, probeMedia } from './media-processor.js';
import { env } from '../config/env.js';

vi.mock('../models/lesson.model.js', () => ({ LessonModel: { findById: vi.fn(), findByIdAndUpdate: vi.fn().mockResolvedValue({}) } }));
vi.mock('../models/processing-job.model.js', () => ({ ProcessingJobModel: { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) } }));
vi.mock('./media-processor.js', () => ({ probeMedia: vi.fn(), extractAudioForASR: vi.fn(), generateThumbnail: vi.fn().mockResolvedValue('/tmp/thumb.jpg') }));
vi.mock('node:fs/promises', () => ({ default: { unlink: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('./r2.js', () => ({ uploadR2File: vi.fn() }));
vi.mock('./asr.js', () => ({ transcribeAudio: vi.fn() }));
vi.mock('./translator.js', () => ({ translationService: { translateChineseToVietnamese: vi.fn(async (texts: string[]) => texts.map(() => 'Xin chào')) } }));
vi.mock('./learning-word.js', () => ({ resolveLearningWordIds: vi.fn().mockResolvedValue(new Map()) }));
vi.mock('./revision-commit.js', () => ({ runGenerationCommit: vi.fn().mockResolvedValue({}) }));
vi.mock('./gemini-translation-improver.js', () => ({ improveVietnameseTranslations: vi.fn().mockResolvedValue(new Map()) }));
vi.mock('./gemini-learning-tips.js', () => ({ generateLearningTips: vi.fn() }));
vi.mock('./playback-derivative.js', () => ({ generatePlaybackDerivative: vi.fn() }));
vi.mock('./podcast/chapter-detector.service.js', () => ({ detectChapters: vi.fn().mockResolvedValue([{ chapterId: 'ch1', title: 'Phần 1', startMs: 0, endMs: 1800000 }]) }));
vi.mock('./drama/speaker-diarization.service.js', () => ({ diarizeAudio: vi.fn().mockResolvedValue({ speakers: ['speaker-1'], segments: [{ startMs: 0, endMs: 1000, text: '你好', speakerId: 'speaker-1' }] }) }));
vi.mock('../queue/video.queue.js', () => ({ transitionStage: vi.fn().mockResolvedValue(true), STAGE_DEADLINES_MS: {} }));

beforeEach(() => {
  vi.clearAllMocks();
  env.VIDEO_PROCESSING_PIPELINE_V2 = false;
  env.PLAYBACK_DERIVATIVE_ENABLED = false;
  vi.mocked(probeMedia).mockResolvedValue({ durationSeconds: 1800 });
  vi.mocked(transcribeAudio).mockResolvedValue([{ startMs: 0, endMs: 1000, zh: '你好' }]);
});

function run(mode: string, lyricsRaw?: string, signal = new AbortController().signal) {
  const lesson = { _id: 'lesson', titleVi: 'Test', hsk: 1, contentMode: mode, lyricsRaw, characters: [] };
  vi.mocked(LessonModel.findById).mockReturnValue(Object.assign(Promise.resolve(lesson), { select: () => ({ lean: async () => lesson }) }) as never);
  return processLessonVideoPipeline('lesson', 'job', '/tmp/video.mp4', { signal, rearmDeadline: vi.fn(), lease: { leaseToken: 'lease' } as never });
}

it.each(['song', 'podcast', 'drama'])('completes %s with thumbnails, learning tokens and its mode metadata', async mode => {
  await run(mode, mode === 'song' ? '[00:00.00]你好' : undefined);
  expect(generateThumbnail).toHaveBeenCalledOnce();
  expect(runGenerationCommit).toHaveBeenCalledOnce();
  const input = vi.mocked(runGenerationCommit).mock.calls[0]![0];
  expect(input.durationSeconds).toBe(1800);
  expect(input.cues[0]!.tokens!.length).toBeGreaterThan(0);
  if (mode === 'song') expect(input.cues[0]!.karaokeTokens!.length).toBeGreaterThan(0);
  if (mode === 'podcast') {
    expect(input.chapters).toHaveLength(1);
    expect(input.cues[0]!.chapterId).toBe('ch1');
    expect(probeMedia).toHaveBeenCalledWith('/tmp/video.mp4', expect.anything(), { maxDurationSeconds: env.VIDEO_MAX_DURATION_PODCAST_SECONDS });
  }
  if (mode === 'drama') expect(input.characters![0]!.speakerId).toBe(input.cues[0]!.speakerId);
});

it('retains supplied LRC when ASR fails, but never invents lyrics without it', async () => {
  vi.mocked(transcribeAudio).mockRejectedValue(new Error('ASR unavailable'));
  await run('song', '[00:00.00]你好');
  expect(vi.mocked(runGenerationCommit).mock.calls[0]![0].cues[0]!.zh).toBe('你好');
  vi.mocked(runGenerationCommit).mockClear();
  await expect(run('song')).rejects.toThrow('ASR unavailable');
  expect(runGenerationCommit).not.toHaveBeenCalled();
});

it('rejects untimed manual lyrics instead of replacing them with an unrelated transcript', async () => {
  await expect(run('song', '你好')).rejects.toMatchObject({ code: 'LYRICS_TIMESTAMPS_REQUIRED' });
  expect(transcribeAudio).not.toHaveBeenCalled();
  expect(runGenerationCommit).not.toHaveBeenCalled();
});

it('never commits after cancellation during speech recognition', async () => {
  const controller = new AbortController();
  vi.mocked(transcribeAudio).mockImplementation(async () => { controller.abort(); throw new Error('cancelled'); });
  await expect(run('song', '[00:00.00]你好', controller.signal)).rejects.toThrow();
  expect(runGenerationCommit).not.toHaveBeenCalled();
});

it('propagates lesson ASR failure instead of proceeding with empty subtitles', async () => {
  vi.mocked(transcribeAudio).mockRejectedValue(new Error('ASR unavailable'));
  await expect(run('lesson')).rejects.toThrow('ASR unavailable');
  expect(runGenerationCommit).not.toHaveBeenCalled();
});
