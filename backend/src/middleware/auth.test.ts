import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireAdmin } from './auth.js';

describe('requireAdmin', () => {
  it('rejects an authenticated non-admin user', () => {
    const request = { auth: { userId: {} as never, role: 'user' } } as Request;
    const next = vi.fn() as unknown as NextFunction;
    requireAdmin(request, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(vi.mocked(next).mock.calls[0]?.[0]).toMatchObject({ statusCode: 403, code: 'ADMIN_REQUIRED' });
  });
});
