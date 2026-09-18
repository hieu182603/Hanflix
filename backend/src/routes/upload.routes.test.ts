import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import type { Express } from 'express';

let app: Express;
let UserModel: typeof import('../models/user.model.js').UserModel;
let cloudinaryService: typeof import('../services/cloudinary.service.js').cloudinaryService;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ cloudinaryService } = await import('../services/cloudinary.service.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

afterEach(() => vi.restoreAllMocks());

describe('Upload routes (Cloudinary & Multer)', () => {
  it('POST /api/v1/uploads/image uploads an image successfully', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) }),
    } as never);

    vi.spyOn(cloudinaryService, 'uploadImageBuffer').mockResolvedValue({
      url: 'https://res.cloudinary.com/hanflix/image/upload/v1234/test.jpg',
      publicId: 'hanflix/images/test',
      format: 'jpg',
      width: 400,
      height: 400,
      bytes: 12345,
    });

    const token = signAccessToken(userId.toString(), 'user');
    const imageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]); // Minimal JPEG signature

    const response = await request(app)
      .post('/api/v1/uploads/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', imageBuffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(200);
    expect(response.body.data.url).toBe('https://res.cloudinary.com/hanflix/image/upload/v1234/test.jpg');
    expect(response.body.data.publicId).toBe('hanflix/images/test');
  });

  it('POST /api/v1/uploads/avatar uploads avatar, updates UserModel and cleans up old avatar', async () => {
    const userId = new Types.ObjectId();
    const mockUserDoc = {
      _id: userId,
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      status: 'active',
      avatarType: 'custom',
      avatarUrl: 'https://res.cloudinary.com/hanflix/image/upload/old.jpg',
      avatarPublicId: 'hanflix/avatars/old-public-id',
      avatarConfig: { sex: 'man' },
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(UserModel, 'findById').mockImplementation(((id: any) => {
      // For requireAuth middleware
      if (typeof id === 'object' && id?._id) return mockUserDoc as never;
      return {
        select: () => ({ lean: () => Promise.resolve(mockUserDoc) }),
        ...mockUserDoc,
      } as never;
    }) as never);

    vi.spyOn(cloudinaryService, 'uploadImageBuffer').mockResolvedValue({
      url: 'https://res.cloudinary.com/hanflix/image/upload/v1234/avatar-new.jpg',
      publicId: 'hanflix/avatars/avatar-new',
      format: 'jpg',
      bytes: 9999,
    });

    const deleteSpy = vi.spyOn(cloudinaryService, 'deleteImage').mockResolvedValue({ result: 'ok' });

    const token = signAccessToken(userId.toString(), 'user');
    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // Minimal PNG signature

    const response = await request(app)
      .post('/api/v1/uploads/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', imageBuffer, { filename: 'my-avatar.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.data.url).toBe('https://res.cloudinary.com/hanflix/image/upload/v1234/avatar-new.jpg');
    expect(response.body.data.avatarType).toBe('custom');
    expect(response.body.data.user.avatarUrl).toBe('https://res.cloudinary.com/hanflix/image/upload/v1234/avatar-new.jpg');
    expect(deleteSpy).toHaveBeenCalledWith('hanflix/avatars/old-public-id');
  });

  it('DELETE /api/v1/uploads/avatar restores default generated avatar and cleans up Cloudinary', async () => {
    const userId = new Types.ObjectId();
    const mockUserDoc = {
      _id: userId,
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      status: 'active',
      avatarType: 'custom',
      avatarUrl: 'https://res.cloudinary.com/hanflix/image/upload/old.jpg',
      avatarPublicId: 'hanflix/avatars/to-delete',
      avatarConfig: { sex: 'man' },
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(UserModel, 'findById').mockImplementation(((id: any) => {
      return {
        select: () => ({ lean: () => Promise.resolve(mockUserDoc) }),
        ...mockUserDoc,
      } as never;
    }) as never);

    const deleteSpy = vi.spyOn(cloudinaryService, 'deleteImage').mockResolvedValue({ result: 'ok' });

    const token = signAccessToken(userId.toString(), 'user');
    const response = await request(app)
      .delete('/api/v1/uploads/avatar')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.avatarType).toBe('generated');
    expect(response.body.data.avatarUrl).toBeNull();
    expect(response.body.data.user.avatarType).toBe('generated');
    expect(deleteSpy).toHaveBeenCalledWith('hanflix/avatars/to-delete');
  });

  it('rejects unsupported file mime types', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) }),
    } as never);

    const token = signAccessToken(userId.toString(), 'user');
    const response = await request(app)
      .post('/api/v1/uploads/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('console.log("hello")'), { filename: 'script.js', contentType: 'application/javascript' });

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects request when no file is uploaded', async () => {
    const userId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: userId, role: 'user', status: 'active' }) }),
    } as never);

    const token = signAccessToken(userId.toString(), 'user');
    const response = await request(app)
      .post('/api/v1/uploads/image')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('FILE_REQUIRED');
  });
});
