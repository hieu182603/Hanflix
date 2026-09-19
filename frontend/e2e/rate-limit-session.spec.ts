import { test, expect } from '@playwright/test';

test('a rate-limited token refresh preserves the session and reports the wait time', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    if (route.request().url().endsWith('/auth/refresh')) {
      await route.fulfill({ status: 429, json: { error: {
        code: 'RATE_LIMITED', message: 'Vui lòng thử lại sau 30 giây.',
      } } });
    } else {
      await route.fulfill({ status: 401, json: { error: { code: 'INVALID_TOKEN' } } });
    }
  });
  // Load the actual Vite client module in a minimal same-origin page.
  await page.route('http://localhost:5173/rate-limit-test', route => route.fulfill({
    contentType: 'text/html', body: '<html><body>API client test</body></html>',
  }));
  await page.goto('/rate-limit-test');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/api/client.ts';
    const client = await import(/* @vite-ignore */ modulePath);
    client.setAccessToken('existing-session');
    try {
      await client.apiFetch('/profile/me');
      return { unexpectedSuccess: true };
    } catch (error) {
      const apiError = error as Error & { status: number };
      return { status: apiError.status, message: apiError.message, token: client.getAccessToken() };
    }
  });
  expect(result).toEqual({ status: 429, message: 'Vui lòng thử lại sau 30 giây.', token: 'existing-session' });
});
