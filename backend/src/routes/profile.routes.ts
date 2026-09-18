import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { UserModel } from '../models/user.model.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(requireAuth);

const profileSchema = z.object({
  currentHsk: z.number().int().min(1).max(9).optional(),
  currentHskSource: z.enum(['unknown', 'self_reported', 'assessed']).default('unknown'),
  targetHsk: z.number().int().min(1).max(9).optional(),
  goal: z.enum(['daily', 'travel', 'work', 'hsk', 'culture', 'other']).optional(),
  focusSkills: z.array(z.enum(['listening', 'reading', 'vocabulary', 'sentence_usage', 'unknown'])).max(2).default([]),
  topicIds: z.array(z.string().trim().min(1).max(50)).max(3).default([]),
  dailyMinutes: z.number().int().min(5).max(120).optional(),
  studyDaysPerWeek: z.number().int().min(1).max(7).optional(),
  subtitlePreference: z.enum(['all', 'zh_pinyin', 'zh_vi', 'zh_only', 'unknown']).default('all'),
  surveyVersion: z.number().int().min(1).default(1),
});

const basicProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
}).refine(data => data.name !== undefined, {
  message: 'Cần ít nhất một thông tin để cập nhật',
});

router.get('/', asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.auth!.userId).select('name email avatarUrl googleAvatarUrl avatarType avatarConfig avatarPublicId learningProfile role status').lean();
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  res.json({ data: user });
}));

router.patch('/', validate(basicProfileSchema), asyncHandler(async (req, res) => {
  const update: { name?: string } = {};
  if (req.body.name !== undefined) update.name = req.body.name;

  const user = await UserModel.findByIdAndUpdate(
    req.auth!.userId,
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  ).select('name email avatarUrl googleAvatarUrl avatarType avatarConfig avatarPublicId learningProfile role status');
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  res.json({ data: user });
}));

router.put('/learning', validate(profileSchema), asyncHandler(async (req, res) => {
  const user = await UserModel.findByIdAndUpdate(
    req.auth!.userId,
    { $set: { learningProfile: req.body } },
    { returnDocument: 'after', runValidators: true },
  ).select('learningProfile');
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  res.json({ data: { learningProfile: user.learningProfile } });
}));

export default router;

