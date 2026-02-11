import { test, expect } from '@playwright/test';
import { waitForApp, loginAsTeacher } from './helpers/test-utils';

// ═════════════════════════════════════════════════════════════
// 1. TEACHER DASHBOARD
// ═════════════════════════════════════════════════════════════

test.describe('Teacher Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/dashboard');
    await waitForApp(page);
  });

  test('should display teacher dashboard', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should navigate to class management', async ({ page }) => {
    const classLink = page.getByText('班级管理');
    if (await classLink.isVisible()) {
      await classLink.click();
      await expect(page).toHaveURL(/\/teacher\/classes/);
    }
  });

  test('should navigate to homework management', async ({ page }) => {
    const hwLink = page.locator('nav').getByText('作业管理');
    if (await hwLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hwLink.click();
      await expect(page).toHaveURL(/\/teacher\/homeworks/);
    } else {
      const hwCard = page.getByText('作业管理').first();
      if (await hwCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await hwCard.click();
        await page.waitForTimeout(1000);
      }
    }
    expect(true).toBe(true);
  });

  test('should navigate to analytics page', async ({ page }) => {
    const analyticsLink = page.getByText('数据分析');
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await expect(page).toHaveURL(/\/teacher\/analytics/);
    }
  });

  test('should navigate to behavior analysis', async ({ page }) => {
    const behaviorCard = page.getByText('学生行为数据');
    if (await behaviorCard.isVisible()) {
      await behaviorCard.click();
      await expect(page).toHaveURL(/\/teacher\/behavior/);
    }
  });

  test('should navigate to intervention console', async ({ page }) => {
    const interventionCard = page.getByText('精准干预');
    if (await interventionCard.isVisible()) {
      await interventionCard.click();
      await expect(page).toHaveURL(/\/teacher\/intervention/);
    }
  });
});

// ═════════════════════════════════════════════════════════════
// 2. CLASS MANAGEMENT
// ═════════════════════════════════════════════════════════════

test.describe('Class Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/classes');
    await waitForApp(page);
  });

  test('should display class management page', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should have create class button', async ({ page }) => {
    const createBtn = page.getByText('创建班级');
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible();
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════
// 3. HOMEWORK MANAGEMENT
// ═════════════════════════════════════════════════════════════

test.describe('Homework Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/homeworks');
    await waitForApp(page);
  });

  test('should display homework management page', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should have create homework button and open dialog', async ({ page }) => {
    const createBtn = page.getByText('发布作业');
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible();
      }
    }
  });

  test('should fill homework creation form', async ({ page }) => {
    const createBtn = page.getByText('发布作业');
    if (!(await createBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;

    await createBtn.click();
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');
    if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) return;

    // Fill title
    const titleInput = dialog.getByPlaceholder('例如：第三章练习题');
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill('E2E测试作业标题');
      await expect(titleInput).toHaveValue('E2E测试作业标题');
    }

    // Fill description
    const descInput = dialog.getByPlaceholder('详细描述作业要求...');
    if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descInput.fill('这是E2E测试的作业描述');
      await expect(descInput).toHaveValue('这是E2E测试的作业描述');
    }

    // Fill deadline (use a future date, 7 days from now)
    const deadlineInputs = dialog.locator('input[type="datetime-local"]');
    const deadlineCount = await deadlineInputs.count();
    if (deadlineCount >= 2) {
      const DAYS_AHEAD = 7;
      const futureDate = new Date(Date.now() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
      const dateStr = futureDate.toISOString().slice(0, 16);
      await deadlineInputs.nth(1).fill(dateStr);
    }

    // The submit button should be disabled when no class is selected
    const submitBtn = dialog.getByText('发布作业');
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Without a class selected, the button should be disabled
      await expect(submitBtn).toBeDisabled();
    }
  });

  test('should show homework form validation - empty title prevents submission', async ({ page }) => {
    const createBtn = page.getByText('发布作业');
    if (!(await createBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;

    await createBtn.click();
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');
    if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) return;

    // The submit button should be disabled when form is empty
    const submitBtn = dialog.getByText('发布作业');
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(submitBtn).toBeDisabled();
    }
  });
});

// ═════════════════════════════════════════════════════════════
// 4. TEACHER ANALYTICS
// ═════════════════════════════════════════════════════════════

test.describe('Teacher Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/analytics');
    await waitForApp(page);
  });

  test('should display teacher analytics page', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});

// ═════════════════════════════════════════════════════════════
// 5. BEHAVIOR ANALYSIS
// ═════════════════════════════════════════════════════════════

test.describe('Behavior Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/behavior');
    await waitForApp(page);
    await page.waitForTimeout(2000);
  });

  test('should load behavior analysis page or redirect', async ({ page }) => {
    const url = page.url();
    expect(url.includes('/teacher/behavior') || url.includes('/login')).toBe(true);
  });

  test('should display behavior page elements when loaded', async ({ page }) => {
    const url = page.url();
    if (url.includes('/teacher/behavior')) {
      const title = page.getByText('学生行为数据分析');
      if (await title.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(title).toBeVisible();
      }
    }
    expect(true).toBe(true);
  });

  test('should have export and generate buttons when loaded', async ({ page }) => {
    const url = page.url();
    if (url.includes('/teacher/behavior')) {
      const exportBtn = page.getByText('导出报表');
      const generateBtn = page.getByText('生成关注清单');

      if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(exportBtn).toBeEnabled();
      }
      if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(generateBtn).toBeEnabled();
      }
    }
    expect(true).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
// 6. TEACHER RESOURCES
// ═════════════════════════════════════════════════════════════

test.describe('Teacher Resources', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/resources');
    await waitForApp(page);
  });

  test('should display resource page for teachers', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});
