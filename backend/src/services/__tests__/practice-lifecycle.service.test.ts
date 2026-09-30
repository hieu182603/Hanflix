import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const { attemptModelMock, setModelMock } = vi.hoisted(() => ({
  attemptModelMock: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
  },
  setModelMock: { findOne: vi.fn() },
}));

vi.mock('../../models/practice.model.js', () => ({
  PracticeAttemptModel: attemptModelMock,
  PracticeSetModel: setModelMock,
}));

import { savePractice, submitPractice } from '../practice.service.js';

const userId = new Types.ObjectId().toString();
const attemptId = new Types.ObjectId().toString();
const setId = new Types.ObjectId();
const questions = [{
  id: 'q1', type: 'choice' as const, prompt: 'Chọn đáp án',
  options: [{ id: 'a', text: 'Đúng' }, { id: 'b', text: 'Sai' }],
  correctOptionId: 'a', acceptedAnswers: [], explanation: 'Đáp án A.',
}];

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    _id: attemptId, userId, setId, title: 'Bài luyện', hsk: 1, skill: 'vocabulary',
    status: 'in_progress', version: 2, startedAt: new Date(Date.now() - 10_000),
    expiresAt: new Date(Date.now() + 60_000), answers: {}, flagged: [], questions,
    rewardXp: 0, ...overrides,
  };
}

const leanResult = (value: unknown) => ({ lean: vi.fn().mockResolvedValue(value) });

describe('practice attempt lifecycle', () => {
  beforeEach(() => {
    attemptModelMock.findOne.mockReset();
    attemptModelMock.findOneAndUpdate.mockReset();
  });

  it('uses ownership, version and active deadline in the save condition', async () => {
    attemptModelMock.findOne.mockReturnValueOnce(leanResult(attempt()));
    attemptModelMock.findOneAndUpdate.mockReturnValueOnce(leanResult(attempt({ version: 3, answers: { q1: 'a' }})));

    await savePractice(userId, attemptId, { version: 2, answers: { q1: 'a' }, flagged: [] });

    expect(attemptModelMock.findOne).toHaveBeenCalledWith({ _id: attemptId, userId });
    expect(attemptModelMock.findOneAndUpdate.mock.calls[0]?.[0]).toMatchObject({
      _id: attemptId, userId, status: 'in_progress', version: 2,
      expiresAt: { $gt: expect.any(Date) },
    });
  });

  it('rejects a stale save when the compare-and-set update loses', async () => {
    attemptModelMock.findOne.mockReturnValueOnce(leanResult(attempt()));
    attemptModelMock.findOneAndUpdate.mockReturnValueOnce(leanResult(null));

    await expect(savePractice(userId, attemptId, { version: 2, answers: {}, flagged: [] }))
      .rejects.toMatchObject({ statusCode: 409, code: 'ATTEMPT_CHANGED' });
  });

  it('grades saved answers after the server deadline and ignores late input', async () => {
    const expired = attempt({ expiresAt: new Date(Date.now() - 1_000), answers: { q1: 'a' } });
    attemptModelMock.findOne.mockReturnValueOnce(leanResult(expired));
    attemptModelMock.findOneAndUpdate.mockReturnValueOnce(leanResult(attempt({
      status: 'submitted', version: 3, answers: { q1: 'a' }, score: 100,
      correctCount: 1, rewardXp: 25, submittedAt: new Date(),
    })));

    const result = await submitPractice(userId, attemptId, { version: 2, answers: { q1: 'b' }, flagged: ['q1'] });

    expect(result.score).toBe(100);
    expect(attemptModelMock.findOneAndUpdate.mock.calls[0]?.[1].$set.answers).toEqual({ q1: 'a' });
  });

  it('returns an existing submitted result without writing or rewarding again', async () => {
    attemptModelMock.findOne.mockReturnValueOnce(leanResult(attempt({
      status: 'submitted', version: 3, answers: { q1: 'a' }, score: 100,
      correctCount: 1, rewardXp: 25, submittedAt: new Date(),
    })));

    const result = await submitPractice(userId, attemptId);

    expect(result).toMatchObject({ status: 'submitted', score: 100, rewardXp: 25 });
    expect(attemptModelMock.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it.each(['', '   ', '\n\t'])('does not persist a blank answer (%j) as streak activity', async (blank) => {
    const original = attempt({ questions: [{ ...questions[0], type: 'short_answer', acceptedAnswers: ['test'] }] });
    attemptModelMock.findOne.mockReturnValueOnce(leanResult(original));
    attemptModelMock.findOneAndUpdate.mockImplementation((_filter, update) => leanResult({ ...original, ...update.$set }));
    const result = await submitPractice(userId, attemptId, { version: 2, answers: { q1: blank }, flagged: [] });
    expect(result).toMatchObject({ status: 'submitted', answers: {}, rewardXp: 0 });
  });
  it('keeps a wrong answer as learning activity even when no XP is earned', async () => {
    const original = attempt();
    attemptModelMock.findOne.mockReturnValueOnce(leanResult(original));
    attemptModelMock.findOneAndUpdate.mockImplementation((_filter, update) => leanResult({ ...original, ...update.$set }));
    const result = await submitPractice(userId, attemptId, { version: 2, answers: { q1: 'b' }, flagged: [] });
    expect(result).toMatchObject({ status: 'submitted', answers: { q1: 'b' }, score: 0, rewardXp: 0 });
  });
});
