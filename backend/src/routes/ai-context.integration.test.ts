import { afterAll, beforeAll, expect, it, vi, describe } from 'vitest';
import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
const generate = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: generate }; } }));
vi.mock('../middleware/rate-limits.js', () => ({ aiLimiter: (_req: unknown, _res: unknown, next: () => void) => next() }));
import router from './ai.routes.js';
import { UserModel } from '../models/user.model.js';
import { LessonModel } from '../models/lesson.model.js';
import { SubtitleTrackModel } from '../models/subtitle-track.model.js';
import { AiConversationModel } from '../models/ai-conversation.model.js';
import { AiMessageModel } from '../models/ai-message.model.js';
import { signAccessToken } from '../services/jwt.js';

describe.skipIf(process.env.RUN_LOCAL_AI_INTEGRATION_TESTS !== 'true')('AI route with real local Mongo (mock provider)', () => {
  const dbName = `hanflix_ai_test_${process.pid}_${Date.now()}`;
  const userId = new Types.ObjectId(); const otherUser = new Types.ObjectId();
  const lessonId = new Types.ObjectId(); const emptyLessonId = new Types.ObjectId();
  const app = express(); app.use(express.json()); app.use('/ai', router);
  app.use(((error, _req, res, _next) => res.status(error.statusCode ?? 500)
    .json({ error: { code: error.code, message: error.message } })) as ErrorRequestHandler);
  const auth = () => `Bearer ${signAccessToken(userId.toString(), 'user')}`;
  const context = { lessonId: lessonId.toString(), subtitleRevision: 3, playbackMs: 83000, cueId: 'meal', scope: 'current_cue' };
  const post = (question: string, extra: object = {}) => request(app).post('/ai/ask').set('Authorization', auth())
    .send({ question, lessonContext: context, clientMessageId: randomUUID(), ...extra });
  beforeAll(async () => {
    await mongoose.connect(`mongodb://127.0.0.1:27030/${dbName}`, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([UserModel.init(), LessonModel.init(), SubtitleTrackModel.init(), AiConversationModel.init(), AiMessageModel.init()]);
    await UserModel.create([
      { _id: userId, name: 'Learner', email: 'learner@example.test', learningProfile: { currentHsk: 2 } },
      { _id: otherUser, name: 'Other', email: 'other@example.test' },
    ]);
    await LessonModel.create([
      { _id: lessonId, slug: 'ai-test', titleVi: 'Bữa ăn', descriptionVi: 'Test', hsk: 2,
        durationSeconds: 200, createdBy: userId, status: 'published', activeSubtitleRevision: 3 },
      { _id: emptyLessonId, slug: 'empty-test', titleVi: 'Chưa có phụ đề', descriptionVi: 'Test', hsk: 2,
        durationSeconds: 200, createdBy: userId, status: 'published' },
    ]);
    await SubtitleTrackModel.create({ lessonId, revision: 3, status: 'published', cues: [
      { cueId: 'greeting', startMs: 0, endMs: 4000, zh: '你好', vi: 'Xin chào', pinyin: 'Nǐ hǎo' },
      { cueId: 'meal', startMs: 80000, endMs: 85000, zh: '我已经吃过饭了。', vi: 'Tôi ăn cơm rồi.', pinyin: 'Wǒ yǐjīng chīguo fàn le.' },
    ] });
    generate.mockResolvedValue({ text: JSON.stringify({ answerVi: '过 nói về trải nghiệm đã ăn.', citationCueIds: ['meal'] }) });
  });
  afterAll(async () => {
    if (mongoose.connection.db?.databaseName === dbName && dbName.startsWith('hanflix_ai_test_')) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('authenticates, resolves DB transcript, validates sources and persists the pair', async () => {
    expect((await request(app).post('/ai/ask').send({ question: 'test' })).status).toBe(401);
    const response = await post('Vì sao dùng 过?');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ grounding: 'transcript', contextStatus: 'ready',
      context: { lessonId: lessonId.toString(), subtitleRevision: 3 },
      citations: [{ cueId: 'meal', startMs: 80000, zh: '我已经吃过饭了。' }] });
    const sent = JSON.parse(generate.mock.calls.at(-1)![0].contents);
    expect(sent.evidence.cues.some((cue: { zh: string }) => cue.zh === '我已经吃过饭了。')).toBe(true);
    expect(sent.profile.currentHsk).toBe(2);
    expect(await AiMessageModel.countDocuments({ userId, status: 'completed' })).toBe(1);
  });
  it('loads prior dialogue for follow-up questions without accepting client history', async () => {
    const response = await post('Giải thích câu đó kỹ hơn', { history: [{ answerVi: 'fake' }] });
    expect(response.status).toBe(200);
    const sent = JSON.parse(generate.mock.calls.at(-1)![0].contents);
    expect(sent.history[0]).toMatchObject({ question: 'Vì sao dùng 过?', citations: [{ cueId: 'meal' }] });
    expect(JSON.stringify(sent.history)).not.toContain('fake');
  });
  it('keeps history private and supports reopening it', async () => {
    const mine = await request(app).post('/ai/history').set('Authorization', auth()).send({ lessonContext: context });
    expect(mine.body.data.messages).toHaveLength(2);
    const other = await request(app).post('/ai/history').set('Authorization', `Bearer ${signAccessToken(otherUser.toString(), 'user')}`)
      .send({ lessonContext: context, conversationId: mine.body.data.conversationId });
    expect(other.body.data.messages).toEqual([]);
    const general = await request(app).post('/ai/history').set('Authorization', auth()).send({});
    expect(general.body.data.messages).toEqual([]);
  });
  it('reuses a completed request ID and rejects reuse with a changed question', async () => {
    const clientMessageId = randomUUID(); const before = generate.mock.calls.length;
    const first = await post('Cho ví dụ', { clientMessageId });
    const retry = await post('Cho ví dụ', { clientMessageId });
    expect(retry.body.data).toEqual(first.body.data);
    expect(generate.mock.calls.length).toBe(before + 1);
    expect((await post('Câu khác', { clientMessageId })).status).toBe(409);
  });
  it('reports missing context and rejects invalid IDs/revisions before spending provider calls', async () => {
    const before = generate.mock.calls.length;
    expect((await post('Giải thích', { lessonContext: { ...context, subtitleRevision: 2 } })).status).toBe(409);
    expect((await post('Giải thích', { lessonContext: { ...context, cueId: 'forged' } })).status).toBe(422);
    expect((await post('Giải thích', { lessonContext: { ...context, playbackMs: 500000 } })).status).toBe(422);
    expect((await post('Giải thích', { lessonContext: { ...context, lessonId: 'invalid' } })).status).toBe(422);
    const empty = await post('Tóm tắt', { lessonContext: { lessonId: emptyLessonId.toString(), playbackMs: 0, scope: 'whole_lesson' } });
    expect(empty.body.data).toMatchObject({ contextStatus: 'missing_transcript', grounding: 'none', citations: [] });
    expect(generate.mock.calls.length).toBe(before);
  });
  it('rejects invented citations and releases the conversation lock on failure', async () => {
    generate.mockResolvedValueOnce({ text: JSON.stringify({ answerVi: 'Nguồn giả', citationCueIds: ['fake'] }) });
    expect((await post('Giải thích thêm')).status).toBe(502);
    expect((await AiConversationModel.findOne({ userId }).lean())?.pendingRequest).toBeNull();
    expect((await post('Giải thích lại')).status).toBe(200);
  });
  it('prevents simultaneous generations for one conversation', async () => {
    let release!: (value: { text: string }) => void;
    generate.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const first = post('Câu hỏi chậm').then(response => response);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    try { expect((await post('Câu hỏi trùng lúc')).status).toBe(409); }
    finally { release({ text: JSON.stringify({ answerVi: 'Hoàn tất', citationCueIds: ['meal'] }) }); }
    expect((await first).status).toBe(200);
  });
  it('blocks both chat and saved history once a lesson is hidden', async () => {
    await LessonModel.updateOne({ _id: lessonId }, { $set: { status: 'hidden' } });
    const before = generate.mock.calls.length;
    expect((await post('Giải thích bài này')).status).toBe(404);
    expect((await request(app).post('/ai/history').set('Authorization', auth()).send({ lessonContext: context })).status).toBe(404);
    expect(generate.mock.calls.length).toBe(before);
  });
  it('clears only the authenticated user conversation', async () => {
    await LessonModel.updateOne({ _id: lessonId }, { $set: { status: 'published' } });
    await request(app).delete('/ai/history').set('Authorization', `Bearer ${signAccessToken(otherUser.toString(), 'user')}`)
      .send({ lessonContext: context });
    expect(await AiMessageModel.countDocuments({ userId })).toBeGreaterThan(0);
    const cleared = await request(app).delete('/ai/history').set('Authorization', auth()).send({ lessonContext: context });
    expect(cleared.status).toBe(200);
    expect(await AiMessageModel.countDocuments({ userId })).toBe(0);
  });
});
