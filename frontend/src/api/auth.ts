import { apiFetch, setAccessToken, ApiRequestError } from './client';
import type { User } from '../data/hanflixData';

interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin';
    status: 'active' | 'locked';
    emailVerified?: boolean;
    learningProfile?: {
      currentHskSource?: string;
      subtitlePreference?: string;
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
  return {
    id: u.id,
    role: u.role,
    status: u.status,
    name: u.name,
    email: u.email,
    avatarAsset: null,
    learningProfile: null,
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

/**
 * Login with email and password.
 */
export async function login(email: string, password: string): Promise<User> {
  const data = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.accessToken);
  return toFrontendUser(data.user);
}

/**
 * Logout: revoke refresh token, clear access token.
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // Best-effort — always clear local state
  }
  setAccessToken(null);
}

/**
 * Try to restore a session from the existing refresh cookie.
 * Returns the current user if the cookie is still valid, or null.
 */
export async function restoreSession(): Promise<User | null> {
  try {
    const data = await apiFetch<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
    });
    setAccessToken(data.accessToken);

    const me = await apiFetch<MeResponse>('/auth/me');
    return toFrontendUser(me.user);
  } catch {
    setAccessToken(null);
    return null;
  }
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

export async function resendVerification(email: string): Promise<void> {
  await apiFetch('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const data = await apiFetch<{ accessToken: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  setAccessToken(data.accessToken);
}

export { ApiRequestError };
