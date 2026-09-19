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

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'mock-tips-key';
});

import { generateLearningTips } from './gemini-learning-tips.js';

const sampleInput = {
  lessonTitleVi: 'Gia đình nhỏ của Peppa',
  hsk: 3,
  cues: [
    { cueId: 'c1', zh: '我是佩奇', vi: 'Tôi là Peppa.' },
    { cueId: 'c2', zh: '这是我的弟弟乔治', vi: 'Đây là em trai tôi, George.' },
    { cueId: 'c3', zh: '我喜欢吃苹果', vi: 'Tôi thích ăn táo.' },
  ],
} as const;

beforeEach(() => {
  mockHandler = undefined;
});

afterEach(() => {
  mockHandler = undefined;
});

describe('generateLearningTips', () => {
  it('parses JSON with 2 tips and 4 drill words', async () => {
    mockHandler = async () => ({
      text: JSON.stringify({
        tips: [
          { title: 'Shadow theo Peppa', detail: 'Bật phụ đề, tắt phụ đề, nói theo bằng giọng Peppa trong 30 giây.' },
          { title: 'Ghi chú 弟弟', detail: '弟弟 = em trai. Đừng nhầm sang 哥哥 (anh trai).', cueId: 'c2' },
        ],
        drillWords: ['佩奇', '弟弟', '苹果', '喜欢'],
      }),
    });
    const result = await generateLearningTips(sampleInput);
    expect(result.tips).toHaveLength(2);
    expect(result.tips[0]?.title).toBe('Shadow theo Peppa');
    expect(result.tips[1]?.cueId).toBe('c2');
    expect(result.drillWords).toEqual(['佩奇', '弟弟', '苹果', '喜欢']);
  });

  it('strips code fences before parsing', async () => {
    mockHandler = async () => ({
      text: '```json\n{"tips":[{"title":"T","detail":"D"}],"drillWords":["x"]}\n```',
    });
    const result = await generateLearningTips(sampleInput);
    expect(result.tips[0]?.title).toBe('T');
    expect(result.drillWords[0]).toBe('x');
  });

  it('caps tips at 3 and drillWords at 8', async () => {
    mockHandler = async () => ({
      text: JSON.stringify({
        tips: Array.from({ length: 10 }, (_, i) => ({ title: `T${i}`, detail: `D${i}` })),
        drillWords: Array.from({ length: 20 }, (_, i) => `w${i}`),
      }),
    });
    const result = await generateLearningTips(sampleInput);
    expect(result.tips.length).toBeLessThanOrEqual(3);
    expect(result.drillWords.length).toBeLessThanOrEqual(8);
  });

  it('returns empty result when Gemini fails', async () => {
    mockHandler = async () => { throw new Error('quota exceeded'); };
    const result = await generateLearningTips(sampleInput);
    expect(result.tips).toEqual([]);
    expect(result.drillWords).toEqual([]);
  });

  it('returns empty result when JSON parse fails', async () => {
    mockHandler = async () => ({ text: 'not valid json' });
    const result = await generateLearningTips(sampleInput);
    expect(result.tips).toEqual([]);
    expect(result.drillWords).toEqual([]);
  });
});
