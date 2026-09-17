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
  APP_PUBLIC_URL: z.string().url().default('http://localhost:5173'),
  APP_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default('hanflix'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
  SMTP_SECURE: booleanFromString.default(false),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: optionalString,
  SMTP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().min(5).max(10080).default(1440),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
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
  R2_ENDPOINT: optionalString,
  R2_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  R2_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(3600),
  MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(104857600),
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  AZURE_TRANSLATOR_KEY: optionalString,
  AZURE_TRANSLATOR_REGION: optionalString,
  AZURE_TRANSLATOR_ENDPOINT: z.string().url().default('https://api.cognitive.microsofttranslator.com'),
  AZURE_SPEECH_KEY: optionalString,
  AZURE_SPEECH_REGION: optionalString,
  AZURE_SPEECH_ENDPOINT: optionalString,
  AZURE_SPEECH_LOCALE: z.string().trim().default('zh-CN'),
  AZURE_SPEECH_API_VERSION: z.string().trim().default('2025-10-15'),
  VIDEO_PROCESSING_MAX_RETRIES: z.coerce.number().int().min(1).max(10).default(3),
  VIDEO_PROCESSING_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(120).default(30),
  VIDEO_PROCESSING_POLL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  VIDEO_WORKER_MODE: z.enum(['embedded', 'standalone', 'disabled']).default('embedded'),
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
  if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASS)) {
    context.addIssue({ code: 'custom', path: ['SMTP_PASS'], message: 'SMTP_USER and SMTP_PASS must be configured together' });
  }
  if (value.NODE_ENV === 'production' && Boolean(value.SMTP_HOST) !== Boolean(value.SMTP_FROM)) {
    context.addIssue({ code: 'custom', path: ['SMTP_FROM'], message: 'SMTP_HOST and SMTP_FROM must be configured together in production' });
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
