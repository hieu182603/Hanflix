import { Types } from 'mongoose';
import { z } from 'zod';
import { VocabularyModel, type Vocabulary } from '../models/vocabulary.model.js';

export const HSK_LEVELS = [1, 2, 3, 4, 5, 6, '7-9'] as const;
export type HskLevelType = (typeof HSK_LEVELS)[number];

export const vocabularyValidationSchema = z.object({
  simplified: z.string().trim().min(1, 'Simplified character is required').max(100),
  traditional: z.string().trim().max(100).optional(),
  pinyin: z.string().trim().min(1, 'Pinyin is required').max(200),
  pinyinNumbered: z.string().trim().max(200).optional(),
  meanings: z.object({
    vi: z.array(z.string().trim().min(1)).optional().default([]),
    en: z.array(z.string().trim().min(1)).optional().default([]),
  }).default({ vi: [], en: [] }),
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
  partOfSpeech: z.array(z.string().trim().min(1)).optional().default([]),
  variants: z.array(z.string().trim().min(1)).optional().default([]),
  examples: z.array(
    z.object({
      chinese: z.string().trim().min(1),
      pinyin: z.string().trim().optional(),
      vietnamese: z.string().trim().optional(),
      english: z.string().trim().optional(),
    })
  ).optional().default([]),
  frequency: z.number().min(0).optional(),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  source: z.array(
    z.object({
      name: z.string().trim().min(1),
      sourceId: z.string().trim().optional(),
    })
  ).optional().default([]),
  status: z.enum(['published', 'draft', 'pending_review']).default('published'),
});

export type ValidatedVocabularyInput = z.infer<typeof vocabularyValidationSchema>;

/**
 * Normalizes pinyin for consistent key matching:
 * lowercase, removes excessive spaces, trims.
 */
export function normalizePinyin(pinyinStr: string): string {
  if (!pinyinStr) return '';
  return pinyinStr
    .toLowerCase()
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Creates a unique normalized key for deduplication and dictionary mapping
 */
export function makeNormalizedKey(simplified: string, pinyinStr: string): string {
  return `${simplified.trim()}:${normalizePinyin(pinyinStr)}`;
}

export class VocabularyService {
  /**
   * Find a single vocabulary by exact simplified word
   */
  async findVocabularyByWord(word: string) {
    if (!word || !word.trim()) return null;
    return VocabularyModel.findOne({ simplified: word.trim(), status: 'published' }).lean();
  }

  /**
   * Bulk lookup vocabulary by an array of words using MongoDB $in operator.
   * High-performance single database query designed for subtitle processing.
   */
  async findVocabularyByWords(words: string[]): Promise<Map<string, any>> {
    const cleanWords = Array.from(new Set(words.map(w => w.trim()).filter(Boolean)));
    if (cleanWords.length === 0) return new Map();

    const items = await VocabularyModel.find({
      simplified: { $in: cleanWords },
      status: 'published',
    }).lean();

    const map = new Map<string, any>();
    for (const item of items) {
      // If there are multiple readings, prioritize the primary one
      if (!map.has(item.simplified)) {
        map.set(item.simplified, item);
      }
    }
    return map;
  }

  /**
   * Search and filter vocabulary catalog with pagination
   */
  async searchCatalog(params: {
    page?: number;
    limit?: number;
    hskLevel?: number | string;
    search?: string;
    status?: 'published' | 'draft' | 'pending_review' | 'all';
    tag?: string;
    sort?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (params.status && params.status !== 'all') {
      filter.status = params.status;
    } else if (!params.status) {
      filter.status = 'published';
    }

    if (params.hskLevel) {
      const lvl = params.hskLevel === '7-9' ? '7-9' : Number(params.hskLevel);
      filter.hskLevel = lvl;
    }

    if (params.tag) {
      filter.tags = params.tag;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      // Test regex or text search
      const safeRegex = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { simplified: { $regex: safeRegex, $options: 'i' } },
        { traditional: { $regex: safeRegex, $options: 'i' } },
        { pinyin: { $regex: safeRegex, $options: 'i' } },
        { 'meanings.vi': { $regex: safeRegex, $options: 'i' } },
        { 'meanings.en': { $regex: safeRegex, $options: 'i' } },
      ];
    }

    const sortOptions: Record<string, 1 | -1> = {};
    if (params.sort === 'frequency') {
      sortOptions.frequency = -1;
    } else if (params.sort === 'hsk_asc') {
      sortOptions.hskLevel = 1;
    } else if (params.sort === 'hsk_desc') {
      sortOptions.hskLevel = -1;
    } else {
      sortOptions.createdAt = -1;
    }

    const [items, total] = await Promise.all([
      VocabularyModel.find(filter).sort(sortOptions).skip(skip).limit(limit).lean(),
      VocabularyModel.countDocuments(filter),
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

  /**
   * Get HSK Vocabulary Statistics for Admin & Dashboard
   */
  async getStatistics() {
    const [
      total,
      hsk1,
      hsk2,
      hsk3,
      hsk4,
      hsk5,
      hsk6,
      hsk7to9,
      pendingReview,
      published,
      draft,
    ] = await Promise.all([
      VocabularyModel.countDocuments({}),
      VocabularyModel.countDocuments({ hskLevel: 1 }),
      VocabularyModel.countDocuments({ hskLevel: 2 }),
      VocabularyModel.countDocuments({ hskLevel: 3 }),
      VocabularyModel.countDocuments({ hskLevel: 4 }),
      VocabularyModel.countDocuments({ hskLevel: 5 }),
      VocabularyModel.countDocuments({ hskLevel: 6 }),
      VocabularyModel.countDocuments({ hskLevel: '7-9' }),
      VocabularyModel.countDocuments({ status: 'pending_review' }),
      VocabularyModel.countDocuments({ status: 'published' }),
      VocabularyModel.countDocuments({ status: 'draft' }),
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
        '7-9': hsk7to9,
      },
      byStatus: {
        published,
        pending_review: pendingReview,
        draft,
      },
    };
  }

  /**
   * Batch import or preview vocabulary items
   */
  async processBatchImport(
    rawItems: any[],
    options: {
      mode: 'skip_existing' | 'update_existing' | 'insert_only';
      dryRun?: boolean;
    }
  ) {
    const { mode, dryRun = false } = options;
    const total = rawItems.length;
    let validCount = 0;
    let invalidCount = 0;
    let duplicatesInInput = 0;
    let existingCount = 0;
    let newCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const validationErrors: Array<{ row: number; item: any; error: string }> = [];
    const validItems: ValidatedVocabularyInput[] = [];
    const seenInInput = new Set<string>();

    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      const parsed = vocabularyValidationSchema.safeParse(raw);
      if (!parsed.success) {
        invalidCount++;
        if (validationErrors.length < 50) {
          validationErrors.push({
            row: i + 1,
            item: raw,
            error: parsed.error.issues.map(iss => `${iss.path.join('.')}: ${iss.message}`).join(', '),
          });
        }
        continue;
      }

      const item = parsed.data;
      const key = makeNormalizedKey(item.simplified, item.pinyin);
      if (seenInInput.has(key)) {
        duplicatesInInput++;
        continue;
      }
      seenInInput.add(key);
      validItems.push(item);
      validCount++;
    }

    // Check existing records in database in chunks of 500
    const existingMap = new Map<string, any>();
    for (let i = 0; i < validItems.length; i += 500) {
      const chunk = validItems.slice(i, i + 500);
      const conditions = chunk.map(it => ({ simplified: it.simplified, pinyin: it.pinyin }));
      const found = await VocabularyModel.find({ $or: conditions }).select('_id simplified pinyin meanings status source').lean();
      for (const rec of found) {
        existingMap.set(makeNormalizedKey(rec.simplified, rec.pinyin), rec);
      }
    }

    for (const item of validItems) {
      const key = makeNormalizedKey(item.simplified, item.pinyin);
      if (existingMap.has(key)) {
        existingCount++;
      } else {
        newCount++;
      }
    }

    // If not dry run, perform database operations
    if (!dryRun && validItems.length > 0) {
      const bulkOps: any[] = [];

      for (const item of validItems) {
        const key = makeNormalizedKey(item.simplified, item.pinyin);
        const exists = existingMap.has(key);

        if (exists) {
          if (mode === 'skip_existing') {
            skippedCount++;
            continue;
          } else if (mode === 'update_existing') {
            updatedCount++;
            bulkOps.push({
              updateOne: {
                filter: { simplified: item.simplified, pinyin: item.pinyin },
                update: {
                  $set: {
                    traditional: item.traditional,
                    pinyinNumbered: item.pinyinNumbered,
                    hskLevel: item.hskLevel,
                    partOfSpeech: item.partOfSpeech,
                    variants: item.variants,
                    frequency: item.frequency,
                    tags: item.tags,
                    status: item.status,
                    updatedAt: new Date(),
                  },
                  $addToSet: {
                    'meanings.vi': { $each: item.meanings.vi || [] },
                    'meanings.en': { $each: item.meanings.en || [] },
                    source: { $each: item.source || [] },
                  },
                },
              },
            });
          } else if (mode === 'insert_only') {
            skippedCount++;
            continue;
          }
        } else {
          // New record
          insertedCount++;
          bulkOps.push({
            insertOne: {
              document: {
                ...item,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          });
        }

        if (bulkOps.length >= 500) {
          await VocabularyModel.bulkWrite(bulkOps, { ordered: false });
          bulkOps.length = 0;
        }
      }

      if (bulkOps.length > 0) {
        await VocabularyModel.bulkWrite(bulkOps, { ordered: false });
      }
    }

    return {
      summary: {
        total,
        valid: validCount,
        invalid: invalidCount,
        duplicatesInInput,
        existing: existingCount,
        new: newCount,
        inserted: dryRun ? newCount : insertedCount,
        updated: dryRun ? (mode === 'update_existing' ? existingCount : 0) : updatedCount,
        skipped: dryRun ? (mode === 'skip_existing' ? existingCount : 0) : skippedCount,
      },
      validationErrors,
    };
  }
}

export const vocabularyService = new VocabularyService();
