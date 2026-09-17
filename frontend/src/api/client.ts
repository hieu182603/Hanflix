const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

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
    accessToken = null;
    throw new Error('SESSION_EXPIRED');
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

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Auto-refresh on 401
  if (res.status === 401 && accessToken) {
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

      // Retry with new token
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      // Wait for the in-progress refresh to complete
      const newToken = await new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      });
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();

  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      json.error?.code || 'UNKNOWN',
      json.error?.message || 'Đã xảy ra lỗi không xác định',
    );
  }

  return json.data as T;
}
