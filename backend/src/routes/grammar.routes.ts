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
  const query = (req as unknown as Record<string, unknown>).parsedQuery as z.infer<typeof listQuerySchema>;
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { status: 'published' };
  const hskLevelConditions: Record<string, unknown>[] = [];
  if (query.hskLevel) {
    const asNumber = Number(query.hskLevel);
    if (!isNaN(asNumber)) {
      // Match either Number (HSK 1-9) or String form
      hskLevelConditions.push({ hskLevel: asNumber });
      hskLevelConditions.push({ hskLevel: query.hskLevel });
    } else {
      hskLevelConditions.push({ hskLevel: query.hskLevel });
    }
  }

  const searchConditions: Record<string, unknown>[] = [];
  if (query.search) {
    searchConditions.push(
      { structure: { $regex: query.search, $options: 'i' } },
      { explanationVi: { $regex: query.search, $options: 'i' } },
      { tags: { $in: [new RegExp(query.search, 'i')] } },
    );
  }

  // Combine $or blocks via $and
  const orBlocks: Record<string, unknown>[] = [];
  if (hskLevelConditions.length > 0) orBlocks.push({ $or: hskLevelConditions });
  if (searchConditions.length > 0) orBlocks.push({ $or: searchConditions });

  if (orBlocks.length === 1) {
    const single = orBlocks[0];
    Object.assign(filter, single);
  } else if (orBlocks.length > 1) {
    filter.$and = orBlocks;
  }

  const [items, total] = await Promise.all([
    GrammarModel.find(filter)
      .sort({ hskLevel: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    GrammarModel.countDocuments(filter),
  ]);

  res.json({
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
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
