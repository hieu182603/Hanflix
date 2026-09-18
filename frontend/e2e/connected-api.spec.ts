import { expect, test, type Page } from '@playwright/test';

const lessonId = '507f1f77bcf86cd799439011';
const lesson = {
  _id: lessonId, slug: 'bai-hoc', titleVi: 'Bài học từ API', titleZh: '你好', pinyin: 'Nǐ hǎo',
  descriptionVi: 'Một bài học thử nghiệm từ API backend.', hsk: 1, topicIds: ['daily-life'],
  goalTags: ['daily'], durationSeconds: 120, status: 'published', media: null,
};

async function mockSession(page: Page, role: 'user' | 'admin') {
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { data: { accessToken: 'test-token' } } }));
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: { user: {
    id: '507f1f77bcf86cd799439012', name: 'Người kiểm thử', email: 'test@example.com', role,
    status: 'active', learningProfile: { currentHsk: 1, goal: 'daily', topicIds: ['daily-life'], dailyMinutes: 15, surveyVersion: 1 },
  } } } }));
}

test('learner opens a published lesson, submits its quiz, and saves a subtitle word', async ({ page }) => {
  let quizPayload: { answers?: unknown[]; idempotencyKey?: string } = {};
  let savedPayload: Record<string, string> = {};
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let data: unknown = {};
    if (path === '/api/v1/lessons' && method === 'GET') data = { items: [lesson], page: 1, limit: 12, total: 1, pages: 1 };
    else if (path === '/api/v1/learning/dashboard') data = { metrics: { completedLessons: 0, savedWords: 0, dueWords: 0, averageQuizScore: null }, continueLearning: null, recentProgress: [], recentAttempts: [] };
    else if (path === '/api/v1/learning/activity') data = { days: [], totals: { activeStudySeconds: 0, progressUpdates: 0, quizAttempts: 0, completedLessons: 0 } };
    else if (path === '/api/v1/learning/recommendations/ai') data = { items: [] };
    else if (path === `/api/v1/lessons/${lessonId}`) data = lesson;
    else if (path === `/api/v1/lessons/${lessonId}/subtitles`) data = { cues: [{ cueId: 'cue-1', startMs: 0, endMs: 3000, zh: '你好', pinyin: 'Nǐ hǎo', vi: 'Xin chào', tokens: [{ text: '你好', wordId: { _id: '507f1f77bcf86cd799439013', hanzi: '你好' } }] }] };
    else if (path === `/api/v1/lessons/${lessonId}/progress`) data = { lastPositionSeconds: 0, watchedRanges: [], coverage: 0, activeStudySeconds: 0, completed: false, bestQuizScore: null };
    else if (path === `/api/v1/lessons/${lessonId}/quiz`) data = { questions: [{ questionId: 'q-1', type: 'multiple_choice', prompt: '你好 nghĩa là gì?', options: [{ optionId: 'a', text: 'Xin chào' }, { optionId: 'b', text: 'Tạm biệt' }] }] };
    else if (path === `/api/v1/lessons/${lessonId}/attempts`) {
      quizPayload = JSON.parse(route.request().postData() ?? '{}');
      data = { score: 100, correctCount: 1, totalCount: 1, answers: [{ questionId: 'q-1', correct: true, explanationVi: 'Lời chào.' }] };
    } else if (path === '/api/v1/vocabulary' && method === 'POST') {
      savedPayload = JSON.parse(route.request().postData() ?? '{}'); data = { _id: 'saved-1' };
    }
    return route.fulfill({ status: 200, json: { data } });
  });
  await mockSession(page, 'user');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kho bài học đã xuất bản' })).toBeVisible();
  await page.getByRole('button', { name: /Bài học từ API/ }).click();
  await expect(page.getByRole('heading', { name: 'Bài học từ API' })).toBeVisible();
  await page.getByTitle('Lưu 你好').click();
  await expect(page.getByText('Đã lưu từ vào sổ ôn tập.')).toBeVisible();
  expect(savedPayload).toMatchObject({ wordId: '507f1f77bcf86cd799439013', sourceLessonId: lessonId, sourceCueId: 'cue-1' });
  await page.getByRole('button', { name: 'Làm bài luyện tập' }).click();
  await page.getByLabel('Xin chào').check();
  await page.getByRole('button', { name: 'Nộp bài' }).click();
  await expect(page.getByText('Kết quả: 100% (1/1)')).toBeVisible();
  expect(quizPayload.answers).toEqual([{ questionId: 'q-1', selectedOptionId: 'a' }]);
  expect(quizPayload.idempotencyKey?.length).toBeGreaterThan(8);
});

test('admin upload creates a draft, sends bytes to R2, and confirms processing', async ({ page }) => {
  let draftInput: Record<string, unknown> = {};
  let confirmed: Record<string, string> = {};
  let r2Uploads = 0;
  let created = false;
  await page.route('https://r2.test/upload', route => { r2Uploads++; return route.fulfill({ status: 200, body: '' }); });
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let data: unknown = {};
    if (path === '/api/v1/admin/lessons' && method === 'GET') data = { items: created ? [{ ...lesson, status: confirmed.lessonId ? 'processing' : 'draft' }] : [] };
    else if (path === '/api/v1/admin/users') data = { items: [] };
    else if (path === '/api/v1/admin/processing-jobs') data = { items: [], total: 0 };
    else if (path === '/api/v1/admin/lessons' && method === 'POST') {
      draftInput = JSON.parse(route.request().postData() ?? '{}'); created = true; data = { ...lesson, status: 'draft' };
    } else if (path === '/api/v1/admin/uploads/presign') data = { uploadUrl: 'https://r2.test/upload', objectKey: `videos/${lessonId}/video.mp4`, requiredHeaders: { 'Content-Type': 'video/mp4' }, maxBytes: 104857600 };
    else if (path === '/api/v1/admin/uploads/confirm') {
      confirmed = JSON.parse(route.request().postData() ?? '{}'); data = { lessonId, status: 'processing', processingJobId: 'job-1' };
    } else if (path === `/api/v1/admin/lessons/${lessonId}/processing`) data = { status: 'queued', stage: 'inspect_media', stageProgress: 5, attempts: 0, video: { status: 'processing' } };
    return route.fulfill({ status: 200, json: { data } });
  });
  await mockSession(page, 'admin');
  await page.goto('/');
  await page.getByRole('button', { name: /Tải video mới/i }).click();
  await page.getByLabel('Video MP4/WebM').setInputFiles({ name: 'lesson.mp4', mimeType: 'video/mp4', buffer: Buffer.from('test-video') });
  await page.getByLabel('Tiêu đề tiếng Việt').fill('Bài học từ API');
  await page.getByLabel('Mô tả').fill('Một bài học thử nghiệm từ API backend.');
  await page.getByRole('button', { name: 'Tạo bài và tải video' }).click();
  await expect(page.getByRole('heading', { name: 'Tiến trình xử lý' })).toBeVisible();
  expect(draftInput).toMatchObject({ titleVi: 'Bài học từ API', hsk: 3, durationSeconds: 120 });
  expect(r2Uploads).toBe(1);
  expect(confirmed).toEqual({ lessonId, objectKey: `videos/${lessonId}/video.mp4` });
});
