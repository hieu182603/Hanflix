import { AppError } from '../errors/app-error.js';

/**
 * Subtitle + style validator used by Subtitle Review endpoints.
 *
 * Single source of truth so the Subtitle Review workspace (UI) and the
 * /publish gate agree on what makes a subtitle "valid". Keeps the validation
 * rules in one place instead of duplicating zod schemas across endpoints.
 */

export interface SubtitleStyleInput {
  chineseFontSize?: unknown;
  pinyinFontSize?: unknown;
  vietnameseFontSize?: unknown;
}

export interface NormalizedSubtitleStyle {
  chineseFontSize: number;
  pinyinFontSize: number;
  vietnameseFontSize: number;
}

export const DEFAULT_SUBTITLE_STYLE: NormalizedSubtitleStyle = {
  chineseFontSize: 34,
  pinyinFontSize: 20,
  vietnameseFontSize: 22,
};

const FONT_BOUNDS = {
  chinese: { min: 16, max: 96 },
  pinyin: { min: 12, max: 64 },
  vietnamese: { min: 12, max: 64 },
} as const;

function normalizeFontSize(value: unknown, fallback: number, bounds: { min: number; max: number }): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError(422, 'INVALID_STYLE', 'Font size phải là số');
  }
  const rounded = Math.round(value);
  if (rounded < bounds.min || rounded > bounds.max) {
    throw new AppError(422, 'INVALID_STYLE', `Font size phải trong khoảng ${bounds.min}-${bounds.max}`);
  }
  return rounded;
}

export function normalizeSubtitleStyle(input: SubtitleStyleInput | null | undefined): NormalizedSubtitleStyle {
  return {
    chineseFontSize: normalizeFontSize(input?.chineseFontSize, DEFAULT_SUBTITLE_STYLE.chineseFontSize, FONT_BOUNDS.chinese),
    pinyinFontSize: normalizeFontSize(input?.pinyinFontSize, DEFAULT_SUBTITLE_STYLE.pinyinFontSize, FONT_BOUNDS.pinyin),
    vietnameseFontSize: normalizeFontSize(input?.vietnameseFontSize, DEFAULT_SUBTITLE_STYLE.vietnameseFontSize, FONT_BOUNDS.vietnamese),
  };
}

export interface CueTimingInput {
  cueId: string;
  startMs: number;
  endMs: number;
}

/**
 * Validates the entire cue list against the video duration. Catches:
 *  - endMs > duration
 *  - out-of-order cues (startMs > endMs)
 *  - duplicate cueIds
 *
 * Throws AppError(422) on the first violation with a cueId pinpoint so the
 * Subtitle Review UI can scroll the offending cue into view.
 */
export function validateCueTimings(cues: CueTimingInput[], durationSeconds: number): void {
  if (cues.length === 0) {
    throw new AppError(422, 'EMPTY_SUBTITLES', 'Phụ đề chưa có nội dung');
  }
  const durationMs = Math.max(1, durationSeconds * 1000);
  const seen = new Set<string>();
  for (const cue of cues) {
    if (seen.has(cue.cueId)) {
      throw new AppError(422, 'DUPLICATE_CUE_ID', `Câu thoại ${cue.cueId} bị trùng cueId`);
    }
    seen.add(cue.cueId);
    if (!Number.isFinite(cue.startMs) || cue.startMs < 0) {
      throw new AppError(422, 'INVALID_CUE_TIME', `Câu thoại ${cue.cueId} có thời gian bắt đầu không hợp lệ`);
    }
    if (!Number.isFinite(cue.endMs) || cue.endMs <= cue.startMs) {
      throw new AppError(422, 'INVALID_CUE_TIME', `Câu thoại ${cue.cueId} có thời gian kết thúc nhỏ hơn hoặc bằng thời gian bắt đầu`);
    }
    if (cue.endMs > durationMs) {
      throw new AppError(422, 'CUE_OVERFLOW', `Câu thoại ${cue.cueId} vượt quá thời lượng video`);
    }
  }
}
