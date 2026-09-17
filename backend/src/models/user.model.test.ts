import { describe, expect, it } from 'vitest';
import { UserModel } from './user.model.js';

describe('User authentication methods', () => {
  it('allows a Google-only account without a password hash', async () => {
    const user = new UserModel({ name: 'Google Learner', email: 'google@example.com', googleSub: 'google-sub-123' });
    await expect(user.validate()).resolves.toBeUndefined();
    expect(user.passwordHash).toBeUndefined();
  });

  it('keeps password-based accounts valid', async () => {
    const user = new UserModel({ name: 'Password Learner', email: 'password@example.com', passwordHash: 'hashed-password' });
    await expect(user.validate()).resolves.toBeUndefined();
    expect(user.googleSub).toBeUndefined();
  });
});
