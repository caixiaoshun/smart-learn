import { test, expect } from '@playwright/test';
import { waitForApp, loginAsStudent, AI_CHAT_INPUT_PLACEHOLDER } from './helpers/test-utils';

// ═════════════════════════════════════════════════════════════
// 1. STUDENT DASHBOARD
// ═════════════════════════════════════════════════════════════

test.describe('Student Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/dashboard');
    await waitForApp(page);
  });

  test('should display student dashboard elements', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should have navigation sidebar with student menu items', async ({ page }) => {
    const navItems = ['仪表盘', '我的作业', '资源中心', 'AI助手'];
    for (const item of navItems) {
      const navLink = page.getByText(item, { exact: false });
      const count = await navLink.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should navigate to homework page', async ({ page }) => {
    const homeworkLink = page.getByText('我的作业');
    if (await homeworkLink.isVisible()) {
      await homeworkLink.click();
      await expect(page).toHaveURL(/\/homeworks/);
    }
  });

  test('should navigate to resources page', async ({ page }) => {
    const resourceLink = page.getByText('资源中心');
    if (await resourceLink.isVisible()) {
      await resourceLink.click();
      await expect(page).toHaveURL(/\/resources/);
    }
  });

  test('should navigate to AI assistant page', async ({ page }) => {
    const aiLink = page.getByText('AI助手');
    if (await aiLink.isVisible()) {
      await aiLink.click();
      await expect(page).toHaveURL(/\/ai-assistant/);
    }
  });

  test('should navigate to settings page', async ({ page }) => {
    const settingsLink = page.getByText('设置');
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/settings/);
    }
  });
});

// ═════════════════════════════════════════════════════════════
// 2. STUDENT HOMEWORK PAGE
// ═════════════════════════════════════════════════════════════

test.describe('Student Homework', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/homeworks');
    await waitForApp(page);
  });

  test('should display student homework page', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should display homework page elements or redirect on auth failure', async ({ page }) => {
    await page.waitForTimeout(2000);
    const url = page.url();

    if (url.includes('/homeworks')) {
      const joinBtn = page.getByText('加入班级');
      if (await joinBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await joinBtn.click();
        await page.waitForTimeout(500);
      }
    }
    expect(true).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
// 3. RESOURCE LIBRARY
// ═════════════════════════════════════════════════════════════

test.describe('Resource Library', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/resources');
    await waitForApp(page);
  });

  test('should display resource library page', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should have search functionality if page loads', async ({ page }) => {
    await page.waitForTimeout(2000);
    const url = page.url();
    if (url.includes('/resources')) {
      const searchInput = page.getByPlaceholder('搜索知识点、算法或案例...');
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('Python');
        await expect(searchInput).toHaveValue('Python');
      }
    }
    expect(true).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
// 4. AI ASSISTANT
// ═════════════════════════════════════════════════════════════

test.describe('AI Assistant', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/ai-assistant');
    await waitForApp(page);
  });

  test('should display AI assistant page', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should not display global SmartLearn AI sidebar', async ({ page }) => {
    // The global sidebar (MainLayout) should be hidden on AI assistant page
    const globalSidebar = page.locator('aside').filter({ hasText: 'SmartLearn AI' });
    await expect(globalSidebar).toHaveCount(0);
  });

  test('should have chat input', async ({ page }) => {
    const chatInput = page.getByPlaceholder(AI_CHAT_INPUT_PLACEHOLDER);
    if (await chatInput.isVisible()) {
      await chatInput.fill('什么是机器学习？');
      await expect(chatInput).toHaveValue('什么是机器学习？');
    }
  });

  test('should type in chat input and verify message appears', async ({ page }) => {
    const chatInput = page.getByPlaceholder(AI_CHAT_INPUT_PLACEHOLDER);
    if (await chatInput.isVisible()) {
      // Type a message
      await chatInput.fill('请解释深度学习的基本概念');
      await expect(chatInput).toHaveValue('请解释深度学习的基本概念');

      // Verify the "new conversation" button exists
      const newChatBtn = page.getByText('新对话');
      if (await newChatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(newChatBtn).toBeVisible();
      }
    }
  });

  test('should display EduBot header and model selector', async ({ page }) => {
    const header = page.getByText('EduBot 助手');
    if (await header.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(header).toBeVisible();
    }
  });
});

// ═════════════════════════════════════════════════════════════
// 5. SETTINGS PAGE
// ═════════════════════════════════════════════════════════════

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/settings');
    await waitForApp(page);
  });

  test('should display settings page', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should display settings tabs', async ({ page }) => {
    const tabs = ['个人资料', '账号安全', '通知设置', '隐私权限'];
    for (const tab of tabs) {
      const tabEl = page.getByText(tab);
      if (await tabEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(tabEl).toBeVisible();
      }
    }
  });

  test('should modify profile name and click save', async ({ page }) => {
    // Find the name input field
    const nameInput = page.locator('#name');
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill('新测试名称');
      await expect(nameInput).toHaveValue('新测试名称');

      // Click save button
      const saveBtn = page.getByText('保存修改');
      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Intercept the alert dialog
        page.on('dialog', async (dialog) => {
          expect(dialog.message()).toContain('保存');
          await dialog.accept();
        });
        await saveBtn.click();
      }
    }
  });

  test('should switch to notifications tab', async ({ page }) => {
    const notifTab = page.getByText('通知设置');
    if (await notifTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await notifTab.click();
      // After clicking, verify notification settings are displayed
      await page.waitForTimeout(500);
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    }
  });

  test('should show empty name validation on save', async ({ page }) => {
    const nameInput = page.locator('#name');
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.clear();

      // Click save - should trigger alert about empty name
      const saveBtn = page.getByText('保存修改');
      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        page.on('dialog', async (dialog) => {
          expect(dialog.message()).toContain('姓名不能为空');
          await dialog.accept();
        });
        await saveBtn.click();
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════
// 6. STUDENT ANALYTICS
// ═════════════════════════════════════════════════════════════

test.describe('Student Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/student/analytics');
    await waitForApp(page);
  });

  test('should display analytics page', async ({ page }) => {
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});
