export type WatchedRange = { start: number; end: number };

export function mergeWatchedRanges(ranges: WatchedRange[], next?: WatchedRange): WatchedRange[] {
  const normalized = [...ranges, ...(next ? [next] : [])]
    .filter(range => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .map(range => ({ start: Math.max(0, range.start), end: Math.max(0, range.end) }))
    .sort((a, b) => a.start - b.start);

  const merged: WatchedRange[] = [];
  for (const range of normalized) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end + 0.5) {
      merged.push({ ...range });
    } else {
      previous.end = Math.max(previous.end, range.end);
    }
  }
  return merged;
}

export function watchedCoverage(ranges: WatchedRange[], durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  const watchedSeconds = mergeWatchedRanges(ranges).reduce((total, range) => {
    const clampedStart = Math.min(durationSeconds, range.start);
    const clampedEnd = Math.min(durationSeconds, range.end);
    return total + Math.max(0, clampedEnd - clampedStart);
  }, 0);
  return Math.min(1, watchedSeconds / durationSeconds);
}
