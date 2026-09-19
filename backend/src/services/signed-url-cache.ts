/**
 * F12 fix (2026-09-19): in-memory signed URL cache.
 *
 * Rationale
 *   `createVideoDownloadUrl(key)` calls `getSignedUrl`, which itself calls
 *   the AWS Signature V4 algorithm. Each call costs ~1-3 ms on a warm
 *   process but it adds up when a single page render hits the endpoint
 *   twice (lesson list + lesson detail) and each lesson has both a video
 *   and a thumbnail to sign. Caching the URL for `R2_DOWNLOAD_URL_TTL_SECONDS
 *   - 60s` brings the steady-state cost close to zero.
 *
 * Invariants
 *   - We never serve a URL that R2 would reject as expired. The TTL is
 *     strictly shorter than the URL validity window (`R2_DOWNLOAD_URL_TTL_SECONDS`),
 *     with a 60s safety margin.
 *   - Cache invalidation is purely time-based. We never have to invalidate
 *     by `lessonId` because the underlying object key is content-addressed:
 *     re-processing creates a new key (`v{N}-{uuid}.mp4`), so any old URL
 *     naturally ages out as its lesson doc gets a new `playbackKey`.
 *
 * Limits
 *   - Memory-bounded by `MAX_ENTRIES`. When full, we evict the oldest entry
 *     first. LRU would be better but adds complexity for negligible gain.
 *   - Single-process only. In a multi-replica deployment each replica keeps
 *     its own cache. That's fine: cache MISS just falls through to a real
 *     `createVideoDownloadUrl` call. The downside is bounded by the
 *     number of replicas.
 *
 * Failure mode
 *   On signing failure we throw; the caller (`safeDownloadUrl` in
 *   `lesson.routes.ts`) catches and returns `null`, which the frontend
 *   interprets as "video not ready". We do NOT cache negative results —
 *   signing usually succeeds within a few ms.
 */
import { env } from '../config/env.js';
import { createVideoDownloadUrl } from './r2.js';

interface CacheEntry {
  url: string;
  expiresAt: number; // ms epoch
}

const MAX_ENTRIES = 1024;
const SAFETY_MARGIN_MS = 60 * 1000;
const TTL_MS = Math.max(env.R2_DOWNLOAD_URL_TTL_SECONDS * 1000 - SAFETY_MARGIN_MS, 30 * 1000);

const cache = new Map<string, CacheEntry>();

function evictExpired(now: number) {
  // Lazy cleanup: scan once and drop everything that's stale. We expect
  // the cache to stay well below MAX_ENTRIES, so this is O(n) in the rare
  // case where the cache has been hammered and many entries expired at
  // roughly the same time.
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

function enforceLimit() {
  if (cache.size <= MAX_ENTRIES) return;
  const overflow = cache.size - MAX_ENTRIES;
  // Map iteration order = insertion order; deleting from the front is the
  // simplest approximation of LRU we can do without a dedicated structure.
  const keys = cache.keys();
  for (let i = 0; i < overflow; i += 1) {
    const next = keys.next();
    if (next.done) break;
    cache.delete(next.value);
  }
}

export async function getCachedSignedDownloadUrl(objectKey: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(objectKey);
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }
  const url = await createVideoDownloadUrl(objectKey);
  cache.set(objectKey, { url, expiresAt: now + TTL_MS });
  evictExpired(now);
  enforceLimit();
  return url;
}

/** Drop the cached URL for a key (useful in tests and after a force-replace). */
export function invalidateSignedDownloadUrl(objectKey: string): void {
  cache.delete(objectKey);
}

/** Drop every entry. Test helper; do NOT call from request handlers. */
export function clearSignedDownloadUrlCache(): void {
  cache.clear();
}

/** Diagnostic helper. Read-only; safe to call from anywhere. */
export function signedUrlCacheStats() {
  const now = Date.now();
  let live = 0;
  for (const entry of cache.values()) {
    if (entry.expiresAt > now) live += 1;
  }
  return { size: cache.size, live, ttlMs: TTL_MS, maxEntries: MAX_ENTRIES };
}

export const __test__ = { TTL_MS, MAX_ENTRIES, SAFETY_MARGIN_MS };
