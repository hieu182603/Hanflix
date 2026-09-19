import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

import { computeQuestionCountForHsk, resolveQuestionCount } from './auto-quiz-generator.js';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'mock-quiz-key';
});

afterEach(() => {
  mockHandler = undefined;
});

describe('computeQuestionCountForHsk', () => {
  it('returns 3 for HSK 1 and HSK 2', () => {
    expect(computeQuestionCountForHsk(1)).toBe(3);
    expect(computeQuestionCountForHsk(2)).toBe(3);
  });

  it('returns 5 for HSK 3 and HSK 4', () => {
    expect(computeQuestionCountForHsk(3)).toBe(5);
    expect(computeQuestionCountForHsk(4)).toBe(5);
  });

  it('returns 6 for HSK 5 and HSK 6', () => {
    expect(computeQuestionCountForHsk(5)).toBe(6);
    expect(computeQuestionCountForHsk(6)).toBe(6);
  });

  it('returns 7 for HSK 7, 8, and 9', () => {
    expect(computeQuestionCountForHsk(7)).toBe(7);
    expect(computeQuestionCountForHsk(8)).toBe(7);
    expect(computeQuestionCountForHsk(9)).toBe(7);
  });

  it('falls back to 5 for out-of-range or invalid HSK', () => {
    expect(computeQuestionCountForHsk(0)).toBe(5);
    expect(computeQuestionCountForHsk(10)).toBe(5);
    expect(computeQuestionCountForHsk(-1)).toBe(5);
    expect(computeQuestionCountForHsk(NaN)).toBe(5);
  });
});

describe('resolveQuestionCount (override-aware)', () => {
  it('respects a per-lesson override within [1, 15]', () => {
    expect(resolveQuestionCount(1, 8)).toBe(8);
    expect(resolveQuestionCount(7, 12)).toBe(12);
    expect(resolveQuestionCount(4, 1)).toBe(1);
  });

  it('clamps very large overrides to 15', () => {
    expect(resolveQuestionCount(4, 100)).toBe(15);
    expect(resolveQuestionCount(4, 16)).toBe(15);
  });

  it('falls back to HSK heuristic when override is missing / zero / NaN', () => {
    expect(resolveQuestionCount(2, undefined)).toBe(3);
    expect(resolveQuestionCount(4, null)).toBe(5);
    expect(resolveQuestionCount(6, 0)).toBe(6); // 0 is invalid override → HSK wins
    expect(resolveQuestionCount(8, NaN)).toBe(7);
  });
});
