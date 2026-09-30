import { expect, test, type Page } from '@playwright/test';

async function mockApi(page: Page, role: 'user' | 'admin' | 'guest' = 'user', premium = false) {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let data: unknown = { items: [], total: 0, totalPages: 1, pages: 1 };
    if (role === 'guest' && path === '/auth/refresh') {
      await route.fulfill({ status: 401, json: { error: { code: 'REFRESH_REQUIRED', message: 'Đăng nhập lại' } } }); return;
    }
    if (path === '/auth/refresh') data = { accessToken: 'i18n-test-token' };
    else if (path === '/auth/me') data = { user: { id: '507f1f77bcf86cd799439011', role, status: 'active', name: 'Nguyễn An', email: 'learner@example.test', premiumExpiresAt: premium ? '2099-01-01T00:00:00.000Z' : null, learningProfile: { surveyVersion: 1, currentHsk: 1 } } };
    else if (path === '/learning/streak') data = { streakCount: 1, longestStreak: 1, weekDays: [], today: '2026-09-30', timezone: 'Asia/Ho_Chi_Minh', isCompletedToday: true, lastActiveDate: '2026-09-30' };
    else if (path === '/billing/plans') data = { plans: [{ code: 'monthly', name: '1 Tháng (Trải nghiệm)', durationMonths: 1, price: 99000, approximatePricePerDay: 3300, pricePerMonth: 99000, active: true, savings: 0, savingsPercent: 0 }], benefits: ['Xem video học không giới hạn'], paymentAvailable: true };
    else if (path === '/billing/subscription') data = { tier: premium ? 'premium' : 'free', premiumExpiresAt: premium ? '2099-01-01T00:00:00.000Z' : null };
    else if (path === '/learning/dashboard') data = { metrics: { completedLessons: 0, savedWords: 0, dueWords: 0, averageQuizScore: null }, recommendations: [], recentProgress: [], continueLearning: null };
    else if (path === '/grammar/stats') data = { total: 0, byLevel: {} };
    else if (path === '/grammar') data = { items: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 1 } };
    else if (path === '/learning/activity') data = { days: [], totals: { activeStudySeconds: 0, progressUpdates: 0, quizAttempts: 0, completedLessons: 0 } };
    else if (path === '/learning/roadmap') data = { stages: [], currentHsk: 1, targetHsk: 3, dailyMinutes: 15, overallProgress: 0, streakDays: 1, weekDays: [], dailyLessons: [], weakSkills: [] };
    else if (path === '/billing/checkout' || path === '/billing/orders/123456') data = { orderCode: 123456, planName: '1 Tháng (Trải nghiệm)', durationMonths: 1, amount: 99000, status: 'PENDING', expiresAt: new Date(Date.now() + 900000).toISOString(), checkoutUrl: 'https://pay.payos.vn/web/test-only' };
    await route.fulfill({ json: { data } });
  });
}

test('learner switches languages live, reloads and checks out in the chosen language', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await mockApi(page);
  await page.goto('/premium');
  await page.getByRole('button', { name: 'Ngôn ngữ giao diện', exact: true }).click();
  await page.getByRole('button', { name: /English/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Upgrade now', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Upgrade now', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Upgrade now', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'HanFlix Premium checkout' });
  await expect(dialog.getByRole('link', { name: 'Open VietQR checkout (PayOS)' })).toBeVisible();
  await expect(dialog.getByText('1 month (Explore)', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Display Language', exact: true }).click();
  await page.getByRole('button', { name: /中文/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('button', { name: '立即升级', exact: true })).toBeVisible();
  await page.goto('/payment-history');
  await expect(page.getByText('暂无交易', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile learner filters and settings localize without changing user data', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem('hanflix_language', 'en'));
  await page.goto('/lessons');
  await expect(page.getByText('Published lesson library', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filter video topics' })).toBeVisible();
  await page.getByRole('button', { name: 'Filter video topics' }).click();
  await page.getByRole('option', { name: 'Travel & discovery' }).click();
  await expect(page).toHaveURL(/topic=travel/);
  await page.goto('/settings');
  await expect(page.getByText(/Account settings/i).first()).toBeVisible();
  await expect(page.getByPlaceholder('Enter your display name')).toHaveValue('Nguyễn An');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

for (const language of ['en', 'zh'] as const) test(`learner page labels use ${language} across the learning area`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(`${page.url()}: ${error.stack}`));
  await mockApi(page, 'user', true);
  await page.addInitScript(lang => localStorage.setItem('hanflix_language', lang), language);
  for (const route of ['/feed', '/grammar', '/vocabulary', '/history', '/roadmap', '/leaderboard', '/practice', '/onboarding']) {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('lang', language === 'zh' ? 'zh-CN' : 'en');
    await expect(page.locator('h1,h2').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(errors, route).toEqual([]);
    const untranslated = await page.locator('body').evaluate(body => {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const texts: string[] = [];
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim() ?? '';
        if (/[ăâêôơưđĂÂÊÔƠƯĐ\u1EA0-\u1EF9]/.test(text) && text !== 'Nguyễn An' && (node.parentElement?.getClientRects().length ?? 0) > 0) texts.push(text);
      }
      return [...new Set(texts)];
    });
    expect(untranslated, route).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('public pages keep Vietnamese for a signed-in learner and restore the preference on return', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem('hanflix_language', 'en'));
  for (const path of ['/landing', '/about', '/faq', '/testimonials']) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    expect(await page.evaluate(() => localStorage.getItem('hanflix_language'))).toBe('en');
  }
  await page.goto('/feed');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

for (const role of ['guest', 'admin'] as const) test(`${role} screens remain Vietnamese with an English learner preference`, async ({ page }) => {
  await mockApi(page, role);
  await page.addInitScript(() => localStorage.setItem('hanflix_language', 'en'));
  await page.goto(role === 'admin' ? '/admin/users' : '/auth/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(role === 'admin' ? page.getByText('Trung tâm Quản trị') : page.getByRole('button', { name: 'Đăng nhập ngay' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hanflix_language'))).toBe('en');
});
