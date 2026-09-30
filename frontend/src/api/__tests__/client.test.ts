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

  it.each([
    ['/lessons/abc/progress', 'PATCH', {}, 'video'],
    ['/lessons/abc/attempts', 'POST', {}, 'practice'],
    ['/exams/abc/submit', 'POST', { id: 'attempt' }, 'practice'],
    ['/exams/my-history/abc', 'GET', {}, null],
    ['/exams/abc', 'GET', {}, null],
    ['/vocabulary/abc/review', 'POST', {}, 'review'],
    ['/vocabulary/practice-session', 'POST', {}, 'review'],
    ['/practice/attempts/abc', 'GET', { status: 'submitted' }, 'practice'],
    ['/practice/attempts/abc', 'PATCH', { status: 'in_progress' }, null],
    ['/vocabulary/save', 'POST', {}, null],
    ['/practice/sets/abc/start', 'POST', { status: 'in_progress' }, null],
  ])('refreshes streak only for confirmed learning: %s %s', async (path, method, data, source) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data }), { status: 200 }));
    const listener = vi.fn();
    window.addEventListener('hanflix:activity-updated', listener);
    try {
      await apiFetch(path, { method });
      expect(listener).toHaveBeenCalledTimes(source ? 1 : 0);
      if (source) expect(listener.mock.calls[0][0].detail.source).toBe(source);
    } finally { window.removeEventListener('hanflix:activity-updated', listener); }
  });

  it.each([
    ['/profile/learning', 'PUT', 200, 1],
    ['/learning/roadmap/preferences', 'PATCH', 200, 1],
    ['/profile/learning', 'PUT', 422, 0],
    ['/profile/learning', 'GET', 200, 0],
  ])('refreshes HSK access only after a confirmed profile save: %s %s %s', async (path, method, status, events) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(status === 200
      ? { data: {} } : { error: { code: 'VALIDATION_ERROR', message: 'Invalid HSK' } }), { status }));
    const listener = vi.fn();
    window.addEventListener('hanflix:learning-profile-updated', listener);
    try {
      const request = apiFetch(path, { method });
      if (status === 200) await request;
      else await expect(request).rejects.toMatchObject({ status });
      expect(listener).toHaveBeenCalledTimes(events);
    } finally { window.removeEventListener('hanflix:learning-profile-updated', listener); }
  });

  it.each([
    ['/profile/learning', 'PUT', 200, 1],
    ['/learning/roadmap/preferences', 'PATCH', 200, 1],
    ['/profile/learning', 'PUT', 422, 0],
    ['/profile/learning', 'GET', 200, 0],
  ])('refreshes HSK access only after a confirmed profile save: %s %s %s', async (path, method, status, events) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(status === 200
      ? { data: {} } : { error: { code: 'VALIDATION_ERROR', message: 'Invalid HSK' } }), { status }));
    const listener = vi.fn();
    window.addEventListener('hanflix:learning-profile-updated', listener);
    try {
      const request = apiFetch(path, { method });
      if (status === 200) await request;
      else await expect(request).rejects.toMatchObject({ status });
      expect(listener).toHaveBeenCalledTimes(events);
    } finally { window.removeEventListener('hanflix:learning-profile-updated', listener); }
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
