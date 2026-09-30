import { apiFetch, getAccessToken, setAccessToken, ApiRequestError } from './client';
import type { User } from '../data/hanflixData';
import { queryClient } from '../lib/queryClient';
import { createLocalStoragePersister } from '../lib/persistedQueryClient';
import { lessonQueryKeys, dashboardQueryKeys, learningQueryKeys, vocabularyQueryKeys } from './queryKeys';

interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin';
    status: 'active' | 'locked';
    premiumExpiresAt?: string | null;
    avatarUrl?: string | null;
    googleAvatarUrl?: string | null;
    avatarType?: 'generated' | 'custom' | null;
    avatarConfig?: any;
    avatarPublicId?: string | null;
    emailVerified?: boolean;
    learningProfile?: {
      currentHsk?: number;
      currentHskSource?: string;
      targetHsk?: number;
      goal?: string;
      topicIds?: string[];
      dailyMinutes?: number;
      subtitlePreference?: string;
      surveyVersion?: number;
      focusSkills?: string[];
      studyDaysPerWeek?: number;
    } | null;
  };
}

interface RegistrationResponse {
  user: AuthResponse['user'];
  verificationRequired: boolean;
}

interface MeResponse {
  user: AuthResponse['user'];
}

/**
 * Convert backend user shape to frontend User type.
 */
function toFrontendUser(u: AuthResponse['user']): User {
  const lp = u.learningProfile;
  return {
    id: u.id,
    role: u.role,
    status: u.status,
    premiumExpiresAt: u.premiumExpiresAt ?? null,
    name: u.name,
    email: u.email,
    avatarAsset: u.avatarUrl ?? u.googleAvatarUrl ?? null,
    avatarUrl: u.avatarUrl ?? u.googleAvatarUrl ?? null,
    googleAvatarUrl: u.googleAvatarUrl ?? null,
    avatarType: u.avatarType ?? (u.avatarUrl ? 'custom' : 'generated'),
    avatarConfig: u.avatarConfig ?? null,
    avatarPublicId: u.avatarPublicId ?? null,

    learningProfile: lp ? {
      hskLevel: lp.currentHsk ?? 0,
      goal: lp.goal ?? 'daily',
      topics: lp.topicIds ?? [],
      dailyMinutes: lp.dailyMinutes ?? 15,
      preferredDuration: '1-3',
      subtitleDefaults: { zh: true, pinyin: true, vi: true },
      defaultSpeed: 1,
      uiLanguage: 'vi',
      surveyVersion: lp.surveyVersion,
      currentHskSource: lp.currentHskSource,
      targetHsk: lp.targetHsk,
      focusSkills: lp.focusSkills,
      studyDaysPerWeek: lp.studyDaysPerWeek,
      subtitlePreference: lp.subtitlePreference,
    } : null,
  };
}

/**
 * Register a new user account.
 */
export async function register(
  name: string,
  email: string,
  password: string,
): Promise<{ user: User; verificationRequired: boolean }> {
  const data = await apiFetch<RegistrationResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  return { user: toFrontendUser(data.user), verificationRequired: data.verificationRequired };
}

const USER_STORAGE_KEY = 'hanflix_user';
// SECURITY (H-7): localStorage is XSS-readable. We store ONLY the minimum data needed
// for offline UI rendering (id + avatar display fields). Sensitive fields like email
// and learningProfile MUST come from /auth/me on every app load — never trust the cached blob
// for authorization decisions.
// NOTE: role is included in cache to prevent redirect loops during session restore,
// but authorization still requires fresh data from /auth/me.
const USER_CACHE_FIELDS = ['id', 'name', 'avatarUrl', 'avatarType', 'avatarConfig', 'role'] as const;

export function getCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Strip a server-issued user object down to the minimum needed for offline rendering
 * before writing it to localStorage. Email, role, learningProfile and anything else
 * sensitive are re-fetched on app load via /auth/me.
 */
function projectUserForCache(user: User): User {
  const projected = {} as Record<string, unknown>;
  for (const field of USER_CACHE_FIELDS) {
    if (field in user) projected[field] = (user as unknown as Record<string, unknown>)[field];
  }
  return projected as unknown as User;
}

export function saveUserCache(user: User | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(projectUserForCache(user)));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Login with email and password.
 */
export async function login(email: string, password: string): Promise<User> {
  const data = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.accessToken);
  const user = toFrontendUser(data.user);
  saveUserCache(user);
  return user;
}

export async function getGoogleClientId(): Promise<string | null> {
  const data = await apiFetch<{ googleClientId: string | null }>('/auth/providers');
  return data.googleClientId;
}

export async function signInWithGoogle(credential: string): Promise<User> {
  const data = await apiFetch<AuthResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
  setAccessToken(data.accessToken);
  const user = toFrontendUser(data.user);
  saveUserCache(user);
  return user;
}

export async function linkGoogle(credential: string): Promise<void> {
  await apiFetch('/auth/google/link', { method: 'POST', body: JSON.stringify({ credential }) });
}

export async function unlinkGoogle(currentPassword: string): Promise<void> {
  await apiFetch('/auth/google/unlink', { method: 'POST', body: JSON.stringify({ currentPassword }) });
}

export async function setPassword(password: string, credential: string): Promise<void> {
  await apiFetch('/auth/password/set', { method: 'POST', body: JSON.stringify({ password, credential }) });
}

export interface AuthSessionItem {
  sessionId: string;
  userAgent?: string;
  ip?: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export async function listSessions(): Promise<AuthSessionItem[]> {
  const data = await apiFetch<{ items: AuthSessionItem[] }>('/auth/sessions');
  return data.items;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await apiFetch(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

/**
 * Update basic profile (name, avatarUrl)
 */
export async function updateBasicProfile(payload: { name?: string; avatarUrl?: string | null }): Promise<User> {
  const data = await apiFetch<{ name: string; email: string; avatarUrl?: string; role: 'user' | 'admin'; status: 'active' | 'locked'; learningProfile?: any }>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const user = toFrontendUser(data as AuthResponse['user']);
  saveUserCache(user);
  return user;
}

/**
 * Cancel every in-flight React Query request so a stale response cannot
 * leak into the next user's session, then drop every cached entry.
 *
 * The cache holds metadata only (catalog, recommendations, progress). Even
 * though it is not an authorization source, we wipe it on logout AND on
 * account switch so a leaked HTML frame from a previous user cannot surface
 * someone else's progress in error messages.
 *
 * IMPORTANT: this also wipes the *persisted* localStorage copy. Without
 * that step, the next page load would rehydrate the previous user's cache
 * before the auth handshake completes — see queryClient.ts for the
 * `persistQueryClient` wiring. We deliberately do not depend on the
 * persister returned there so we can be called outside React.
 */
export async function purgeClientCaches(): Promise<void> {
  await queryClient.cancelQueries({ type: 'all' });
  for (const keyGroup of [
    dashboardQueryKeys.root,
    learningQueryKeys.root,
    lessonQueryKeys.all,
    vocabularyQueryKeys.root,
  ]) {
    queryClient.removeQueries({ queryKey: keyGroup, exact: false });
  }
  queryClient.clear();
  // Wipe the localStorage-backed cache. The persister is module-level in
  // queryClient.ts; we instantiate a fresh handle here so logout works even
  // when called from a context without React.
  createLocalStoragePersister().removeClient();
}

/**
 * Logout: revoke refresh token, clear access token, scrub React Query and
 * local cache so no data of the signed-out account lingers in this browser.
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Best-effort — always clear local state
  }
  setAccessToken(null);
  saveUserCache(null);
  await purgeClientCaches();
}

let restoreSessionPromise: Promise<User | null> | null = null;

/**
 * Try to restore a session from the existing refresh cookie.
 * Returns the current user if the cookie is still valid, or null.
 */
export async function restoreSession(): Promise<User | null> {
  if (restoreSessionPromise) {
    return restoreSessionPromise;
  }
  restoreSessionPromise = (async () => {
    try {
      // If /me temporarily failed after rotation, reuse the new access token
      // on retry instead of rotating the refresh cookie a second time.
      if (!getAccessToken()) {
        const data = await apiFetch<{ accessToken: string }>('/auth/refresh', {
          method: 'POST',
        });
        setAccessToken(data.accessToken);
      }

      const me = await apiFetch<MeResponse>('/auth/me');
      const user = toFrontendUser(me.user);
      saveUserCache(user);
      return user;
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        setAccessToken(null);
        saveUserCache(null);
        return null;
      }
      // Network errors, rate limits and server failures do not prove logout.
      throw error;
    } finally {
      restoreSessionPromise = null;
    }
  })();
  return restoreSessionPromise;
}

/**
 * Send a forgot-password request.
 */
export async function forgotPassword(email: string): Promise<void> {
  await apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmail(token: string): Promise<void> {
  await apiFetch('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  await apiFetch('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) });
}

export async function resendVerification(email: string): Promise<void> {
  await apiFetch('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
}

export async function resetPasswordWithCode(email: string, code: string, password: string): Promise<void> {
  await apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, password }) });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const data = await apiFetch<{ accessToken: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  setAccessToken(data.accessToken);
}

export { ApiRequestError };
