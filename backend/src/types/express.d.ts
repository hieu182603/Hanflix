import type { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        userId: Types.ObjectId;
        role: 'user' | 'admin';
        premiumExpiresAt?: Date | null;
        premiumStartedAt?: Date | null;
        premiumTrial?: { startedAt: Date; endsAt: Date; planCode: string } | null;
        currentHsk?: number | null;
      };
    }
  }
}

export {};
