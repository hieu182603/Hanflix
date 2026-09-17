import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

type VerifyClient = Pick<OAuth2Client, 'verifyIdToken'>;

export class GoogleIdentityService {
  constructor(private readonly client: VerifyClient = new OAuth2Client()) {}

  async verify(credential: string): Promise<GoogleIdentity> {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError(503, 'GOOGLE_LOGIN_NOT_CONFIGURED', 'Đăng nhập Google chưa được cấu hình');
    }
    try {
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified !== true ||
        !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss ?? '')) {
        throw new AppError(401, 'GOOGLE_IDENTITY_INVALID', 'Tài khoản Google không hợp lệ hoặc email chưa được xác minh');
      }
      return {
        sub: payload.sub,
        email: payload.email.trim().toLowerCase(),
        name: (payload.name || payload.email.split('@')[0] || 'Người học').slice(0, 80),
        picture: payload.picture,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'GOOGLE_IDENTITY_INVALID', 'Google ID token không hợp lệ hoặc đã hết hạn');
    }
  }
}

export const googleIdentityService = new GoogleIdentityService();
