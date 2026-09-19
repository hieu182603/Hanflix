import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';

vi.mock('../config/env.js', () => ({ env: {
  GLOBAL_RATE_LIMIT_WINDOW_MS: 60_000, GLOBAL_RATE_LIMIT_MAX: 3,
  AUTH_RATE_LIMIT_MAX: 2, REFRESH_RATE_LIMIT_MAX: 3,
  AI_RATE_LIMIT_MAX: 2, UPLOAD_RATE_LIMIT_MAX: 2,
  JWT_ACCESS_SECRET: 'test-access-secret-long-enough-for-test', JWT_ACCESS_TTL: '15m',
} }));

import { globalLimiter, authLimiter, refreshLimiter, aiLimiter, uploadLimiter } from './rate-limits.js';
import { signAccessToken } from '../services/jwt.js';

it('isolates accounts on the same IP, but token changes do not reset an account budget', async () => {
  const app = express();
  app.use(globalLimiter);
  app.get('/', (_req, res) => res.sendStatus(200));
  const first = signAccessToken('user-one', 'user');
  const renewed = signAccessToken('user-one', 'admin');
  for (let i = 0; i < 3; i++) {
    expect((await request(app).get('/').auth(first, { type: 'bearer' })).status).toBe(200);
  }
  const blocked = await request(app).get('/').auth(renewed, { type: 'bearer' });
  expect(blocked.status).toBe(429);
  expect(blocked.body.error.retryAfterSeconds).toBeGreaterThan(0);
  expect(Number(blocked.headers['retry-after'])).toBe(blocked.body.error.retryAfterSeconds);
  expect((await request(app).get('/').auth(signAccessToken('user-two', 'user'), { type: 'bearer' })).status).toBe(200);
});

it('invalid tokens cannot bypass the anonymous IP limit', async () => {
  const app = express();
  app.use(globalLimiter);
  app.get('/', (_req, res) => res.sendStatus(200));
  for (let i = 0; i < 3; i++) {
    expect((await request(app).get('/').auth(`fake-${i}`, { type: 'bearer' })).status).toBe(200);
  }
  expect((await request(app).get('/')).status).toBe(429);
});

it('refresh failures do not block login and successful login does not consume the failure budget', async () => {
  const app = express();
  app.post('/refresh', refreshLimiter, (_req, res) => res.sendStatus(401));
  app.post('/login', authLimiter, (req, res) => res.sendStatus(req.query.fail ? 401 : 200));
  for (let i = 0; i < 3; i++) await request(app).post('/refresh');
  expect((await request(app).post('/refresh')).status).toBe(429);
  for (let i = 0; i < 4; i++) expect((await request(app).post('/login')).status).toBe(200);
  for (let i = 0; i < 2; i++) expect((await request(app).post('/login?fail=1')).status).toBe(401);
  expect((await request(app).post('/login?fail=1')).status).toBe(429);
});

it.each([['AI', aiLimiter], ['upload', uploadLimiter]] as const)('%s budgets are per account', async (_name, limiter) => {
  const app = express();
  app.post('/', limiter, (_req, res) => res.sendStatus(200));
  const first = signAccessToken('account-a', 'user');
  for (let i = 0; i < 2; i++) expect((await request(app).post('/').auth(first, { type: 'bearer' })).status).toBe(200);
  expect((await request(app).post('/').auth(first, { type: 'bearer' })).status).toBe(429);
  expect((await request(app).post('/').auth(signAccessToken('account-b', 'user'), { type: 'bearer' })).status).toBe(200);
});
