import { assertLessonHsk } from '../services/lesson-access.js';
import { Router } from 'express';
import { optionalAuth, requirePremium } from '../middleware/premium.js';
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
import { answerLearningQuestion, explainChineseInContext, isOffTopicQuestion, normalizeAiError, type AiExplanation } from '../services/gemini.js';
import { randomUUID } from 'node:crypto';
import { lessonAiContextSchema, resolveLessonAiContext, resolveAiCitations, unavailableContextMessages } from '../services/lesson-ai-context.service.js';
import { readAiHistory, clearAiHistory, runAiConversation, type AiReply } from '../services/ai-conversation.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

const explainSchema = z.object({
  lessonId: z.string().refine(Types.ObjectId.isValid),
  cueId: z.string().min(1).max(100),
  wordId: z.string().refine(Types.ObjectId.isValid),
  question: z.string().trim().min(1).max(500).optional(),
});

const askSchema = z.object({
  question: z.string().trim().min(1).max(500),
  context: z.string().trim().max(1000).optional(),
  lessonContext: lessonAiContextSchema.optional(),
  clientMessageId: z.string().uuid().optional(),
});

router.post('/history', requireAuth, requirePremium, validate(z.object({ lessonContext: lessonAiContextSchema.optional() })), asyncHandler(async (req, res) => {
  if (req.body.lessonContext) await assertLessonHsk(req.auth, req.body.lessonContext.lessonId);
  const context = req.body.lessonContext ? await resolveLessonAiContext(req.body.lessonContext) : undefined;
  if (context && context.status === 'missing_transcript') {
    res.json({ data: { messages: [] } }); return;
  }
  res.json({ data: await readAiHistory(req.auth!.userId, context) });
}));

router.delete('/history', requireAuth, requirePremium, validate(z.object({ lessonContext: lessonAiContextSchema.optional() })), asyncHandler(async (req, res) => {
  if (req.body.lessonContext) await assertLessonHsk(req.auth, req.body.lessonContext.lessonId);
  const context = req.body.lessonContext ? await resolveLessonAiContext(req.body.lessonContext) : undefined;
  await clearAiHistory(req.auth!.userId, context);
  res.json({ data: { cleared: true } });
}));

router.post('/ask', requireAuth, requirePremium, aiLimiter, validate(askSchema), asyncHandler(async (req, res) => {
  // Server-side topic guard
  const guard = isOffTopicQuestion(req.body.question);
  if (guard.blocked) {
    throw new AppError(400, 'OFF_TOPIC', guard.reason);
  }

  if (req.body.lessonContext) await assertLessonHsk(req.auth, req.body.lessonContext.lessonId);
  const context = req.body.lessonContext ? await resolveLessonAiContext(req.body.lessonContext, req.body.question) : undefined;
  const metadata = context ? (({ cues, status, ...rest }) => rest)(context) : undefined;
  if (context && context.status !== 'ready') {
    const reply: AiReply = { answerVi: unavailableContextMessages[context.status], citations: [],
      contextStatus: context.status, grounding: 'none', context: metadata, requestId: randomUUID() };
    res.json({ data: reply }); return;
  }
  const learner = await UserModel.findById(req.auth!.userId).select('learningProfile.currentHsk learningProfile.goal').lean();
  const controller = new AbortController();
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', cancel);
  try {
    const answer = await runAiConversation({
      userId: req.auth!.userId, clientMessageId: req.body.clientMessageId,
      question: req.body.question, context, note: req.body.context,
      generate: async history => {
        // History belongs to this user's same lesson/revision. Its source texts
        // were constructed by the server, not accepted from the browser.
        const allowedCues = new Map(context?.cues.map(c => [c.cueId, c]) ?? []);
        for (const turn of history) for (const cue of turn.citations) allowedCues.set(cue.cueId, cue);
        const result = await answerLearningQuestion({
          question: req.body.question, profile: learner?.learningProfile ?? {},
          context: req.body.context, lesson: context, history, signal: controller.signal,
        });
        return { answerVi: result.answerVi,
          citations: resolveAiCitations(result.citationCueIds, context ? { ...context, cues: [...allowedCues.values()] } : undefined),
          contextStatus: context ? 'ready' : 'general', grounding: context ? 'transcript' : 'general',
          context: metadata, requestId: '',
        };
      },
    });
    if (!res.destroyed) res.json({ data: answer });
  } catch (err) {
    throw normalizeAiError(err);
  } finally {
    res.off('close', cancel);
  }
}));

router.post('/explain', requireAuth, requirePremium, aiLimiter, validate(explainSchema), asyncHandler(async (req, res) => {
  await assertLessonHsk(req.auth, req.body.lessonId);
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

  let explanation: AiExplanation;
  try {
    explanation = await explainChineseInContext({
      hanzi: word.hanzi,
      pinyin: word.pinyin ?? undefined,
      meaningVi: word.meaningVi ?? undefined,
      sentenceZh: cue.zh,
      sentenceVi: cue.vi,
      learnerHsk: learner?.learningProfile?.currentHsk ?? undefined,
      question: req.body.question,
    });
  } catch (err) {
    throw normalizeAiError(err);
  }
  res.json({ data: { ...explanation, context: { lessonId: lesson._id, cueId: cue.cueId, wordId: word._id } } });
}));

export default router;
