import { test, expect } from '@playwright/test';

test.describe('HanFlix Authentication & Responsive Layout Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/providers', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: { googleClientId: 'test-client-id.apps.googleusercontent.com' } }),
    }));
    await page.addInitScript(() => {
      let credentialCallback: (response: { credential: string }) => void = () => undefined;
      Object.defineProperty(window, 'google', { value: { accounts: { id: {
        initialize: (options: { callback: typeof credentialCallback }) => { credentialCallback = options.callback; },
        renderButton: (element: HTMLElement, options: { text: string }) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = options.text === 'signup_with' ? 'Đăng ký với Google' : 'Đăng nhập với Google';
          button.addEventListener('click', () => credentialCallback({ credential: 'x'.repeat(120) }));
          element.appendChild(button);
        },
      } } } });
    });
  });

  test('Google button sends the ID token to the backend and signs the user in', async ({ page }) => {
    let credential = '';
    await page.route('**/api/v1/auth/google', async route => {
      credential = JSON.parse(route.request().postData() ?? '{}').credential;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
        accessToken: 'mock-access-token',
        user: { id: 'learner-1', name: 'Learner', email: 'learner@example.com', role: 'user', status: 'active' },
      } }) });
    });
    await page.goto('/auth/login');
    await page.getByRole('button', { name: /đăng nhập với google/i }).click();
    await expect(page).toHaveURL('/');
    expect(credential).toHaveLength(120);
  });

  test('password signup accepts the emailed verification code', async ({ page }) => {
    await page.route('**/api/v1/auth/register', route => route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({ data: { user: { id: 'learner-1', name: 'Learner', email: 'learner@example.com', role: 'user', status: 'active' }, verificationRequired: true } }),
    }));
    let proof: Record<string, string> = {};
    await page.route('**/api/v1/auth/verify-email', route => {
      proof = JSON.parse(route.request().postData() ?? '{}');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { verified: true } }) });
    });
    await page.goto('/auth/signup');
    await page.getByLabel('Họ và tên').fill('Learner');
    await page.getByLabel('Email').fill('learner@example.com');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('Password123!');
    await page.getByLabel('Xác nhận mật khẩu').fill('Password123!');
    await page.getByRole('button', { name: /tạo tài khoản/i }).click();
    await page.getByLabel('Mã xác minh email').fill('123456');
    await page.getByRole('button', { name: /xác minh email/i }).click();
    await expect(page.getByText('Email đã được xác minh. Bạn có thể đăng nhập.')).toBeVisible();
    expect(proof).toMatchObject({ email: 'learner@example.com', code: '123456' });
  });

  test('forgot password accepts the emailed reset code', async ({ page }) => {
    await page.route('**/api/v1/auth/forgot-password', route => route.fulfill({
      status: 202, contentType: 'application/json', body: JSON.stringify({ data: { accepted: true } }),
    }));
    let proof: Record<string, string> = {};
    await page.route('**/api/v1/auth/reset-password', route => {
      proof = JSON.parse(route.request().postData() ?? '{}');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { passwordReset: true } }) });
    });
    await page.goto('/auth/forgot-password');
    await page.getByLabel('Email').fill('learner@example.com');
    await page.getByRole('button', { name: /gửi mã xác thực otp/i }).click();
    await page.getByRole('button', { name: /nhập mã otp/i }).click();
    await page.getByLabel('Mã OTP 6 số').fill('654321');
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill('NewPassword123!');
    await page.getByLabel('Xác nhận mật khẩu mới').fill('NewPassword123!');
    await page.getByRole('button', { name: /cập nhật mật khẩu/i }).click();
    await expect(page.getByRole('heading', { name: 'Đã đổi mật khẩu' })).toBeVisible();
    expect(proof).toMatchObject({ email: 'learner@example.com', code: '654321', password: 'NewPassword123!' });
  });


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
      await page.addInitScript(() => localStorage.setItem('hanflix_survey_completed_global', 'true'));
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
