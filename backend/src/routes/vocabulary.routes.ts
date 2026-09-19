import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { SavedWordModel } from '../models/saved-word.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { WordModel } from '../models/word.model.js';
import { VocabularyModel } from '../models/vocabulary.model.js';
import { scheduleReview } from '../services/srs.js';
import { vocabularyService } from '../services/vocabulary.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

const saveSchema = z.object({
  wordId: z.string().optional(),
  sourceLessonId: z.string().refine(Types.ObjectId.isValid).optional(),
  sourceCueId: z.string().min(1).max(100).optional(),
  hanzi: z.string().trim().min(1).max(50).optional(),
  pinyin: z.string().trim().min(1).max(100).optional(),
  meaningVi: z.string().trim().max(500).optional(),
  partOfSpeech: z.string().trim().max(50).optional(),
}).refine(data => Boolean(data.wordId || data.hanzi), {
  message: 'Cần cung cấp wordId hoặc chữ Hán để lưu từ',
});
const wordParam = z.object({ wordId: z.string().refine(Types.ObjectId.isValid) });
const reviewSchema = z.object({ rating: z.enum(['again', 'hard', 'good', 'easy']) });

const publicListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  hskLevel: z.string().optional(),
  search: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  sort: z.string().optional(),
  view: z.string().optional(),
  saved: z.string().optional(),
});

// GET /api/vocabulary/saved
router.get('/saved', requireAuth, asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    SavedWordModel.find({ userId: req.auth!.userId })
      .populate('wordId', 'hanzi pinyin meaningVi partOfSpeech examples audioKey')
      .populate('sourceLessonId', 'titleVi titleZh slug')
      .sort({ nextReviewAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SavedWordModel.countDocuments({ userId: req.auth!.userId }),
  ]);
  const dueCount = await SavedWordModel.countDocuments({
    userId: req.auth!.userId,
    nextReviewAt: { $lte: new Date() },
  });
  res.json({
    data: {
      items,
      total,
      dueCount,
      pagination: { page, limit, totalItems: total, totalPages: Math.ceil(total / limit) },
    },
  });
}));

// GET /api/vocabulary/due
router.get('/due', requireAuth, asyncHandler(async (req, res) => {
  const items = await SavedWordModel.find({ userId: req.auth!.userId, nextReviewAt: { $lte: new Date() } })
    .populate('wordId', 'hanzi pinyin meaningVi partOfSpeech examples audioKey')
    .sort({ nextReviewAt: 1 })
    .limit(50)
    .lean();
  res.json({ data: { items, count: items.length } });
}));

// GET /api/vocabulary (Public HSK catalog OR backwards-compatible saved words)
router.get('/', validateQuery(publicListQuerySchema), asyncHandler(async (req, res, next) => {
  const query = (req as unknown as Record<string, unknown>).parsedQuery as z.infer<typeof publicListQuerySchema>;

  // Backwards compatibility for user saved words
  if (query.view === 'saved' || query.saved === 'true') {
    return requireAuth(req, res, async () => {
      const items = await SavedWordModel.find({ userId: req.auth!.userId })
        .populate('wordId', 'hanzi pinyin meaningVi partOfSpeech examples audioKey')
        .populate('sourceLessonId', 'titleVi titleZh slug')
        .sort({ nextReviewAt: 1 })
        .lean();
      const dueCount = items.filter(item => item.nextReviewAt <= new Date()).length;
      res.json({ data: { items, total: items.length, dueCount } });
    });
  }

  // Public HSK catalog search
  const result = await vocabularyService.searchCatalog({
    page: query.page,
    limit: query.limit,
    hskLevel: query.hskLevel,
    search: query.search,
    tag: query.tag,
    sort: query.sort,
    status: 'published',
  });

  res.json({ data: result });
}));

// GET /api/vocabulary/:id (Public detail)
router.get('/:id', asyncHandler(async (req, res, next) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!id || !Types.ObjectId.isValid(id)) {
    return next();
  }

  const vocab = await VocabularyModel.findOne({ _id: id, status: 'published' }).lean();
  if (vocab) {
    return res.json({ data: vocab });
  }

  // Fallback to legacy WordModel if exists
  const legacyWord = await WordModel.findById(id).lean();
  if (legacyWord) {
    return res.json({ data: legacyWord });
  }

  throw new AppError(404, 'VOCABULARY_NOT_FOUND', 'Không tìm thấy từ vựng');
}));

// POST /api/vocabulary (Save word to notebook)
router.post('/', requireAuth, validate(saveSchema), asyncHandler(async (req, res) => {
  const { wordId, sourceLessonId, sourceCueId, hanzi, pinyin, meaningVi, partOfSpeech } = req.body;
  let targetWordId: Types.ObjectId | null = null;

  // Case 1: Subtitle track cue word
  if (sourceLessonId && sourceCueId && wordId && Types.ObjectId.isValid(wordId)) {
    const [wordExists, cueSource] = await Promise.all([
      WordModel.exists({ _id: wordId }),
      SubtitleTrackModel.exists({
        lessonId: sourceLessonId,
        status: 'published',
        cues: { $elemMatch: { cueId: sourceCueId, 'tokens.wordId': new Types.ObjectId(wordId) } },
      }),
    ]);

    if (!wordExists || !cueSource) {
      throw new AppError(422, 'INVALID_WORD_SOURCE', 'Từ vựng không thuộc câu phụ đề đã chọn');
    }
    targetWordId = new Types.ObjectId(wordId);
  } else {
    // Case 2: General vocabulary save (from Topic Hub / HSK Catalog)
    if (wordId && Types.ObjectId.isValid(wordId)) {
      const existingWord = await WordModel.findById(wordId);
      if (existingWord) {
        targetWordId = existingWord._id;
      } else {
        const vocabItem = await VocabularyModel.findById(wordId);
        if (vocabItem) {
          let matchedWord = await WordModel.findOne({ hanzi: vocabItem.simplified });
          if (!matchedWord) {
            matchedWord = await WordModel.create({
              hanzi: vocabItem.simplified,
              pinyin: vocabItem.pinyin,
              meaningVi: vocabItem.meanings?.vi?.[0] || 'Từ vựng HSK',
              partOfSpeech: vocabItem.partOfSpeech?.[0] || undefined,
            });
          }
          targetWordId = matchedWord._id;
        }
      }
    }

    // If still no targetWordId, use hanzi / pinyin to find or create in WordModel
    if (!targetWordId && hanzi) {
      let matchedWord = await WordModel.findOne({ hanzi });
      if (!matchedWord) {
        matchedWord = await WordModel.create({
          hanzi,
          pinyin: pinyin || '',
          meaningVi: meaningVi || 'Từ vựng theo chủ đề',
          partOfSpeech: partOfSpeech || undefined,
        });
      }
      targetWordId = matchedWord._id;
    }
  }

  if (!targetWordId) {
    throw new AppError(422, 'INVALID_WORD', 'Không thể xác định từ vựng để lưu');
  }

  let saved = await SavedWordModel.findOne({ userId: req.auth!.userId, wordId: targetWordId });
  saved ??= await SavedWordModel.create({
    userId: req.auth!.userId,
    wordId: targetWordId,
    sourceLessonId: sourceLessonId || undefined,
    sourceCueId: sourceCueId || undefined,
    nextReviewAt: new Date(),
  });

  const populated = await SavedWordModel.findById(saved._id)
    .populate('wordId', 'hanzi pinyin meaningVi partOfSpeech examples audioKey')
    .populate('sourceLessonId', 'titleVi titleZh slug')
    .lean();

  res.status(201).json({ data: populated ?? saved });
}));

// DELETE /api/vocabulary/:wordId (Remove from notebook)
router.delete('/:wordId', requireAuth, validate(wordParam, 'params'), asyncHandler(async (req, res) => {
  const targetId = new Types.ObjectId(req.params.wordId as string);
  await SavedWordModel.deleteOne({
    userId: req.auth!.userId,
    $or: [{ wordId: targetId }, { _id: targetId }],
  });
  res.status(204).send();
}));

// POST /api/vocabulary/:wordId/review (Submit SRS review)
router.post('/:wordId/review', requireAuth, validate(wordParam, 'params'), validate(reviewSchema), asyncHandler(async (req, res) => {
  const saved = await SavedWordModel.findOne({ userId: req.auth!.userId, wordId: req.params.wordId });
  if (!saved) throw new AppError(404, 'SAVED_WORD_NOT_FOUND', 'Từ chưa có trong danh sách ôn tập');
  const result = scheduleReview({
    repetitions: saved.repetitions,
    intervalDays: saved.intervalDays,
    easeFactor: saved.easeFactor,
  }, req.body.rating);
  Object.assign(saved, result, { lastReviewedAt: new Date(), lastRating: req.body.rating });
  await saved.save();
  res.json({ data: saved });
}));

export default router;
