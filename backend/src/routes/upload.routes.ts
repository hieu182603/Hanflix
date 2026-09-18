import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rate-limits.js';
import { handleSingleImageUpload, handleSingleAvatarUpload } from '../middleware/upload.js';
import { cloudinaryService } from '../services/cloudinary.service.js';
import { UserModel } from '../models/user.model.js';
import { publicUser } from '../utils/user.mapper.js';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { generateDefaultAvatarConfig } from '../utils/avatar-generator.js';
import { logger } from '../services/logger.js';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/v1/uploads/image
 * Generic image upload to Cloudinary.
 */
router.post(
  '/image',
  uploadLimiter,
  handleSingleImageUpload('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'Vui lòng chọn một file ảnh.');
    }

    const result = await cloudinaryService.uploadImageBuffer(req.file.buffer, {
      folder: 'hanflix/images',
      tags: ['general', req.auth!.userId.toString()],
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/uploads/avatar
 * Upload user avatar directly to Cloudinary and update user profile.
 * Cleans up previous Cloudinary avatar if one was configured.
 */
router.post(
  '/avatar',
  uploadLimiter,
  handleSingleAvatarUpload('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'Vui lòng chọn một file ảnh đại diện.');
    }

    const userId = req.auth!.userId.toString();
    const currentUser = await UserModel.findById(req.auth!.userId);
    if (!currentUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
    }

    const oldPublicId = currentUser.avatarPublicId;

    // Upload new image with avatar-optimized crop and quality
    const result = await cloudinaryService.uploadImageBuffer(req.file.buffer, {
      folder: 'hanflix/avatars',
      publicId: `avatar-${userId}-${Date.now()}`,
      tags: ['avatar', userId],
      transformation: [
        { width: 512, height: 512, crop: 'fill', gravity: 'face' },
        { fetch_format: 'auto', quality: 'auto' },
      ],
    });

    // Update database
    currentUser.avatarType = 'custom';
    currentUser.avatarUrl = result.url;
    currentUser.avatarPublicId = result.publicId;
    if (!currentUser.avatarConfig) {
      currentUser.avatarConfig = generateDefaultAvatarConfig(userId);
    }
    await currentUser.save();

    // Clean up old avatar image asynchronously if it existed
    if (oldPublicId && oldPublicId !== result.publicId) {
      cloudinaryService.deleteImage(oldPublicId).catch((err) => {
        // ERR-01: Use structured logger instead of console.warn
        logger.warn({ publicId: oldPublicId, error: err instanceof Error ? err.message : String(err) }, 'Failed to delete old Cloudinary avatar');
      });
    }

    res.json({
      success: true,
      data: {
        url: result.url,
        publicId: result.publicId,
        avatarType: currentUser.avatarType,
        user: publicUser(currentUser),
      },
    });
  })
);

/**
 * Restore default react-nice-avatar:
 * - Deletes custom image on Cloudinary if present
 * - Sets avatarType = 'generated', avatarUrl = null, avatarPublicId = null
 * - Preserves or generates avatarConfig
 */
async function handleRestoreAvatar(userId: unknown, res: any) {
  const currentUser = await UserModel.findById(userId);
  if (!currentUser) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  }

  const oldPublicId = currentUser.avatarPublicId;
  if (oldPublicId) {
    cloudinaryService.deleteImage(oldPublicId).catch((err) => {
      // ERR-01: Use structured logger instead of console.warn
      logger.warn({ publicId: oldPublicId, error: err instanceof Error ? err.message : String(err) }, 'Failed to delete old Cloudinary avatar on restore');
    });
  }

  if (!currentUser.avatarConfig) {
    currentUser.avatarConfig = generateDefaultAvatarConfig(String(currentUser._id));
  }

  currentUser.avatarType = 'generated';
  currentUser.avatarUrl = null;
  currentUser.avatarPublicId = null;
  await currentUser.save();

  res.json({
    success: true,
    data: {
      avatarType: 'generated',
      avatarUrl: null,
      avatarPublicId: null,
      user: publicUser(currentUser),
    },
  });
}

/**
 * DELETE /api/v1/uploads/avatar
 * Restore default avatar.
 */
router.delete(
  '/avatar',
  uploadLimiter,
  asyncHandler(async (req, res) => {
    await handleRestoreAvatar(req.auth!.userId, res);
  })
);

export default router;
