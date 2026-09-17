import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AccountTokenModel } from '../models/account-token.model.js';
import { hashToken } from './jwt.js';

export type AccountTokenPurpose = 'verify_email' | 'reset_password';

function hashOtp(userId: Types.ObjectId, purpose: AccountTokenPurpose, code: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET)
    .update(`${userId.toString()}:${purpose}:${code}`)
    .digest('hex');
}

export class AccountTokenService {
  async issue(userId: Types.ObjectId, purpose: AccountTokenPurpose, ttlMinutes: number): Promise<string> {
    return (await this.issueProof(userId, purpose, ttlMinutes, false)).token;
  }

  async issueWithOtp(userId: Types.ObjectId, purpose: AccountTokenPurpose, ttlMinutes: number): Promise<{ token: string; code: string }> {
    const proof = await this.issueProof(userId, purpose, ttlMinutes, true);
    return { token: proof.token, code: proof.code! };
  }

  async issueWithOtpIfAllowed(userId: Types.ObjectId, purpose: AccountTokenPurpose, ttlMinutes: number): Promise<{ token: string; code: string } | null> {
    const recent = await AccountTokenModel.exists({ userId, purpose, createdAt: { $gt: new Date(Date.now() - 60_000) } });
    return recent ? null : this.issueWithOtp(userId, purpose, ttlMinutes);
  }

  private async issueProof(userId: Types.ObjectId, purpose: AccountTokenPurpose, ttlMinutes: number, withOtp: boolean) {
    const token = randomBytes(32).toString('base64url');
    const code = withOtp ? randomInt(0, 1_000_000).toString().padStart(6, '0') : undefined;
    await AccountTokenModel.updateMany(
      { userId, purpose, usedAt: { $exists: false } },
      { $set: { usedAt: new Date() } },
    );
    await AccountTokenModel.create({
      userId,
      purpose,
      tokenHash: hashToken(token),
      ...(code ? {
        otpHash: hashOtp(userId, purpose, code),
        otpAttempts: 0,
        otpExpiresAt: new Date(Date.now() + 60_000), // OTP expires after 1 minute
      } : {}),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    });
    return { token, code };
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

  async consumeOtp(userId: Types.ObjectId, code: string, purpose: AccountTokenPurpose) {
    const now = new Date();
    const record = await AccountTokenModel.findOne({
      userId, purpose, usedAt: { $exists: false }, expiresAt: { $gt: now }, otpAttempts: { $lt: 5 },
    }).select('+otpHash +otpExpiresAt');

    if (!record?.otpHash) return null;

    // If OTP has expired (> 1 minute), cancel/invalidate the token and return null
    if (record.otpExpiresAt && record.otpExpiresAt <= now) {
      await AccountTokenModel.updateOne({ _id: record._id }, { $set: { usedAt: now } });
      return null;
    }

    const expected = Buffer.from(record.otpHash, 'hex');
    const received = Buffer.from(hashOtp(userId, purpose, code), 'hex');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      await AccountTokenModel.updateOne({ _id: record._id, usedAt: { $exists: false }, otpAttempts: { $lt: 5 } }, { $inc: { otpAttempts: 1 } });
      return null;
    }
    return AccountTokenModel.findOneAndUpdate(
      { _id: record._id, usedAt: { $exists: false }, expiresAt: { $gt: now }, otpAttempts: { $lt: 5 } },
      { $set: { usedAt: now } },
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
