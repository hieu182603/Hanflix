import { QueryClient, defaultShouldDehydrateQuery, type DefaultOptions } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createLocalStoragePersister } from './persistedQueryClient';

/**
 * HanFlix React Query client.
 *
 * Goals:
 *  - Show cached data immediately on revisit (no full-screen spinner) while
 *    letting a background refetch silently update the content.
 *  - Keep query keys consistent across components so two views of the same
 *    data share one in-flight request and one cache entry.
 *  - Pause retries on errors that should not be retried (4xx). The default
 *    `retry: 1` covers transient network errors.
 *
 * SECURITY: this cache is NEVER used as evidence of authorization. Any data
 * the server normally protects (per-user progress, AI recs that depend on
 * profile, recommendations engine output) must still be revalidated by the
 * server before being acted on. See `auth.ts` for the cache-clearing flow on
 * logout / account switch.
 *
 * Persistence:
 *  - The persister runs once at module load and rehydrates cached queries
 *    before React mounts, so the first paint already shows the previous
 *    session's data when `auth/me` later confirms the user is still active.
 *  - `maxAge = 24h` keeps stale blobs from lingering forever; combined with
 *    the schema version, any older blob is dropped instead of poisoning
 *    the new client.
 *  - On quota / private-mode failures the persister silently no-ops; the
 *    app still works, just without offline cache.
 */
const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: 5 * 60 * 1000, // 5 min — typical learning session length
    gcTime: 30 * 60 * 1000, // 30 min — long enough for back-navigation
    retry: 1,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    // Re-fetch only when the user explicitly invalidates; tab switches and
    // window focus changes are noisy on this product and don't justify an
    // extra round trip.
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    retry: 0,
  },
};

export const queryClient = new QueryClient({
  defaultOptions,
});

/**
 * Wire persistence once per process. We pass the persister through
 * `persistQueryClient` so it handles structural sharing and the
 * `gcTime` contract correctly. If `window.localStorage` is unavailable
 * (Safari private mode, quota exceeded), `createLocalStoragePersister`
 * returns a no-op persister and `persistQueryClient` short-circuits.
 */
const persister = createLocalStoragePersister();
// The `Persister` shape expected by `persistQueryClient` is compatible with
// our `LocalStoragePersister<unknown>` — same method signatures, looser
// generic. Cast at the boundary keeps the rest of the file untyped to
// this package.
persistQueryClient({
  queryClient,
  persister: persister as unknown as Parameters<typeof persistQueryClient>[0]['persister'],
  maxAge: 1000 * 60 * 60 * 24,
  buster: 'hanflix-query-cache-v2-hsk-access',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query)
      && !['lesson', 'subtitles', 'quiz'].includes(String(query.queryKey[0])),
  },
});
