import { describe, expect, it } from 'vitest';
import { summarizeStreak } from './streak.js';

describe('server streak calendar', () => {
  const now = new Date('2026-09-26T05:00:00Z');
  it('starts at zero with an empty calendar', () => {
    const result = summarizeStreak([], now);
    expect(result.streakCount).toBe(0);
    expect(result.weekDays.map(d => d.date)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
    expect(result.weekDays.every(d => !d.completed)).toBe(true);
  });
  it('deduplicates activities and ignores invalid/future dates', () => {
    const result = summarizeStreak(['2026-09-25', '2026-09-26', '2026-09-26', '2026-02-30', '2027-01-01'], now);
    expect(result.streakCount).toBe(2);
    expect(result.activeDays).toBe(2);
    expect(result.isCompletedToday).toBe(true);
  });
  it('preserves yesterday streak until the end of today', () => {
    const result = summarizeStreak(['2026-09-24', '2026-09-25'], now);
    expect(result.streakCount).toBe(2);
    expect(result.isCompletedToday).toBe(false);
    expect(result.weekDays.filter(d => d.completed).map(d => d.date)).toEqual(['2026-09-24', '2026-09-25']);
  });
  it('resets after a missed day but preserves longest and earned days', () => {
    const dates = ['2026-09-21', '2026-09-22', '2026-09-23'];
    expect(summarizeStreak(dates, now)).toMatchObject({ streakCount: 0, longestStreak: 3, activeDays: 3 });
    expect(summarizeStreak([...dates, '2026-09-26'], now)).toMatchObject({ streakCount: 1, longestStreak: 3, activeDays: 4 });
  });
  it('crosses Vietnam midnight and year boundaries correctly', () => {
    expect(summarizeStreak(['2025-12-30', '2025-12-31', '2026-01-01'], new Date('2025-12-31T17:00:00Z')))
      .toMatchObject({ today: '2026-01-01', streakCount: 3, isCompletedToday: true });
    expect(summarizeStreak(['2026-09-25'], new Date('2026-09-26T17:00:00Z')).streakCount).toBe(0);
  });
  it('supports leap days', () => {
    expect(summarizeStreak(['2024-02-28', '2024-02-29', '2024-03-01'], new Date('2024-03-01T05:00:00Z')).streakCount).toBe(3);
  });
});
