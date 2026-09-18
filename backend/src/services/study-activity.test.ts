import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMEZONE,
  enumerateDateKeys,
  enumerateUtcDateKeys,
  parseDateKey,
  parseUtcDateKey,
  toTimezoneDateKey,
  toUtcDateKey,
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
