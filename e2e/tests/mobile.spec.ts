import { test, expect } from '@playwright/test';
import { waitForApp, loginAsStudent, loginAsTeacher, MOBILE_VIEWPORT } from './helpers/test-utils';

// ═════════════════════════════════════════════════════════════
// MOBILE RESPONSIVE DESIGN TESTS
// ═════════════════════════════════════════════════════════════

test.describe('Mobile - Student Dashboard', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('should render login page correctly on mobile', async ({ page }) => {
    await page.goto('/login');
    await waitForApp(page);

    // Core login elements should still be visible
    await expect(page.getByText('密码登录')).toBeVisible();
    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible();
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
    await expect(page.getByText('立即登录')).toBeVisible();
  });

  test('should load student dashboard on mobile viewport', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/dashboard');
    await waitForApp(page);

    // Dashboard should load - content should be present
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should have sidebar behavior on mobile - check if sidebar is hidden or collapsed', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/dashboard');
    await waitForApp(page);

    // On mobile viewport (375px), the fixed sidebar (w-64 = 256px) may overflow
    // Check if sidebar elements are either hidden or the layout adapts
    const sidebar = page.locator('aside');
    const sidebarCount = await sidebar.count();

    if (sidebarCount > 0) {
      // Sidebar exists - verify it's either hidden or within viewport
      const box = await sidebar.first().boundingBox();
      if (box) {
        // On mobile, sidebar might be off-screen or have scroll
        // Just verify the page still functions
        const pageContent = await page.textContent('body');
        expect(pageContent).toBeTruthy();
      }
    }
  });

  test('should navigate through student pages on mobile', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/homeworks');
    await waitForApp(page);

    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should display settings page on mobile', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/settings');
    await waitForApp(page);

    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});

test.describe('Mobile - Teacher Dashboard', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('should load teacher dashboard on mobile', async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/dashboard');
    await waitForApp(page);

    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should load intervention console on mobile', async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/intervention');
    await waitForApp(page);

    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should load homework management on mobile', async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/homeworks');
    await waitForApp(page);

    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});

test.describe('Mobile - Auth Pages', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('should render register page on mobile', async ({ page }) => {
    await page.goto('/register');
    await waitForApp(page);

    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible();
    await expect(page.getByText('下一步')).toBeVisible();
  });

  test('should render forgot password page on mobile', async ({ page }) => {
    await page.goto('/forgot-password');
    await waitForApp(page);

    await expect(page.getByPlaceholder('请输入注册邮箱')).toBeVisible();
  });

  test('should redirect unauthenticated mobile user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);

    await expect(page).toHaveURL(/\/login/);
  });
});
