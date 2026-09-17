import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { AccountTokenModel } from '../models/account-token.model.js';
import { hashToken } from './jwt.js';

export type AccountTokenPurpose = 'verify_email' | 'reset_password';

export class AccountTokenService {
  async issue(userId: Types.ObjectId, purpose: AccountTokenPurpose, ttlMinutes: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await AccountTokenModel.updateMany(
      { userId, purpose, usedAt: { $exists: false } },
      { $set: { usedAt: new Date() } },
    );
    await AccountTokenModel.create({
      userId,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    });
    return token;
  }

  async consume(token: string, purpose: AccountTokenPurpose) {
    return AccountTokenModel.findOneAndUpdate(
      {
        tokenHash: hashToken(token),
        purpose,
        usedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt: new Date() } },
      { new: true },
    );
  }

  async invalidate(userId: Types.ObjectId, purpose: AccountTokenPurpose): Promise<void> {
    await AccountTokenModel.updateMany(
      { userId, purpose, usedAt: { $exists: false } },
      { $set: { usedAt: new Date() } },
    );
  }
}

export const accountTokenService = new AccountTokenService();
