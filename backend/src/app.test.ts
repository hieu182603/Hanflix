import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.MONGODB_DB_NAME = 'hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('./app.js'));
});

describe('application shell', () => {
  it('exposes a lightweight liveness endpoint', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('exposes the versioned API root', async () => {
    const response = await request(app).get('/api/v1');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ name: 'HanFlix API', version: 'v1' });
  });

  it('reports degraded health until MongoDB connects', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(503);
    expect(response.body.data.database).toBe('disconnected');
  });

  it('returns a structured 404', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBeTypeOf('string');
  });
});
