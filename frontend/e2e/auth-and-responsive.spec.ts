import { test, expect } from '@playwright/test';

test.describe('HanFlix Authentication & Responsive Layout Tests', () => {

  test.describe('Standard Laptop (1366x768) Viewport Tests', () => {
    test.use({ viewport: { width: 1366, height: 768 } });

    test('Login page fits within 768px laptop height without scrolling and renders AuthDivider', async ({ page }) => {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');

      // Verify AuthDivider "hoặc" is present
      const divider = page.getByText(/hoặc/i);
      await expect(divider).toBeVisible();

      // Verify Google OAuth button is present
      const googleBtn = page.getByRole('button', { name: /đăng nhập với google/i });
      await expect(googleBtn).toBeVisible();

      // Verify Primary Submit button is present
      const submitBtn = page.getByRole('button', { name: /đăng nhập ngay/i });
      await expect(submitBtn).toBeVisible();

      // Verify no vertical overflow requiring scroll
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollHeight > window.innerHeight;
      });
      expect(isOverflowing).toBe(false);
    });

    test('Signup page fits within 768px laptop height without scrolling, renders 4 feature cards & AuthDivider', async ({ page }) => {
      await page.goto('/auth/signup');
      await page.waitForLoadState('networkidle');

      // Verify AuthDivider "hoặc" is present
      const divider = page.getByText(/hoặc/i);
      await expect(divider).toBeVisible();

      // Verify Google signup button is present
      const googleBtn = page.getByRole('button', { name: /đăng ký với google/i });
      await expect(googleBtn).toBeVisible();

      // Verify Primary Submit button is present
      const submitBtn = page.getByRole('button', { name: /tạo tài khoản/i });
      await expect(submitBtn).toBeVisible();

      // Verify 4 feature cards in 2x2 grid are present
      await expect(page.getByText('5,000+ Video Bài Học')).toBeVisible();
      await expect(page.getByText('Lộ Trình HSK 1-6')).toBeVisible();
      await expect(page.getByText('Phụ Đề Pinyin Thông Minh')).toBeVisible();
      await expect(page.getByText('Trợ Lý AI Luyện Nói')).toBeVisible();

      // Verify no vertical overflow requiring scroll
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollHeight > window.innerHeight;
      });
      expect(isOverflowing).toBe(false);
    });

    test('Forgot Password page fits within 768px laptop height without scrolling', async ({ page }) => {
      await page.goto('/auth/forgot-password');
      await page.waitForLoadState('networkidle');

      // Verify OTP button
      const otpBtn = page.getByRole('button', { name: /gửi mã.*otp/i });
      await expect(otpBtn).toBeVisible();

      // Verify visual card heading
      await expect(page.getByRole('heading', { name: /lấy lại mật khẩu|khôi phục mật khẩu/i })).toBeVisible();

      // Verify no vertical overflow requiring scroll
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollHeight > window.innerHeight;
      });
      expect(isOverflowing).toBe(false);
    });
  });

  test.describe('Mobile Viewport (390x844) Tests', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('Login page displays responsive mobile header and single column form', async ({ page }) => {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');

      // Verify mobile header with brand logo
      const brandLogo = page.getByAltText(/hanflix/i).first();
      await expect(brandLogo).toBeVisible();

      // Verify back button in mobile header
      const backBtn = page.getByRole('button', { name: /quay lại/i });
      await expect(backBtn).toBeVisible();

      // Form elements are visible and properly laid out
      const submitBtn = page.getByRole('button', { name: /đăng nhập ngay/i });
      await expect(submitBtn).toBeVisible();

      const divider = page.getByText(/hoặc/i);
      await expect(divider).toBeVisible();

      const googleBtn = page.getByRole('button', { name: /đăng nhập với google/i });
      await expect(googleBtn).toBeVisible();
    });

    test('Signup page displays clean mobile single column layout with AuthDivider', async ({ page }) => {
      await page.goto('/auth/signup');
      await page.waitForLoadState('networkidle');

      const submitBtn = page.getByRole('button', { name: /tạo tài khoản/i });
      await expect(submitBtn).toBeVisible();

      const divider = page.getByText(/hoặc/i);
      await expect(divider).toBeVisible();

      const googleBtn = page.getByRole('button', { name: /đăng ký với google/i });
      await expect(googleBtn).toBeVisible();
    });
  });

  test.describe('Panda Pet & AI Drawer Integration Tests', () => {
    test('Panda Pet does not display "Hỏi AI" pill badge, and clicking opens AI Drawer', async ({ page }) => {
      await page.route('**/api/v1/auth/refresh', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { accessToken: 'mock-jwt-token-12345' } }),
        });
      });
      await page.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { user: {
            id: 'mock-panda-tester', name: 'Panda Tester', email: 'panda@example.com',
            role: 'user', status: 'active', learningProfile: null,
          } } }),
        });
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Verify we are logged in and Panda Pet mascot button is present
      const pandaPetBtn = page.locator('button[aria-label="Mở trợ lý Panda AI"]');
      await expect(pandaPetBtn).toBeVisible({ timeout: 10000 });

      // Verify the badge "Hỏi AI" is NOT rendered above panda pet
      const hoiAiBadge = pandaPetBtn.locator('text=Hỏi AI');
      await expect(hoiAiBadge).toHaveCount(0);

      // Click Panda Pet to open AI Assistant Drawer
      await pandaPetBtn.click();

      // Verify AI Drawer is opened
      const aiDrawer = page.locator('text=Trợ lý Panda AI');
      await expect(aiDrawer.first()).toBeVisible({ timeout: 5000 });
    });
  });

});
