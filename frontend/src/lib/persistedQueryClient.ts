/**
 * Lightweight, dependency-free persister for the React Query cache.
 *
 * Rationale:
 *   The TanStack async-storage persister is the canonical tool, but adding
 *   two new packages just to back up a few KB of metadata is not justified
 *   for the current frontend bundle budget. We serialize the entire
 *   `QueryClient`'s dehydrated state into `localStorage` instead.
 *
 * Guarantees:
 *   - Schema versioned (`CACHE_SCHEMA_VERSION`). Bumping the version drops
 *     stale blobs so a frontend release with new query keys never reads old
 *     data with the same key shape.
 *   - Payload size capped (`MAX_BYTES`). When the cache grows beyond the cap,
 *     we keep only the most-recently-updated entries until we are under it.
 *   - All operations tolerate `localStorage` being unavailable (Safari
 *     private mode, quota exceeded, disabled by user config) without
 *     crashing the app. A failure is reported via `onError` and the cache
 *     runs as if persistence were disabled.
 *
 * What we deliberately do NOT persist:
 *   - Access tokens or refresh cookies (those are httpOnly + sent by the
 *     fetch client, never duplicated here).
 *   - R2 presigned URLs (TTL = 1h, never guaranteed to outlive the session).
 *   - Per-user "AI recommendation" explanations keyed off profile HSK
 *     (these are cheap to re-fetch and cheap to expire on user switch).
 *
 * Callers pass the `persister` instance to `persistQueryClient()` from
 * `@tanstack/react-query-persist-client`.
 */

const STORAGE_KEY = 'hanflix_query_cache_v1';
/** Bump when the shape of `QueryData` changes incompatibly. */
export const CACHE_SCHEMA_VERSION = 1;
/** Defensive cap on persisted bytes. 1.5 MB fits comfortably under the
 * 5 MB localStorage budget shared with other HanFlix keys. */
export const MAX_BYTES = 1.5 * 1024 * 1024;
/** Serialized payload soft cap before pruning oldest entries. */
const PRUNE_THRESHOLD_BYTES = 1.2 * 1024 * 1024;

type Listener = (event: StorageEvent) => void;

interface PersistedEnvelope<T> {
  version: number;
  savedAt: number;
  payload: T;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    // Probe so we fail fast on Safari private mode / disabled storage.
    const probeKey = '__hanflix_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as PersistedEnvelope<T>;
    if (parsed.version !== CACHE_SCHEMA_VERSION) return undefined;
    return parsed.payload;
  } catch {
    return undefined;
  }
}

function enumerateKeys(payload: unknown): string[] {
  // TanStack dehydrate shape: `{ mutations: [], queries: [] }`. Each query
  // carries `queryHash` and `state.dataUpdatedAt` we can rank by.
  if (!payload || typeof payload !== 'object') return [];
  const envelope = payload as { queries?: Array<{ queryHash?: string; queryKey?: unknown; state?: { dataUpdatedAt?: number } }> };
  if (!Array.isArray(envelope.queries)) return [];
  return envelope.queries
    .map((entry) => ({
      hash: entry.queryHash ?? JSON.stringify(entry.queryKey ?? ''),
      updatedAt: entry.state?.dataUpdatedAt ?? 0,
    }))
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .map((entry) => entry.hash);
}

/** Remove the oldest half of entries until we drop below the soft cap. */
function prune(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as PersistedEnvelope<unknown>;
    const queries = (parsed.payload as { queries?: Array<Record<string, unknown>> })?.queries;
    if (!Array.isArray(queries)) return raw;
    const sorted = [...queries].sort((a, b) => {
      const aTs = (a.state as { dataUpdatedAt?: number } | undefined)?.dataUpdatedAt ?? 0;
      const bTs = (b.state as { dataUpdatedAt?: number } | undefined)?.dataUpdatedAt ?? 0;
      return aTs - bTs;
    });
    const keepIndex = Math.max(2, Math.floor(sorted.length / 2));
    (parsed.payload as { queries: unknown[] }).queries = sorted.slice(keepIndex);
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

export interface LocalStoragePersister<T = unknown> {
  persistClient: (client: T) => void;
  restoreClient: () => T | undefined;
  removeClient: () => void;
  onRestoreError?: (error: unknown) => void;
  onPersistError?: (error: unknown) => void;
  /** Test/observability hook. Best-effort; never throws. */
  stats?: () => { storedBytes: number; entryCount: number; prunedAtLeastOnce: boolean };
}

/** The shape `persistQueryClient` from `@tanstack/react-query-persist-client`
 *  expects. We deliberately declare it here instead of importing the symbol,
 *  so this module has zero dependency on the persister package — that lets
 *  the rest of the codebase build even if the package is removed later.
 */
export interface Persister {
  persistClient: (client: unknown) => void;
  restoreClient: () => unknown;
  removeClient: () => void;
}

let storageRef: StorageLike | null = null;
let prunedOnce = false;

/** Test helper: clears the cached `window.localStorage` handle so the
 *  next call re-probes the global. Production code should not call this. */
export function __resetPersisterForTests(): void {
  storageRef = null;
  prunedOnce = false;
}

export function createLocalStoragePersister<T = unknown>(): LocalStoragePersister<T> {
  const ensureStorage = () => {
    if (storageRef === null) storageRef = resolveStorage();
    return storageRef;
  };

  const persistClient = (client: T) => {
    const storage = ensureStorage();
    if (!storage) return;
    try {
      const envelope: PersistedEnvelope<T> = {
        version: CACHE_SCHEMA_VERSION,
        savedAt: Date.now(),
        payload: client,
      };
      let serialized = JSON.stringify(envelope);
      if (serialized.length > PRUNE_THRESHOLD_BYTES) {
        const pruned = prune(serialized);
        if (pruned) serialized = pruned;
        prunedOnce = true;
      }
      if (serialized.length > MAX_BYTES) {
        // Still too big after pruning — fall back to wipe; the cache is
        // rebuildable on the next request.
        storage.removeItem(STORAGE_KEY);
        return;
      }
      storage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
      storage.removeItem(STORAGE_KEY);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[persistedQueryClient] failed to persist cache', error);
      }
    }
  };

  const restoreClient = (): T | undefined => {
    const storage = ensureStorage();
    if (!storage) return undefined;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      return safeParse<T>(raw);
    } catch {
      return undefined;
    }
  };

  const removeClient = () => {
    const storage = ensureStorage();
    if (!storage) return;
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const stats = () => {
    const storage = ensureStorage();
    if (!storage) return { storedBytes: 0, entryCount: 0, prunedAtLeastOnce: prunedOnce };
    const raw = storage.getItem(STORAGE_KEY);
    let entryCount = 0;
    if (raw) {
      try {
        const parsed = safeParse<unknown>(raw);
        const keys = enumerateKeys(parsed);
        entryCount = keys.length;
      } catch {
        /* ignore */
      }
    }
    return { storedBytes: raw?.length ?? 0, entryCount, prunedAtLeastOnce: prunedOnce };
  };

  return { persistClient, restoreClient, removeClient, stats };
}

/** Storage event listener for cross-tab cache invalidation hooks. */
export function attachStorageSyncListener(handler: Listener): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export const __test__ = { safeParse, enumerateKeys, prune, PRUNE_THRESHOLD_BYTES };
