/**
 * CONTENT MODE (2026-09-22) - SONG: karaoke aligner service.
 *
 * Mục đích:
 *   - Căn chỉnh word-level timing giữa LRC text và audio thực.
 *   - Trả về AlignedToken[]: mỗi token có startMs/endMs — đủ để KaraokePlayer
 *     highlight từng từ theo nhịp nhạc.
 *
 * Hai chiến lược:
 *   1. LRC có timestamp (cue-level): dùng cue timing làm "xương sống", ASR
 *      chỉ cung cấp word-level timing bên trong mỗi cue (proportional scaling).
 *      Ưu điểm: timing luôn khớp với bài gốc (admin paste LRC đã biết nhịp).
 *      Nhược: nếu LRC không đồng bộ với audio, mỗi cue sẽ "trượt" cùng offset.
 *
 *   2. Không có LRC (plain text hoặc auto): dùng ASR output trực tiếp.
 *      Fallback an toàn khi admin không cung cấp LRC.
 *
 * Thuật toán align (chiến lược 1):
 *   - Gọi Azure ASR với wordLevelTimestampsEnabled=true.
 *   - Trong mỗi cue, tìm tất cả ASR words thuộc về khoảng [cue.startMs, cue.endMs].
 *   - Match các word với cue.text tokens bằng longest-common-subsequence (LCS).
 *   - Với mỗi cue token khớp: gán timing = ASR word startMs/endMs.
 *   - Với cue token không khớp (LRC có từ mà ASR bỏ sót, hoặc ngược lại):
 *     dùng proportional interpolation giữa các word đã khớp.
 */

import type { LyricsCue } from './lyrics-parser.service.js';
import { transcribeAudio } from '../asr.js';
import { logger } from '../logger.js';

export interface AlignedToken {
  /** Văn bản từ (giữ nguyên từ LRC để UI dùng karaoke highlight). */
  text: string;
  /** Thời điểm bắt đầu từ này (ms). */
  startMs: number;
  /** Thời điểm kết thúc từ này (ms). */
  endMs: number;
  /** Confidence từ ASR (0-1). null nếu interpolated. */
  confidence: number | null;
}

export interface AlignedCue {
  startMs: number;
  endMs: number;
  zh: string;
  pinyin: string;
  tokens: AlignedToken[];
}

export interface AlignedLyricsResult {
  cues: AlignedCue[];
  /** Tỉ lệ cues có ít nhất một token được match từ ASR (0-1). */
  matchRatio: number;
  /** Source quyết định chiến lược align. */
  source: 'lrc+asr' | 'asr-only';
}

/**
 * Tokenize câu Hán-Việt-Hỗn-Hợp thành các từ đơn lẻ.
 *
 * Đơn giản: cắt theo whitespace + loại bỏ punctuation ở rìa.
 * KHÔNG dùng segmenter phức tạp vì:
 *   - LRC gốc thường đã được tách từ sẵn bởi con người.
 *   - ASR word-level cũng tách sẵn.
 *   - Edge case (vd "不行," và "不行") có thể chấp nhận sai số 1-2 từ.
 */
function tokenize(text: string): string[] {
  return Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text), s => s.segment).filter(s => s.trim());
}

function matchTokensToAsrWords(
  cueTokens: string[],
  asrWords: Array<{ text: string; startMs: number; endMs: number; confidence?: number }>,
): Map<number, { asrWord: { text: string; startMs: number; endMs: number }; confidence: number }> {
  const matches = new Map<number, { asrWord: { text: string; startMs: number; endMs: number }; confidence: number }>();
  // Expand Chinese ASR words to characters and consume each at most once, in order.
  const chars = asrWords.flatMap(w => {
    const texts = tokenize(w.text);
    return texts.map((text, i) => ({ text, startMs: w.startMs + (w.endMs - w.startMs) * i / texts.length, endMs: w.startMs + (w.endMs - w.startMs) * (i + 1) / texts.length }));
  });
  let cursor = 0;
  cueTokens.forEach((token, i) => {
    const index = chars.findIndex((word, j) => j >= cursor && word.text === token);
    if (index >= 0) { matches.set(i, { asrWord: chars[index]!, confidence: 1 }); cursor = index + 1; }
  });
  return matches;
}

/**
 * Interpolate timing cho cue tokens không khớp với ASR.
 *
 * Chiến lược:
 *   - Nếu cue có tokens match trước/sau: dùng proportional scaling.
 *   - Nếu cue không match gì: chia đều giữa cue.startMs và cue.endMs.
 */
function interpolateTokens(
  cueStartMs: number, cueEndMs: number, cueTokens: string[],
  matches: Map<number, { asrWord: { text: string; startMs: number; endMs: number }; confidence: number }>,
): AlignedToken[] {
  const result: AlignedToken[] = [];
  let cursor = cueStartMs;
  for (let i = 0; i < cueTokens.length; i++) {
    const match = matches.get(i);
    if (match) {
      const startMs = Math.max(cursor, Math.min(cueEndMs, match.asrWord.startMs));
      const endMs = Math.max(startMs, Math.min(cueEndMs, match.asrWord.endMs));
      result.push({ text: cueTokens[i]!, startMs, endMs, confidence: match.confidence });
      cursor = endMs;
    } else {
      let next = i + 1;
      while (next < cueTokens.length && !matches.has(next)) next++;
      const boundary = Math.max(cursor, Math.min(cueEndMs, matches.get(next)?.asrWord.startMs ?? cueEndMs));
      const endMs = cursor + (boundary - cursor) / (next - i);
      result.push({ text: cueTokens[i]!, startMs: cursor, endMs, confidence: null });
      cursor = endMs;
    }
  }
  return result;
}

/**
 * Align toàn bộ LRC với audio.
 *
 * @param audioPath Path file audio (wav, mp3 — Azure Speech tự detect).
 * @param cues      LRC cues đã parse (cue-level timing).
 * @returns AlignedCue[] — mỗi cue chứa tokens với word-level timing.
 */
export async function alignLyricsToAudio(
  audioPath: string,
  cues: LyricsCue[],
  signal?: AbortSignal,
): Promise<AlignedLyricsResult> {
  if (!cues.length) return { cues: [], matchRatio: 0, source: 'lrc+asr' };

  // Gọi ASR để lấy word-level timing cho cả audio
  const segments = await transcribeAudio(audioPath, signal);
  const allAsrWords = segments.flatMap(seg => seg.words ?? []).filter(Boolean);

  if (!allAsrWords.length) {
    // ASR không trả về word-level — fallback về chia đều cue
    logger.warn({ cues: cues.length }, '[KaraokeAligner] ASR không trả về word-level, fallback chia đều cue');
    return {
      cues: cues.map(cue => ({
        startMs: cue.startMs,
        endMs: cue.endMs,
        zh: cue.text,
        pinyin: '',
        tokens: tokenize(cue.text).map((text, idx, arr) => {
          const sliceMs = (cue.endMs - cue.startMs) / Math.max(1, arr.length);
          return { text, startMs: Math.round(cue.startMs + idx * sliceMs), endMs: Math.round(cue.startMs + (idx + 1) * sliceMs), confidence: null };
        }),
      })),
      matchRatio: 0,
      source: 'lrc+asr',
    };
  }

  let matchedCues = 0;
  const alignedCues: AlignedCue[] = cues.map(cue => {
    const cueTokens = tokenize(cue.text);
    // Lấy ASR words nằm trong khoảng cue này (mở rộng 500ms để bắt từ ở rìa)
    const asrInCue = allAsrWords.filter(w =>
      w.startMs >= cue.startMs - 500 && w.endMs <= cue.endMs + 500,
    );
    const matches = matchTokensToAsrWords(cueTokens, asrInCue);
    if (matches.size > 0) matchedCues += 1;
    const tokens = interpolateTokens(cue.startMs, cue.endMs, cueTokens, matches);
    return {
      startMs: cue.startMs,
      endMs: cue.endMs,
      zh: cue.text,
      pinyin: '', // sẽ được fill ở stage generate_pinyin
      tokens,
    };
  });

  return {
    cues: alignedCues,
    matchRatio: matchedCues / cues.length,
    source: 'lrc+asr',
  };
}

/**
 * Fallback: ASR-only khi không có LRC.
 * Mỗi ASR segment → một cue, ASR words → tokens.
 */
export async function alignAsrOnly(audioPath: string, signal?: AbortSignal): Promise<AlignedLyricsResult> {
  const segments = await transcribeAudio(audioPath, signal);
  const cues: AlignedCue[] = segments.map(segment => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    zh: segment.zh,
    pinyin: '',
    tokens: (segment.words ?? []).map(word => ({
      text: word.text,
      startMs: word.startMs,
      endMs: word.endMs,
      confidence: segment.confidence ?? null,
    })),
  }));
  return { cues, matchRatio: 1, source: 'asr-only' };
}
