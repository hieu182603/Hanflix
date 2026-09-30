/**
 * User mapper utilities.
 *
 * ARCH-04: Extracted from `auth.routes.ts` so it can be reused by other modules
 * (upload.routes.ts, profile.routes.ts, admin.routes.ts, ...) without
 * violating the separation of concerns (route files should not export helpers).
 */

import { hasPremium } from '../services/premium.js';

export interface PublicUserInput {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  status: string;
  learningProfile?: unknown;
  emailVerifiedAt?: Date | null;
  emailVerificationRequired?: boolean;
  avatarUrl?: string | null;
  googleAvatarUrl?: string | null;
  avatarType?: 'generated' | 'custom' | null;
  avatarConfig?: unknown;
  avatarPublicId?: string | null;
  totalXP?: number;
  premiumExpiresAt?: Date | null;
}

export function publicUser(user: PublicUserInput) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt || !user.emailVerificationRequired),
    learningProfile: user.learningProfile,
    totalXP: user.totalXP ?? 0,
    tier: hasPremium(user) ? 'premium' : 'free',
    premiumExpiresAt: user.premiumExpiresAt ?? null,
    avatarType: user.avatarType ?? (user.avatarUrl ? 'custom' : 'generated'),
    avatarUrl: user.avatarUrl ?? user.googleAvatarUrl ?? null,
    googleAvatarUrl: user.googleAvatarUrl ?? null,
    avatarConfig: user.avatarConfig ?? null,
    avatarPublicId: user.avatarPublicId ?? null,
  };
}
