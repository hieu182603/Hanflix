import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { PracticeAttemptModel, PracticeSetModel } from '../models/practice.model.js';
import { toTimezoneDateKey } from './study-activity.js';

export const practiceSkills = ['vocabulary', 'listening', 'reading', 'writing'] as const;
const draftQuestionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
  type: z.enum(['choice', 'short_answer']),
  prompt: z.string().trim().max(5000).default(''),
  audioUrl: z.string().url().refine(v => v.startsWith('https://'), 'Audio cần URL HTTPS').optional(),
  options: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/), text: z.string().trim().max(2000) })).max(6).default([]),
  correctOptionId: z.string().optional(),
  acceptedAnswers: z.array(z.string().trim().max(1000)).max(20).default([]),
  explanation: z.string().trim().max(5000).default(''),
}).superRefine((q, ctx) => {
  if (new Set(q.options.map(o => o.id)).size !== q.options.length) ctx.addIssue({ code: 'custom', message: 'ID đáp án bị trùng' });
});
const publishedQuestionSchema = draftQuestionSchema.safeExtend({
  prompt: z.string().trim().min(1).max(5000),
  explanation: z.string().trim().min(1).max(5000),
}).superRefine((q, ctx) => {
  if (q.type === 'choice' && q.options.some(o => !o.text)) ctx.addIssue({ code: 'custom', message: 'Lựa chọn cần có nội dung' });
  if (q.type === 'choice' && (q.options.length < 2 || !q.options.some(o => o.id === q.correctOptionId))) ctx.addIssue({ code: 'custom', message: 'Câu trắc nghiệm cần ít nhất 2 lựa chọn và đáp án đúng' });
  if (q.type === 'short_answer' && (!q.acceptedAnswers.length || q.acceptedAnswers.some(a => !a))) ctx.addIssue({ code: 'custom', message: 'Câu trả lời ngắn cần đáp án chấp nhận không rỗng' });
});
export const practiceSetInput = z.object({
  title: z.string().trim().min(2).max(160),
  hsk: z.number().int().min(1).max(9),
  skill: z.enum(practiceSkills),
  status: z.enum(['draft', 'published']).default('draft'),
  durationSeconds: z.number().int().min(60).max(7200),
  questions: z.array(draftQuestionSchema).min(1).max(50),
}).superRefine((set, ctx) => {
  if (new Set(set.questions.map(q => q.id)).size !== set.questions.length) ctx.addIssue({ code: 'custom', message: 'ID câu hỏi bị trùng' });
  if (set.status === 'published') {
    set.questions.forEach((q, index) => {
      const result = publishedQuestionSchema.safeParse(q);
      if (!result.success) for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['questions', index, ...issue.path] });
      }
      if (set.skill === 'listening' && !q.audioUrl) ctx.addIssue({ code: 'custom', path: ['questions', index, 'audioUrl'], message: 'Mỗi câu nghe cần audio' });
    });
  }
});
export const attemptInput = z.object({
  version: z.number().int().min(0),
  answers: z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/), z.string().max(1000)),
  flagged: z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/)).max(50).default([]),
});
type Answers = Record<string, string>;
type Question = {
  id: string;
  type: 'choice' | 'short_answer';
  prompt: string;
  audioUrl?: string | null;
  options: Array<{ id?: string | null; text?: string | null }>;
  correctOptionId?: string | null;
  acceptedAnswers?: string[] | null;
  explanation: string;
};
type Attempt = {
  _id: unknown;
  setId: unknown;
  title: string;
  hsk: number;
  skill: string;
  status: string;
  version: number;
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date | null;
  answers?: Map<string, string> | Answers | null;
  flagged: string[];
  questions: Question[];
  score?: number | null;
  correctCount?: number | null;
  rewardXp: number;
};
export function normalizePracticeAnswer(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN');
}
export function gradePractice(questions: Question[], answers: Answers) {
  const results = questions.map(q => ({
    id: q.id,
    correct: q.type === 'choice'
      ? Boolean(q.correctOptionId) && answers[q.id] === q.correctOptionId
      : (q.acceptedAnswers ?? []).some(a => normalizePracticeAnswer(a) === normalizePracticeAnswer(answers[q.id] ?? '')),
  }));
  const correctCount = results.filter(r => r.correct).length;
  return { correctCount, score: questions.length ? Math.round(correctCount / questions.length * 100) : 0, results };
}
function answersOf(attempt: Attempt): Answers {
  return attempt.answers instanceof Map ? Object.fromEntries(attempt.answers) : (attempt.answers ?? {}) as unknown as Answers;
}
const asAttempt = (value: unknown) => value as Attempt;
export function practiceAttemptDto(attempt: Attempt, now = new Date()) {
  const answers = answersOf(attempt);
  const submitted = attempt.status === 'submitted';
  const grade = submitted ? gradePractice(attempt.questions, answers) : null;
  return {
    id: String(attempt._id), setId: String(attempt.setId), title: attempt.title,
    hsk: attempt.hsk, skill: attempt.skill, status: attempt.status, version: attempt.version,
    startedAt: attempt.startedAt, expiresAt: attempt.expiresAt, serverNow: now,
    submittedAt: attempt.submittedAt, answers, flagged: attempt.flagged,
    questions: attempt.questions.map(q => ({
      id: q.id, type: q.type, prompt: q.prompt, audioUrl: q.audioUrl,
      options: q.options.map(o => ({ id: o.id ?? '', text: o.text ?? '' })),
      ...(submitted ? { explanation: q.explanation, correctOptionId: q.correctOptionId, acceptedAnswers: q.acceptedAnswers ?? [], correct: grade?.results.find(r => r.id === q.id)?.correct } : {}),
    })),
    ...(submitted ? { score: attempt.score, correctCount: attempt.correctCount, rewardXp: attempt.rewardXp } : {}),
  };
}
function validateAnswers(attempt: Attempt, input: z.infer<typeof attemptInput>) {
  const questions = new Map(attempt.questions.map(q => [q.id, q]));
  if (input.flagged.some(id => !questions.has(id))) throw new AppError(422, 'INVALID_QUESTION', 'Câu đánh dấu không tồn tại');
  for (const [id, answer] of Object.entries(input.answers)) {
    const q = questions.get(id);
    if (!q || (q.type === 'choice' && answer && !q.options.some(o => o.id === answer))) throw new AppError(422, 'INVALID_ANSWER', 'Đáp án không thuộc câu hỏi');
  }
}
const duplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;
export async function startPractice(userId: string, setId: string, requestKey: string) {
  const previous = await PracticeAttemptModel.findOne({ userId, requestKey }).lean();
  if (previous) {
    if (String(previous.setId) !== setId) throw new AppError(409, 'REQUEST_KEY_REUSED', 'Mã yêu cầu đã dùng cho bài khác');
    return getPractice(userId, String(previous._id));
  }
  const openKey = `${userId}:${setId}`;
  const open = await PracticeAttemptModel.findOne({ openKey }).lean();
  if (open) return getPractice(userId, String(open._id));
  const set = await PracticeSetModel.findOne({ _id: setId, status: 'published' }).lean();
  if (!set) throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Bài luyện chưa được xuất bản');
  const now = new Date();
  try {
    const attempt = await PracticeAttemptModel.create({ userId, setId, requestKey, openKey,
      title: set.title, hsk: set.hsk, skill: set.skill, setRevision: set.revision,
      questions: set.questions, startedAt: now, expiresAt: new Date(now.getTime() + set.durationSeconds * 1000),
    });
    return practiceAttemptDto(asAttempt(attempt));
  } catch (e) {
    if (!duplicateKey(e)) throw e;
    const winner = await PracticeAttemptModel.findOne({ userId, $or: [{ requestKey }, { openKey }] }).lean();
    if (!winner) throw e;
    if (String(winner.setId) !== setId) throw new AppError(409, 'REQUEST_KEY_REUSED', 'Mã yêu cầu đã dùng cho bài khác');
    return getPractice(userId, String(winner._id));
  }
}
async function ownedAttempt(userId: string, id: string) {
  const attempt = await PracticeAttemptModel.findOne({ _id: id, userId }).lean();
  if (!attempt) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Không tìm thấy bài làm');
  return attempt;
}
export async function getPractice(userId: string, id: string) {
  const attempt = await ownedAttempt(userId, id);
  if (attempt.status === 'in_progress' && attempt.expiresAt.getTime() <= Date.now()) return submitPractice(userId, id);
  return practiceAttemptDto(asAttempt(attempt));
}
export async function savePractice(userId: string, id: string, input: z.infer<typeof attemptInput>) {
  const attempt = await ownedAttempt(userId, id);
  validateAnswers(asAttempt(attempt), input);
  const updated = await PracticeAttemptModel.findOneAndUpdate({ _id: id, userId, status: 'in_progress', version: input.version, expiresAt: { $gt: new Date() } }, {
    $set: { answers: input.answers, flagged: [...new Set(input.flagged)] }, $inc: { version: 1 },
  }, { returnDocument: 'after' }).lean();
  if (!updated) throw new AppError(409, 'ATTEMPT_CHANGED', 'Bài đã hết giờ hoặc thay đổi ở tab khác. Hãy tải lại bản đã lưu.');
  return practiceAttemptDto(asAttempt(updated));
}
export async function submitPractice(userId: string, id: string, input?: z.infer<typeof attemptInput>) {
  const attempt = await ownedAttempt(userId, id);
  if (attempt.status === 'submitted') return practiceAttemptDto(asAttempt(attempt));
  const now = new Date();
  const expired = attempt.expiresAt.getTime() <= now.getTime();
  if (input && !expired) {
    if (input.version !== attempt.version) throw new AppError(409, 'ATTEMPT_CHANGED', 'Bài đã thay đổi ở tab khác. Hãy tải lại bản đã lưu.');
    validateAnswers(asAttempt(attempt), input);
  }
  const answers = Object.fromEntries(Object.entries(input && !expired ? input.answers : answersOf(asAttempt(attempt)))
    .filter(([, answer]) => answer.trim().length > 0));
  const grade = gradePractice(asAttempt(attempt).questions, answers);
  const dateKey = toTimezoneDateKey(expired ? new Date(attempt.expiresAt) : now);
  // The submitted attempt IS the immutable reward record. A unique key caps rewards
  // to one per learner/set/day; no second write to XP counters can partially succeed.
  const rewardKey = `${userId}:${attempt.setId}:${dateKey}`;
  const rewardXp = grade.score >= 80 ? 25 : grade.score >= 50 ? 10 : 0;
  const update = { status: 'submitted', answers, flagged: input && !expired ? input.flagged : attempt.flagged,
    submittedAt: now, dateKey, score: grade.score, correctCount: grade.correctCount, rewardXp,
    ...(rewardXp ? { rewardKey } : {}),
  };
  const filter = { _id: id, userId, status: 'in_progress' as const, version: attempt.version };
  let updated;
  try {
    updated = await PracticeAttemptModel.findOneAndUpdate(filter, { $set: update, $unset: { openKey: 1 }, $inc: { version: 1 } }, { returnDocument: 'after' }).lean();
  } catch (e) {
    if (!duplicateKey(e)) throw e;
    const { rewardKey: _key, ...withoutRewardKey } = update;
    updated = await PracticeAttemptModel.findOneAndUpdate(filter, { $set: { ...withoutRewardKey, rewardXp: 0 }, $unset: { openKey: 1 }, $inc: { version: 1 } }, { returnDocument: 'after' }).lean();
  }
  if (!updated) {
    const latest = await ownedAttempt(userId, id);
    if (latest.status === 'submitted') return practiceAttemptDto(asAttempt(latest));
    throw new AppError(409, 'ATTEMPT_CHANGED', 'Bài đã thay đổi trong lúc nộp. Hãy tải lại bản đã lưu.');
  }
  return practiceAttemptDto(asAttempt(updated));
}
