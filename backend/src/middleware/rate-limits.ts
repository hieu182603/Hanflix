/**
 * Rate Limiters
 *
 * NOTE (SEC-03): These limiters use in-memory store by default.
 * When running multi-instance (PM2 cluster / multiple containers),
 * each instance has its own counter → limit becomes effectively (limit * instances).
 * Mitigation: use a Redis store via `rate-limit-redis` in production, or
 * delegate rate limiting to a reverse proxy (Nginx/Cloudflare).
 *
 * TODO: Wire `rate-limit-redis` when Redis is available in production stack.
 */
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

const response = { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' } };

export const globalLimiter = rateLimit({
  windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
  limit: env.GLOBAL_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: response,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: response,
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.AI_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: response,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.UPLOAD_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: response,
});
