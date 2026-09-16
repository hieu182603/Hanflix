import 'dotenv/config';
import { z } from 'zod';

const optionalString = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional(),
);

const booleanFromString = z.preprocess(value => {
  if (typeof value !== 'string') return value;
  return value.toLowerCase() === 'true';
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),
  APP_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default('hanflix'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  REFRESH_COOKIE_NAME: z.string().default('hanflix_refresh'),
  COOKIE_DOMAIN: optionalString,
  COOKIE_SECURE: booleanFromString.default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET_NAME: optionalString,
  R2_PUBLIC_BASE_URL: optionalString,
  R2_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  R2_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(3600),
  MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(104857600),
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(12),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@hanflix.local'),
  SEED_ADMIN_PASSWORD: z.string().min(10).default('ChangeMe123!'),
}).superRefine((value, context) => {
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    context.addIssue({ code: 'custom', path: ['JWT_REFRESH_SECRET'], message: 'Refresh secret must differ from access secret' });
  }
  if (value.COOKIE_SAME_SITE === 'none' && !value.COOKIE_SECURE) {
    context.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'SameSite=None requires Secure cookies' });
  }
  if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) {
    context.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'Production refresh cookies must be secure' });
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = {
  ...parsed.data,
  APP_ORIGINS: parsed.data.APP_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean),
};

export type AppEnv = typeof env;
