import { expect, test } from '@playwright/test';

for (const navigation of ['sidebar', 'back'] as const) {
  test(`practice preserves answers before ${navigation} navigation`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let releaseSave!: () => void;
    const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
    let saveReceived = false;
    let savedAnswers: Record<string, string> = {};
    const attempt = { id: 'attempt-1', setId: 'set-1', title: 'Luyện đọc kiểm thử', hsk: 1, skill: 'reading',
      status: 'in_progress', version: 0, answers: {}, flagged: [], startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      questions: [{ id: 'q1', type: 'choice', prompt: 'Chọn nghĩa của 你好', options: [{ id: 'a', text: 'Xin chào' }, { id: 'b', text: 'Tạm biệt' }] }] };
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      let data: unknown = { items: [], total: 0, totalPages: 1 };
      if (path.endsWith('/auth/refresh')) data = { accessToken: 'test-practice' };
      else if (path.endsWith('/auth/me')) data = { user: { id: 'learner-practice', name: 'Học viên', email: 'learner@example.test', role: 'user', status: 'active', learningProfile: { currentHsk: 1, surveyVersion: 1 } } };
      else if (path.endsWith('/learning/streak')) data = { streakCount: 0, longestStreak: 0, isCompletedToday: false, lastActiveDate: null, today: '2026-09-27', timezone: 'Asia/Ho_Chi_Minh', weekDays: [] };
      else if (path.endsWith('/practice/sets')) data = { items: [{ id: 'set-1', title: attempt.title, hsk: 1, skill: 'reading', durationSeconds: 120, questionCount: 1 }], totalPages: 1 };
      else if (path.endsWith('/practice/attempts') && method === 'POST') data = { ...attempt, serverNow: new Date().toISOString() };
      else if (path.endsWith('/practice/attempts/attempt-1')) {
        if (method === 'PATCH') {
          saveReceived = true;
          const input = route.request().postDataJSON();
          await saveGate;
          savedAnswers = input.answers;
          data = { ...attempt, ...input, version: input.version + 1, serverNow: new Date().toISOString() };
        } else data = { ...attempt, serverNow: new Date().toISOString() };
      }
      return route.fulfill({ json: { data } });
    });
    try {
      await page.goto('/exam');
      await page.getByRole('button', { name: 'Bắt đầu / Tiếp tục' }).click();
      await page.getByLabel('Xin chào', { exact: true }).check();
      await expect.poll(() => saveReceived).toBe(true);
      if (navigation === 'back') await page.evaluate(() => history.back());
      else await page.getByRole('button', { name: 'Ngữ pháp', exact: true }).first().click();
      await expect(page).toHaveURL(/\/exam\?attempt=attempt-1/);
      await expect(page.getByRole('heading', { name: attempt.title })).toBeVisible();
      releaseSave();
      await expect(page).toHaveURL(navigation === 'back' ? /\/exam$/ : /\/grammar$/);
      expect(savedAnswers).toEqual({ q1: 'a' });
      expect(errors).toEqual([]);
    } finally { releaseSave(); }
  });
}
