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
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

const response = { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' } };

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
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedStore('rl:global:') as never,
  message: response,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedStore('rl:auth:') as never,
  skipSuccessfulRequests: true,
  message: response,
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.AI_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedStore('rl:ai:') as never,
  message: response,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.UPLOAD_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: sharedStore('rl:upload:') as never,
  message: response,
});
