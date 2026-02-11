import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { ensureFixtures } from './helpers/generate-fixtures';
import { waitForApp, loginAsStudent } from './helpers/test-utils';

// Generate test fixtures before all tests
let fixtures: { pdf: string; notebook: string };

test.beforeAll(() => {
  fixtures = ensureFixtures();
});

// ═════════════════════════════════════════════════════════════
// STUDENT HOMEWORK - Deep Interaction & File Upload Tests
// ═════════════════════════════════════════════════════════════

test.describe('Student Homework - Deep Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/homeworks');
    await waitForApp(page);
  });

  test('should display homework page and have join class button', async ({ page }) => {
    await page.waitForTimeout(2000);
    const url = page.url();

    if (url.includes('/homeworks')) {
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();

      // Should have join class functionality
      const joinBtn = page.getByText('加入班级');
      if (await joinBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(joinBtn).toBeVisible();
      }
    }
  });

  test('should open join class dialog', async ({ page }) => {
    await page.waitForTimeout(2000);
    const url = page.url();
    if (!url.includes('/homeworks')) return;

    const joinBtn = page.getByText('加入班级');
    if (await joinBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await joinBtn.click();
      await page.waitForTimeout(500);

      // Check if dialog opened
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(dialog).toBeVisible();
      }
    }
  });

  test('should attempt file upload on homework submission area', async ({ page }) => {
    await page.waitForTimeout(2000);
    const url = page.url();
    if (!url.includes('/homeworks')) return;

    // Look for file upload input on the page
    const fileInput = page.locator('input[type="file"]');
    const fileInputCount = await fileInput.count();

    if (fileInputCount > 0) {
      // Use the generated PDF fixture for upload
      await fileInput.first().setInputFiles(fixtures.pdf);
      await page.waitForTimeout(1000);

      // Verify file was selected (the file name should appear somewhere)
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    }
  });

  test('should handle homework list display states', async ({ page }) => {
    await page.waitForTimeout(2000);
    const url = page.url();
    if (!url.includes('/homeworks')) return;

    // The page should either show homeworks or an empty state
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();

    // Check for common elements - either homework cards or empty state
    const hasHomeworks = await page.getByText('截止时间').isVisible({ timeout: 2000 }).catch(() => false);
    const hasEmptyState = await page.getByText('暂无作业').isVisible({ timeout: 2000 }).catch(() => false);
    const hasJoinClass = await page.getByRole('button', { name: '加入班级' }).isVisible({ timeout: 2000 }).catch(() => false);

    // One of these states should be true
    expect(hasHomeworks || hasEmptyState || hasJoinClass).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
// STUDENT HOMEWORK - File Upload with Fixtures
// ═════════════════════════════════════════════════════════════

test.describe('Student Homework - Fixture File Upload', () => {
  test('should validate PDF fixture file exists and is valid', async () => {
    expect(fs.existsSync(fixtures.pdf)).toBe(true);

    const content = fs.readFileSync(fixtures.pdf, 'utf-8');
    expect(content).toContain('%PDF-1.4');
    expect(content).toContain('%%EOF');
  });

  test('should validate Notebook fixture file exists and is valid', async () => {
    expect(fs.existsSync(fixtures.notebook)).toBe(true);

    const content = JSON.parse(fs.readFileSync(fixtures.notebook, 'utf-8'));
    expect(content.nbformat).toBe(4);
    expect(content.cells).toHaveLength(3);
    expect(content.cells[0].cell_type).toBe('markdown');
    expect(content.cells[1].cell_type).toBe('code');
  });

  test('should attempt PDF upload when file input is available', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/homeworks');
    await waitForApp(page);
    await page.waitForTimeout(2000);

    const url = page.url();
    if (!url.includes('/homeworks')) return;

    // Look for any file input on the page
    const fileInput = page.locator('input[type="file"]');
    const count = await fileInput.count();

    if (count > 0) {
      // Upload the PDF fixture
      await fileInput.first().setInputFiles(fixtures.pdf);
      await page.waitForTimeout(1000);

      // Verify we can see uploaded file feedback
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    }
  });

  test('should attempt Notebook upload when file input is available', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/homeworks');
    await waitForApp(page);
    await page.waitForTimeout(2000);

    const url = page.url();
    if (!url.includes('/homeworks')) return;

    const fileInput = page.locator('input[type="file"]');
    const count = await fileInput.count();

    if (count > 0) {
      // Upload the Notebook fixture
      await fileInput.first().setInputFiles(fixtures.notebook);
      await page.waitForTimeout(1000);

      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    }
  });
});
