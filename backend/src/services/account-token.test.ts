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
});
