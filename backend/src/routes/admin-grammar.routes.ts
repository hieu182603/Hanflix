import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { GrammarModel } from '../models/grammar.model.js';
import { grammarService, grammarValidationSchema } from '../services/grammar.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

const objectIdSchema = z.object({ id: z.string().refine(Types.ObjectId.isValid, 'Invalid ObjectId') });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  hskLevel: z.string().optional(),
  status: z.enum(['published', 'draft', 'pending_review', 'all']).optional(),
  search: z.string().trim().optional(),
});

// GET /api/admin/grammar/stats
router.get('/stats', asyncHandler(async (_req, res) => {
  const stats = await grammarService.getStatistics();
  res.json({ data: stats });
}));

// GET /api/admin/grammar
router.get('/', validateQuery(listQuerySchema), asyncHandler(async (req, res) => {
  const query = (req as unknown as Record<string, unknown>).parsedQuery as z.infer<typeof listQuerySchema>;
  const result = await grammarService.searchGrammar({
    page: query.page,
    limit: query.limit,
    hskLevel: query.hskLevel,
    status: query.status,
    search: query.search,
  });
  res.json({ data: result });
}));

// GET /api/admin/grammar/:id
router.get('/:id', validate(objectIdSchema, 'params'), asyncHandler(async (req, res) => {
  const item = await GrammarModel.findById(req.params.id).lean();
  if (!item) throw new AppError(404, 'GRAMMAR_NOT_FOUND', 'Không tìm thấy điểm ngữ pháp');
  res.json({ data: item });
}));

// POST /api/admin/grammar
router.post('/', validate(grammarValidationSchema), asyncHandler(async (req, res) => {
  const count = await GrammarModel.countDocuments({});
  const code = req.body.code || `GF-${String(count + 1).padStart(3, '0')}`;
  const created = await GrammarModel.create({
    ...req.body,
    code,
  });
  res.status(201).json({ data: created });
}));

// PATCH /api/admin/grammar/:id
router.patch('/:id', validate(objectIdSchema, 'params'), validate(grammarValidationSchema.partial()), asyncHandler(async (req, res) => {
  const item = await GrammarModel.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { returnDocument: 'after', runValidators: true }
  );
  if (!item) throw new AppError(404, 'GRAMMAR_NOT_FOUND', 'Không tìm thấy điểm ngữ pháp');
  res.json({ data: item });
}));

// DELETE /api/admin/grammar/:id
router.delete('/:id', validate(objectIdSchema, 'params'), asyncHandler(async (req, res) => {
  const item = await GrammarModel.findByIdAndDelete(req.params.id);
  if (!item) throw new AppError(404, 'GRAMMAR_NOT_FOUND', 'Không tìm thấy điểm ngữ pháp');
  res.status(204).send();
}));

export default router;
