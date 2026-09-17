import { describe, expect, it } from 'vitest';
import { enumerateUtcDateKeys, parseUtcDateKey, toUtcDateKey } from './study-activity.js';

describe('study activity UTC date helpers', () => {
  it('normalizes dates and enumerates an inclusive range', () => {
    expect(toUtcDateKey(new Date('2026-09-17T23:59:59Z'))).toBe('2026-09-17');
    expect(enumerateUtcDateKeys('2026-09-16', '2026-09-18')).toEqual([
      '2026-09-16', '2026-09-17', '2026-09-18',
    ]);
  });

  it('rejects impossible dates and reversed ranges', () => {
    expect(() => parseUtcDateKey('2026-02-30')).toThrow();
    expect(() => enumerateUtcDateKeys('2026-09-18', '2026-09-17')).toThrow();
  });
});
