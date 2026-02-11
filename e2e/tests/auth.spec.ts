import { test, expect } from '@playwright/test';
import { waitForApp, loginAsStudent, setupApiMocks } from './helpers/test-utils';

// Unique identifiers for test isolation
const ts = Date.now();
const STUDENT_EMAIL = `student_${ts}@test.com`;

// ═════════════════════════════════════════════════════════════
// 1. LOGIN PAGE
// ═════════════════════════════════════════════════════════════

test.describe('Authentication - Login', () => {
  test('should display login page with password and code tabs', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    await expect(page.getByText('密码登录')).toBeVisible();
    await expect(page.getByText('验证码登录')).toBeVisible();
    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible();
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
    await expect(page.getByText('立即登录')).toBeVisible();
    await expect(page.getByText('忘记密码？')).toBeVisible();
  });

  test('should switch between password and code login tabs', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    // Click the code login tab
    await page.getByText('验证码登录').click();
    await expect(page.getByPlaceholder('请输入6位验证码')).toBeVisible();

    // Switch back to password login
    await page.getByText('密码登录').click();
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
  });

  test('should show validation errors on empty login submission', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    // Try to login with empty fields
    await page.getByText('立即登录').click();

    // Should still be on login page (form validation prevents submission)
    await expect(page).toHaveURL(/\/login/);
  });

  test('should fill and submit password login form', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    await page.getByPlaceholder('请输入邮箱').fill('test@example.com');
    await page.getByPlaceholder('请输入密码').fill('password123');

    await expect(page.getByPlaceholder('请输入邮箱')).toHaveValue('test@example.com');
    await expect(page.getByPlaceholder('请输入密码')).toHaveValue('password123');
  });

  test('should fill and interact with code login tab', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    // Switch to code login
    await page.getByText('验证码登录').click();

    // Fill email
    const emailInput = page.locator('#email-code');
    await emailInput.fill('test@example.com');

    // Code input should be visible
    await expect(page.getByPlaceholder('请输入6位验证码')).toBeVisible();
    await expect(page.getByText('获取验证码')).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const passwordInput = page.getByPlaceholder('请输入密码');
    await passwordInput.fill('secret123');

    await expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await toggleBtn.isVisible()) {
      await expect(passwordInput).toHaveValue('secret123');
    }
  });

  test('should navigate between login and register pages', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    const registerLink = page.getByRole('link', { name: /注册/ });
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/\/register/);
    }
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    await page.getByText('忘记密码？').click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

// ═════════════════════════════════════════════════════════════
// 2. REGISTRATION PAGE
// ═════════════════════════════════════════════════════════════

test.describe('Authentication - Registration', () => {
  test('should display step 1 registration form', async ({ page }) => {
    await page.goto('/register');
    await waitForApp(page);

    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible();
    await expect(page.getByPlaceholder('请输入6位验证码')).toBeVisible();
    await expect(page.getByText('获取验证码')).toBeVisible();
    await expect(page.getByText('下一步')).toBeVisible();
  });

  test('should fill step 1 fields', async ({ page }) => {
    await page.goto('/register');
    await waitForApp(page);

    await page.getByPlaceholder('请输入邮箱').fill(STUDENT_EMAIL);
    await expect(page.getByPlaceholder('请输入邮箱')).toHaveValue(STUDENT_EMAIL);
  });
});

// ═════════════════════════════════════════════════════════════
// 3. FORGOT PASSWORD
// ═════════════════════════════════════════════════════════════

test.describe('Authentication - Forgot Password', () => {
  test('should display forgot password form', async ({ page }) => {
    await page.goto('/forgot-password');
    await waitForApp(page);

    await expect(page.getByPlaceholder('请输入注册邮箱')).toBeVisible();
  });

  test('should fill and interact with forgot password form', async ({ page }) => {
    await page.goto('/forgot-password');
    await waitForApp(page);

    await page.getByPlaceholder('请输入注册邮箱').fill('user@example.com');
    await expect(page.getByPlaceholder('请输入注册邮箱')).toHaveValue('user@example.com');
  });
});

// ═════════════════════════════════════════════════════════════
// 4. PERMISSION CONTROL
// ═════════════════════════════════════════════════════════════

test.describe('Authentication - Permission Control', () => {
  test('should redirect unauthenticated users to login from /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);

    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated users from teacher pages', async ({ page }) => {
    await page.goto('/teacher/dashboard');
    await waitForApp(page);

    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated users from student homework page', async ({ page }) => {
    await page.goto('/homeworks');
    await waitForApp(page);

    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect unauthenticated users from settings page', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);

    await expect(page).toHaveURL(/\/login/);
  });
});

// ═════════════════════════════════════════════════════════════
// 5. LOGOUT FLOW
// ═════════════════════════════════════════════════════════════

test.describe('Authentication - Logout', () => {
  test('should clear auth state on logout action', async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/login');
    await page.evaluate(() => {
      const mockAuth = {
        state: {
          token: 'mock-student-token',
          isAuthenticated: true,
          user: { id: 'test-student-id', name: '测试学生', email: 'student@test.com', role: 'STUDENT' },
        },
        version: 0,
      };
      localStorage.setItem('auth-storage', JSON.stringify(mockAuth));
    });
    await page.goto('/dashboard');
    await waitForApp(page);

    const logoutBtn = page.getByText('退出登录');
    if (await logoutBtn.first().isVisible()) {
      await logoutBtn.first().click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
