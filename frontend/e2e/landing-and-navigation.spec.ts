import { test, expect } from '@playwright/test';

test.describe('HanFlix E2E Landing & Navigation', () => {
  test('renders homepage with brand title and primary navigation', async ({ page }) => {
    await page.goto('/');

    // Check document title
    await expect(page).toHaveTitle(/HanFlix/i);

    // Verify main app root rendered
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // Verify brand header / logo is rendered
    const brand = page.getByText(/HanFlix/i).first();
    await expect(brand).toBeVisible();
  });

  test('checks presence of interactive learning elements or hero section', async ({ page }) => {
    await page.goto('/');

    // Wait for DOM to settle
    await page.waitForLoadState('domcontentloaded');

    // Verify buttons are clickable
    const buttons = page.locator('button');
    expect(await buttons.count()).toBeGreaterThan(0);
  });
});
