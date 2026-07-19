import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const APP_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve('e2e/__screens__/roadmap');

mkdirSync(SCREENSHOT_DIR, { recursive: true });

declare global {
  interface Window {
    __seed?: () => Promise<void>;
    __wipe?: () => Promise<void>;
  }
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function createTestUser(email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error && !error.message.includes('already been registered')) {
    throw error;
  }
}

function generateTestEmail(prefix: string): string {
  return `${prefix}+${Date.now()}@test.studytracker.app`;
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/);
}

async function waitForDevSeeder(page: Page): Promise<void> {
  await page.waitForFunction(() => typeof window.__wipe === 'function');
}

async function insertEventsIntoFirstStudyDb(
  page: Page,
  events: Array<{ kind: string; payload: Record<string, unknown>; createdAt: string }>,
): Promise<void> {
  await page.evaluate(async (seedEvents) => {
    const databases = await indexedDB.databases();
    const dbName = databases.find((db) => db.name?.startsWith('StudyTracker_'))?.name;
    if (!dbName) throw new Error('StudyTracker IndexedDB not found');

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');
      for (const event of seedEvents) store.add(event);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    db.close();
  }, events);
}

async function insertOverflowSessionsForToday(page: Page): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const events = Array.from({ length: 4 }, (_, index) => {
    const startedAt = new Date(`${today}T1${index}:00:00`);
    const endedAt = new Date(startedAt.getTime() + (25 + index * 5) * 60000);
    return {
      kind: 'SessionLogged',
      payload: {
        sessionId: `overflow-${index}`,
        materialId: `overflow-material-${index}`,
        sessionTitle: `Overflow session ${index + 1}`,
        date: today,
        duration: 25 + index * 5,
        activeMinutes: 25 + index * 5,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        source: 'manual',
      },
      createdAt: endedAt.toISOString(),
    };
  });

  await insertEventsIntoFirstStudyDb(page, events);
}

async function swipeCalendar(
  page: Page,
  direction: 'left' | 'right',
): Promise<void> {
  const calendar = page.getByTestId('roadmap-calendar');
  const box = await calendar.boundingBox();
  if (!box) throw new Error('Roadmap calendar is not visible');

  const y = box.y + Math.min(220, box.height / 2);
  const startX = direction === 'left' ? box.x + box.width - 40 : box.x + 40;
  const endX = direction === 'left' ? box.x + 40 : box.x + box.width - 40;

  await calendar.dispatchEvent('touchstart', {
    touches: [{ clientX: startX, clientY: y }],
    changedTouches: [{ clientX: startX, clientY: y }],
  });
  await calendar.dispatchEvent('touchend', {
    touches: [],
    changedTouches: [{ clientX: endX, clientY: y }],
  });
}

test.describe('Roadmap calendar visual walkthrough', () => {
  test.use({ baseURL: APP_URL });

  test.beforeEach(() => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip();
    }
  });

  test('Phases 2-4: calendar grid, month navigation, and session modals', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'app-mobile', 'Desktop walkthrough runs in the app project.');

    const email = generateTestEmail('roadmap-calendar');
    const password = 'TestPassword123!';
    let currentMonthLabel = '';

    await createTestUser(email, password);
    await signIn(page, email, password);
    await waitForDevSeeder(page);

    await test.step('01-grid', async () => {
      await page.evaluate(async () => {
        await window.__wipe?.();
        await window.__seed?.();
      });
      await page.goto(`${APP_URL}/study/roadmap`);

      await expect(page.getByTestId('roadmap-calendar')).toBeVisible();
      currentMonthLabel = await page.getByTestId('roadmap-month-label').innerText();
      await expect(page.getByLabel(/Roadmap progress/i)).toBeVisible();
      await expect(page.getByLabel(/Roadmap status legend/i)).toBeVisible();
      const weekCount = await page.locator('.roadmap-week-row').count();
      expect(weekCount).toBeGreaterThanOrEqual(4);
      expect(weekCount).toBeLessThanOrEqual(6);
      await screenshot(page, '01-grid');
    });

    await test.step('02-status-colors', async () => {
      const todayCell = page.getByTestId('roadmap-today-cell');
      await expect(todayCell).toHaveClass(/roadmap-day-today/);
      await expect(todayCell).toContainText('Today');
      await expect(page.locator('.roadmap-day-current-week').first()).toBeVisible();

      const doneChip = page.locator('[data-status="done"][data-icon="ti-check"]').first();
      const pendingChip = page.locator('[data-status="pending"][data-icon="ti-clock"]').first();
      const skippedChip = page.locator('[data-status="skipped"][data-icon="ti-x"]').first();
      const unplannedLegend = page.locator('[data-status="unplanned"][data-icon="ti-plus"]').first();

      await expect(doneChip).toBeVisible();
      await expect(pendingChip).toBeVisible();
      await expect(skippedChip).toBeVisible();
      await expect(unplannedLegend).toBeVisible();
      await expect(page.locator('.terracotta-ring')).toHaveCount(0);
      await screenshot(page, '02-status-colors');
    });

    await test.step('03-empty', async () => {
      await page.evaluate(async () => {
        await window.__wipe?.();
      });
      await insertEventsIntoFirstStudyDb(page, [
        {
          kind: 'OnboardingCompleted',
          payload: {},
          createdAt: new Date().toISOString(),
        },
      ]);

      await page.goto(`${APP_URL}/study/roadmap`);
      await expect(page.getByTestId('roadmap-empty')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'No active roadmap' })).toBeVisible();
      await screenshot(page, '03-empty');
    });

    await test.step('04-next-month', async () => {
      await page.evaluate(async () => {
        await window.__wipe?.();
        await window.__seed?.();
      });
      await insertOverflowSessionsForToday(page);
      await page.goto(`${APP_URL}/study/roadmap`);
      currentMonthLabel = await page.getByTestId('roadmap-month-label').innerText();

      await page.getByRole('button', { name: 'Next month' }).click();
      await expect(page.getByTestId('roadmap-month-label')).not.toHaveText(currentMonthLabel);
      await screenshot(page, '04-next-month');
    });

    await test.step('05-prev-month', async () => {
      await page.getByRole('button', { name: 'Previous month' }).click();
      await expect(page.getByTestId('roadmap-month-label')).toHaveText(currentMonthLabel);
      await screenshot(page, '05-prev-month');
    });

    await test.step('06-today-reset', async () => {
      const next = page.getByRole('button', { name: 'Next month' });
      const previous = page.getByRole('button', { name: 'Previous month' });

      while (await previous.isEnabled()) {
        await previous.click();
      }
      await expect(previous).toBeDisabled();

      while (await next.isEnabled()) {
        await next.click();
      }
      await expect(next).toBeDisabled();
      await expect(page.getByTestId('roadmap-deadline-marker')).toBeVisible();

      await page.getByRole('button', { name: 'Today' }).click();
      await expect(page.getByTestId('roadmap-month-label')).toHaveText(currentMonthLabel);
      await screenshot(page, '06-today-reset');
    });

    await test.step('07-hover-expand', async () => {
      const filledDay = page
        .locator('.roadmap-day-in-month')
        .filter({ has: page.locator('.roadmap-bubble') })
        .first();

      await filledDay.hover();
      await screenshot(page, '07-hover-expand');
    });

    await test.step('08-modal-done', async () => {
      await page.locator('.roadmap-bubble[data-status="done"]').first().click();
      await expect(page.getByRole('dialog', { name: 'Roadmap session detail' })).toBeVisible();
      await expect(page.getByText('Completed')).toBeVisible();
      await expect(page.getByRole('button', { name: 'View session' })).toBeVisible();
      await screenshot(page, '08-modal-done');
      await page.getByLabel('Close modal').click();
      await expect(page.getByRole('dialog', { name: 'Roadmap session detail' })).toHaveCount(0);
    });

    await test.step('09-modal-pending', async () => {
      await page.locator('.roadmap-bubble[data-status="pending"]').first().click();
      await expect(page.getByRole('dialog', { name: 'Roadmap session detail' })).toBeVisible();
      await expect(page.getByText('Planned')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start session' })).toBeVisible();
      await screenshot(page, '09-modal-pending');
      await page.getByLabel('Close modal').click();
      await expect(page.getByRole('dialog', { name: 'Roadmap session detail' })).toHaveCount(0);
    });

    await test.step('10-day-modal', async () => {
      await page
        .getByTestId('roadmap-today-cell')
        .getByRole('button', { name: /more/ })
        .click();
      await expect(page.getByRole('dialog', { name: 'Roadmap day sessions' })).toBeVisible();
      expect(await page.locator('.roadmap-day-list-row').count()).toBeGreaterThanOrEqual(4);
      await screenshot(page, '10-day-modal');
    });
  });

  test('Phase 5: mobile dots, day sheet, and swipe navigation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'app-mobile', 'Mobile walkthrough runs in the app-mobile project.');

    const email = generateTestEmail('roadmap-calendar-mobile');
    const password = 'TestPassword123!';

    await createTestUser(email, password);
    await signIn(page, email, password);
    await waitForDevSeeder(page);

    await page.evaluate(async () => {
      await window.__wipe?.();
      await window.__seed?.();
    });
    await insertOverflowSessionsForToday(page);
    await page.goto(`${APP_URL}/study/roadmap`);

    await test.step('11-mobile-dots', async () => {
      const todayCell = page.getByTestId('roadmap-today-cell');
      await expect(todayCell.locator('.roadmap-mobile-day-button')).toBeVisible();
      await expect(todayCell.locator('.roadmap-status-dot')).toHaveCount(4);
      await expect(todayCell.locator('.roadmap-mobile-count')).toHaveText(/\d+/);
      await expect(page.locator('.roadmap-bubble')).toHaveCount(0);
      await screenshot(page, '11-mobile-dots');
    });

    await test.step('12-day-sheet', async () => {
      await page.getByTestId('roadmap-today-cell').click();
      await expect(page.getByRole('dialog', { name: 'Roadmap day sheet' })).toBeVisible();
      expect(await page.locator('.roadmap-day-sheet-row').count()).toBeGreaterThanOrEqual(4);
      await screenshot(page, '12-day-sheet');
    });

    await test.step('13-mobile-modal', async () => {
      await page.locator('.roadmap-day-sheet-row').first().click();
      await expect(page.getByRole('dialog', { name: 'Roadmap session detail' })).toBeVisible();
      await screenshot(page, '13-mobile-modal');
      await page.getByLabel('Close modal').click();
    });

    await test.step('14-mobile-month-change', async () => {
      const monthLabel = page.getByTestId('roadmap-month-label');
      const previousLabel = await monthLabel.innerText();
      const canGoNext = await page.getByRole('button', { name: 'Next month' }).isEnabled();
      const canGoPrevious = await page.getByRole('button', { name: 'Previous month' }).isEnabled();

      test.skip(!canGoNext && !canGoPrevious, 'Seed roadmap only spans one month.');

      await swipeCalendar(page, canGoNext ? 'left' : 'right');
      await expect(monthLabel).not.toHaveText(previousLabel);
      await screenshot(page, '14-mobile-month-change');
    });
  });

  test('Phase 6: terminal events and roadmaps history', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'app-mobile', 'History walkthrough runs in the app project.');

    const email = generateTestEmail('roadmap-calendar-history');
    const password = 'TestPassword123!';

    await createTestUser(email, password);
    await signIn(page, email, password);
    await waitForDevSeeder(page);

    await test.step('15-complete-confirm', async () => {
      await page.evaluate(async () => {
        await window.__wipe?.();
        await window.__seed?.();
      });
      await page.goto(`${APP_URL}/study/roadmap`);
      await page.getByRole('button', { name: 'Mark roadmap complete' }).click();
      await page.waitForURL(/\/study\/roadmaps/);
      await expect(page.getByRole('heading', { name: 'Past Roadmaps' })).toBeVisible();
      await screenshot(page, '15-complete-confirm');
    });

    await test.step('16-history-completed', async () => {
      const completed = page.getByLabel('Completed roadmaps');
      await expect(completed.getByRole('button', { name: /Learn modern React/i })).toBeVisible();
      await screenshot(page, '16-history-completed');
    });

    await test.step('17-history-abandoned', async () => {
      await page.evaluate(async () => {
        await window.__wipe?.();
        await window.__seed?.();
      });
      await page.goto(`${APP_URL}/study/roadmap`);
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Abandon this roadmap');
        await dialog.accept();
      });
      await page.getByRole('button', { name: 'Abandon roadmap' }).click();
      await page.waitForURL(/\/study\/roadmaps/);
      const abandoned = page.getByLabel('Abandoned roadmaps');
      await expect(abandoned.getByRole('button', { name: /Learn modern React/i })).toBeVisible();
      await screenshot(page, '17-history-abandoned');
    });

    await test.step('18-history-empty', async () => {
      await page.evaluate(async () => {
        await window.__wipe?.();
      });
      await insertEventsIntoFirstStudyDb(page, [
        {
          kind: 'OnboardingCompleted',
          payload: {},
          createdAt: new Date().toISOString(),
        },
      ]);
      await page.goto(`${APP_URL}/study/roadmaps`);
      await expect(page.getByTestId('roadmaps-empty')).toBeVisible();
      await expect(page.getByText('Nothing here yet.')).toBeVisible();
      await screenshot(page, '18-history-empty');
    });

    await test.step('19-history-readonly', async () => {
      await page.evaluate(async () => {
        await window.__wipe?.();
        await window.__seed?.();
      });
      await page.goto(`${APP_URL}/study/roadmaps`);
      await page.getByLabel('Active roadmaps').getByRole('button', { name: /Learn modern React/i }).click();
      await expect(page.getByTestId('roadmaps-readonly-detail')).toBeVisible();
      await expect(page.getByTestId('roadmap-readonly')).toBeVisible();
      await expect(page.getByTestId('roadmap-calendar')).toBeVisible();
      await screenshot(page, '19-history-readonly');
    });
  });

  test('Phase 7: replan route stub', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'app-mobile', 'Replan route walkthrough runs in the app project.');

    const email = generateTestEmail('roadmap-calendar-replan');
    const password = 'TestPassword123!';

    await createTestUser(email, password);
    await signIn(page, email, password);
    await waitForDevSeeder(page);

    await test.step('20-replan-stub', async () => {
      await page.evaluate(async () => {
        await window.__wipe?.();
        await window.__seed?.();
      });
      await page.goto(`${APP_URL}/study/roadmap`);
      await page.getByRole('link', { name: 'Replan' }).click();
      await page.waitForURL(/\/study\/replan$/);
      await expect(page.getByRole('heading', { name: 'Replan' })).toBeVisible();
      expect(page.url()).not.toContain('/study/study/');
      await screenshot(page, '20-replan-stub');
    });
  });

  test('progress ignores historical and gap sessions for the active roadmap', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'app', 'Progress regression runs in the desktop app project.');

    const email = generateTestEmail('roadmap-progress-scope');
    const password = 'TestPassword123!';
    const roadmapCreatedAt = '2099-06-27T00:00:00.000Z';

    await createTestUser(email, password);
    await signIn(page, email, password);
    await waitForDevSeeder(page);
    await page.evaluate(async () => {
      await window.__wipe?.();
    });
    await insertEventsIntoFirstStudyDb(page, [
      {
        kind: 'OnboardingCompleted',
        payload: {},
        createdAt: '2099-06-26T00:00:00.000Z',
      },
      {
        kind: 'MaterialAdded',
        payload: {
          materialId: 'mat-current',
          title: 'Current material',
          estimatedDuration: 60,
          kind: 'article',
          role: 'anchor',
        },
        createdAt: '2099-06-26T01:00:00.000Z',
      },
      {
        kind: 'RoadmapCreated',
        payload: {
          startDate: '2099-06-27',
          deadline: '2099-07-11',
          weeks: 2,
          purpose: 'Tests',
          selectedStudyDays: ['Tue'],
          weekdayHours: 1,
          weekendHours: 0,
          weeklyHours: 1,
          slots: [
            {
              date: '2099-06-30',
              dayOfWeek: 'Tue',
              weekIndex: 0,
              plannedMinutes: 60,
              capacityMinutes: 60,
              candidateMaterialIds: ['mat-current'],
              role: 'anchor',
              sessionTitle: 'Current roadmap session',
            },
          ],
        },
        createdAt: roadmapCreatedAt,
      },
      {
        kind: 'SessionLogged',
        payload: {
          sessionId: 'old-before-window',
          date: '2099-06-26',
          materialId: 'mat-current',
          duration: 62,
          source: 'manual',
        },
        createdAt: '2099-06-26T12:00:00.000Z',
      },
      {
        kind: 'SessionLogged',
        payload: {
          sessionId: 'gap-inside-window',
          date: '2099-06-30',
          materialId: 'other-material',
          duration: 30,
          source: 'manual',
        },
        createdAt: '2099-06-30T12:00:00.000Z',
      },
    ]);

    await page.goto(`${APP_URL}/study/roadmap`);
    await expect(page.getByLabel('Roadmap progress')).toContainText('0%');
    await expect(page.getByLabel('Roadmap progress')).toContainText('0m logged');
    await expect(page.getByLabel('Roadmap progress')).toContainText('1h to go');
    await expect(page.getByLabel('Roadmap progress')).not.toContainText('1h 32m logged');

    await page.goto(`${APP_URL}/study/roadmaps`);
    await expect(page.getByTestId('roadmaps-active-hero')).toBeVisible();
    await expect(page.getByLabel('Active roadmap stats')).toContainText('0 sessions');
    await expect(page.getByLabel('Active roadmap stats')).toContainText('0m logged');
    await expect(page.getByLabel('Active roadmap stats')).toContainText('0% complete');
  });
});
