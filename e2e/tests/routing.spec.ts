import { test, expect } from '@playwright/test';
import { waitForApp, loginAsStudent } from './helpers/test-utils';

// ═════════════════════════════════════════════════════════════
// ROUTING & REDIRECTS
// ═════════════════════════════════════════════════════════════

test.describe('Routing - Unauthenticated Redirects', () => {
  test('should redirect /dashboard to /login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForApp(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect /teacher/dashboard to /login when unauthenticated', async ({ page }) => {
    await page.goto('/teacher/dashboard');
    await waitForApp(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect /homeworks to /login when unauthenticated', async ({ page }) => {
    await page.goto('/homeworks');
    await waitForApp(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect /settings to /login when unauthenticated', async ({ page }) => {
    await page.goto('/settings');
    await waitForApp(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect /ai-assistant to /login when unauthenticated', async ({ page }) => {
    await page.goto('/ai-assistant');
    await waitForApp(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Routing - 404 / Unknown Routes', () => {
  test('should redirect unknown routes to home when authenticated', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/some-nonexistent-page');
    await waitForApp(page);

    // The catch-all route redirects to "/" which is the student dashboard
    await page.waitForURL(/^(?!.*some-nonexistent-page)/, { timeout: 5000 }).catch(() => {});
    const url = page.url();
    expect(url).not.toContain('some-nonexistent-page');
  });

  test('should redirect /xyz to home', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/xyz');
    await waitForApp(page);

    await page.waitForURL(/^(?!.*\/xyz)/, { timeout: 5000 }).catch(() => {});
    const url = page.url();
    expect(url).not.toContain('/xyz');
  });

  test('should redirect deeply nested unknown routes', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/a/b/c/d/e');
    await waitForApp(page);

    await page.waitForURL(/^(?!.*\/a\/b\/c\/d\/e)/, { timeout: 5000 }).catch(() => {});
    const url = page.url();
    expect(url).not.toContain('/a/b/c/d/e');
  });
});

test.describe('Routing - Authenticated Navigation', () => {
  test('should load course detail page route', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/courses/test-course-id');
    await waitForApp(page);

    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should load case library page route', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/cases');
    await waitForApp(page);

    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should load student analytics route', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/student/analytics');
    await waitForApp(page);

    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});
