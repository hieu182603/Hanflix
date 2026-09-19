import type { WordTimestamp } from './asr.js';

export interface SplitterInput {
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
  words?: WordTimestamp[];
}

export interface SplitCue {
  startMs: number;
  endMs: number;
  zh: string;
  confidence?: number;
}

export interface SplitterOptions {
  maxChars: number;
  maxDurationMs: number;
  minDurationMs: number;
}

export const DEFAULT_SPLITTER_OPTIONS: SplitterOptions = {
  maxChars: 18,
  maxDurationMs: 4_000,
  minDurationMs: 600,
};

const SENTENCE_ENDERS = /[。！？!?\.]/;
const CLAUSE_SEPARATORS = /[，,；;]/;

// Punctuation has no audible duration. Azure sometimes timestamps a final
// standalone full stop at the end of the video, well after the last word.
function speechWords(words: WordTimestamp[]): WordTimestamp[] {
  const result: WordTimestamp[] = [];
  let prefix = '';
  for (const word of words) {
    if (!/[\p{L}\p{N}]/u.test(word.text)) {
      const previous = result.at(-1);
      if (previous) previous.text += word.text;
      else prefix += word.text;
    } else {
      result.push({ ...word, text: prefix + word.text });
      prefix = '';
    }
  }
  return result;
}

export function splitLongPhraseIntoCues(
  input: SplitterInput,
  options: SplitterOptions = DEFAULT_SPLITTER_OPTIONS,
): SplitCue[] {
  const words = input.words?.length ? speechWords(input.words) : undefined;
  if (words && !words.length) return [];
  const boundedInput = words?.length
    ? { ...input, startMs: words[0]!.startMs, endMs: words.at(-1)!.endMs, words }
    : input;
  const { text, startMs, endMs, confidence } = boundedInput;
  const duration = endMs - startMs;

  if (text.length <= options.maxChars && duration <= options.maxDurationMs) {
    return [{ startMs, endMs, zh: text, confidence }];
  }

  if (!words || words.length === 0) {
    return splitByPunctuationOnly(boundedInput, options);
  }

  return splitByWords(boundedInput, words, options);
}

function splitByPunctuationOnly(
  input: SplitterInput,
  options: SplitterOptions,
): SplitCue[] {
  const { text, startMs, endMs, confidence } = input;
  const duration = endMs - startMs;

  const segments: SplitCue[] = [];
  let buffer = '';
  let bufferStart = startMs;
  let charIndex = 0;

  for (const char of text) {
    buffer += char;
    charIndex += 1;

    const isEndOfSentence = SENTENCE_ENDERS.test(char);
    const isEndOfClause = CLAUSE_SEPARATORS.test(char);
    const exceedsChars = buffer.length >= options.maxChars;

    if (isEndOfSentence || (exceedsChars && (isEndOfClause || buffer.length >= options.maxChars * 1.5))) {
      const ratio = charIndex / Math.max(text.length, 1);
      const segEnd = Math.min(endMs, startMs + Math.round(duration * ratio));
      segments.push({ startMs: bufferStart, endMs: segEnd, zh: buffer.trim(), confidence });
      buffer = '';
      bufferStart = segEnd;
    }
  }

  if (buffer.trim()) {
    segments.push({ startMs: bufferStart, endMs, zh: buffer.trim(), confidence });
  }

  return segments.length > 0 ? segments : [{ startMs, endMs, zh: text, confidence }];
}

function splitByWords(
  input: SplitterInput,
  words: WordTimestamp[],
  options: SplitterOptions,
): SplitCue[] {
  const { startMs, endMs, confidence } = input;

  const splitPoints: number[] = [0, words.length];

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i]!;
    const endsWithSentence = SENTENCE_ENDERS.test(word.text);
    const endsWithClause = CLAUSE_SEPARATORS.test(word.text);
    if (endsWithSentence) {
      splitPoints.push(i + 1);
    } else if (endsWithClause) {
      splitPoints.push(i + 1);
    }
  }

  splitPoints.sort((a, b) => a - b);
  const uniquePoints = Array.from(new Set(splitPoints)).filter(p => p > 0 && p < words.length);

  const segments: SplitCue[] = [];
  let cursor = 0;

  for (const point of uniquePoints) {
    const slice = words.slice(cursor, point);
    if (slice.length === 0) continue;

    const segText = slice.map(w => w.text).join('').trim();
    if (!segText) {
      cursor = point;
      continue;
    }

    const segStart = slice[0]!.startMs;
    const segEnd = slice[slice.length - 1]!.endMs;

    if (segText.length <= options.maxChars && (segEnd - segStart) <= options.maxDurationMs) {
      segments.push({ startMs: segStart, endMs: segEnd, zh: segText, confidence });
      cursor = point;
      continue;
    }

    const subSegments = splitLongSliceByChars(slice, segStart, options, confidence);
    segments.push(...subSegments);
    cursor = point;
  }

  if (cursor < words.length) {
    const slice = words.slice(cursor);
    const segText = slice.map(w => w.text).join('').trim();
    if (segText) {
      const segStart = slice[0]!.startMs;
      const segEnd = slice[slice.length - 1]!.endMs;
      if (segText.length <= options.maxChars && (segEnd - segStart) <= options.maxDurationMs) {
        segments.push({ startMs: segStart, endMs: segEnd, zh: segText, confidence });
      } else {
        segments.push(...splitLongSliceByChars(slice, segStart, options, confidence));
      }
    }
  }

  return enforceMinDuration(mergeTooShortSegments(segments, endMs, options), endMs, options);
}

function splitLongSliceByChars(
  slice: WordTimestamp[],
  segStart: number,
  options: SplitterOptions,
  confidence?: number,
): SplitCue[] {
  const segments: SplitCue[] = [];
  let buffer: WordTimestamp[] = [];
  let bufferChars = 0;

  for (const word of slice) {
    if (buffer.length && word.endMs - buffer[0]!.startMs > options.maxDurationMs) {
      segments.push({ startMs: buffer[0]!.startMs, endMs: buffer.at(-1)!.endMs, zh: buffer.map(w => w.text).join('').trim(), confidence });
      buffer = [];
      bufferChars = 0;
    }
    buffer.push(word);
    bufferChars += word.text.length;

    if (bufferChars >= options.maxChars) {
      const text = buffer.map(w => w.text).join('').trim();
      const s = buffer[0]!.startMs;
      const e = buffer[buffer.length - 1]!.endMs;
      segments.push({ startMs: s, endMs: e, zh: text, confidence });
      buffer = [];
      bufferChars = 0;
    }
  }

  if (buffer.length > 0) {
    const text = buffer.map(w => w.text).join('').trim();
    const s = buffer[0]!.startMs;
    const e = buffer[buffer.length - 1]!.endMs;
    segments.push({ startMs: s, endMs: e, zh: text, confidence });
  }

  return segments;
}

function mergeTooShortSegments(
  segments: SplitCue[],
  finalEndMs: number,
  options: SplitterOptions,
): SplitCue[] {
  if (segments.length <= 1) return segments;

  const merged: SplitCue[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && (seg.endMs - seg.startMs) < options.minDurationMs
      && seg.startMs - last.endMs <= options.minDurationMs
      && seg.endMs - last.startMs <= options.maxDurationMs
      && last.zh.length + seg.zh.length <= options.maxChars) {
      last.endMs = seg.endMs;
      last.zh = `${last.zh}${last.zh && seg.zh ? '' : ''}${seg.zh}`.trim();
    } else {
      merged.push({ ...seg });
    }
  }

  const lastCue = merged[merged.length - 1];
  if (lastCue && lastCue.endMs < options.minDurationMs && finalEndMs > lastCue.endMs) {
    lastCue.endMs = Math.min(finalEndMs, lastCue.startMs + options.minDurationMs);
  }

  for (let i = 1; i < merged.length; i += 1) {
    const prev = merged[i - 1]!;
    const current = merged[i]!;
    if (current.startMs < prev.endMs) {
      const midpoint = Math.floor((prev.endMs + current.startMs) / 2);
      prev.endMs = midpoint;
      current.startMs = midpoint;
      if (current.endMs <= current.startMs) {
        current.startMs = Math.min(current.endMs, prev.endMs);
      }
    }
  }

  return merged.filter((cue) => cue.endMs > cue.startMs);
}

function enforceMinDuration(
  segments: SplitCue[],
  finalEndMs: number,
  options: SplitterOptions,
): SplitCue[] {
  return mergeTooShortSegments(segments, finalEndMs, options);
}
