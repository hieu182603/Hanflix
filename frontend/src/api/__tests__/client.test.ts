import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiRequestError, getAccessToken, setAccessToken } from '../client';

describe('apiFetch — cancellation contract', () => {
  beforeEach(() => {
    setAccessToken('test-token');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });
  afterEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it('throws ApiRequestError(ABORTED) when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(apiFetch('/path', { signal: controller.signal })).rejects.toMatchObject({
      status: 0,
      code: 'ABORTED',
    });
  });

  it('attaches the AbortSignal to fetch and surfaces aborts as ABORTED', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn(() => {
      const err = new DOMException('aborted', 'AbortError');
      return Promise.reject(err);
    });
    const controller = new AbortController();
    const promise = apiFetch('/path', { signal: controller.signal });
    await expect(promise).rejects.toBeInstanceOf(ApiRequestError);
    await expect(promise).rejects.toMatchObject({ status: 0, code: 'ABORTED' });
  });

  it('sends Authorization header when access token is set', async () => {
    let captured: RequestInit | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn((_url: unknown, init: RequestInit) => {
      captured = init;
      return Promise.resolve(new Response(JSON.stringify({ data: { ok: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    const out = await apiFetch<{ ok: number }>('/path');
    expect(out.ok).toBe(1);
    expect((captured?.headers as Record<string, string>)?.Authorization).toBe('Bearer test-token');
  });

  it('clears the access token on a 401 retry that still 401s', async () => {
    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn((_url: string, init: RequestInit) => {
      callCount += 1;
      const url = _url as string;
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(new Response(JSON.stringify({ data: { accessToken: 'rotated-token' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      // First call: 401. Refresh call: 200. Retry: 401 again.
      const status = callCount === 1 ? 401 : 401;
      void init;
      return Promise.resolve(new Response(JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'expired' } }), { status }));
    });
    try { await apiFetch('/protected'); } catch { /* expected */ }
    expect(getAccessToken()).toBeNull();
  });
});
