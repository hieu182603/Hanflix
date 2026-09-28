import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { PracticeAttemptModel, PracticeSetModel } from '../models/practice.model.js';
import { attemptInput, getPractice, practiceSkills, savePractice, startPractice, submitPractice } from '../services/practice.service.js';

const router = Router();
router.use(requireAuth);
const id = z.object({ id: z.string().refine(Types.ObjectId.isValid) });
const list = z.object({
  hsk: z.coerce.number().int().min(1).max(9).optional(), skill: z.enum(practiceSkills).optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(12),
});
router.get('/sets', validateQuery(list), asyncHandler(async (req, res) => {
  const q = (req as unknown as { parsedQuery: z.infer<typeof list> }).parsedQuery;
  const filter: { status: 'published'; hsk?: number; skill?: typeof practiceSkills[number] } = {
    status: 'published',
    ...(q.hsk ? { hsk: q.hsk } : {}),
    ...(q.skill ? { skill: q.skill } : {}),
  };
  const [sets, total] = await Promise.all([
    PracticeSetModel.find(filter).select('title hsk skill revision durationSeconds questions.id').sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    PracticeSetModel.countDocuments(filter),
  ]);
  res.json({ data: { items: sets.map(s => ({ id: String(s._id), title: s.title, hsk: s.hsk, skill: s.skill, revision: s.revision, durationSeconds: s.durationSeconds, questionCount: s.questions.length })), page: q.page, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) } });
}));
router.get('/attempts', validateQuery(list), asyncHandler(async (req, res) => {
  const q = (req as unknown as { parsedQuery: z.infer<typeof list> }).parsedQuery;
  const filter = { userId: req.auth!.userId, ...(q.hsk ? { hsk: q.hsk } : {}), ...(q.skill ? { skill: q.skill } : {}) };
  const [items, total] = await Promise.all([
    PracticeAttemptModel.find(filter).select('title hsk skill status startedAt expiresAt submittedAt score rewardXp').sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    PracticeAttemptModel.countDocuments(filter),
  ]);
  res.json({ data: { items: items.map(a => ({ ...a, id: String(a._id) })), page: q.page, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) } });
}));
router.post('/attempts', validate(z.object({ setId: z.string().refine(Types.ObjectId.isValid), requestKey: z.string().uuid() })), asyncHandler(async (req, res) => {
  res.json({ data: await startPractice(String(req.auth!.userId), req.body.setId, req.body.requestKey) });
}));
router.get('/attempts/:id', validate(id, 'params'), asyncHandler(async (req, res) => {
  res.json({ data: await getPractice(String(req.auth!.userId), String(req.params.id)) });
}));
router.patch('/attempts/:id', validate(id, 'params'), validate(attemptInput), asyncHandler(async (req, res) => {
  res.json({ data: await savePractice(String(req.auth!.userId), String(req.params.id), req.body) });
}));
router.post('/attempts/:id/submit', validate(id, 'params'), validate(attemptInput.optional()), asyncHandler(async (req, res) => {
  res.json({ data: await submitPractice(String(req.auth!.userId), String(req.params.id), req.body) });
}));
export default router;
