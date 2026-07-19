import { test, expect, type Page } from '@playwright/test';

/**
 * Live booking-interaction check against a real Supabase login (no service-role
 * user creation). Verifies the reworked Phase-5 booking sheets (D21): the radio
 * list material picker, the tappable material card, and the "No material · pick
 * at start" detach path — exercised on the running app with a real account.
 *
 * SAFETY: this test is non-destructive to an existing account. It only seeds a
 * throwaway roadmap (and abandons it afterward) when the account has NO roadmap
 * yet. When a roadmap already exists it verifies the picker read-only and closes
 * every sheet via the backdrop without committing any event.
 *
 * Credentials come from env so they are not committed:
 *   E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD  (falls back to the shared dev account).
 */
const APP_URL = 'http://localhost:5173';
const EMAIL = process.env.E2E_LIVE_EMAIL ?? 'iamrohitsaji@gmail.com';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '123456';

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 15000 });
}

async function userDbName(page: Page): Promise<string> {
  return page.evaluate(async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const dbs = await indexedDB.databases();
      const userDb = dbs.find((db) => db.name?.startsWith('StudyTracker_'));
      if (userDb?.name) return userDb.name;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('No StudyTracker DB found');
  });
}

async function seedRoadmap(page: Page): Promise<void> {
  const dbName = await userDbName(page);
  await page.evaluate(async (dbName) => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const deadline = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const events = [
      { kind: 'OnboardingCompleted', payload: {}, createdAt: now },
      {
        kind: 'MaterialAdded',
        payload: { materialId: 'e2e-mat-1', title: 'E2E Linear Algebra', estimatedDuration: 120, kind: 'manual', role: 'anchor' },
        createdAt: now,
      },
      {
        kind: 'RoadmapCreated',
        payload: {
          startDate: today,
          deadline,
          weeks: 4,
          selectedStudyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          weekdayHours: 2,
          weekendHours: 0,
          weeklyHours: 10,
          materialIds: ['e2e-mat-1'],
        },
        createdAt: now,
      },
      {
        kind: 'SessionBooked',
        payload: { roadmapCreatedAt: now, bookingId: 'e2e-booking', date: today, estimatedDuration: 60, materialId: 'e2e-mat-1' },
        createdAt: now,
      },
    ];
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('events', 'readwrite');
        const store = tx.objectStore('events');
        for (const event of events) store.add(event);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, dbName);
}

test.describe('Live roadmap booking picker (real login)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'app', 'app project only');
  });

  test('real login authenticates and the reworked material picker works', async ({ page }) => {
    await signIn(page);
    await userDbName(page); // ensure the per-user DB exists before we inspect state

    await page.goto(`${APP_URL}/study/roadmap`);

    // If a real roadmap already exists we verify read-only and never mutate it.
    // Otherwise (onboarding redirect or empty state) the account has no active
    // roadmap, so it is safe to seed a throwaway one and abandon it afterward.
    let didSeed = false;
    let eta = page.getByLabel('Projected finish');
    if (!(await eta.isVisible().catch(() => false))) {
      await seedRoadmap(page);
      await page.goto(`${APP_URL}/study/roadmap`);
      eta = page.getByLabel('Projected finish');
      didSeed = true;
    }

    await expect(eta).toContainText('provisional');

    // Open a future booking editor if one exists; otherwise use "+ add session".
    const bookedBubble = page.getByRole('button', { name: /^Booked:/ }).first();
    if (await bookedBubble.isVisible().catch(() => false)) {
      await bookedBubble.click();
      const editDialog = page.getByRole('dialog', { name: 'Edit booking' });
      await expect(editDialog).toBeVisible();
      await editDialog.getByRole('button', { name: 'Change material' }).click();
    } else {
      await page.getByRole('button', { name: '+ add session' }).first().click();
      const addDialog = page.getByRole('dialog', { name: 'Add session' });
      await expect(addDialog).toBeVisible();
      await addDialog.getByRole('button', { name: /Attach/ }).click();
    }

    // The reworked radio-list picker (D21) is present with the detach row.
    const picker = page.getByRole('dialog', { name: 'Choose material' });
    await expect(picker).toBeVisible();
    await expect(picker.getByText('No material · pick at start')).toBeVisible();

    if (didSeed) {
      // Full detach flow on the throwaway roadmap, then clean up by abandoning it.
      await picker.getByRole('button', { name: /No material · pick at start/ }).click();
      await picker.getByRole('button', { name: 'Use this material' }).click();
      const editDialog = page.getByRole('dialog', { name: 'Edit booking' });
      await expect(editDialog.getByText('No material — pick at start')).toBeVisible();
      await editDialog.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('button', { name: /Booked: Session .*pick at start/ }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Abandon roadmap' }).click();
    } else {
      // Read-only on a real account: close without committing anything.
      await picker.getByRole('button', { name: 'Cancel' }).click();
    }
  });
});
