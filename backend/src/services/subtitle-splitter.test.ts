import { describe, expect, it } from 'vitest';
import { splitLongPhraseIntoCues, DEFAULT_SPLITTER_OPTIONS } from './subtitle-splitter.js';

describe('splitLongPhraseIntoCues', () => {
  it('returns a single cue when input is already short', () => {
    const result = splitLongPhraseIntoCues({
      startMs: 0,
      endMs: 1500,
      text: '你好',
    });
    expect(result).toEqual([{ startMs: 0, endMs: 1500, zh: '你好' }]);
  });

  it('splits a long phrase by word timestamps at sentence boundaries', () => {
    const result = splitLongPhraseIntoCues({
      startMs: 0,
      endMs: 6000,
      text: '你好,今天天气很好。我们去公园吧。',
      words: [
        { text: '你好,', startMs: 0, endMs: 1000 },
        { text: '今天天气很好。', startMs: 1500, endMs: 3500 },
        { text: '我们去公园吧。', startMs: 4000, endMs: 6000 },
      ],
    });
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.map(c => c.zh)).toContain('你好,');
    expect(result.map(c => c.zh)).toContain('今天天气很好。');
    expect(result.map(c => c.zh)).toContain('我们去公园吧。');
  });

  it('falls back to punctuation-only split when no words are provided', () => {
    const result = splitLongPhraseIntoCues({
      startMs: 0,
      endMs: 30000,
      text: '你好,今天天气很好。我们去公园吧。',
    });
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('enforces max duration by char-split when sentence is very long', () => {
    const longText = '啊'.repeat(50);
    const result = splitLongPhraseIntoCues({
      startMs: 0,
      endMs: 30_000,
      text: longText,
      words: Array.from({ length: 50 }).map((_, i) => ({
        text: '啊',
        startMs: i * 600,
        endMs: (i + 1) * 600,
      })),
    });
    expect(result.length).toBeGreaterThan(2);
    for (const cue of result) {
      expect(cue.zh.length).toBeLessThanOrEqual(DEFAULT_SPLITTER_OPTIONS.maxChars * 1.2);
    }
  });

  it('preserves chronological order with non-overlapping timestamps', () => {
    const result = splitLongPhraseIntoCues({
      startMs: 0,
      endMs: 10_000,
      text: '第一句。第二句,继续。第三句结束。',
      words: [
        { text: '第一句。', startMs: 0, endMs: 3000 },
        { text: '第二句,', startMs: 3500, endMs: 6000 },
        { text: '继续。', startMs: 6500, endMs: 8000 },
        { text: '第三句结束。', startMs: 8500, endMs: 10_000 },
      ],
    });

    for (let i = 1; i < result.length; i += 1) {
      expect(result[i]!.startMs).toBeGreaterThanOrEqual(result[i - 1]!.startMs);
      expect(result[i]!.endMs).toBeGreaterThan(result[i]!.startMs);
    }
  });
});

it('ignores a trailing full stop timestamp in silent outro while preserving punctuation', () => {
  const words = [
    { text: '也是最漂亮的妈妈', startMs: 276150, endMs: 277950 },
    { text: '。', startMs: 284990, endMs: 285030 },
  ];
  const original = structuredClone(words);
  expect(splitLongPhraseIntoCues({ text: '也是最漂亮的妈妈。', startMs: 276150, endMs: 285030, words }))
    .toEqual([{ zh: '也是最漂亮的妈妈。', startMs: 276150, endMs: 277950 }]);
  expect(words).toEqual(original);
});

it('bounds short phrases by spoken words even before the splitting fast path', () => {
  expect(splitLongPhraseIntoCues({ text: '你好。', startMs: 0, endMs: 3500, words: [
    { text: '你好', startMs: 400, endMs: 1200 }, { text: '。', startMs: 3400, endMs: 3500 },
  ] })).toEqual([{ zh: '你好。', startMs: 400, endMs: 1200 }]);
});

it('does not merge a short final sentence across a long silence', () => {
  const cues = splitLongPhraseIntoCues({ text: '你好。再见。', startMs: 0, endMs: 20000, words: [
    { text: '你好。', startMs: 0, endMs: 1000 }, { text: '再见。', startMs: 10000, endMs: 10400 },
  ] });
  expect(cues).toHaveLength(2);
  expect(cues[0]!.endMs).toBe(1000);
  expect(cues[1]!.endMs).toBe(10400);
});

it('enforces duration as well as character count on slow speech', () => {
  const cues = splitLongPhraseIntoCues({ text: '一二三四五六七八九十', startMs: 0, endMs: 10000,
    words: Array.from('一二三四五六七八九十', (text, i) => ({ text, startMs: i * 1000, endMs: i * 1000 + 500 })) });
  expect(cues.map(c => c.zh).join('')).toBe('一二三四五六七八九十');
  expect(cues.every(c => c.endMs - c.startMs <= 4000)).toBe(true);
});
