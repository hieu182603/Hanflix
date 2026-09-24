import { beforeEach, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { parseLRC } from './song/lyrics-parser.service.js';
import { alignLyricsToAudio } from './song/karaoke-aligner.service.js';
import { transcribeAudio } from './asr.js';
import { LessonModel } from '../models/lesson.model.js';
import { ProcessingJobModel } from '../models/processing-job.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { runGenerationCommit } from './revision-commit.js';

vi.mock('./asr.js', () => ({ transcribeAudio: vi.fn() }));
beforeEach(() => vi.restoreAllMocks());

it('parses repeated LRC timestamps, offsets and duplicate timestamps without overlapping cues', () => {
  const parsed = parseLRC('[offset:-500]\n[00:01.00][00:03.00]你好\n[00:01.00]世界');
  expect(parsed.cues).toEqual([
    { startMs: 500, endMs: 2500, text: '你好 世界' },
    { startMs: 2500, endMs: 7500, text: '你好' },
  ]);
});

it('aligns Chinese characters in order, without reusing ASR words or exceeding the cue', async () => {
  vi.mocked(transcribeAudio).mockResolvedValue([{ startMs: 0, endMs: 1000, zh: '你好你好', words: [
    { text: '你好', startMs: 0, endMs: 400 }, { text: '你好', startMs: 600, endMs: 1100 },
  ] }]);
  const result = await alignLyricsToAudio('unused.wav', [{ startMs: 0, endMs: 1000, text: '你好你好！' }]);
  const tokens = result.cues[0]!.tokens;
  expect(tokens.map(t => t.text).join('')).toBe('你好你好！');
  expect(tokens[2]!.startMs).toBeGreaterThanOrEqual(tokens[1]!.endMs);
  for (const [i, token] of tokens.entries()) {
    expect(token.startMs).toBeGreaterThanOrEqual(i ? tokens[i - 1]!.endMs : 0);
    expect(token.endMs).toBeLessThanOrEqual(1000);
  }
});

it('retains true podcast duration and extended metadata in the guarded generation commit', async () => {
  const id = new Types.ObjectId().toString();
  vi.spyOn(LessonModel, 'findById').mockResolvedValue({ contentMode: 'podcast' } as never);
  vi.spyOn(SubtitleTrackModel, 'findOne').mockReturnValue({ sort: () => ({ session: async () => null }) } as never);
  vi.spyOn(QuizModel, 'findOne').mockReturnValue({ sort: () => ({ select: () => ({ session: async () => null }) }) } as never);
  vi.spyOn(ProcessingJobModel, 'findOne').mockResolvedValue({} as never);
  vi.spyOn(ProcessingJobModel, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);
  const subtitle = vi.spyOn(SubtitleTrackModel, 'findOneAndUpdate').mockResolvedValue({ revision: 1 } as never);
  vi.spyOn(QuizModel, 'findOneAndUpdate').mockResolvedValue({ revision: 1 } as never);
  const lesson = vi.spyOn(LessonModel, 'findOneAndUpdate').mockResolvedValue({} as never);
  const chapters = [{ chapterId: 'c1', title: 'Intro', startMs: 0, endMs: 1800000 }];
  await runGenerationCommit({ lessonId: id, jobId: id, durationSeconds: 1800, leaseToken: 'lease', questions: [], chapters,
    cues: [{ cueId: 'a', startMs: 0, endMs: 1000, zh: '你好', pinyin: 'ni hao', vi: 'Xin chào', chapterId: 'c1' }],
  });
  expect(lesson.mock.calls[0]![1]).toMatchObject({ $set: { durationSeconds: 1800, chapters } });
  expect(subtitle.mock.calls[0]![1]).toMatchObject({ $set: { cues: [expect.objectContaining({ chapterId: 'c1' })] } });
});

it('keeps the quiz requirement for standard lessons', async () => {
  vi.spyOn(LessonModel, 'findById').mockResolvedValue({ contentMode: 'lesson' } as never);
  await expect(runGenerationCommit({ lessonId: 'x', jobId: 'x', durationSeconds: 60, leaseToken: 'x', questions: [],
    cues: [{ cueId: 'a', startMs: 0, endMs: 1000, zh: '你好', pinyin: 'ni hao', vi: 'Xin chào' }],
  })).rejects.toMatchObject({ code: 'CONTENT_INCOMPLETE' });
});
