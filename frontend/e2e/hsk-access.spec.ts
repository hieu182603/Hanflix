import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const userId = '507f1f77bcf86cd799439011';
const lessonId = '507f1f77bcf86cd799439022';
const expiry = '2099-01-01T00:00:00.000Z';

async function setup(page: Page, paid = true) {
  const state = { hsk: 3, videoHsk: 3, lessonRequests: [] as string[], catalogRequests: [] as string[] };
  const lesson = () => ({ _id: lessonId, titleVi: 'Video đúng cấp HSK', titleZh: '你好', hsk: state.videoHsk,
    durationSeconds: 30, contentMode: 'lesson', status: 'published', topicIds: [], isFreeSample: true,
    media: { url: '/hsk-test.mp4', mimeType: 'video/mp4' } });
  await page.route('**/hsk-test.mp4', route => route.fulfill({ contentType: 'video/mp4', path: fileURLToPath(new URL('./fixtures/premium-sample.mp4', import.meta.url)) }));
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    let data: unknown = { items: [], total: 0, totalPages: 1 };
    if (path === '/auth/refresh') data = { accessToken: 'hsk-test-token' };
    else if (path === '/auth/me') data = { user: { id: userId, role: 'user', status: 'active', name: 'Học viên', email: 'learner@example.test',
      premiumExpiresAt: paid ? expiry : null, learningProfile: { surveyVersion: 1, currentHsk: state.hsk, targetHsk: 9 } } };
    else if (path === '/billing/subscription') data = { tier: paid ? 'premium' : 'free', premiumExpiresAt: paid ? expiry : null, benefits: [] };
    else if (path === '/learning/streak') data = { streakCount: 0, longestStreak: 0, weekDays: [], today: '2026-09-30', timezone: 'Asia/Ho_Chi_Minh', isCompletedToday: false };
    else if (path === '/learning/dashboard') data = { metrics: { completedLessons: 0, savedWords: 0, dueWords: 0, totalXP: 0 }, recentProgress: [], continueLearning: null };
    else if (path === '/lessons') {
      state.catalogRequests.push(url.search);
      data = { items: state.hsk === state.videoHsk ? [lesson()] : [], page: 1, pages: 1, total: state.hsk === state.videoHsk ? 1 : 0 };
    } else if (path.startsWith(`/lessons/${lessonId}`)) {
      state.lessonRequests.push(path);
      if (state.hsk !== state.videoHsk) return route.fulfill({ status: 403, json: { error: {
        code: 'HSK_LEVEL_MISMATCH', message: `Bạn chỉ được xem video thuộc HSK ${state.hsk} theo hồ sơ hiện tại.`,
      } } });
      if (path.endsWith('/subtitles')) data = { revision: 1, cues: [] };
      else if (path.endsWith('/quiz')) data = { questions: [] };
      else if (path.endsWith('/progress')) data = { coverage: 0, watchedRanges: [], lastPositionSeconds: 0 };
      else data = lesson();
    }
    await route.fulfill({ json: { data } });
  });
  return state;
}

test('the catalog uses saved HSK even when the URL requests a different level', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/lessons?hsk=9');
  await expect(page.getByText('Bạn chỉ được xem video thuộc HSK 3 theo hồ sơ hiện tại.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Video đúng cấp HSK', exact: true })).toBeVisible();
  expect(state.catalogRequests.length).toBeGreaterThan(0);
  expect(state.catalogRequests.every(query => new URLSearchParams(query).get('hsk') === '3')).toBe(true);
  await expect(page.getByRole('button', { name: 'Lọc HSK' })).toHaveCount(0);
});

for (const paid of [false, true]) {
  test(`${paid ? 'Premium' : 'Free'} can play its own HSK and receives an HSK notice for a different level`, async ({ page }) => {
    const state = await setup(page, paid);
    await page.goto(`/watch/${lessonId}`);
    await expect(page.locator('video')).toHaveJSProperty('readyState', 4);
    state.videoHsk = 9;
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Video không thuộc HSK hiện tại' })).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nâng cấp Premium ngay' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Xem video đúng HSK' }).click();
    await expect(page).toHaveURL(/\/lessons$/);
  });
}

test('changing saved HSK invalidates the open video instead of replaying its cached URL', async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/watch/${lessonId}`);
  await expect(page.locator('video')).toHaveJSProperty('readyState', 4);
  const requestsBefore = state.lessonRequests.length;
  state.hsk = 4;
  await page.evaluate(() => window.dispatchEvent(new Event('hanflix:learning-profile-updated')));
  await expect(page.getByRole('heading', { name: 'Video không thuộc HSK hiện tại' })).toBeVisible();
  await expect(page.getByText('Bạn chỉ được xem video thuộc HSK 4 theo hồ sơ hiện tại.')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  expect(state.lessonRequests.length).toBeGreaterThan(requestsBefore);
});
