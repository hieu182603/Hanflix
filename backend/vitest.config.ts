import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: { reporter: ['text', 'json-summary'] },
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/hanflix-test',
      JWT_ACCESS_SECRET: '01234567890123456789012345678901',
      JWT_REFRESH_SECRET: 'abcdefghijklmnopqrstuvwxyzabcdef',
      REDIS_URL: 'redis://127.0.0.1:6379',
      GEMINI_API_KEY: 'test-gemini-api-key',
    },
  },
});
