import { grammarService } from '../services/grammar.service.js';
import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/validate.js';
import { GrammarModel } from '../models/grammar.model.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  hskLevel: z.string().optional(),
  search: z.string().optional(),
});

// GET /api/v1/grammar - Public grammar list for learners
router.get('/', validateQuery(listQuerySchema), asyncHandler(async (req, res) => {
  const query = (req as unknown as { parsedQuery: z.infer<typeof listQuerySchema> }).parsedQuery;
  const result = await grammarService.searchGrammar({ ...query, status: 'published' });
  res.json({ data: result });
}));

// GET /api/v1/grammar/stats - Get grammar statistics
router.get('/stats', asyncHandler(async (_req, res) => {
  const stats = await GrammarModel.aggregate([
    { $match: { status: 'published' } },
    {
      $group: {
        _id: '$hskLevel',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const total = await GrammarModel.countDocuments({ status: 'published' });

  res.json({
    data: {
      total,
      byLevel: stats.reduce<Record<string, number>>((acc, s) => {
        acc[String(s._id)] = s.count;
        return acc;
      }, {}),
    },
  });
}));

// GET /api/v1/grammar/:id - Get single grammar point
router.get('/:id', asyncHandler(async (req, res) => {
  const item = await GrammarModel.findOne({
    _id: req.params.id,
    status: 'published',
  }).lean();

  if (!item) {
    res.status(404).json({ error: { code: 'GRAMMAR_NOT_FOUND', message: 'Không tìm thấy điểm ngữ pháp' } });
    return;
  }

  res.json({ data: item });
}));

export default router;
