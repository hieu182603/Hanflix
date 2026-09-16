import { createHash, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

export type TokenRole = 'user' | 'admin';
type TokenKind = 'access' | 'refresh';

type HanflixClaims = JwtPayload & {
  sub: string;
  role: TokenRole;
  kind: TokenKind;
  jti?: string;
};

export function signAccessToken(userId: string, role: TokenRole): string {
  const options: SignOptions = { subject: userId, expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'] };
  return jwt.sign({ role, kind: 'access' }, env.JWT_ACCESS_SECRET as Secret, options);
}

export function signRefreshToken(userId: string, role: TokenRole, jti: string): string {
  const options: SignOptions = { subject: userId, jwtid: jti, expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d` as SignOptions['expiresIn'] };
  return jwt.sign({ role, kind: 'refresh' }, env.JWT_REFRESH_SECRET as Secret, options);
}

function verifyToken(token: string, secret: string, expectedKind: TokenKind): HanflixClaims {
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === 'string' || payload.kind !== expectedKind || !payload.sub) {
      throw new Error('Unexpected token payload');
    }
    return payload as HanflixClaims;
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
  }
}

export const verifyAccessToken = (token: string) => verifyToken(token, env.JWT_ACCESS_SECRET, 'access');
export const verifyRefreshToken = (token: string) => verifyToken(token, env.JWT_REFRESH_SECRET, 'refresh');
export const newJti = () => randomUUID();
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const refreshExpiry = () => new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
