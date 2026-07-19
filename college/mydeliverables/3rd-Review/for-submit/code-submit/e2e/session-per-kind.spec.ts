import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const APP_URL = 'http://localhost:5173';

function generateTestEmail(): string {
  return `per-kind+${Date.now()}@test.studytracker.app`;
}

async function createTestUser(email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
}

async function seedActiveSession(
  page: any,
  overrides: Record<string, unknown> = {},
) {
  await page.evaluate(async (overrides: Record<string, unknown>) => {
    const dbs = await indexedDB.databases();
    const userDb = dbs.find((db: IDBDatabaseInfo) => db.name?.startsWith('StudyTracker_'));
    if (!userDb?.name) throw new Error('No StudyTracker DB found');

    const dbName = userDb.name;
    const request = indexedDB.open(dbName);
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('activeSession', 'readwrite');
        const store = tx.objectStore('activeSession');
        store.put({
          id: 1,
          sessionId: crypto.randomUUID(),
          materialId: 'test-mat-1',
          sessionTitle: 'Test session',
          slotDate: new Date().toISOString().slice(0, 10),
          weekIndex: 0,
          plannedMinutes: 30,
          startedAt: new Date().toISOString(),
          status: 'active',
          pauseIntervals: [],
          pomodoroConfig: { workMinutes: 50, breakMinutes: 10 },
          ...overrides,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, overrides);
}

test.describe('Per-kind session rendering', () => {
  const email = generateTestEmail();
  const password = 'TestPassword123!';

  test.beforeEach(async () => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip();
    }
  });

  test('YouTube session renders YouTube layout with embed', async ({ page }) => {
    test.setTimeout(120000);

    // Inject fake YT.Player before page loads
    await page.addInitScript(() => {
      (window as any).YT = {
        Player: class FakePlayer {
          constructor(_el: string, opts: any) {
            setTimeout(() => opts.events?.onReady?.(), 100);
          }
          playVideo() {}
          pauseVideo() {}
          seekTo() {}
          getCurrentTime() { return 0; }
          getDuration() { return 252; }
          destroy() {}
        },
      };
      (window as any).onYouTubeIframeAPIReady?.();
    });

    await createTestUser(email, password);
    await page.goto(`${APP_URL}/study/sign-in`);
    await page.waitForTimeout(2000);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(2000);

    await seedActiveSession(page, {
      kind: 'youtube',
      youtubeVideoId: 'dQw4w9WgXcQ',
      materialUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });

    await page.goto(`${APP_URL}/study/session`);
    await page.waitForTimeout(3000);

    await expect(page.locator('.session-layout-youtube')).toBeVisible();
    await expect(page.locator('.session-yt-embed-container')).toBeVisible();
  });

  test('article session renders default layout with banner', async ({ page }) => {
    test.setTimeout(120000);

    const articleEmail = `per-kind-article+${Date.now()}@test.studytracker.app`;
    await createTestUser(articleEmail, password);
    await page.goto(`${APP_URL}/study/sign-in`);
    await page.waitForTimeout(2000);
    await page.getByLabel('Email').fill(articleEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(2000);

    await seedActiveSession(page, {
      kind: 'article',
      materialUrl: 'https://example.com/article',
    });

    await page.goto(`${APP_URL}/study/session`);
    await page.waitForTimeout(3000);

    await expect(page.locator('.session-layout-centered')).toBeVisible();
    await expect(page.locator('.session-yt-embed-container')).not.toBeVisible();
  });

  test('manual session with URL renders "Open material" button', async ({ page }) => {
    test.setTimeout(120000);

    const manualEmail = `per-kind-manual+${Date.now()}@test.studytracker.app`;
    await createTestUser(manualEmail, password);
    await page.goto(`${APP_URL}/study/sign-in`);
    await page.waitForTimeout(2000);
    await page.getByLabel('Email').fill(manualEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(2000);

    await seedActiveSession(page, {
      kind: 'manual',
      materialUrl: 'https://drive.google.com/some-pdf',
    });

    await page.goto(`${APP_URL}/study/session`);
    await page.waitForTimeout(3000);

    await expect(page.locator('.session-layout-centered')).toBeVisible();
    await expect(page.getByText('Open material')).toBeVisible();
  });

  test('manual session without URL renders text-only view', async ({ page }) => {
    test.setTimeout(120000);

    const manualNoUrlEmail = `per-kind-manual-nourl+${Date.now()}@test.studytracker.app`;
    await createTestUser(manualNoUrlEmail, password);
    await page.goto(`${APP_URL}/study/sign-in`);
    await page.waitForTimeout(2000);
    await page.getByLabel('Email').fill(manualNoUrlEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(2000);

    await seedActiveSession(page, {
      kind: 'manual',
    });

    await page.goto(`${APP_URL}/study/session`);
    await page.waitForTimeout(3000);

    await expect(page.locator('.session-layout-centered')).toBeVisible();
    await expect(page.getByText('Open material')).not.toBeVisible();
  });
});
