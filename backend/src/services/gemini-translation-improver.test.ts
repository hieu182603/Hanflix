import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let mockHandler: ((req: { model: string; contents: string }) => Promise<{ text: string }>) | undefined;

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: async (req: { model: string; contents: string }) => {
          if (!mockHandler) throw new Error('no mock handler');
          return mockHandler(req);
        },
      };
    },
  };
});

// Important: import env AFTER the mock so the lazy GEMINI_API_KEY parse succeeds.
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'mock-improve-key';
  process.env.GEMINI_TRANSLATION_IMPROVE_ENABLED = 'true';
  process.env.GEMINI_TRANSLATION_BATCH_SIZE = '2';
});

import { improveVietnameseBatch, improveVietnameseTranslations } from './gemini-translation-improver.js';

const sampleCues = [
  { cueId: 'c1', zh: '我是佩奇', vi: 'Ta là Peiqi.' },
  { cueId: 'c2', zh: '这是我的弟弟乔治', vi: 'Đây là anh trai tôi, George.' },
  { cueId: 'c3', zh: '我喜欢吃苹果', vi: 'Ta thích ăn táo.' },
  { cueId: 'c4', zh: '明天我们去北京', vi: 'Ngày mai chúng ta đi Bắc Kinh.' },
];

beforeEach(() => {
  mockHandler = undefined;
});

afterEach(() => {
  mockHandler = undefined;
});

describe('improveVietnameseBatch', () => {
  it('parses a clean JSON response and preserves cueId order', async () => {
    mockHandler = async () => ({
      text: JSON.stringify({
        items: [
          { cueId: 'c1', vi: 'Tôi là Peppa.' },
          { cueId: 'c2', vi: 'Đây là em trai tôi, George.' }, // Azure said "anh trai" → fixed
          { cueId: 'c3', vi: 'Tôi thích ăn táo.' },
          { cueId: 'c4', vi: 'Ngày mai chúng ta sẽ đi Bắc Kinh.' },
        ],
      }),
    });
    const result = await improveVietnameseBatch(sampleCues);
    expect(result).toHaveLength(4);
    expect(result[1]?.vi).toContain('em trai');
    expect(result[1]?.vi).not.toContain('anh trai');
  });

  it('strips ```json fences before parsing', async () => {
    mockHandler = async () => ({
      text: '```json\n{"items":[{"cueId":"c1","vi":"Tôi là Peppa."}]}\n```',
    });
    const result = await improveVietnameseBatch([sampleCues[0]!]);
    expect(result[0]?.vi).toBe('Tôi là Peppa.');
  });

  it('falls back to Azure for missing / empty / invalid entries inside a valid batch', async () => {
    mockHandler = async () => ({
      text: JSON.stringify({
        items: [
          { cueId: 'c1', vi: 'Tôi là Peppa.' },
          { cueId: 12, vi: 'wrong cueId type' },          // ignored
          { cueId: 'c3', vi: '' },                          // empty → ignore
          { cueId: 'c4', vi: 'Tốt.' },
        ],
      }),
    });
    const result = await improveVietnameseBatch(sampleCues);
    // Valid items kept, invalid items fall back to the Azure .vi.
    expect(result).toHaveLength(4);
    expect(result.map(r => r.cueId)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(result.find(r => r.cueId === 'c1')?.vi).toBe('Tôi là Peppa.');
    expect(result.find(r => r.cueId === 'c4')?.vi).toBe('Tốt.');
    expect(result.find(r => r.cueId === 'c2')?.vi).toBe(sampleCues[1]!.vi);
    expect(result.find(r => r.cueId === 'c3')?.vi).toBe(sampleCues[2]!.vi);
  });

  it('falls back to Azure output when response JSON is malformed', async () => {
    mockHandler = async () => ({ text: 'not a JSON string' });
    const result = await improveVietnameseBatch(sampleCues.slice(0, 2));
    expect(result[0]?.vi).toBe('Ta là Peiqi.');
    expect(result[1]?.vi).toBe('Đây là anh trai tôi, George.');
  });

  it('returns empty array on empty input', async () => {
    const result = await improveVietnameseBatch([]);
    expect(result).toEqual([]);
  });
});

describe('improveVietnameseTranslations (batched)', () => {
  it('processes all cues and produces a map keyed by cueId', async () => {
    mockHandler = async ({ contents }) => {
      // Echo a rewrite that respects the cueId written in each line.
      const ids = [...contents.matchAll(/\[(c\d)\]/g)].map(m => m[1]!);
      return {
        text: JSON.stringify({
          items: ids.map(id => ({ cueId: id, vi: `Bản Việt tự nhiên cho ${id}.` })),
        }),
      };
    };
    const map = await improveVietnameseTranslations(sampleCues);
    expect(map.size).toBe(4);
    expect(map.get('c2')).toBe('Bản Việt tự nhiên cho c2.');
    expect(map.get('c4')).toBe('Bản Việt tự nhiên cho c4.');
  });

  it('seeds map with Azure output so fallback is graceful', async () => {
    mockHandler = async () => { throw new Error('boom'); };
    const map = await improveVietnameseTranslations(sampleCues);
    expect(map.get('c1')).toBe('Ta là Peiqi.');
    expect(map.get('c2')).toBe('Đây là anh trai tôi, George.');
  });

  it('returns Azure-seeded map when Gemini is disabled via env', async () => {
    const original = process.env.GEMINI_TRANSLATION_IMPROVE_ENABLED;
    process.env.GEMINI_TRANSLATION_IMPROVE_ENABLED = 'false';
    // Re-import the module so env takes effect. Vitest config has isolate=true
    // by default, so we instead reach into the running instance by toggling
    // state through env on next call (the read happens per call).
    try {
      const map = await improveVietnameseTranslations(sampleCues);
      // When disabled, every entry must be a verbatim copy of the input .vi.
      for (const cue of sampleCues) {
        expect(map.get(cue.cueId)).toBe(cue.vi);
      }
    } finally {
      process.env.GEMINI_TRANSLATION_IMPROVE_ENABLED = original;
    }
  });
});

it('retries truncated JSON and reserves enough tokens for UUIDs and Vietnamese output', async () => {
  let attempts = 0;
  mockHandler = async (request) => {
    expect((request as unknown as { config: { maxOutputTokens: number } }).config.maxOutputTokens).toBeGreaterThanOrEqual(2048);
    attempts++;
    if (attempts === 1) return { text: '{"items":[' };
    return { text: JSON.stringify({items:[{cueId:'c1',vi:'Mình là Peppa.'}]}) };
  };
  expect(await improveVietnameseBatch([sampleCues[0]!])).toEqual([{cueId:'c1',vi:'Mình là Peppa.'}]);
  expect(attempts).toBe(2);
});
