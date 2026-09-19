/**
 * Rate Limiters
 *
 * SECURITY (SEC-03 / H-1): These limiters default to in-memory store for local development.
 * When running multi-instance (Azure Container Apps maxReplicas=2, Kubernetes, PM2 cluster),
 * each instance has its own counter → limit becomes effectively (limit * instances).
 *
 * Production deployment options:
 *   1. Set REDIS_URL to enable a shared counter via `rate-limit-redis`. All replicas will
 *      share the same rate-limit window.
 *   2. Delegate rate limiting to the reverse proxy / WAF (Azure Front Door, Cloudflare, Nginx).
 *   3. Accept the multiplicative risk for maxReplicas=2 (current Azure Container Apps config).
 *
 * When REDIS_URL is set, this module transparently swaps in a Redis-backed store without
 * any route handler code changes. The Redis packages are optional — if REDIS_URL is unset
 * or the packages are missing, the limiter silently falls back to in-memory.
 */
import { ipKeyGenerator, rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../services/jwt.js';

const rateLimitHandler: RequestHandler = (_req, res) => {
  const retryAfterSeconds = Math.max(1, Number(res.getHeader('Retry-After')) || 60);
  res.status(429).json({ error: {
    code: 'RATE_LIMITED',
    message: `Bạn đã gửi nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
    retryAfterSeconds,
  } });
};

// Global middleware runs before requireAuth. Only trust a verified JWT subject,
// never raw tokens or client-supplied user IDs. This does not authorize requests.
function accountOrIpKey(req: Request): string {
  if (req.auth) return `user:${req.auth.userId}`;
  const authorization = req.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    try {
      return `user:${verifyAccessToken(authorization.slice(7)).sub}`;
    } catch { /* Anonymous/expired/invalid tokens share the IP budget. */ }
  }
  return `ip:${ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown')}`;
}

type RedisLike = {
  call: (...args: (string | number | Buffer)[]) => Promise<unknown>;
  on: (event: string, listener: (error: unknown) => void) => unknown;
};

interface RedisStoreCtor {
  new (options: { sendCommand: (...args: string[]) => Promise<unknown>; prefix: string }): unknown;
}

let redisClient: RedisLike | undefined;
let redisStoreBuilder: ((prefix: string) => unknown) | undefined;

if (env.REDIS_URL) {
  try {
    // Lazy require so projects without Redis do not crash at boot.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ioredisModule = require('ioredis') as new (url: string) => RedisLike;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RedisStore } = require('rate-limit-redis') as { RedisStore: RedisStoreCtor };
    redisClient = new ioredisModule(env.REDIS_URL);
    redisStoreBuilder = (prefix: string) => new RedisStore({
      sendCommand: (...args: string[]) => redisClient!.call(args[0]!, ...args.slice(1)).then(() => undefined) as Promise<unknown>,
      prefix,
    });
    redisClient.on('error', (error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[rate-limit] Redis error', error);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[rate-limit] REDIS_URL set but ioredis/rate-limit-redis is not installed; falling back to in-memory', error);
  }
}

function sharedStore(prefix: string) {
  return redisStoreBuilder ? redisStoreBuilder(prefix) : undefined;
}

export const globalLimiter = rateLimit({
  windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
  limit: env.GLOBAL_RATE_LIMIT_MAX,
  keyGenerator: accountOrIpKey,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedStore('rl:global:') as never,
  handler: rateLimitHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedStore('rl:auth:') as never,
  skipSuccessfulRequests: true,
  handler: rateLimitHandler,
});

// Background session renewal must not consume the failed-login/OTP budget.
export const refreshLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: env.REFRESH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedStore('rl:refresh:') as never,
  handler: rateLimitHandler,
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.AI_RATE_LIMIT_MAX,
  keyGenerator: accountOrIpKey,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedStore('rl:ai:') as never,
  handler: rateLimitHandler,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.UPLOAD_RATE_LIMIT_MAX,
  keyGenerator: accountOrIpKey,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedStore('rl:upload:') as never,
  handler: rateLimitHandler,
});

/**
 * Limit broadcast notifications: admin duy nhất có thể gọi route này
 * nhưng cần giới hạn để phòng admin compromised spam DB. 30 broadcast
 * mỗi 10 phút / account là đủ cho workflow broadcast thực tế.
 */
export const broadcastLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.BROADCAST_RATE_LIMIT_MAX,
  keyGenerator: accountOrIpKey,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedStore('rl:broadcast:') as never,
  handler: rateLimitHandler,
});
