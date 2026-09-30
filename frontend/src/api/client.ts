// Production proxies /api/v1 through the website origin. Calling Azure directly
// makes the HttpOnly refresh cookie third-party and breaks reload in browsers
// that block third-party cookies, even though login returns an access token.
const API_BASE = import.meta.env.PROD
  ? '/api/v1'
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1');

let accessToken: string | null = null;
let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = [];

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    if (res.status === 429) {
      const json = await res.json().catch(() => null);
      throw new ApiRequestError(429, 'RATE_LIMITED',
        json?.error?.message || 'Vui lòng đợi một chút trước khi thử lại.');
    }
    const json = await res.json().catch(() => null);
    if (res.status === 401 || res.status === 403) accessToken = null;
    throw new ApiRequestError(res.status, json?.error?.code || 'REFRESH_FAILED',
      json?.error?.message || 'Chưa thể khôi phục phiên đăng nhập. Vui lòng thử lại.');
  }

  const json = await res.json();
  const newToken = json.data.accessToken as string;
  accessToken = newToken;
  return newToken;
}

function processRefreshQueue(token: string | null, error: Error | null) {
  for (const entry of refreshQueue) {
    if (error) {
      entry.reject(error);
    } else {
      entry.resolve(token!);
    }
  }
  refreshQueue = [];
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Lightweight typed wrapper around `fetch` that integrates with React Query's
 * AbortSignal plumbing.
 *
 * Calling pattern:
 *     queryFn: ({ signal }) => apiFetch<T>('/path', { signal })
 *
 * When React Query cancels a query (e.g. because the user switched lessons),
 * `signal.aborted` becomes true. We surface that as a special
 * `ApiRequestError` carrying `status: 0` and `code: 'ABORTED'` so consumers
 * can distinguish cancellation from real network failure.
 *
 * Cancellation contract:
 *   - We always `signal.throwIfAborted()` before reading the body.
 *   - We propagate the abort event to fetch via the `signal` field.
 *   - On 401, we attempt a single refresh. If the refresh itself fails, we
 *     clear the access token and surface the original 401 to the caller —
 *     we never spin forever.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const inboundSignal = (options as { signal?: AbortSignal }).signal;
  const signal = inboundSignal ?? undefined;

  if (signal?.aborted) {
    throw new ApiRequestError(0, 'ABORTED', 'Yêu cầu đã bị hủy');
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError(0, 'ABORTED', 'Yêu cầu đã bị hủy');
    }
    throw error;
  }

  // Auto-refresh on 401 (limit to 1 retry per request to prevent infinite loop)
  if (res.status === 401 && accessToken && !(options as Record<string, unknown>).__retried) {
    try {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await refreshAccessToken();
          processRefreshQueue(newToken, null);
        } catch (err) {
          processRefreshQueue(null, err as Error);
          isRefreshing = false;
          throw err;
        }
        isRefreshing = false;
      } else {
        // Wait for the in-progress refresh to complete
        const newToken = await new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        });
        headers['Authorization'] = `Bearer ${newToken}`;
      }

      // Retry with new token (mark as retried to prevent infinite loop)
      headers['Authorization'] = `Bearer ${accessToken}`;
      try {
        res = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
          signal,
        } as RequestInit);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new ApiRequestError(0, 'ABORTED', 'Yêu cầu đã bị hủy');
        }
        throw error;
      }
      (options as Record<string, unknown>).__retried = true;

      // SECURITY: If retry still returns 401, clear session to force logout
      // and prevent infinite refresh loops (e.g., when account gets locked)
      if (res.status === 401) {
        accessToken = null;
      }
    } catch (error) {
      // A temporary rate limit is not an expired session. Preserve the token
      // and show the server's wait time instead of forcing a new login.
      if (error instanceof ApiRequestError && error.status === 429) throw error;
      // A refresh cancelled via abort is not a real error — propagate it
      // so React Query stops retrying, but don't clear the token.
      if (error instanceof ApiRequestError && error.code === 'ABORTED') throw error;
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        accessToken = null;
      }
      throw error;
    }
  }

  if (signal?.aborted) {
    throw new ApiRequestError(0, 'ABORTED', 'Yêu cầu đã bị hủy');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError(0, 'ABORTED', 'Yêu cầu đã bị hủy');
    }
    throw error;
  }

  if (!res.ok) {
    const errBody = (json as { error?: { code?: string; message?: string } } | null)?.error;
    if (errBody?.code === 'PREMIUM_REQUIRED' && options.method && options.method !== 'GET') {
      window.dispatchEvent(new Event('hanflix:premium-required'));
      window.dispatchEvent(new Event('hanflix:subscription-updated'));
    }
    throw new ApiRequestError(
      res.status,
      errBody?.code || 'UNKNOWN',
      errBody?.message || 'Đã xảy ra lỗi không xác định',
    );
  }

  const method = options.method?.toUpperCase();
  if ((method === 'PUT' && path === '/profile/learning') || (method === 'PATCH' && path === '/learning/roadmap/preferences')) {
    window.dispatchEvent(new Event('hanflix:learning-profile-updated'));
  }
  const learningSource = method === 'PATCH' && /^\/lessons\/[^/]+\/progress$/.test(path) ? 'video'
    : method === 'POST' && /^\/lessons\/[^/]+\/attempts$/.test(path) ? 'practice'
    : method === 'POST' && /^\/exams\/[^/]+\/submit$/.test(path) ? 'practice'
    : method === 'POST' && /^\/vocabulary\/(practice-session|[^/]+\/review)$/.test(path) ? 'review'
    : /^\/practice\//.test(path) && (json as { data?: { status?: string } }).data?.status === 'submitted' ? 'practice'
    : null;
  if (typeof window !== 'undefined' && learningSource) {
    window.dispatchEvent(new CustomEvent('hanflix:activity-updated', { detail: { source: learningSource } }));
  }

  return (json as { data: T }).data;
}
