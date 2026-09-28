import { describe, expect, it } from 'vitest';
import { gradePractice, normalizePracticeAnswer, practiceAttemptDto, practiceSetInput } from '../practice.service.js';
import { PracticeSetModel } from '../../models/practice.model.js';
import { z } from 'zod';

const questions = [
  {
    id: 'choice-1', type: 'choice' as const, prompt: 'Chọn nghĩa đúng',
    options: [{ id: 'a', text: 'Xin chào' }, { id: 'b', text: 'Tạm biệt' }],
    correctOptionId: 'a', acceptedAnswers: [], explanation: '你好 nghĩa là xin chào.',
  },
  {
    id: 'short-1', type: 'short_answer' as const, prompt: 'Điền từ', options: [],
    acceptedAnswers: ['你 好'], explanation: 'Chấp nhận khoảng trắng Unicode chuẩn hóa.',
  },
];

describe('practice service', () => {
  it('normalizes Unicode, case and repeated whitespace before grading', () => {
    expect(normalizePracticeAnswer('  Ａ   B  ')).toBe('a b');
    expect(gradePractice(questions, { 'choice-1': 'a', 'short-1': '你   好' })).toMatchObject({ score: 100, correctCount: 2 });
  });

  it('does not expose answer keys before submission', () => {
    const dto = practiceAttemptDto({
      _id: 'attempt', setId: 'set', title: 'HSK 1', hsk: 1, skill: 'vocabulary',
      status: 'in_progress', version: 0, startedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
      answers: {}, flagged: [], questions, rewardXp: 0,
    });
    expect(dto.questions[0]).not.toHaveProperty('correctOptionId');
    expect(dto.questions[0]).not.toHaveProperty('acceptedAnswers');
    expect(dto.questions[0]).not.toHaveProperty('explanation');
  });

  it('reveals explanations and correctness only after submission', () => {
    const dto = practiceAttemptDto({
      _id: 'attempt', setId: 'set', title: 'HSK 1', hsk: 1, skill: 'vocabulary',
      status: 'submitted', version: 1, startedAt: new Date(), expiresAt: new Date(), submittedAt: new Date(),
      answers: { 'choice-1': 'a', 'short-1': 'sai' }, flagged: [], questions,
      score: 50, correctCount: 1, rewardXp: 10,
    });
    expect(dto.questions.map(q => q.correct)).toEqual([true, false]);
    expect(dto.questions[0]).toHaveProperty('correctOptionId', 'a');
    expect(dto).toMatchObject({ score: 50, rewardXp: 10 });
  });

  it('rejects published listening sets without HTTPS audio', () => {
    const result = practiceSetInput.safeParse({
      title: 'Luyện nghe', hsk: 1, skill: 'listening', status: 'published', durationSeconds: 60,
      questions: [{ ...questions[0], audioUrl: undefined }],
    });
    expect(result.success).toBe(false);
  });

  it('saves an incomplete listening draft through both API and database validation', async () => {
    const input = practiceSetInput.parse({ title: 'Bản nháp nghe', hsk: 1, skill: 'listening', status: 'draft', durationSeconds: 60,
      questions: [{ id: 'q1', type: 'choice', prompt: '', explanation: '', options: [{ id: 'a', text: '' }] }] });
    await expect(new PracticeSetModel(input).validate()).resolves.toBeUndefined();
    expect(practiceSetInput.safeParse({ ...input, status: 'published' }).success).toBe(false);
  });

  it('requires a complete answer and explanation when publishing or updating a draft', () => {
    const updateSchema = practiceSetInput.safeExtend({ revision: z.number().int().min(1) });
    const input = { title: 'Bản nháp viết', hsk: 1, skill: 'writing', status: 'draft', durationSeconds: 60, revision: 1,
      questions: [{ id: 'q1', type: 'short_answer', prompt: 'Điền từ', explanation: '', acceptedAnswers: [''] }] };
    expect(updateSchema.safeParse(input).success).toBe(true);
    expect(updateSchema.safeParse({ ...input, status: 'published' }).success).toBe(false);
    expect(updateSchema.safeParse({ ...input, status: 'published', questions: [{ ...input.questions[0], explanation: 'Lời giải', acceptedAnswers: ['你好'] }] }).success).toBe(true);
  });

  it('still rejects unsafe media, duplicate IDs and oversized drafts', () => {
    const input = { title: 'Bản nháp', hsk: 1, skill: 'listening', status: 'draft', durationSeconds: 60, questions: [questions[0]] };
    expect(practiceSetInput.safeParse({ ...input, questions: [{ ...questions[0], audioUrl: 'http://example.com/a.mp3' }] }).success).toBe(false);
    expect(practiceSetInput.safeParse({ ...input, questions: [questions[0], questions[0]] }).success).toBe(false);
    expect(practiceSetInput.safeParse({ ...input, questions: [{ ...questions[0], prompt: 'a'.repeat(5001) }] }).success).toBe(false);
    expect(practiceSetInput.safeParse({ ...input, status: 'published', skill: 'reading', questions: [{ ...questions[0], options: [{ id: 'a', text: '' }, { id: 'b', text: 'B' }] }] }).success).toBe(false);
  });
});
