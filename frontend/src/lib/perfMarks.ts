/**
 * Lightweight performance marks for HanFlix.
 *
 * Why a custom module instead of `performance.measure`?
 *   - We need to surface a stable set of named marks (e.g. for analytics or
 *     dashboards) and group them by user-visible flow.
 *   - We never want to leak sensitive data (no token, no signed URL, no
 *     full lesson payload) — only durations and milestones.
 *   - We want the module to be safely no-op'd in browsers without
 *     `performance.mark`/`PerformanceObserver` (Safari ITP, restricted
 *     contexts).
 *
 * Marks emitted (kept stable for dashboards):
 *   - `restore_session:start`     — first paint when AuthGate is mounted
 *   - `restore_session:ready`     — `/auth/me` resolved (or rejected and we
 *                                    cleared the cached user)
 *   - `feed_list:ready`           — first lesson list / dashboard payload is
 *                                    available in the React tree
 *   - `thumbnail:first`           — first lesson thumbnail fully loaded
 *   - `watch_open:start`          — user clicked a lesson
 *   - `lesson_media:ready`        — backend returned the lesson + media URL
 *   - `metadata:ready`            — `<video>.loadedmetadata` fired
 *   - `first_frame:rendered`      — `requestVideoFrameCallback` callback ran
 *                                    (falls back to `playing` event — flagged
 *                                    in the mark as `approx: true`)
 *   - `buffering:start`           — `waiting` event
 *   - `buffering:end`             — `canplay`/`playing` after a wait
 */

type MarkMap = Record<string, number>;

const marks: MarkMap = {};
const customTimes: Array<Record<string, unknown>> = [];

function safePerformance(): Performance | null {
  if (typeof performance === 'undefined') return null;
  return performance;
}

function emit(name: string, detail?: Record<string, unknown>) {
  const perf = safePerformance();
  if (!perf) return;
  try {
    perf.mark(name);
    if (typeof detail === 'object' && detail !== null) {
      customTimes.push({ name, time: Date.now(), ...detail });
    } else {
      customTimes.push({ name, time: Date.now() });
    }
  } catch {
    /* ignore — Performance.mark throws on invalid name in some browsers */
  }
}

function diff(startName: string, endName: string): number | null {
  const start = marks[startName];
  const end = marks[endName];
  if (start === undefined || end === undefined) return null;
  return end - start;
}

export const perfMarks = {
  mark(name: string, detail?: Record<string, unknown>) {
    marks[name] = typeof performance !== 'undefined' ? performance.now() : Date.now();
    emit(name, detail);
  },
  /** Records a milestone + returns the millisecond offset from `anchor`. */
  since(name: string, anchor: string, detail?: Record<string, unknown>): number | null {
    const anchorTs = marks[anchor];
    if (anchorTs === undefined) {
      // Anchor not yet recorded — try again on the next tick
      this.mark(name, detail);
      return null;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    marks[name] = now;
    const elapsed = now - anchorTs;
    emit(name, { ...(detail ?? {}), elapsed });
    return elapsed;
  },
  /** Difference between two recorded marks. Returns null when either side is missing. */
  measure(startName: string, endName: string): number | null {
    return diff(startName, endName);
  },
  /** Read the current snapshot; never throws. */
  snapshot(): { marks: MarkMap; trace: ReadonlyArray<Record<string, unknown>> } {
    return { marks: { ...marks }, trace: customTimes.slice(-50) };
  },
  /** Reset all marks. Used in tests; do not call from product code. */
  __reset(): void {
    for (const key of Object.keys(marks)) delete marks[key];
    customTimes.length = 0;
  },
};

export type PerfMarks = typeof perfMarks;
