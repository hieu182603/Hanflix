import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreSession } from '../auth';
import { getAccessToken, setAccessToken } from '../client';

vi.mock('../../lib/queryClient', () => ({ queryClient: {} }));

const response = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const user = { id: 'learner', name: 'Learner', role: 'user', status: 'active', email: 'learner@example.com' };

describe('session restoration after reload', () => {
  it('restores the Premium expiry from the authenticated server response', async () => {
    const premiumExpiresAt = '2027-09-29T10:00:00.000Z';
    vi.mocked(fetch).mockResolvedValueOnce(response(200, { data: { accessToken: 'new-token' } }))
      .mockResolvedValueOnce(response(200, { data: { user: { ...user, premiumExpiresAt } } }));
    await expect(restoreSession()).resolves.toMatchObject({ premiumExpiresAt });
    expect(JSON.parse(localStorage.getItem('hanflix_user')!)).not.toHaveProperty('premiumExpiresAt');
  });
  beforeEach(() => {
    setAccessToken(null);
    localStorage.setItem('hanflix_user', JSON.stringify({ id: user.id }));
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    setAccessToken(null);
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('restores the user using the cookie with no in-memory access token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(200, { data: { accessToken: 'new-token' } }))
      .mockResolvedValueOnce(response(200, { data: { user } }));
    const [first, second] = await Promise.all([restoreSession(), restoreSession()]);
    expect(first).toMatchObject(user);
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/auth/refresh'), expect.objectContaining({ credentials: 'include' }));
  });

  it.each([429, 500, 503])('does not erase the session on HTTP %s', async status => {
    vi.mocked(fetch).mockResolvedValueOnce(response(status, { error: { code: 'TEMPORARY', message: 'Thử lại' } }));
    await expect(restoreSession()).rejects.toMatchObject({ status });
    expect(localStorage.getItem('hanflix_user')).not.toBeNull();
  });

  it('keeps cache when the network is offline', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(restoreSession()).rejects.toThrow('Failed to fetch');
    expect(localStorage.getItem('hanflix_user')).not.toBeNull();
  });

  it('retries /me without rotating again after a temporary /me failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(200, { data: { accessToken: 'new-token' } }))
      .mockResolvedValueOnce(response(503, { error: { message: 'Unavailable' } }))
      .mockResolvedValueOnce(response(200, { data: { user } }));
    await expect(restoreSession()).rejects.toMatchObject({ status: 503 });
    expect(getAccessToken()).toBe('new-token');
    await expect(restoreSession()).resolves.toMatchObject(user);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('clears the session when the server confirms the cookie is invalid', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(401, { error: { code: 'REFRESH_REQUIRED' } }));
    await expect(restoreSession()).resolves.toBeNull();
    expect(localStorage.getItem('hanflix_user')).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});
