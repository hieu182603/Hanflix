import 'dotenv/config';
import { z } from 'zod';

const optionalString = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional(),
);

const optionalUrl = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().url().optional(),
);

const optionalSecret = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(32).optional(),
);

const placeholderPattern = /(?:replace-with|YOUR_|USERNAME|PASSWORD|ACCOUNT_ID|<[^>]+>)/i;

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
  R2_PUBLIC_BASE_URL: optionalUrl,
  R2_ENDPOINT: optionalUrl,
  R2_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  R2_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(3600),
  MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(104857600),
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().trim().regex(/^gemini-[a-z0-9.-]+$/, 'Use a Gemini API model ID, for example gemini-3.5-flash-lite').default('gemini-3.5-flash-lite'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  AZURE_TRANSLATOR_KEY: optionalString,
  AZURE_TRANSLATOR_REGION: optionalString,
  AZURE_TRANSLATOR_ENDPOINT: z.string().url().default('https://api.cognitive.microsofttranslator.com'),
  AZURE_SPEECH_KEY: optionalString,
  AZURE_SPEECH_REGION: optionalString,
  AZURE_SPEECH_ENDPOINT: optionalUrl,
  AZURE_SPEECH_LOCALE: z.string().trim().default('zh-CN'),
  AZURE_SPEECH_API_VERSION: z.string().trim().default('2025-10-15'),
  AZURE_PROVIDER_MAX_RETRIES: z.coerce.number().int().min(1).max(5).default(2),
  VIDEO_PROCESSING_MAX_RETRIES: z.coerce.number().int().min(1).max(10).default(3),
  VIDEO_PROCESSING_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(120).default(30),
  VIDEO_PROCESSING_POLL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  VIDEO_WORKER_MODE: z.enum(['embedded', 'standalone', 'disabled']).default('embedded'),
  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(12),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  METRICS_TOKEN: optionalSecret,
  SEED_ADMIN_EMAIL: z.string().email().default('admin@hanflix.local'),
  SEED_ADMIN_PASSWORD: z.string().min(10).default('ChangeMe123!'),
}).superRefine((value, context) => {
  const rejectPlaceholder = (name: keyof typeof value) => {
    const configured = value[name];
    if (typeof configured === 'string' && placeholderPattern.test(configured)) {
      context.addIssue({ code: 'custom', path: [name], message: `${name} vẫn là giá trị mẫu` });
    }
  };
  const requireTogether = (names: Array<keyof typeof value>, label: string) => {
    const configured = names.filter(name => Boolean(value[name]));
    if (configured.length > 0 && configured.length < names.length) {
      for (const name of names) {
        if (!value[name]) context.addIssue({ code: 'custom', path: [name], message: `${label} phải được cấu hình đầy đủ` });
      }
    }
  };
  const requireProduction = (name: keyof typeof value, label: string) => {
    if (value.NODE_ENV === 'production' && !value[name]) {
      context.addIssue({ code: 'custom', path: [name], message: `${label} là bắt buộc trong production` });
    }
  };

  for (const name of [
    'MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT', 'AZURE_TRANSLATOR_KEY',
    'AZURE_TRANSLATOR_ENDPOINT', 'AZURE_SPEECH_KEY', 'AZURE_SPEECH_ENDPOINT', 'GEMINI_API_KEY',
  ] as const) rejectPlaceholder(name);

  requireTogether(['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'], 'Cloudflare R2');
  requireTogether(['AZURE_TRANSLATOR_KEY', 'AZURE_TRANSLATOR_REGION'], 'Azure Translator');
  requireTogether(['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'], 'Azure Speech');

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
  if (value.R2_ENDPOINT && value.R2_ACCOUNT_ID) {
    const expectedHost = `${value.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.toLowerCase();
    if (new URL(value.R2_ENDPOINT).hostname.toLowerCase() !== expectedHost) {
      context.addIssue({ code: 'custom', path: ['R2_ENDPOINT'], message: 'R2_ENDPOINT không khớp R2_ACCOUNT_ID' });
    }
  }
  if (value.NODE_ENV === 'production') {
    for (const [name, label] of [
      ['R2_ACCOUNT_ID', 'R2 account ID'], ['R2_ACCESS_KEY_ID', 'R2 access key'],
      ['R2_SECRET_ACCESS_KEY', 'R2 secret key'], ['R2_BUCKET_NAME', 'R2 bucket'],
      ['SMTP_HOST', 'SMTP host'], ['SMTP_FROM', 'SMTP from address'],
      ['METRICS_TOKEN', 'Metrics bearer token'],
    ] as const) requireProduction(name, label);
    if (value.VIDEO_WORKER_MODE !== 'disabled') {
      for (const [name, label] of [
        ['AZURE_SPEECH_KEY', 'Azure Speech key'], ['AZURE_SPEECH_REGION', 'Azure Speech region'],
        ['AZURE_TRANSLATOR_KEY', 'Azure Translator key'], ['AZURE_TRANSLATOR_REGION', 'Azure Translator region'],
      ] as const) requireProduction(name, label);
    }
    if (!value.APP_PUBLIC_URL.startsWith('https://')) {
      context.addIssue({ code: 'custom', path: ['APP_PUBLIC_URL'], message: 'APP_PUBLIC_URL phải dùng HTTPS trong production' });
    }
    const insecureOrigin = value.APP_ORIGINS.split(',').map(origin => origin.trim()).find(origin => origin && !origin.startsWith('https://'));
    if (insecureOrigin) {
      context.addIssue({ code: 'custom', path: ['APP_ORIGINS'], message: 'Mọi APP_ORIGINS phải dùng HTTPS trong production' });
    }
    if (value.SEED_ADMIN_PASSWORD === 'ChangeMe123!') {
      context.addIssue({ code: 'custom', path: ['SEED_ADMIN_PASSWORD'], message: 'Không được dùng mật khẩu seed mặc định trong production' });
    }
  }
});

export function parseEnvironment(input: NodeJS.ProcessEnv) {
  const parsed = envSchema.parse(input);
  return {
    ...parsed,
    APP_ORIGINS: parsed.APP_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean),
    R2_ENDPOINT: parsed.R2_ENDPOINT || (parsed.R2_ACCOUNT_ID
      ? `https://${parsed.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined),
    AZURE_SPEECH_ENDPOINT: parsed.AZURE_SPEECH_ENDPOINT || (parsed.AZURE_SPEECH_REGION
      ? `https://${parsed.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com`
      : undefined),
  };
}

let resolvedEnv: ReturnType<typeof parseEnvironment>;
try {
  resolvedEnv = parseEnvironment(process.env);
} catch (error) {
  const fieldErrors = error instanceof z.ZodError ? error.flatten().fieldErrors : undefined;
  console.error('Invalid environment configuration', fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = resolvedEnv;

export type AppEnv = typeof env;
