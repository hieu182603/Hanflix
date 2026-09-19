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
  // SECURITY (H-5): Explicit TLS toggle for MongoDB connections. Defaults to true in production
  // (see database.ts). Set MONGODB_TLS=false only when connecting to a local mongod.
  MONGODB_TLS: booleanFromString.optional(),
  MONGODB_TLS_ALLOW_INVALID: booleanFromString.optional(),
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
  QUIZ_AUTO_GENERATION_ENABLED: booleanFromString.default(true),
  QUIZ_AUTO_GENERATION_KINDS: z.string().default('comprehension,vocabulary,grammar,cloze'),
  // After Azure Translator returns the literal Vietnamese translation, send
  // each batch of cues through Gemini to rewrite a more natural, idiomatic
  // Vietnamese version. Set false to fall back to raw Azure output.
  GEMINI_TRANSLATION_IMPROVE_ENABLED: booleanFromString.default(true),
  // How many cues to send per Gemini rewrite request. Larger = cheaper (fewer
  // requests) but slower per request. Default 25 works well for 5-minute videos.
  GEMINI_TRANSLATION_BATCH_SIZE: z.coerce.number().int().min(5).max(60).default(25),
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
  // F11 fix (2026-09-18): disable transactions explicitly. Some Atlas tiers
  // (e.g. M0 free) advertise ReplicaSetWithPrimary but the driver still
  // throws "Only servers in a sharded cluster can start a new transaction"
  // on the second session — we fall back to sequential writes instead.
  // Set DISABLE_TRANSACTIONS=true in .env to opt out for production runs
  // that you control via your own Mongo replica set.
  // NOTE: we use a string → enum transform instead of z.coerce.boolean()
  // because Boolean("false") === true (any non-empty string is truthy).
  DISABLE_TRANSACTIONS: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  // F04 fix (2026-09-18): per-stage deadlines (milliseconds). When a stage runs
  // longer than its deadline, the worker aborts the in-flight ffmpeg/ASR call
  // and fails the job. Each value is the absolute ceiling; the pipeline also
  // enforces `leaseExpiresAt` (a sliding window) on every heartbeat.
  VIDEO_STAGE_DEADLINE_INSPECT_MS: z.coerce.number().int().min(10_000).max(600_000).default(60_000),
  VIDEO_STAGE_DEADLINE_TRANSCRIBE_MS: z.coerce.number().int().min(60_000).max(1_800_000).default(900_000),
  VIDEO_STAGE_DEADLINE_PINYIN_MS: z.coerce.number().int().min(10_000).max(600_000).default(120_000),
  VIDEO_STAGE_DEADLINE_TRANSLATE_MS: z.coerce.number().int().min(10_000).max(600_000).default(180_000),
  VIDEO_STAGE_DEADLINE_VOCABULARY_MS: z.coerce.number().int().min(10_000).max(300_000).default(60_000),
  VIDEO_STAGE_DEADLINE_QUIZ_MS: z.coerce.number().int().min(10_000).max(300_000).default(60_000),
  VIDEO_STAGE_DEADLINE_FINALIZE_MS: z.coerce.number().int().min(10_000).max(300_000).default(60_000),
  // F04: lease TTL (seconds). Worker must heartbeat within this window or its
  // lease is considered abandoned and another worker may claim the job.
  VIDEO_LEASE_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(120),
  // F04: heartbeat interval (seconds). Worker emits heartbeat at this rate.
  VIDEO_HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(120).default(20),
  // F12 fix (2026-09-19): playback derivative MP4 faststart + transcoding.
  // When enabled, the pipeline runs ffmpeg after audio extraction to either
  // remux (no re-encode when already H.264/AAC) or transcode to a
  // web-friendly MP4 with `+faststart`. Set to false to skip the step
  // entirely (legacy videos keep their original file as the playback URL).
  PLAYBACK_DERIVATIVE_ENABLED: booleanFromString.default(true),
  // Maximum output height for the transcoded playback derivative. Source
  // videos are downscaled to this height without upscaling — keeps the
  // bundle size small while preserving text legibility for Chinese.
  PLAYBACK_DERIVATIVE_MAX_HEIGHT: z.coerce.number().int().min(240).max(2160).default(720),
  // Maximum output bitrate (kbps) for the H.264 encoder. Default 2500
  // is a sensible middle ground for 720p educational video. Hard floor 500
  // kbps because anything lower makes Chinese characters unreadable on the
  // derivative. Hard ceiling 20 mbps because R2 egress costs grow linearly
  // and we never want the derivative to exceed the source bitrate.
  PLAYBACK_DERIVATIVE_VIDEO_BITRATE_KBPS: z.coerce.number().int().min(500).max(20000).default(2500),
  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  REFRESH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(24),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  // Limit how often an admin can broadcast notifications. 30 broadcast / 10
  // minutes is enough for real workflows; tighter bound prevents admin
  // compromised or buggy script from spamming the notifications collection.
  BROADCAST_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  // SECURITY (H-1): Optional Redis URL for shared rate-limit counters across replicas.
  REDIS_URL: optionalString,
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  CLOUDINARY_URL: optionalString,
  METRICS_TOKEN: optionalSecret,
  // SECURITY (SEC-04): Optional CIDR/IP allowlist for /metrics. Empty = allow any source
  // that has a valid bearer token. Useful for restricting scraping to monitoring subnets.
  METRICS_IP_ALLOWLIST: z.string().default(''),
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
      // REDIS_URL is intentionally NOT required in production — the rate-limit
      // middleware transparently falls back to in-memory when REDIS_URL is unset
      // (see backend/src/middleware/rate-limits.ts). For multi-replica deployments
      // where shared counters matter, set REDIS_URL to a real Redis/Upstash URL.
      // ['REDIS_URL', 'Redis URL (required for shared rate limiting)'],
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
    METRICS_IP_ALLOWLIST: parsed.METRICS_IP_ALLOWLIST
      ? parsed.METRICS_IP_ALLOWLIST.split(',').map(entry => entry.trim()).filter(Boolean)
      : [],
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
