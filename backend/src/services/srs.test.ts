import { describe, expect, it } from 'vitest';
import { scheduleReview } from './srs.js';

const start = new Date('2026-09-17T00:00:00.000Z');

describe('SRS scheduler', () => {
  it('schedules again shortly without counting a successful repetition', () => {
    const result = scheduleReview({ repetitions: 3, intervalDays: 8, easeFactor: 2.5 }, 'again', start);
    expect(result.repetitions).toBe(0);
    expect(result.nextReviewAt.getTime() - start.getTime()).toBe(10 * 60 * 1000);
  });

  it('increases the interval after a good review', () => {
    const result = scheduleReview({ repetitions: 2, intervalDays: 3, easeFactor: 2.5 }, 'good', start);
    expect(result.repetitions).toBe(3);
    expect(result.intervalDays).toBeGreaterThan(3);
  });

  it('never lowers ease below 1.3', () => {
    const result = scheduleReview({ repetitions: 0, intervalDays: 0, easeFactor: 1.3 }, 'again', start);
    expect(result.easeFactor).toBe(1.3);
  });
});
