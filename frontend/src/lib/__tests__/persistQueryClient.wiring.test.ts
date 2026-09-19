import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { __resetPersisterForTests, createLocalStoragePersister } from '../persistedQueryClient';

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

describe('persistQueryClient wiring', () => {
  beforeEach(() => __resetPersisterForTests());
  afterEach(() => __resetPersisterForTests());

  it('integrates with persistQueryClient without throwing', () => {
    installStorage();
    const persister = createLocalStoragePersister();
    const persisterForLibrary = persister as unknown as Parameters<typeof persistQueryClient>[0]['persister'];

    const clientA = new QueryClient();
    expect(() => {
      persistQueryClient({ queryClient: clientA, persister: persisterForLibrary, maxAge: 1000 * 60 * 60 });
    }).not.toThrow();

    const clientB = new QueryClient();
    expect(() => {
      persistQueryClient({ queryClient: clientB, persister: persisterForLibrary, maxAge: 1000 * 60 * 60 });
    }).not.toThrow();
  });

  it('persister is a no-op when localStorage is unavailable', () => {
    // jsdom: monkey-patch localStorage to throw on every call to simulate
    // Safari private mode / quota exceeded.
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => { throw new Error('QuotaExceededError'); },
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => undefined,
      },
    });
    __resetPersisterForTests();
    const persister = createLocalStoragePersister();
    // No throw. No data. The contract is "graceful degradation".
    expect(() => persister.persistClient({ queries: [] })).not.toThrow();
    expect(persister.restoreClient()).toBeUndefined();
  });

  it('persister stats() reflects current usage', () => {
    installStorage();
    const persister = createLocalStoragePersister();
    persister.persistClient({ queries: [{ queryHash: 'a', state: { dataUpdatedAt: 1 } }] });
    const stats = persister.stats?.();
    expect(stats).toBeDefined();
    expect(stats!.entryCount).toBe(1);
  });

  it('vi spy survives the import boundary', () => {
    // Sanity: vi works at all in this file.
    const spy = vi.fn();
    spy();
    expect(spy).toHaveBeenCalledOnce();
  });
});
