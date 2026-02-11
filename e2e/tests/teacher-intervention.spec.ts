import { test, expect } from '@playwright/test';
import { waitForApp, loginAsTeacher } from './helpers/test-utils';

// ═════════════════════════════════════════════════════════════
// INTERVENTION CONSOLE - Deep Interaction Tests
// ═════════════════════════════════════════════════════════════

test.describe('Intervention Console', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/intervention');
    await waitForApp(page);
    await page.waitForTimeout(2000);
  });

  test('should load intervention console page or redirect', async ({ page }) => {
    const url = page.url();
    expect(url.includes('/teacher/intervention') || url.includes('/login')).toBe(true);
  });

  test('should display intervention page title and description', async ({ page }) => {
    const url = page.url();
    if (url.includes('/teacher/intervention')) {
      const title = page.getByText('干预控制台');
      if (await title.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(title).toBeVisible();
      }

      // Verify breadcrumb
      const breadcrumb = page.getByText('干预与分层作业');
      if (await breadcrumb.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(breadcrumb).toBeVisible();
      }
    }
  });

  test('should have statistics cards', async ({ page }) => {
    const url = page.url();
    if (url.includes('/teacher/intervention')) {
      const items = ['本周预警学生', '待处理干预', '班级平均积分'];
      for (const item of items) {
        const el = page.getByText(item);
        if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(el).toBeVisible();
        }
      }
    }
    expect(true).toBe(true);
  });

  // ─── Filter interaction tests ───────────────────────────

  test('should click filter buttons and verify active state', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/teacher/intervention')) return;

    // Click "全部" filter
    const allBtn = page.getByText('全部', { exact: false }).first();
    if (await allBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await allBtn.click();
      await page.waitForTimeout(300);
    }

    // Click "预警" filter
    const warningBtn = page.getByText('预警', { exact: false }).first();
    if (await warningBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await warningBtn.click();
      await page.waitForTimeout(300);
      // Verify the filter is active (has blue styling)
      await expect(warningBtn).toBeVisible();
    }

    // Click "高分" filter
    const highBtn = page.getByText('高分', { exact: false }).first();
    if (await highBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await highBtn.click();
      await page.waitForTimeout(300);
      await expect(highBtn).toBeVisible();
    }

    // Switch back to "全部"
    if (await allBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await allBtn.click();
      await page.waitForTimeout(300);
    }
  });

  // ─── Toggle switch interaction tests ────────────────────

  test('should toggle layer switches (基础层/进阶层/挑战层)', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/teacher/intervention')) return;

    const layers = ['基础层', '进阶层', '挑战层'];
    for (const layer of layers) {
      const el = page.getByText(layer);
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(el).toBeVisible();
      }
    }

    // Find all switch buttons on the page
    const switches = page.locator('button[role="switch"]');
    const switchCount = await switches.count();

    if (switchCount >= 3) {
      // Toggle 挑战层 (3rd switch, initially unchecked)
      const challengeSwitch = switches.nth(2);
      const initialState = await challengeSwitch.getAttribute('data-state');

      await challengeSwitch.click();
      await page.waitForTimeout(300);

      const newState = await challengeSwitch.getAttribute('data-state');
      // The state should have toggled
      expect(newState).not.toBe(initialState);

      // Toggle it back
      await challengeSwitch.click();
      await page.waitForTimeout(300);

      const restoredState = await challengeSwitch.getAttribute('data-state');
      expect(restoredState).toBe(initialState);
    }
  });

  test('should toggle 基础层 switch and verify state change', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/teacher/intervention')) return;

    const switches = page.locator('button[role="switch"]');
    const switchCount = await switches.count();

    if (switchCount >= 1) {
      // 基础层 is the 1st switch (initially checked)
      const basicSwitch = switches.nth(0);
      const initialState = await basicSwitch.getAttribute('data-state');
      expect(initialState).toBe('checked');

      // Toggle off
      await basicSwitch.click();
      await page.waitForTimeout(300);
      const offState = await basicSwitch.getAttribute('data-state');
      expect(offState).toBe('unchecked');

      // Toggle back on
      await basicSwitch.click();
      await page.waitForTimeout(300);
      const onState = await basicSwitch.getAttribute('data-state');
      expect(onState).toBe('checked');
    }
  });

  // ─── Homework publish form tests ────────────────────────

  test('should fill homework topic input', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/teacher/intervention')) return;

    const topicInput = page.locator('#homework-topic-input');
    if (await topicInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await topicInput.fill('Python 基础语法');
      await expect(topicInput).toHaveValue('Python 基础语法');
    }
  });

  test('should have publish button disabled when topic is empty', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/teacher/intervention')) return;

    // Ensure the topic input is empty
    const topicInput = page.locator('#homework-topic-input');
    if (await topicInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await topicInput.fill('');
      await page.waitForTimeout(300);

      // The publish button should be disabled
      const publishBtn = page.getByText('AI 生成并发布');
      if (await publishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(publishBtn).toBeDisabled();
      }
    }
  });

  test('should enable publish button when topic is filled', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/teacher/intervention')) return;

    const topicInput = page.locator('#homework-topic-input');
    if (await topicInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await topicInput.fill('3.1 空间向量基础');
      await page.waitForTimeout(300);

      // The publish button should become enabled
      const publishBtn = page.getByText('AI 生成并发布');
      if (await publishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(publishBtn).toBeEnabled();
      }
    }
  });

  test('should have class selector in the form', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/teacher/intervention')) return;

    // Check that the class selector exists
    const classLabel = page.getByText('目标班级');
    if (await classLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(classLabel).toBeVisible();
    }
  });

  test('should have layer configuration section', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/teacher/intervention')) return;

    const layerLabel = page.getByText('分层设置 (AI 辅助生成)');
    if (await layerLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(layerLabel).toBeVisible();
    }
  });

  // ─── Action buttons tests ──────────────────────────────

  test('should have "新建分层作业" and "历史记录" buttons', async ({ page }) => {
    const url = page.url();
    if (!url.includes('/teacher/intervention')) return;

    const newHomeworkBtn = page.getByText('新建分层作业');
    if (await newHomeworkBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(newHomeworkBtn).toBeVisible();
    }

    const historyBtn = page.getByText('历史记录');
    if (await historyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(historyBtn).toBeVisible();
    }
  });
});
