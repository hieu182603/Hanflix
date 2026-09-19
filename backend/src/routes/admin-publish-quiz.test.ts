import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';

let app: typeof import('../app.js').app;
let UserModel: typeof import('../models/user.model.js').UserModel;
let LessonModel: typeof import('../models/lesson.model.js').LessonModel;
let QuizModel: typeof import('../models/quiz.model.js').QuizModel;
let SubtitleTrackModel: typeof import('../models/subtitle-track.model.js').SubtitleTrackModel;
let signAccessToken: typeof import('../services/jwt.js').signAccessToken;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hanflix-test';
  process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  ({ app } = await import('../app.js'));
  ({ UserModel } = await import('../models/user.model.js'));
  ({ LessonModel } = await import('../models/lesson.model.js'));
  ({ QuizModel } = await import('../models/quiz.model.js'));
  ({ SubtitleTrackModel } = await import('../models/subtitle-track.model.js'));
  ({ signAccessToken } = await import('../services/jwt.js'));
});

afterEach(() => vi.restoreAllMocks());

it.each(['multiple_choice', 'fill_blank', 'invalid'])(
  'publish explicitly loads hidden answers and validates %s', async (kind) => {
    const userId = new Types.ObjectId();
    const lessonId = new Types.ObjectId();
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: () => ({ lean: async () => ({ _id: userId, role: 'admin', status: 'active' }) }),
    } as never);
    const save = vi.fn().mockResolvedValue(undefined);
    const lesson = { _id: lessonId, status: 'ready_for_review', media: {}, durationSeconds: 120, save };
    vi.spyOn(LessonModel, 'findOne').mockReturnValue({ session: async () => lesson } as never);
    vi.spyOn(SubtitleTrackModel, 'findOne').mockReturnValue({
      sort: () => ({ session: async () => ({ revision: 1, cues: [{ endMs: 1000 }], save }) }),
    } as never);
    // Simulate Mongoose's select:false: answers only exist when explicitly selected.
    let selected = '';
    const query = {
      sort: () => query,
      select: (fields: string) => { selected = fields; return query; },
      session: async () => ({
        revision: 1, status: 'draft', save,
        questions: [{
          questionId: 'peppa-comp-1',
          type: kind === 'fill_blank' ? 'fill_blank' : 'multiple_choice',
          options: [{ optionId: 'a', text: 'Đúng' }, { optionId: 'b', text: 'Sai' }],
          ...(selected.includes('+questions.correctOptionId') ? { correctOptionId: kind === 'invalid' ? 'z' : 'a' } : {}),
          ...(selected.includes('+questions.acceptedAnswers') ? { acceptedAnswers: ['你好'] } : {}),
        }],
      }),
    };
    vi.spyOn(QuizModel, 'findOne').mockReturnValue(query as never);
    const response = await request(app).post(`/api/v1/admin/lessons/${lessonId}/publish`)
      .set('Authorization', `Bearer ${signAccessToken(userId.toString(), 'admin')}`);
    expect(response.status).toBe(kind === 'invalid' ? 422 : 200);
    expect(selected).toContain('+questions.explanationVi');
    if (kind === 'invalid') expect(save).not.toHaveBeenCalled();
    else expect(response.body.data.status).toBe('published');
  },
);
