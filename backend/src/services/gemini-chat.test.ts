import { afterEach, expect, it, vi } from 'vitest';
const generate = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: generate }; } }));
import { answerLearningQuestion, normalizeAiError, isOffTopicQuestion } from './gemini.js';
import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
it('sends evidence and conversation as data with a structured output schema', async () => {
  generate.mockResolvedValue({ text: JSON.stringify({ answerVi: 'Giải thích câu thật.', citationCueIds: ['c1'] }) });
  const lesson = { lessonId: 'lesson', subtitleRevision: 2, title: 'Bài', hsk: 2, playbackMs: 1000,
    scope: 'current_cue' as const, status: 'ready' as const, coverage: 'window' as const,
    cues: [{ cueId: 'c1', startMs: 0, endMs: 2000, zh: '吃过饭', pinyin: 'chīguo fàn', vi: 'Đã ăn cơm' }] };
  const history = [{ question: 'Nghĩa là gì?', answerVi: 'Đã ăn cơm.', citations: lesson.cues }];
  await answerLearningQuestion({ question: 'Giải thích thêm', profile: { currentHsk: 2 }, lesson, history });
  const call = generate.mock.calls[0]![0];
  expect(JSON.parse(call.contents)).toMatchObject({ evidence: lesson, history });
  expect(call.config.responseJsonSchema.required).toContain('citationCueIds');
  expect(call.config.systemInstruction).toContain('Không đoán nội dung từ tiêu đề');
});
it('rejects text or invalid structured replies instead of treating them as success', async () => {
  generate.mockResolvedValue({ text: '{"answerVi":"không có trường nguồn"}' });
  await expect(answerLearningQuestion({ question: 'test', profile: {} })).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
});
it('aborts the provider client on timeout and retains the timeout error code', async () => {
  vi.useFakeTimers();
  generate.mockImplementation(({ config }) => new Promise((_resolve, reject) => {
    config.abortSignal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const pending = answerLearningQuestion({ question: 'test', profile: {} });
  const assertion = expect(pending).rejects.toMatchObject({ code: 'AI_TIMEOUT', statusCode: 504 });
  await vi.advanceTimersByTimeAsync(env.GEMINI_TIMEOUT_MS + 1);
  await assertion;
  expect(generate.mock.calls[0]![0].config.abortSignal.aborted).toBe(true);
  expect(normalizeAiError(new AppError(504, 'AI_TIMEOUT', 'Gemini timeout')).code).toBe('AI_TIMEOUT');
});
it('does not send a request after cancellation', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(answerLearningQuestion({ question: 'test', profile: {}, signal: controller.signal })).rejects.toMatchObject({ code: 'AI_CANCELLED' });
  expect(generate).not.toHaveBeenCalled();
});
it('allows language questions about subject vocabulary', () => {
  expect(isOffTopicQuestion('Từ bác sĩ trong câu này nghĩa là gì?').blocked).toBe(false);
  expect(isOffTopicQuestion('Dịch từ Python sang tiếng Trung').blocked).toBe(false);
});
