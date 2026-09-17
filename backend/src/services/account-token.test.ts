import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AccountTokenModel } from '../models/account-token.model.js';
import { AccountTokenService } from './account-token.js';
import { hashToken } from './jwt.js';

afterEach(() => vi.restoreAllMocks());

describe('AccountTokenService', () => {
  it('stores only a hash of a newly issued one-time token', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(AccountTokenModel, 'updateMany').mockResolvedValue({ acknowledged: true } as never);
    const create = vi.spyOn(AccountTokenModel, 'create').mockResolvedValue({} as never);

    const token = await new AccountTokenService().issue(userId, 'verify_email', 30);

    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      purpose: 'verify_email',
      tokenHash: hashToken(token),
    }));
    expect(JSON.stringify(create.mock.calls[0]?.[0])).not.toContain(`"token":"${token}"`);
  });

  it('atomically consumes only an unused and unexpired matching token', async () => {
    const findOneAndUpdate = vi.spyOn(AccountTokenModel, 'findOneAndUpdate').mockResolvedValue(null);
    await new AccountTokenService().consume('one-time-token', 'reset_password');
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: hashToken('one-time-token'),
        purpose: 'reset_password',
        usedAt: { $exists: false },
        expiresAt: { $gt: expect.any(Date) },
      }),
      { $set: { usedAt: expect.any(Date) } },
      { new: true },
    );
  });

  it('stores an HMAC for the OTP and never the six-digit code', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(AccountTokenModel, 'updateMany').mockResolvedValue({ acknowledged: true } as never);
    const create = vi.spyOn(AccountTokenModel, 'create').mockResolvedValue({} as never);

    const proof = await new AccountTokenService().issueWithOtp(userId, 'reset_password', 30);
    expect(proof.code).toMatch(/^\d{6}$/);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      tokenHash: hashToken(proof.token),
      otpHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('code');
    expect(JSON.stringify(create.mock.calls[0]?.[0])).not.toContain(proof.code);
  });

  it('accepts the matching OTP once and counts a wrong attempt', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(AccountTokenModel, 'updateMany').mockResolvedValue({ acknowledged: true } as never);
    const create = vi.spyOn(AccountTokenModel, 'create').mockResolvedValue({} as never);
    const service = new AccountTokenService();
    const proof = await service.issueWithOtp(userId, 'verify_email', 30);
    const record = { _id: new Types.ObjectId(), otpHash: (create.mock.calls[0]![0] as { otpHash: string }).otpHash };
    vi.spyOn(AccountTokenModel, 'findOne').mockReturnValue({ select: () => Promise.resolve(record) } as never);
    const failedAttempt = vi.spyOn(AccountTokenModel, 'updateOne').mockResolvedValue({ acknowledged: true } as never);
    const consume = vi.spyOn(AccountTokenModel, 'findOneAndUpdate').mockResolvedValue(record as never);

    expect(await service.consumeOtp(userId, proof.code === '000000' ? '999999' : '000000', 'verify_email')).toBeNull();
    expect(failedAttempt).toHaveBeenCalledWith(expect.objectContaining({ _id: record._id, otpAttempts: { $lt: 5 } }), { $inc: { otpAttempts: 1 } });
    expect(await service.consumeOtp(userId, proof.code, 'verify_email')).toEqual(record);
    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ _id: record._id, usedAt: { $exists: false } }), { $set: { usedAt: expect.any(Date) } }, { new: true });
  });

  it('rejects and cancels OTP if it has expired after 1 minute', async () => {
    const userId = new Types.ObjectId();
    const service = new AccountTokenService();
    const expiredRecord = {
      _id: new Types.ObjectId(),
      otpHash: 'a'.repeat(64),
      otpExpiresAt: new Date(Date.now() - 1000), // 1 second in the past
    };
    vi.spyOn(AccountTokenModel, 'findOne').mockReturnValue({ select: () => Promise.resolve(expiredRecord) } as never);
    const cancelToken = vi.spyOn(AccountTokenModel, 'updateOne').mockResolvedValue({ acknowledged: true } as never);

    const result = await service.consumeOtp(userId, '123456', 'verify_email');
    expect(result).toBeNull();
    expect(cancelToken).toHaveBeenCalledWith(
      { _id: expiredRecord._id },
      { $set: { usedAt: expect.any(Date) } },
    );
  });
});
