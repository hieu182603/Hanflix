import { expect, test } from '@playwright/test';

// Twelve seconds of valid local PCM audio. No media, auth, or cloud dependencies.
const samples = 16000 * 12;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);

for (const mode of ['song', 'podcast', 'drama']) {
  test(`${mode} plays real local audio, seeks and preserves typing`, async ({ page }) => {
    await page.route('**/test-content.wav', route => {
      const match = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? '');
      const start = match ? Number(match[1]) : 0;
      const end = match?.[2] ? Math.min(Number(match[2]), wav.length - 1) : wav.length - 1;
      return route.fulfill({ status: match ? 206 : 200, contentType: 'audio/wav',
        headers: { 'Accept-Ranges': 'bytes', ...(match ? { 'Content-Range': `bytes ${start}-${end}/${wav.length}` } : {}) },
        body: wav.subarray(start, end + 1) });
    });
    await page.goto(`/e2e/fixtures/content-mode-player.html?mode=${mode}`);
    const video = page.locator('video');
    await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    await page.getByRole('button', { name: 'Phát', exact: true }).click();
    await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
    await page.getByLabel('Ghi chú').fill('Xin');
    await page.getByLabel('Ghi chú').press('End');
    await page.getByLabel('Ghi chú').press('Space');
    await expect(page.getByLabel('Ghi chú')).toHaveValue('Xin ');
    if (mode === 'podcast') await page.getByRole('button', { name: /Phần tiếp theo/ }).click();
    else await page.locator('input[type=range]').fill('6');
    await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId('seeks')).not.toHaveText('0');
    await expect(page.getByText('Xin chào thế giới')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(video).toBeVisible();
    expect(await video.evaluate(v => v.getBoundingClientRect().width)).toBeGreaterThan(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `test-results/content-mode-${mode}-mobile.png` });
  });
}
