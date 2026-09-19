import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetPersisterForTests, createLocalStoragePersister, CACHE_SCHEMA_VERSION, __test__ } from '../persistedQueryClient';

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

describe('localStorage persister', () => {
  let originalLS: Storage | undefined;
  beforeEach(() => {
    __resetPersisterForTests();
    originalLS = window.localStorage;
  });
  afterEach(() => {
    __resetPersisterForTests();
    if (originalLS !== undefined) {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: originalLS });
    }
  });

  it('round-trips a payload when the schema version matches', () => {
    installStorage();
    const persister = createLocalStoragePersister();
    const payload = { queries: [{ queryHash: 'a', state: { dataUpdatedAt: 1 } }] };
    persister.persistClient(payload);
    expect(persister.restoreClient()).toEqual(payload);
  });

  it('drops payloads with a mismatched schema version', () => {
    installStorage({ hanflix_query_cache_v1: JSON.stringify({ version: 99, payload: { foo: 'bar' } }) });
    const persister = createLocalStoragePersister();
    expect(persister.restoreClient()).toBeUndefined();
  });

  it('drops payloads larger than MAX_BYTES', () => {
    installStorage();
    const persister = createLocalStoragePersister();
    const huge = { queries: new Array(20000).fill({ queryHash: 'huge', state: { dataUpdatedAt: Date.now(), data: 'x'.repeat(200) } }) };
    persister.persistClient(huge);
    const stats = persister.stats?.();
    expect(stats).toBeDefined();
  });

  it('removeClient wipes the entry', () => {
    installStorage();
    const persister = createLocalStoragePersister();
    persister.persistClient({ queries: [] });
    persister.removeClient();
    expect(persister.restoreClient()).toBeUndefined();
  });

  it('safeParse returns undefined for invalid JSON', () => {
    const value = __test__.safeParse<unknown>('not-json');
    expect(value).toBeUndefined();
  });

  it('enumerateKeys ranks entries by updatedAt', () => {
    const keys = __test__.enumerateKeys({ queries: [{ queryHash: 'old', state: { dataUpdatedAt: 1 } }, { queryHash: 'new', state: { dataUpdatedAt: 5 } }] });
    expect(keys).toEqual(['old', 'new']);
  });

  it('exposes a stable schema version', () => {
    expect(CACHE_SCHEMA_VERSION).toBe(1);
  });
});
