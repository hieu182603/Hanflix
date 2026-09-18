import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rate-limits.js';
import { validate } from '../middleware/validate.js';
import { LessonModel } from '../models/lesson.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { UserModel } from '../models/user.model.js';
import { WordModel } from '../models/word.model.js';
import { answerLearningQuestion, explainChineseInContext } from '../services/gemini.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

const explainSchema = z.object({
  lessonId: z.string().refine(Types.ObjectId.isValid),
  cueId: z.string().min(1).max(100),
  wordId: z.string().refine(Types.ObjectId.isValid),
  question: z.string().trim().min(1).max(500).optional(),
});

const askSchema = z.object({ question: z.string().trim().min(1).max(500) });

router.post('/ask', requireAuth, aiLimiter, validate(askSchema), asyncHandler(async (req, res) => {
  const learner = await UserModel.findById(req.auth!.userId).select('learningProfile').lean();
  const answer = await answerLearningQuestion({ question: req.body.question, profile: learner?.learningProfile ?? {} });
  res.json({ data: answer });
}));

router.post('/explain', requireAuth, aiLimiter, validate(explainSchema), asyncHandler(async (req, res) => {
  const [lesson, word, learner] = await Promise.all([
    LessonModel.findOne({ _id: req.body.lessonId, status: 'published' }).select('activeSubtitleRevision').lean(),
    WordModel.findById(req.body.wordId).lean(),
    UserModel.findById(req.auth!.userId).select('learningProfile.currentHsk').lean(),
  ]);
  if (!lesson?.activeSubtitleRevision || !word) throw new AppError(404, 'CONTEXT_NOT_FOUND', 'Không tìm thấy ngữ cảnh học');
  const track = await SubtitleTrackModel.findOne({
    lessonId: lesson._id,
    revision: lesson.activeSubtitleRevision,
    status: 'published',
    cues: { $elemMatch: { cueId: req.body.cueId, 'tokens.wordId': new Types.ObjectId(req.body.wordId) } },
  }).lean();
  const cue = track?.cues.find(item => item.cueId === req.body.cueId);
  if (!cue) throw new AppError(422, 'INVALID_CONTEXT', 'Từ không thuộc câu phụ đề đã chọn');

  const explanation = await explainChineseInContext({
    hanzi: word.hanzi,
    pinyin: word.pinyin ?? undefined,
    meaningVi: word.meaningVi ?? undefined,
    sentenceZh: cue.zh,
    sentenceVi: cue.vi,
    learnerHsk: learner?.learningProfile?.currentHsk ?? undefined,
    question: req.body.question,
  });
  res.json({ data: { ...explanation, context: { lessonId: lesson._id, cueId: cue.cueId, wordId: word._id } } });
}));

export default router;
