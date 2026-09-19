import { describe, expect, it } from 'vitest';
import { perfMarks } from '../perfMarks';

describe('perfMarks', () => {
  it('records marks and computes deltas via since()', () => {
    perfMarks.__reset();
    perfMarks.mark('anchor:start');
    const elapsed = perfMarks.since('after:done', 'anchor:start');
    expect(elapsed).toBeTypeOf('number');
    expect(elapsed!).toBeGreaterThanOrEqual(0);
    const measure = perfMarks.measure('anchor:start', 'after:done');
    expect(measure).toBeTypeOf('number');
  });

  it('returns null when anchor is missing', () => {
    perfMarks.__reset();
    const elapsed = perfMarks.since('orphan', 'never-anchored');
    expect(elapsed).toBeNull();
  });

  it('snapshot() never throws and returns a stable shape', () => {
    perfMarks.__reset();
    const snap = perfMarks.snapshot();
    expect(snap).toHaveProperty('marks');
    expect(snap).toHaveProperty('trace');
    expect(typeof snap.marks).toBe('object');
    expect(Array.isArray(snap.trace)).toBe(true);
  });
});
