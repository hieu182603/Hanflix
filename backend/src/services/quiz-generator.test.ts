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

// Import after mock so the module picks up the mocked client.
import { generateQuizWithGemini } from './quiz-generator.js';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'mock-quiz-key';
  process.env.GEMINI_TIMEOUT_MS = '1000';
});

afterEach(() => {
  mockHandler = undefined;
});

describe('generateQuizWithGemini', () => {
  const cues = [
    { cueId: 'cue-1', startMs: 0, endMs: 2000, zh: '你好,我叫小明。', pinyin: 'nǐ hǎo, wǒ jiào Xiǎo Míng.', vi: 'Xin chào, tôi tên là Tiểu Minh.' },
    { cueId: 'cue-2', startMs: 2000, endMs: 5000, zh: '我每天八点去学校。', pinyin: 'wǒ měi tiān bā diǎn qù xué xiào.', vi: 'Mỗi ngày tôi đi học lúc 8 giờ.' },
  ];

  it('returns parsed and validated questions', async () => {
    mockHandler = async () => ({
      text: JSON.stringify({
        questions: [
          {
            questionId: 'ai-q-1',
            type: 'multiple_choice',
            prompt: 'Nhân vật trong video tên là gì?',
            cueId: 'cue-1',
            options: [
              { optionId: 'a', text: 'Tiểu Minh' },
              { optionId: 'b', text: 'Tiểu Hoa' },
              { optionId: 'c', text: 'Tiểu Lâm' },
              { optionId: 'd', text: 'Tiểu Vũ' },
            ],
            correctOptionId: 'a',
            explanationVi: 'Nhân vật tự giới thiệu tên Tiểu Minh.',
          },
          {
            questionId: 'ai-q-2',
            type: 'fill_blank',
            prompt: '我每天___八点去学校。',
            cueId: 'cue-2',
            acceptedAnswers: ['都'],
            explanationVi: '都 dùng nhấn mạnh thói quen hằng ngày.',
          },
        ],
      }),
    });

    const questions = await generateQuizWithGemini({
      hsk: 2,
      kinds: ['comprehension', 'cloze'],
      questionCount: 2,
      cues,
      lessonTitleVi: 'Giới thiệu bản thân',
    });

    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      type: 'multiple_choice',
      correctOptionId: 'a',
      cueId: 'cue-1',
    });
    expect(questions[1]).toMatchObject({
      type: 'fill_blank',
      acceptedAnswers: ['都'],
      cueId: 'cue-2',
    });
  });

  it('drops questions whose cueId does not exist in cues', async () => {
    mockHandler = async () => ({
      text: JSON.stringify({
        questions: [
          {
            questionId: 'ai-q-orphan',
            type: 'multiple_choice',
            prompt: 'Câu hỏi không hợp lệ',
            cueId: 'cue-not-exist',
            options: [
              { optionId: 'a', text: 'A' },
              { optionId: 'b', text: 'B' },
              { optionId: 'c', text: 'C' },
              { optionId: 'd', text: 'D' },
            ],
            correctOptionId: 'a',
            explanationVi: 'Đáp án A giải thích nội dung được nhắc đến trong câu thoại.',
          },
        ],
      }),
    });

    const questions = await generateQuizWithGemini({
      hsk: 1,
      kinds: ['comprehension'],
      questionCount: 1,
      cues,
    });

    expect(questions).toHaveLength(1);
    expect(questions[0]?.cueId).toBeUndefined();
  });

  it('drops questions missing required fields per type', async () => {
    mockHandler = async () => ({
      text: JSON.stringify({
        questions: [
          {
            questionId: 'bad-mc',
            type: 'multiple_choice',
            prompt: 'Câu hỏi thiếu correctOptionId',
            options: [{ optionId: 'a', text: 'A' }],
          },
          {
            questionId: 'bad-fill',
            type: 'fill_blank',
            prompt: 'Câu điền từ không có đáp án',
          },
        ],
      }),
    });

    const questions = await generateQuizWithGemini({
      hsk: 1,
      kinds: ['comprehension', 'cloze'],
      questionCount: 2,
      cues,
    });

    expect(questions).toHaveLength(0);
  });

  it('throws when no kinds are requested', async () => {
    await expect(
      generateQuizWithGemini({
        hsk: 1,
        kinds: [],
        questionCount: 1,
        cues,
      }),
    ).rejects.toThrow();
  });

  it('throws when question count is out of range', async () => {
    await expect(
      generateQuizWithGemini({
        hsk: 1,
        kinds: ['comprehension'],
        questionCount: 0,
        cues,
      }),
    ).rejects.toThrow();
    await expect(
      generateQuizWithGemini({
        hsk: 1,
        kinds: ['comprehension'],
        questionCount: 20,
        cues,
      }),
    ).rejects.toThrow();
  });
});
