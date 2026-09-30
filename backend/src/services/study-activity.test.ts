import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { StudyActivityModel } from '../models/study-activity.model.js';
import { UserModel } from '../models/user.model.js';
import {
  DEFAULT_TIMEZONE,
  enumerateDateKeys,
  enumerateUtcDateKeys,
  parseDateKey,
  parseUtcDateKey,
  toTimezoneDateKey,
  toUtcDateKey,
  recordStudyActivity,
} from './study-activity.js';

describe('study activity date helpers', () => {
  it('normalizes dates and enumerates an inclusive range', () => {
    expect(toUtcDateKey(new Date('2026-09-17T23:59:59Z'))).toBe('2026-09-17');
    expect(enumerateUtcDateKeys('2026-09-16', '2026-09-18')).toEqual([
      '2026-09-16', '2026-09-17', '2026-09-18',
    ]);
  });

  it('formats dates according to Asia/Ho_Chi_Minh timezone', () => {
    // 18:00 UTC on 2026-09-17 is 01:00 on 2026-09-18 in Vietnam (+07:00)
    const lateNightUtc = new Date('2026-09-17T18:00:00Z');
    expect(toUtcDateKey(lateNightUtc)).toBe('2026-09-17');
    expect(toTimezoneDateKey(lateNightUtc, DEFAULT_TIMEZONE)).toBe('2026-09-18');
  });

  it('rejects impossible dates and reversed ranges', () => {
    expect(() => parseUtcDateKey('2026-02-30')).toThrow();
    expect(() => parseDateKey('2026-02-30')).toThrow();
    expect(() => enumerateUtcDateKeys('2026-09-18', '2026-09-17')).toThrow();
    expect(() => enumerateDateKeys('2026-09-18', '2026-09-17')).toThrow();
  });
});

describe('recording a study day', () => {
  afterEach(() => vi.restoreAllMocks());
  it('recovers a first-write race without dropping the activity or doubling XP', async () => {
    const saved = { activeStudySeconds: 15 };
    const write = vi.spyOn(StudyActivityModel, 'findOneAndUpdate')
      .mockRejectedValueOnce({ code: 11000 }).mockResolvedValueOnce(saved as never);
    const xp = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);
    const userId = new Types.ObjectId();
    expect(await recordStudyActivity(userId, { vocabReviews: 1, xpEarned: 5 }, new Date('2026-09-26T17:00:00Z'))).toBe(saved);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]).toEqual([
      { userId, dateKey: '2026-09-27' },
      { $inc: { vocabReviews: 1, xpEarned: 5 }, $setOnInsert: { userId, dateKey: '2026-09-27' } },
      { returnDocument: 'after' },
    ]);
    expect(xp).toHaveBeenCalledTimes(1);
  });
  it('surfaces storage failures and does not grant XP for a failed activity write', async () => {
    vi.spyOn(StudyActivityModel, 'findOneAndUpdate').mockRejectedValue(new Error('unavailable'));
    const xp = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);
    await expect(recordStudyActivity(new Types.ObjectId(), { vocabReviews: 1, xpEarned: 5 })).rejects.toThrow('unavailable');
    expect(xp).not.toHaveBeenCalled();
  });
  it('does not create records for empty or non-finite increments', async () => {
    const write = vi.spyOn(StudyActivityModel, 'findOneAndUpdate');
    expect(await recordStudyActivity(new Types.ObjectId(), { activeStudySeconds: Infinity, xpEarned: NaN, vocabReviews: 0 })).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
});
