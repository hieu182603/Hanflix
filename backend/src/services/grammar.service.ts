import { GrammarModel, type Grammar } from '../models/grammar.model.js';
import { z } from 'zod';

export const grammarValidationSchema = z.object({
  code: z.string().trim().optional(),
  structure: z.string().trim().min(1, 'Tên cấu trúc ngữ pháp là bắt buộc'),
  pattern: z.string().trim().optional().default(''),
  group: z.string().trim().optional().default('Ngữ pháp'),
  category: z.string().trim().optional().default(''),
  details: z.string().trim().optional().default(''),
  explanationVi: z.string().trim().min(1, 'Giải thích tiếng Việt là bắt buộc'),
  explanationEn: z.string().trim().optional().default(''),
  hskLevel: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal('7-9'),
    z.literal('1'),
    z.literal('2'),
    z.literal('3'),
    z.literal('4'),
    z.literal('5'),
    z.literal('6'),
  ]).transform(v => (v === '7-9' ? '7-9' : Number(v) as 1 | 2 | 3 | 4 | 5 | 6)),
  examples: z.array(
    z.object({
      chinese: z.string().trim().min(1),
      pinyin: z.string().trim().optional(),
      vietnamese: z.string().trim().optional(),
      english: z.string().trim().optional(),
    })
  ).optional().default([]),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  status: z.enum(['published', 'draft', 'pending_review']).default('published'),
});

export class GrammarService {
  async searchGrammar(params: {
    page?: number;
    limit?: number;
    hskLevel?: string;
    status?: string;
    search?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (params.status && params.status !== 'all') {
      filter.status = params.status;
    }

    if (params.hskLevel) {
      const asNumber = Number(params.hskLevel);
      if (!isNaN(asNumber)) {
        filter.hskLevel = { $in: [asNumber, params.hskLevel] };
      } else {
        filter.hskLevel = params.hskLevel;
      }
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      const safeRegex = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { structure: { $regex: safeRegex, $options: 'i' } },
        { pattern: { $regex: safeRegex, $options: 'i' } },
        { explanationVi: { $regex: safeRegex, $options: 'i' } },
        { explanationEn: { $regex: safeRegex, $options: 'i' } },
        { details: { $regex: safeRegex, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      GrammarModel.find(filter).sort({ hskLevel: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      GrammarModel.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStatistics() {
    const [
      total,
      hsk1,
      hsk2,
      hsk3,
      hsk4,
      hsk5,
      hsk6,
      hsk7,
      hsk8,
      hsk9,
      published,
      pendingReview,
      draft,
    ] = await Promise.all([
      GrammarModel.countDocuments({}),
      GrammarModel.countDocuments({ hskLevel: 1 }),
      GrammarModel.countDocuments({ hskLevel: 2 }),
      GrammarModel.countDocuments({ hskLevel: 3 }),
      GrammarModel.countDocuments({ hskLevel: 4 }),
      GrammarModel.countDocuments({ hskLevel: 5 }),
      GrammarModel.countDocuments({ hskLevel: 6 }),
      GrammarModel.countDocuments({ hskLevel: 7 }),
      GrammarModel.countDocuments({ hskLevel: 8 }),
      GrammarModel.countDocuments({ hskLevel: 9 }),
      GrammarModel.countDocuments({ status: 'published' }),
      GrammarModel.countDocuments({ status: 'pending_review' }),
      GrammarModel.countDocuments({ status: 'draft' }),
    ]);

    return {
      total,
      byLevel: {
        1: hsk1,
        2: hsk2,
        3: hsk3,
        4: hsk4,
        5: hsk5,
        6: hsk6,
        7: hsk7,
        8: hsk8,
        9: hsk9,
      },
      byStatus: {
        published,
        pending_review: pendingReview,
        draft,
      },
    };
  }
}

export const grammarService = new GrammarService();
