import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './env.js';

const base = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/hanflix-test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('environment configuration', () => {
  it('derives the canonical R2 and Azure Speech endpoints', () => {
    const result = parseEnvironment({
      ...base,
      R2_ACCOUNT_ID: 'account123',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET_NAME: 'hanflix-media',
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'southeastasia',
    });

    expect(result.R2_ENDPOINT).toBe('https://account123.r2.cloudflarestorage.com');
    expect(result.AZURE_SPEECH_ENDPOINT).toBe('https://southeastasia.api.cognitive.microsoft.com');
  });

  it('rejects placeholder endpoints', () => {
    expect(() => parseEnvironment({
      ...base,
      R2_ACCOUNT_ID: 'account123',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET_NAME: 'hanflix-media',
      R2_ENDPOINT: 'https://ACCOUNT_ID.r2.cloudflarestorage.com',
    })).toThrow();
  });

  it('rejects partially configured provider groups', () => {
    expect(() => parseEnvironment({ ...base, AZURE_SPEECH_KEY: 'speech-key' })).toThrow();
    expect(() => parseEnvironment({ ...base, R2_ACCOUNT_ID: 'account123' })).toThrow();
  });

  it('enforces production transport and secret requirements', () => {
    expect(() => parseEnvironment({
      ...base,
      NODE_ENV: 'production',
      APP_PUBLIC_URL: 'http://localhost:5173',
      APP_ORIGINS: 'http://localhost:5173',
      COOKIE_SECURE: 'false',
      VIDEO_WORKER_MODE: 'disabled',
    })).toThrow();
  });

  it('accepts a complete production configuration with a disabled worker', () => {
    const result = parseEnvironment({
      ...base,
      NODE_ENV: 'production',
      APP_PUBLIC_URL: 'https://app.hanflix.test',
      APP_ORIGINS: 'https://app.hanflix.test',
      COOKIE_SECURE: 'true',
      VIDEO_WORKER_MODE: 'disabled',
      R2_ACCOUNT_ID: 'account123',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET_NAME: 'hanflix-media',
      SMTP_HOST: 'smtp.hanflix.test',
      SMTP_FROM: 'HanFlix <no-reply@hanflix.test>',
      METRICS_TOKEN: 'm'.repeat(32),
      SEED_ADMIN_PASSWORD: 'NonDefaultAdminPassword123!',
    });
    expect(result.COOKIE_SECURE).toBe(true);
  });

  it('requires worker providers and accepts a complete embedded production worker', () => {
    const production = {
      ...base,
      NODE_ENV: 'production',
      APP_PUBLIC_URL: 'https://app.hanflix.test',
      APP_ORIGINS: 'https://app.hanflix.test',
      COOKIE_SECURE: 'true',
      VIDEO_WORKER_MODE: 'embedded',
      R2_ACCOUNT_ID: 'account123',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET_NAME: 'hanflix-media',
      SMTP_HOST: 'smtp.hanflix.test',
      SMTP_FROM: 'HanFlix <no-reply@hanflix.test>',
      METRICS_TOKEN: 'm'.repeat(32),
      SEED_ADMIN_PASSWORD: 'NonDefaultAdminPassword123!',
    };
    expect(() => parseEnvironment(production)).toThrow();
    const result = parseEnvironment({
      ...production,
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'southeastasia',
      AZURE_TRANSLATOR_KEY: 'translator-key',
      AZURE_TRANSLATOR_REGION: 'southeastasia',
    });
    expect(result.VIDEO_WORKER_MODE).toBe('embedded');
  });
});
