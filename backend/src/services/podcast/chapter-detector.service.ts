/**
 * CONTENT MODE (2026-09-22) - PODCAST: chapter detection service.
 */
import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { logger } from '../logger.js';

const geminiClient = env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }) : null;

export interface DetectedChapter {
  chapterId: string;
  title: string;
  startMs: number;
  endMs: number;
  summary: string;
}

export interface ChapterDetectionInput {
  segments: Array<{ startMs: number; endMs: number; text: string }>;
  durationMs: number;
}

interface GeminiChapter {
  title?: string;
  startMs?: number;
  endMs?: number;
  summary?: string;
}

const chapterCache = new Map<string, { result: DetectedChapter[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function computeHash(input: ChapterDetectionInput): string {
  const text = input.segments.map(s => `${s.startMs}:${s.text}`).join('|');
  return createHash('sha256').update(`${input.durationMs}|${text}`).digest('hex').slice(0, 16);
}

function makeUniformChapters(input: ChapterDetectionInput): DetectedChapter[] {
  if (!input.durationMs || input.segments.length === 0) return [];
  const count = Math.min(12, Math.max(2, Math.ceil(input.durationMs / (5 * 60 * 1000))));
  const sliceMs = input.durationMs / count;
  const out: DetectedChapter[] = [];
  for (let i = 0; i < count; i++) {
    const startMs = Math.round(i * sliceMs);
    const endMs = Math.round((i + 1) * sliceMs);
    const seg = input.segments.find(s => s.startMs >= startMs && s.startMs < endMs);
    out.push({
      chapterId: `chapter-${i + 1}`,
      title: `Phần ${i + 1}`,
      startMs,
      endMs,
      summary: seg ? seg.text.slice(0, 200) : '',
    });
  }
  return out;
}

export async function detectChapters(input: ChapterDetectionInput, signal?: AbortSignal): Promise<DetectedChapter[]> {
  signal?.throwIfAborted();
  if (!input.segments.length || input.durationMs <= 0) return [];

  const hash = computeHash(input);
  const cached = chapterCache.get(hash);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const fallback: DetectedChapter[] = makeUniformChapters(input);
  if (chapterCache.size >= 100) chapterCache.delete(chapterCache.keys().next().value!);
  chapterCache.set(hash, { result: fallback, expiresAt: Date.now() + CACHE_TTL_MS });

  if (!geminiClient) {
    return fallback;
  }

  const targetCount = Math.min(12, Math.max(2, Math.ceil(input.durationMs / (5 * 60 * 1000))));
  const lines = input.segments.map(seg => {
    const totalSec = Math.floor(seg.startMs / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `[${mm}:${ss}]${seg.text}`;
  });
  const transcript = lines.join('\n').slice(0, 30000);

  const systemInstruction = `Bạn là chuyên gia phân tích podcast tiếng Trung cho người học tiếng Việt.
Nhiệm vụ: chia transcript thành các chapter theo chủ đề/topic shift.
Mỗi chapter cần có:
- title: tiêu đề ngắn gọn bằng tiếng Việt (6-50 ký tự)
- startMs: thời điểm bắt đầu (ms)
- endMs: thời điểm kết thúc (ms, lớn hơn startMs)
- summary: tóm tắt 1-2 câu bằng tiếng Việt
Số chapter mục tiêu: ${targetCount}. Không vượt quá 12.
Trả về JSON object: { "chapters": [{ "title": "...", "startMs": 0, "endMs": 60000, "summary": "..." }, ...] }
KHÔNG Markdown. KHÔNG giải thích.`;

  try {
    const response = await geminiClient.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: transcript }] }],
      config: {
        abortSignal: signal,
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });
    const raw = (response.text ?? '').replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(raw) as { chapters?: GeminiChapter[] };
    if (!parsed?.chapters || !Array.isArray(parsed.chapters)) {
      throw new Error('Invalid Gemini response');
    }
    const chapters: DetectedChapter[] = parsed.chapters
      .filter(c => c && typeof c.title === 'string' && Number.isFinite(c.startMs) && Number.isFinite(c.endMs))
      .map((c, i) => ({
        chapterId: `chapter-${i + 1}`,
        title: (c.title ?? '').slice(0, 200),
        startMs: Math.max(0, Math.min(c.startMs ?? 0, input.durationMs)),
        endMs: Math.max(c.startMs ?? 0, Math.min(c.endMs ?? c.startMs ?? 0, input.durationMs)),
        summary: typeof c.summary === 'string' ? c.summary.slice(0, 1000) : '',
      }))
      .filter(c => c.title.length > 0 && c.endMs > c.startMs)
      .sort((a, b) => a.startMs - b.startMs);
    chapters.splice(12);
    if (chapters[0]) chapters[0].startMs = 0;
    chapters.forEach((c, i) => { c.chapterId = `chapter-${i + 1}`; c.endMs = chapters[i + 1]?.startMs ?? input.durationMs; });
    if (chapters.some(c => c.endMs <= c.startMs)) throw new Error('Invalid chapter ranges');
    if (chapters.length === 0) throw new Error('Empty chapters');
    chapterCache.set(hash, { result: chapters, expiresAt: Date.now() + CACHE_TTL_MS });
    return chapters;
  } catch (err) {
    signal?.throwIfAborted();
    logger.warn({ err: String(err) }, '[ChapterDetector] Gemini failed, using fallback');
    return fallback;
  }
}
