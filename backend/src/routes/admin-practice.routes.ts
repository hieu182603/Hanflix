import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { PracticeSetModel } from '../models/practice.model.js';
import { practiceSetInput, practiceSkills } from '../services/practice.service.js';

const router = Router();
router.use(requireAuth, requireAdmin);
const list = z.object({ hsk: z.coerce.number().int().min(1).max(9).optional(), skill: z.enum(practiceSkills).optional(), status: z.enum(['draft', 'published']).optional(), page: z.coerce.number().int().min(1).default(1) });
const id = z.object({ id: z.string().refine(Types.ObjectId.isValid) });
router.get('/', validateQuery(list), asyncHandler(async (req, res) => {
  const { page, ...filter } = (req as unknown as { parsedQuery: z.infer<typeof list> }).parsedQuery;
  const [items, total] = await Promise.all([
    PracticeSetModel.find(filter).select('title hsk skill status revision durationSeconds').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20).lean(),
    PracticeSetModel.countDocuments(filter),
  ]);
  res.json({ data: { items, page, totalPages: Math.max(1, Math.ceil(total / 20)) } });
}));
router.get('/:id', validate(id, 'params'), asyncHandler(async (req, res) => {
  const item = await PracticeSetModel.findById(req.params.id).lean();
  if (!item) throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Không tìm thấy bộ luyện');
  res.json({ data: item });
}));
router.post('/', validate(practiceSetInput), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await PracticeSetModel.create({ ...req.body, revision: 1 }) });
}));
router.put('/:id', validate(id, 'params'), validate(practiceSetInput.safeExtend({ revision: z.number().int().min(1) })), asyncHandler(async (req, res) => {
  const { revision, ...input } = req.body;
  const item = await PracticeSetModel.findOneAndUpdate({ _id: req.params.id, revision }, { $set: input, $inc: { revision: 1 } }, { returnDocument: 'after', runValidators: true });
  if (!item) throw new AppError(409, 'PRACTICE_CHANGED', 'Bộ luyện đã thay đổi. Hãy tải lại trước khi lưu.');
  res.json({ data: item });
}));
export default router;
