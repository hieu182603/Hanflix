import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { SavedWordModel } from '../models/saved-word.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { WordModel } from '../models/word.model.js';
import { scheduleReview } from '../services/srs.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(requireAuth);

const saveSchema = z.object({
  wordId: z.string().refine(Types.ObjectId.isValid),
  sourceLessonId: z.string().refine(Types.ObjectId.isValid),
  sourceCueId: z.string().min(1).max(100),
});
const wordParam = z.object({ wordId: z.string().refine(Types.ObjectId.isValid) });
const reviewSchema = z.object({ rating: z.enum(['again', 'hard', 'good', 'easy']) });

router.get('/', asyncHandler(async (req, res) => {
  const items = await SavedWordModel.find({ userId: req.auth!.userId })
    .populate('wordId', 'hanzi pinyin meaningVi partOfSpeech examples audioKey')
    .populate('sourceLessonId', 'titleVi titleZh slug')
    .sort({ nextReviewAt: 1 })
    .lean();
  const dueCount = items.filter(item => item.nextReviewAt <= new Date()).length;
  res.json({ data: { items, total: items.length, dueCount } });
}));

router.get('/due', asyncHandler(async (req, res) => {
  const items = await SavedWordModel.find({ userId: req.auth!.userId, nextReviewAt: { $lte: new Date() } })
    .populate('wordId', 'hanzi pinyin meaningVi partOfSpeech examples audioKey')
    .sort({ nextReviewAt: 1 })
    .limit(50)
    .lean();
  res.json({ data: { items, count: items.length } });
}));

router.post('/', validate(saveSchema), asyncHandler(async (req, res) => {
  const [word, cueSource] = await Promise.all([
    WordModel.exists({ _id: req.body.wordId }),
    SubtitleTrackModel.exists({
      lessonId: req.body.sourceLessonId,
      status: 'published',
      cues: { $elemMatch: { cueId: req.body.sourceCueId, 'tokens.wordId': new Types.ObjectId(req.body.wordId) } },
    }),
  ]);
  if (!word || !cueSource) throw new AppError(422, 'INVALID_WORD_SOURCE', 'Từ vựng không thuộc câu phụ đề đã chọn');
  let saved = await SavedWordModel.findOne({ userId: req.auth!.userId, wordId: req.body.wordId });
  saved ??= await SavedWordModel.create({
    userId: req.auth!.userId,
    wordId: req.body.wordId,
    sourceLessonId: req.body.sourceLessonId,
    sourceCueId: req.body.sourceCueId,
    nextReviewAt: new Date(),
  });
  res.status(201).json({ data: saved });
}));

router.delete('/:wordId', validate(wordParam, 'params'), asyncHandler(async (req, res) => {
  await SavedWordModel.deleteOne({ userId: req.auth!.userId, wordId: req.params.wordId });
  res.status(204).send();
}));

router.post('/:wordId/review', validate(wordParam, 'params'), validate(reviewSchema), asyncHandler(async (req, res) => {
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
