import { describe, expect, it } from 'vitest';
import { mergeWatchedRanges, watchedCoverage } from './watched-ranges.js';

describe('watched ranges', () => {
  it('merges overlapping playback ranges', () => {
    expect(mergeWatchedRanges([{ start: 0, end: 10 }, { start: 8, end: 20 }])).toEqual([{ start: 0, end: 20 }]);
  });

  it('does not treat seeking to the end as watched coverage', () => {
    expect(watchedCoverage([{ start: 95, end: 100 }], 100)).toBe(0.05);
  });

  it('caps ranges at lesson duration', () => {
    expect(watchedCoverage([{ start: 0, end: 130 }], 100)).toBe(1);
  });
});
