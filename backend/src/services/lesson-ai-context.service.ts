import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { LessonModel } from '../models/lesson.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';

export const lessonAiContextSchema = z.object({
  lessonId: z.string().refine(Types.ObjectId.isValid),
  subtitleRevision: z.number().int().positive().optional(),
  playbackMs: z.number().int().nonnegative(),
  cueId: z.string().min(1).max(100).optional(),
  scope: z.enum(['current_cue', 'current_segment', 'whole_lesson']),
});
export type LessonAiContextInput = z.infer<typeof lessonAiContextSchema>;
export interface AiCue {
  cueId: string; startMs: number; endMs: number;
  zh: string; vi: string; pinyin: string;
  quality?: string; speakerId?: string; chapterId?: string;
}
export interface ResolvedAiContext {
  lessonId: string; subtitleRevision?: number; title: string; hsk: number;
  playbackMs: number; scope: LessonAiContextInput['scope']; cueId?: string;
  status: 'ready' | 'missing_transcript' | 'no_nearby_cue' | 'context_too_large';
  coverage: 'window' | 'full' | 'none'; cues: AiCue[];
}

// Bound serialized evidence, retaining complete cues. This is a byte ceiling,
// not a claim that character count is an exact model token count.
export const AI_EVIDENCE_BYTE_LIMIT = 18000;
const cueBytes = (cue: AiCue) => Buffer.byteLength(JSON.stringify(cue), 'utf8');

export function selectAiCues(cues: AiCue[], input: LessonAiContextInput, question: string,
  byteLimit = AI_EVIDENCE_BYTE_LIMIT): Pick<ResolvedAiContext, 'cues' | 'status' | 'coverage'> {
  const ordered = [...cues].sort((a, b) => a.startMs - b.startMs);
  if (!ordered.length) return { cues: [], status: 'missing_transcript', coverage: 'none' };
  if (input.cueId && !ordered.some(c => c.cueId === input.cueId)) {
    throw new AppError(422, 'INVALID_CONTEXT', 'Câu phụ đề không thuộc phiên bản bài học đang xem.');
  }
  if (input.scope === 'whole_lesson') {
    const fits = Buffer.byteLength(JSON.stringify(ordered), 'utf8') <= byteLimit;
    return { cues: fits ? ordered : [], status: fits ? 'ready' : 'context_too_large', coverage: fits ? 'full' : 'none' };
  }
  let anchor = input.cueId ? ordered.findIndex(c => c.cueId === input.cueId)
    : ordered.findIndex(c => c.startMs <= input.playbackMs && input.playbackMs < c.endMs);
  if (anchor < 0) {
    let nearest = 15001;
    ordered.forEach((c, i) => {
      const distance = Math.min(Math.abs(c.startMs - input.playbackMs), Math.abs(c.endMs - input.playbackMs));
      if (distance < nearest) { nearest = distance; anchor = i; }
    });
  }
  if (anchor < 0) return { cues: [], status: 'no_nearby_cue', coverage: 'none' };
  const focus = ordered[anchor]!;
  const candidates = input.scope === 'current_cue'
    ? ordered.slice(Math.max(0, anchor - 2), anchor + 3)
    : ordered.filter(c => c.endMs >= focus.startMs - 30000 && c.startMs <= focus.endMs + 30000);
  // Preserve the anchor before adding neighbours or exact Chinese phrase hits.
  const ranked = [focus, ...candidates.filter(c => c !== focus).sort((a, b) =>
    Math.abs(a.startMs - focus.startMs) - Math.abs(b.startMs - focus.startMs))];
  const phrases = question.match(/[\p{Script=Han}]{2,}/gu) ?? [];
  ranked.push(...ordered.filter(c => phrases.some(p => c.zh.includes(p))).slice(0, 8));
  const selected = new Map<string, AiCue>();
  let bytes = 2;
  for (const cue of ranked) {
    if (selected.has(cue.cueId)) continue;
    const size = cueBytes(cue) + 1;
    if (bytes + size > byteLimit) continue;
    selected.set(cue.cueId, cue); bytes += size;
  }
  if (!selected.has(focus.cueId)) return { cues: [], status: 'context_too_large', coverage: 'none' };
  return { cues: [...selected.values()].sort((a, b) => a.startMs - b.startMs), status: 'ready', coverage: 'window' };
}

export async function resolveLessonAiContext(input: LessonAiContextInput, question = ''): Promise<ResolvedAiContext> {
  const lesson = await LessonModel.findOne({ _id: input.lessonId, status: 'published' })
    .select('titleVi hsk durationSeconds activeSubtitleRevision').lean();
  if (!lesson) throw new AppError(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học.');
  if (input.playbackMs > Math.ceil(lesson.durationSeconds * 1000)) {
    throw new AppError(422, 'INVALID_POSITION', 'Thời điểm hỏi vượt quá thời lượng video.');
  }
  if (input.subtitleRevision !== undefined && input.subtitleRevision !== lesson.activeSubtitleRevision) {
    throw new AppError(409, 'CONTEXT_STALE', 'Phụ đề đã được cập nhật. Hãy tải lại bài học trước khi hỏi tiếp.');
  }
  const base = {
    lessonId: lesson._id.toString(), subtitleRevision: lesson.activeSubtitleRevision ?? undefined,
    title: lesson.titleVi, hsk: lesson.hsk, playbackMs: input.playbackMs, scope: input.scope, cueId: input.cueId,
  };
  const track = lesson.activeSubtitleRevision ? await SubtitleTrackModel.findOne({
    lessonId: lesson._id, revision: lesson.activeSubtitleRevision, status: 'published',
  }).select('cues').lean() : null;
  const cues: AiCue[] = (track?.cues ?? []).filter(c => c.zh?.trim()).map(c => ({
    cueId: c.cueId, startMs: c.startMs, endMs: c.endMs, zh: c.zh, vi: c.vi, pinyin: c.pinyin,
    ...(c.quality ? { quality: c.quality } : {}),
    ...(c.speakerId ? { speakerId: c.speakerId } : {}),
    ...(c.chapterId ? { chapterId: c.chapterId } : {}),
  }));
  return { ...base, ...selectAiCues(cues, input, question) };
}

export function resolveAiCitations(ids: string[], context?: ResolvedAiContext): AiCue[] {
  const allowed = new Map(context?.cues.map(c => [c.cueId, c]) ?? []);
  if (ids.some(id => !allowed.has(id))) {
    throw new AppError(502, 'AI_INVALID_RESPONSE', 'Panda chưa xác minh được nguồn câu trả lời. Vui lòng thử lại.');
  }
  return [...new Set(ids)].map(id => allowed.get(id)!);
}

export const unavailableContextMessages = {
  missing_transcript: 'Bài này chưa có phụ đề đã xuất bản để Panda phân tích. Bạn có thể chuyển sang hỏi tiếng Trung chung.',
  no_nearby_cue: 'Chưa có câu phụ đề gần thời điểm này. Hãy chọn một câu trong bản chép lời hoặc hỏi về toàn bài.',
  context_too_large: 'Nội dung vượt giới hạn một lần hỏi. Hãy chọn câu hoặc đoạn đang xem để Panda giải thích chính xác.',
};
