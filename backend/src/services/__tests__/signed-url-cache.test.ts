import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSignedDownloadUrlCache, getCachedSignedDownloadUrl, invalidateSignedDownloadUrl, signedUrlCacheStats } from '../signed-url-cache.js';

const createVideoDownloadUrl = vi.fn();
vi.mock('../r2.js', () => ({
  createVideoDownloadUrl: (...args: unknown[]) => createVideoDownloadUrl(...args),
}));

beforeEach(() => {
  clearSignedDownloadUrlCache();
  createVideoDownloadUrl.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('signed URL cache', () => {
  it('signs on first call and reuses on subsequent calls within TTL', async () => {
    createVideoDownloadUrl.mockResolvedValue('https://r2.example.com/k1?sig=aaa');
    const first = await getCachedSignedDownloadUrl('k1');
    const second = await getCachedSignedDownloadUrl('k1');
    expect(first).toBe(second);
    expect(createVideoDownloadUrl).toHaveBeenCalledTimes(1);
  });

  it('re-signs after invalidate()', async () => {
    createVideoDownloadUrl.mockResolvedValueOnce('https://r2.example.com/k1?sig=aaa');
    await getCachedSignedDownloadUrl('k1');
    invalidateSignedDownloadUrl('k1');
    createVideoDownloadUrl.mockResolvedValueOnce('https://r2.example.com/k1?sig=bbb');
    const fresh = await getCachedSignedDownloadUrl('k1');
    expect(fresh).toBe('https://r2.example.com/k1?sig=bbb');
    expect(createVideoDownloadUrl).toHaveBeenCalledTimes(2);
  });

  it('keeps separate entries per key', async () => {
    createVideoDownloadUrl.mockImplementation(async (key: string) => `https://r2.example.com/${key}?sig=1`);
    await getCachedSignedDownloadUrl('a');
    await getCachedSignedDownloadUrl('b');
    await getCachedSignedDownloadUrl('a');
    expect(createVideoDownloadUrl).toHaveBeenCalledTimes(2);
  });

  it('stats() reports size and ttl', () => {
    const stats = signedUrlCacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('live');
    expect(stats).toHaveProperty('ttlMs');
    expect(stats.ttlMs).toBeGreaterThan(0);
  });
});
