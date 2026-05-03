import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const APP_URL = 'http://localhost:5173';

function generateTestEmail(): string {
  return `planned-end+${Date.now()}@test.studytracker.app`;
}

async function createTestUser(email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
}

test.describe('Planned-end notification', () => {
  const email = generateTestEmail();
  const password = 'TestPassword123!';

  test.beforeEach(() => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip();
    }
  });

  test('banner appears after returning to backgrounded tab past planned end', async ({ page }) => {
    test.setTimeout(120000);

    await page.clock.install();

    await createTestUser(email, password);
    await page.goto(`${APP_URL}/study/sign-in`);
    await page.waitForTimeout(2000);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(2000);

    await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      const userDb = dbs.find(db => db.name?.startsWith('StudyTracker_'));
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
            sessionTitle: 'Test session for planned-end',
            slotDate: new Date().toISOString().slice(0, 10),
            weekIndex: 0,
            plannedMinutes: 1,
            startedAt: new Date().toISOString(),
            status: 'active',
            pauseIntervals: [],
            pomodoroConfig: { workMinutes: 50, breakMinutes: 10 },
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    });

    await page.goto(`${APP_URL}/study/session`);
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        value: true, configurable: true, writable: true,
      });
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden', configurable: true, writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.clock.fastForward(61_000);

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        value: false, configurable: true, writable: true,
      });
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible', configurable: true, writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const faviconHref = await page.evaluate(() => {
      const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      return link?.href ?? '';
    });
    expect(faviconHref).toContain('favicon-dot.svg');

    await expect(
      page.locator('.banner.attention .banner-title')
    ).toContainText('Planned time reached');

    const title = await page.evaluate(() => document.title);
    expect(title).not.toContain('⏰');

    await expect(page.locator('.session-frame.overrun')).toBeVisible();

    await page.locator('.banner.attention .banner-dismiss').click();

    await expect(page.locator('.banner.attention')).not.toBeVisible();

    const faviconAfterDismiss = await page.evaluate(() => {
      const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      return link?.href ?? '';
    });
    expect(faviconAfterDismiss).toContain('favicon.svg');
    expect(faviconAfterDismiss).not.toContain('favicon-dot.svg');
  });
});
