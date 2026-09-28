import { expect, test } from '@playwright/test';

const lessonId = '507f1f77bcf86cd799439011';
const cue = { cueId: 'meal', startMs: 80000, endMs: 85000, zh: '我已经吃过饭了。',
  pinyin: 'Wǒ yǐjīng chīguo fàn le.', vi: 'Tôi ăn cơm rồi.', tokens: [] };
const samples = 16000 * 95;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);

for (const contentMode of ['lesson', 'song', 'podcast', 'drama']) {
  test(`${contentMode}: asks with real playback context, restores history and seeks a citation`, async ({ page }) => {
    const asks: Array<Record<string, any>> = [];
    const turns: Array<Record<string, any>> = [];
    const lesson = { _id: lessonId, slug: 'meal', titleVi: 'Bữa ăn trong gia đình', titleZh: '吃饭',
      descriptionVi: 'Học theo hội thoại', hsk: 2, topicIds: ['daily-life'], goalTags: ['daily'],
      durationSeconds: 95, status: 'published', activeSubtitleRevision: 3, contentMode,
      media: { url: '/ai-fixture.wav', mimeType: 'audio/wav' } };
    await page.route('**/ai-fixture.wav', route => {
      const match = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? '');
      const start = match ? Number(match[1]) : 0;
      const end = match?.[2] ? Math.min(Number(match[2]), wav.length - 1) : wav.length - 1;
      return route.fulfill({ status: match ? 206 : 200, contentType: 'audio/wav',
        headers: { 'Accept-Ranges': 'bytes', ...(match ? { 'Content-Range': `bytes ${start}-${end}/${wav.length}` } : {}) },
        body: wav.subarray(start, end + 1) });
    });
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown = {};
      if (path.endsWith('/auth/refresh')) data = { accessToken: 'test-ai' };
      else if (path.endsWith('/auth/me')) data = { user: { id: '507f1f77bcf86cd799439012', name: 'Người học',
        email: 'learner@example.test', role: 'user', status: 'active', learningProfile: { currentHsk: 2, surveyVersion: 1 } } };
      else if (path === `/api/v1/lessons/${lessonId}`) data = lesson;
      else if (path.endsWith('/subtitles')) data = { revision: 3, cues: [cue] };
      else if (path.endsWith('/progress')) data = { lastPositionSeconds: 0, watchedRanges: [], coverage: 0, activeStudySeconds: 0, completed: false };
      else if (path.endsWith('/quiz')) data = { questions: [] };
      else if (path === '/api/v1/lessons') data = { items: [lesson], total: 1, pages: 1 };
      else if (path.endsWith('/ai/history')) data = { messages: turns };
      else if (path.endsWith('/ai/ask')) {
        const body = route.request().postDataJSON(); asks.push(body);
        data = { answerVi: 'Trong câu này, 过 nói về trải nghiệm đã ăn.', citations: [cue], grounding: 'transcript',
          contextStatus: 'ready', context: { ...body.lessonContext, title: lesson.titleVi, coverage: 'window' }, requestId: `r${asks.length}` };
        turns.push({ id: `r${asks.length}`, question: body.question, response: data, createdAt: new Date().toISOString() });
      }
      return route.fulfill({ json: { data } });
    });
    await page.goto(`/watch/${lessonId}`);
    const video = page.locator('video');
    await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    await video.evaluate(v => { const media = v as HTMLVideoElement; media.pause(); media.currentTime = 83; });
    await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime)).toBe(83);
    await page.getByRole('button', { name: 'Mở trợ lý Panda AI' }).click();
    const drawer = page.getByRole('complementary', { name: 'Trợ lý Panda AI' });
    await expect(drawer.getByText('Bữa ăn trong gia đình', { exact: true })).toBeVisible();
    await drawer.getByRole('textbox').fill('Vì sao dùng 过?');
    await drawer.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await expect(drawer.getByText('Trong câu này, 过 nói về trải nghiệm đã ăn.')).toBeVisible();
    expect(asks[0].lessonContext).toMatchObject({ lessonId, subtitleRevision: 3, playbackMs: 83000, cueId: 'meal', scope: 'current_segment' });
    expect(asks[0].history).toBeUndefined();
    await drawer.getByRole('button', { name: /Xem lại 01:20/ }).click();
    await expect(drawer).not.toBeVisible();
    await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime)).toBe(80);
    await page.getByRole('button', { name: 'Hỏi câu này' }).click();
    await expect(drawer.getByText('Vì sao dùng 过?', { exact: true })).toBeVisible();
    await expect(drawer.getByText(/Đã ghim 01:20/)).toBeVisible();
    expect(asks).toHaveLength(1);
    await drawer.getByRole('textbox').fill('Giải thích câu đó kỹ hơn');
    await drawer.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await expect.poll(() => asks.length).toBe(2);
    expect(asks[1].lessonContext).toMatchObject({ lessonId, cueId: 'meal', playbackMs: 80000, scope: 'current_cue' });
    await expect(drawer.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled();
    await drawer.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.getByRole('button', { name: 'Hỏi AI', exact: true }).click();
    await expect(drawer.getByLabel('Phạm vi câu hỏi')).toHaveValue('current_segment');
    await expect(drawer.getByRole('textbox')).toHaveValue('Giải thích nội dung, từ vựng và ngữ pháp trong đoạn đang xem.');
    expect(asks).toHaveLength(2);
    if (contentMode === 'lesson') {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(drawer.getByRole('textbox')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await page.screenshot({ path: 'test-results/ai-context-mobile.png' });
    }
  });
}
