import { type Page } from '@playwright/test';

/**
 * Wait for the page to be interactive (DOM content loaded).
 */
export async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Intercept all backend API requests to prevent rate-limiting (429) errors
 * during E2E tests. Returns appropriate empty responses for each endpoint.
 */
export async function setupApiMocks(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    let body: unknown = {};

    if (url.includes('/homeworks/student') || url.includes('/homeworks/teacher')) {
      body = { homeworks: [] };
    } else if (url.includes('/classes/teacher') || url.includes('/classes')) {
      body = { classes: [] };
    } else if (url.includes('/resources')) {
      body = { resources: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };
    } else if (url.includes('/ai/models')) {
      body = { models: [] };
    } else if (url.includes('/ai/history')) {
      body = { messages: [], chatHistory: [] };
    } else if (url.includes('/dashboard/student/stats')) {
      body = { totalPoints: 0, maxPoints: 0, rank: '0', courseProgress: 0, aiInteractionScore: 0, weeklyPointsEarned: 0, rankChange: 0, interactionLevel: '' };
    } else if (url.includes('/dashboard/student/trend')) {
      body = { labels: [], data: [] };
    } else if (url.includes('/dashboard/student/radar')) {
      body = { labels: [], data: [], fullMark: 100 };
    } else if (url.includes('/dashboard/student/activities')) {
      body = [];
    } else if (url.includes('/dashboard/student/modules')) {
      body = {};
    } else if (url.includes('/dashboard/teacher/stats')) {
      body = { totalStudents: 0, totalClasses: 0, submissionRate: 0, pendingAlerts: 0 };
    } else if (url.includes('/dashboard/teacher/activities')) {
      body = [];
    } else if (url.includes('/dashboard/teacher/tasks')) {
      body = [];
    } else if (url.includes('/dashboard/teacher/ai-suggestion')) {
      body = { suggestion: '' };
    } else if (url.includes('/dashboard/teacher/intervention')) {
      body = { interventions: [], stats: { warningCount: 0, pendingInterventions: 0, urgentCount: 0, avgPoints: 0, highPerformers: 0 }, aiInsights: '' };
    } else if (url.includes('/behavior')) {
      body = { students: [] };
    } else if (url.includes('/analytics')) {
      body = {};
    } else if (url.includes('/auth/preferences')) {
      body = { preferences: {} };
    } else if (url.includes('/auth/me')) {
      body = { id: 'test-id', name: 'Test', email: 'test@test.com', role: 'STUDENT' };
    } else if (url.includes('/courses')) {
      body = [];
    } else if (url.includes('/cases')) {
      body = [];
    } else if (url.includes('/public/stats')) {
      body = { userCount: 0, courseCount: 0 };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/**
 * Inject mock student auth state into localStorage and skip login.
 */
export async function loginAsStudent(page: Page) {
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
}

/**
 * Inject mock teacher auth state into localStorage and skip login.
 */
export async function loginAsTeacher(page: Page) {
  await setupApiMocks(page);
  await page.goto('/login');
  await page.evaluate(() => {
    const mockAuth = {
      state: {
        token: 'mock-teacher-token',
        isAuthenticated: true,
        user: { id: 'test-teacher-id', name: '测试教师', email: 'teacher@test.com', role: 'TEACHER' },
      },
      version: 0,
    };
    localStorage.setItem('auth-storage', JSON.stringify(mockAuth));
  });
}

/** Mobile viewport configuration (iPhone X) */
export const MOBILE_VIEWPORT = { width: 375, height: 812 };

/** Regex pattern for AI assistant chat input placeholder */
export const AI_CHAT_INPUT_PLACEHOLDER = /输入|提问|消息|询问/;
