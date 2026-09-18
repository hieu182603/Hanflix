import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { VocabularyModel } from '../models/vocabulary.model.js';
import { vocabularyService, vocabularyValidationSchema } from '../services/vocabulary.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

const objectIdSchema = z.object({ id: z.string().refine(Types.ObjectId.isValid, 'Invalid ObjectId') });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  hskLevel: z.string().optional(),
  status: z.enum(['published', 'draft', 'pending_review', 'all']).optional(),
  search: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  sort: z.string().optional(),
});

const importPayloadSchema = z.object({
  mode: z.enum(['preview', 'commit']).default('preview'),
  strategy: z.enum(['skip_existing', 'update_existing', 'insert_only']).default('skip_existing'),
  items: z.array(z.record(z.string(), z.any())).min(1, 'Items list cannot be empty'),
});

// GET /api/admin/vocabulary/stats
router.get('/stats', asyncHandler(async (_req, res) => {
  const stats = await vocabularyService.getStatistics();
  res.json({ data: stats });
}));

// GET /api/admin/vocabulary
router.get('/', validateQuery(listQuerySchema), asyncHandler(async (req, res) => {
  const query = (req as unknown as Record<string, unknown>).parsedQuery as z.infer<typeof listQuerySchema>;
  const result = await vocabularyService.searchCatalog({
    page: query.page,
    limit: query.limit,
    hskLevel: query.hskLevel,
    status: query.status,
    search: query.search,
    tag: query.tag,
    sort: query.sort,
  });
  res.json({ data: result });
}));

// GET /api/admin/vocabulary/:id
router.get('/:id', validate(objectIdSchema, 'params'), asyncHandler(async (req, res) => {
  const item = await VocabularyModel.findById(req.params.id).lean();
  if (!item) throw new AppError(404, 'VOCABULARY_NOT_FOUND', 'Không tìm thấy từ vựng');
  res.json({ data: item });
}));

// POST /api/admin/vocabulary
router.post('/', validate(vocabularyValidationSchema), asyncHandler(async (req, res) => {
  const existing = await VocabularyModel.findOne({
    simplified: req.body.simplified,
    pinyin: req.body.pinyin,
  });
  if (existing) {
    throw new AppError(409, 'VOCABULARY_DUPLICATE', 'Từ vựng với Hán tự và Pinyin này đã tồn tại');
  }

  const created = await VocabularyModel.create(req.body);
  res.status(201).json({ data: created });
}));

// PATCH /api/admin/vocabulary/:id
router.patch('/:id', validate(objectIdSchema, 'params'), validate(vocabularyValidationSchema.partial()), asyncHandler(async (req, res) => {
  const item = await VocabularyModel.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { returnDocument: 'after', runValidators: true }
  );
  if (!item) throw new AppError(404, 'VOCABULARY_NOT_FOUND', 'Không tìm thấy từ vựng');
  res.json({ data: item });
}));

// DELETE /api/admin/vocabulary/:id
router.delete('/:id', validate(objectIdSchema, 'params'), asyncHandler(async (req, res) => {
  const item = await VocabularyModel.findByIdAndDelete(req.params.id);
  if (!item) throw new AppError(404, 'VOCABULARY_NOT_FOUND', 'Không tìm thấy từ vựng');
  res.status(204).send();
}));

// POST /api/admin/vocabulary/import
router.post('/import', validate(importPayloadSchema), asyncHandler(async (req, res) => {
  const { mode, strategy, items } = req.body as z.infer<typeof importPayloadSchema>;
  const dryRun = mode === 'preview';

  const report = await vocabularyService.processBatchImport(items, {
    mode: strategy,
    dryRun,
  });

  res.json({ data: { mode, strategy, ...report } });
}));

export default router;
