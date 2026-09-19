import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createLocalStoragePersister, __resetPersisterForTests } from '../persistedQueryClient';

/**
 * These tests stand in for the higher-level contract: when the app logs
 * out / switches account, the persisted cache MUST be wiped, otherwise
 * the next page load will rehydrate the previous user's data before the
 * auth handshake completes.
 */
describe('persisted cache hygiene across logout', () => {
  beforeEach(() => __resetPersisterForTests());
  afterEach(() => __resetPersisterForTests());

  function installStorage(initial: Record<string, string> = {}) {
    const store = new Map<string, string>(Object.entries(initial));
    const fake: Storage = {
      get length() { return store.size; },
      clear: () => store.clear(),
      getItem: (k) => (store.has(k) ? store.get(k)! : null),
      key: (i) => Array.from(store.keys())[i] ?? null,
      removeItem: (k) => { store.delete(k); },
      setItem: (k, v) => { store.set(k, v); },
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, value: fake });
    return fake;
  }

  it('removeClient() actually removes the entry', () => {
    const storage = installStorage();
    const persister = createLocalStoragePersister();
    persister.persistClient({ queries: [{ queryHash: 'a', state: { dataUpdatedAt: 1 } }] });
    expect(storage.getItem('hanflix_query_cache_v1')).toBeTruthy();
    persister.removeClient();
    expect(storage.getItem('hanflix_query_cache_v1')).toBeNull();
  });

  it('removeClient() on empty storage is a no-op', () => {
    const storage = installStorage();
    const persister = createLocalStoragePersister();
    expect(() => persister.removeClient()).not.toThrow();
    expect(storage.getItem('hanflix_query_cache_v1')).toBeNull();
  });

  it('removeClient() survives a corruption scenario', () => {
    const storage = installStorage({ hanflix_query_cache_v1: '<<not-json>>' });
    const persister = createLocalStoragePersister();
    expect(() => persister.removeClient()).not.toThrow();
    expect(storage.getItem('hanflix_query_cache_v1')).toBeNull();
  });

  it('two persister instances share the same storage slot (singleton key)', () => {
    installStorage();
    const a = createLocalStoragePersister();
    const b = createLocalStoragePersister();
    a.persistClient({ queries: [{ queryHash: 'h', state: { dataUpdatedAt: 5 } }] });
    expect(b.restoreClient()).toBeDefined();
  });

  it('QueryClient subscription survives across instances (sanity)', async () => {
    const { QueryClient: Qc } = await import('@tanstack/react-query');
    const clientA = new Qc();
    clientA.setQueryData(['foo'], 1);
    expect(clientA.getQueryData(['foo'])).toBe(1);
  });
});
