import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { LessonModel } from '../models/lesson.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { selectAiCues, resolveLessonAiContext, resolveAiCitations, type AiCue, type LessonAiContextInput } from './lesson-ai-context.service.js';

const lessonId = new Types.ObjectId().toString();
const cues: AiCue[] = Array.from({ length: 40 }, (_, i) => ({
  cueId: `c${i}`, startMs: i * 5000, endMs: i * 5000 + 4000,
  zh: i === 35 ? '我已经吃过饭了。' : `第${i}句`, pinyin: 'pinyin', vi: `Câu ${i}`,
}));
const input: LessonAiContextInput = { lessonId, subtitleRevision: 3, playbackMs: 83000, scope: 'current_cue' };
afterEach(() => vi.restoreAllMocks());

describe('video evidence selection', () => {
  it('selects the current cue and neighbours at a timestamp in the middle', () => {
    expect(selectAiCues(cues, input, '').cues.map(c => c.cueId)).toEqual(['c14', 'c15', 'c16', 'c17', 'c18']);
  });
  it('honours the explicitly selected cue while the player moves on', () => {
    expect(selectAiCues(cues, { ...input, cueId: 'c35' }, '').cues.map(c => c.cueId)).toEqual(['c33', 'c34', 'c35', 'c36', 'c37']);
  });
  it('includes an exact Chinese phrase from later in the video', () => {
    expect(selectAiCues(cues, input, '吃过饭 nghĩa là gì?').cues.map(c => c.cueId)).toContain('c35');
  });
  it('keeps the full transcript for whole-lesson questions', () => {
    const result = selectAiCues(cues, { ...input, scope: 'whole_lesson' }, '');
    expect(result.coverage).toBe('full'); expect(result.cues).toHaveLength(40);
  });
  it('does not label a truncated transcript as the whole lesson', () => {
    expect(selectAiCues(cues, { ...input, scope: 'whole_lesson' }, '', 200)).toMatchObject({ status: 'context_too_large', cues: [] });
  });
  it('preserves the focus cue under a tight budget and keeps JSON intact', () => {
    const result = selectAiCues(cues, input, '', 200);
    expect(result.cues.map(c => c.cueId)).toContain('c16');
    expect(Buffer.byteLength(JSON.stringify(result.cues))).toBeLessThanOrEqual(200);
  });
  it('rejects a forged cue and reports missing or distant subtitles', () => {
    expect(() => selectAiCues(cues, { ...input, cueId: 'other-lesson' }, '')).toThrow('không thuộc');
    expect(selectAiCues([], input, '').status).toBe('missing_transcript');
    expect(selectAiCues(cues, { ...input, playbackMs: 300000 }, '').status).toBe('no_nearby_cue');
  });
  it.each([0, 5000, 195000, 199000])('handles cue boundaries at %i ms', playbackMs => {
    expect(selectAiCues(cues, { ...input, playbackMs }, '').status).toBe('ready');
  });
});

describe('published lesson resolver', () => {
  const mockLesson = (extra = {}) => vi.spyOn(LessonModel, 'findOne').mockReturnValue({
    select: () => ({ lean: async () => ({ _id: new Types.ObjectId(lessonId), titleVi: 'Bữa ăn', hsk: 2,
      durationSeconds: 200, activeSubtitleRevision: 3, ...extra }) }),
  } as never);
  it('loads only the active published revision and returns DB text', async () => {
    const lesson = mockLesson();
    const track = vi.spyOn(SubtitleTrackModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ cues }) }) } as never);
    const result = await resolveLessonAiContext(input);
    expect(lesson).toHaveBeenCalledWith({ _id: lessonId, status: 'published' });
    expect(track.mock.calls[0]?.[0]).toMatchObject({ revision: 3, status: 'published' });
    expect(result).toMatchObject({ title: 'Bữa ăn', subtitleRevision: 3, status: 'ready' });
    expect(resolveAiCitations(['c16', 'c16'], result)).toEqual([cues[16]]);
    expect(() => resolveAiCitations(['fake'], result)).toThrow('xác minh');
  });
  it('rejects unavailable lessons', async () => {
    vi.spyOn(LessonModel, 'findOne').mockReturnValue({ select: () => ({ lean: async () => null }) } as never);
    await expect(resolveLessonAiContext(input)).rejects.toMatchObject({ code: 'LESSON_NOT_FOUND' });
  });
  it('rejects stale revisions and out-of-range positions before reading a track', async () => {
    mockLesson();
    await expect(resolveLessonAiContext({ ...input, subtitleRevision: 2 })).rejects.toMatchObject({ code: 'CONTEXT_STALE' });
    await expect(resolveLessonAiContext({ ...input, playbackMs: 999999 })).rejects.toMatchObject({ code: 'INVALID_POSITION' });
  });
  it('does not fabricate evidence when no published track exists', async () => {
    mockLesson({ activeSubtitleRevision: undefined });
    await expect(resolveLessonAiContext({ ...input, subtitleRevision: undefined })).resolves.toMatchObject({ status: 'missing_transcript', cues: [] });
  });
});
