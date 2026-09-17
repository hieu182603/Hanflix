import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { OAuth2Client } from 'google-auth-library';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.GOOGLE_CLIENT_ID = 'hanflix-web-client-id';
});

describe('GoogleIdentityService', () => {
  it('accepts verified email and maps stable Google subject', async () => {
    const { GoogleIdentityService } = await import('./google-identity.js');
    const client = {
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({ sub: 'google-123', email: 'LEARNER@EXAMPLE.COM', email_verified: true,
          iss: 'https://accounts.google.com', name: 'Learner' }),
      }),
    } as unknown as Pick<OAuth2Client, 'verifyIdToken'>;
    const service = new GoogleIdentityService(client);

    await expect(service.verify('token')).resolves.toEqual({
      sub: 'google-123', email: 'learner@example.com', name: 'Learner', picture: undefined,
    });
    expect(client.verifyIdToken).toHaveBeenCalledWith({ idToken: 'token', audience: 'hanflix-web-client-id' });
  });

  it('rejects an unverified Google email', async () => {
    const { GoogleIdentityService } = await import('./google-identity.js');
    const client = {
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({ sub: 'google-123', email: 'learner@example.com', email_verified: false,
          iss: 'https://accounts.google.com' }),
      }),
    } as unknown as Pick<OAuth2Client, 'verifyIdToken'>;
    await expect(new GoogleIdentityService(client).verify('token')).rejects.toMatchObject({ code: 'GOOGLE_IDENTITY_INVALID' });
  });

  it('rejects a forged or expired token', async () => {
    const { GoogleIdentityService } = await import('./google-identity.js');
    const client = { verifyIdToken: vi.fn().mockRejectedValue(new Error('Invalid signature')) } as unknown as Pick<OAuth2Client, 'verifyIdToken'>;
    await expect(new GoogleIdentityService(client).verify('token')).rejects.toMatchObject({ code: 'GOOGLE_IDENTITY_INVALID' });
  });
});
