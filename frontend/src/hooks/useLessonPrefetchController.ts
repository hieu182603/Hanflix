/**
 * Centralised hook for prefetching the next lesson into React Query.
 *
 * Why a single hook instead of a per-card prefetcher?
 *   - Per-card `useEffect` mounting would create a player per visible card on
 *     the initial paint, dragging TTFB and battery down on phones.
 *   - Centralising the work gives us a clean concurrency cap (1 active
 *     candidate) and lets us turn it off on slow links with a single feature
 *     flag check.
 *
 * Behaviour:
 *   - `acquire(target)` is called when a card signals intent (hover/focus).
 *   - If we are already loading another candidate, we drop the new one.
 *   - We never block the actual click-to-play path; prefetch only ever runs
 *     through `ensureQueryData`, which React Query will dedupe and which
 *     keeps the result in cache for the real click to hit.
 *   - `release(target)` is called when the user abandons the hover; React
 *     Query's GC will reclaim unused cache after `gcTime`.
 *
 * This module intentionally does NOT trigger playback, allocate `<video>`
 * elements, or write any progress. Those concerns live in the real
 * `<PublishedLessonView>` and `<YouTubePlayer>`.
 */

import { useCallback, useEffect, useRef } from 'react';
import { queryClient } from '../lib/queryClient';
import { lessonQueryKeys } from '../api/queryKeys';
import { getPublishedLesson, getPublishedSubtitles, getLessonProgress } from '../api/learning';

interface AcquireOptions {
  lessonId: string;
  /** Stable identifier of the requesting card; used for dedupe. */
  source: string;
}

interface PrefetchController {
  acquire: (options: AcquireOptions) => void;
  release: (source: string) => void;
  /** Returns true when one or more candidates are currently in flight. */
  busy: () => boolean;
  /** Flushes any teardown on unmount. */
  dispose: () => void;
}

const inFlight = new Map<string, AbortController>();
const acquiredBy = new Map<string, string>(); // source -> lessonId

export function useLessonPrefetchController(): PrefetchController {
  const subscribed = useRef(false);

  useEffect(() => {
    subscribed.current = true;
    return () => {
      // Intentionally do NOT abort in-flight requests here. The prefetch
      // state is module-level — multiple components share the same in-flight
      // map — so aborting on a single subscriber's unmount would yank a
      // download that another card (or the click handler waiting on it) still
      // needs. The owning page calls `dispose()` on route exit; per-source
      // cancellation happens via `release(source)` on `mouseleave`/`blur`.
      subscribed.current = false;
    };
  }, []);

  const acquire = useCallback(({ lessonId, source }: AcquireOptions) => {
    if (!subscribed.current) return;
    if (inFlight.has(source)) return;
    if (inFlight.size > 0) {
      // Hard cap = 1 active candidate. If another card is already loading,
      // remember this one as "intent" so a quick click still benefits from
      // the cache once it lands. We give up on this path though — the click
      // itself will use the cached data once another card finishes.
      return;
    }

    const controller = new AbortController();
    inFlight.set(source, controller);
    acquiredBy.set(source, lessonId);

    void (async () => {
      try {
        await Promise.all([
          queryClient.ensureQueryData({
            queryKey: lessonQueryKeys.lesson(lessonId),
            queryFn: () => getPublishedLesson(lessonId, { signal: controller.signal }).then((data) => data),
            staleTime: 5 * 60 * 1000,
          }),
          queryClient.ensureQueryData({
            queryKey: lessonQueryKeys.subtitles(lessonId),
            queryFn: () => getPublishedSubtitles(lessonId, { signal: controller.signal }).then((data) => data),
            staleTime: 10 * 60 * 1000,
          }),
          queryClient.ensureQueryData({
            queryKey: lessonQueryKeys.progress(lessonId),
            queryFn: () => getLessonProgress(lessonId, { signal: controller.signal }).then((data) => data),
            staleTime: 60 * 1000,
          }),
        ]);
      } catch {
        // Cancellation or genuine failure — neither should throw into the UI.
      } finally {
        inFlight.delete(source);
        acquiredBy.delete(source);
      }
    })();
  }, []);

  const release = useCallback((source: string) => {
    const controller = inFlight.get(source);
    if (controller) {
      controller.abort();
      inFlight.delete(source);
    }
    acquiredBy.delete(source);
  }, []);

  const busy = useCallback(() => inFlight.size > 0, []);
  const dispose = useCallback(() => {
    for (const [, controller] of inFlight) controller.abort();
    inFlight.clear();
    acquiredBy.clear();
  }, []);

  return { acquire, release, busy, dispose };
}
