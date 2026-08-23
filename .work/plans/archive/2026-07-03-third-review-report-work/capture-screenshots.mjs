// One-off script to capture dissertation screenshots. Not part of the test suite.
// Run: node ".work/plans/active/2026-07-03 third-review-report-work/capture-screenshots.mjs"
import { chromium } from '@playwright/test';
import path from 'node:path';

const APP_URL = 'http://localhost:5173';
const EMAIL = 'iamrohitsaji@gmail.com';
const PASSWORD = '123456';
const OUT_DIR = path.resolve(
  'college/mydeliverables/3rd-Review/report/screenshots',
);

// The real "Tests" roadmap's only material (read from the account's own event
// log). Used to complete its one real planned session realistically.
const TESTS_MATERIAL_ID = 'fd48dba2-c619-4046-9f92-a01c345866e8';
const TESTS_MATERIAL_TITLE =
  "How She Became SDE-3 at a Payments Company 🚀 | Interview Process, Resources & Senior Tips";

async function signIn(page) {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 15000 });
  await page.locator('.boot-screen').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function userDbName(page) {
  return page.evaluate(async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const dbs = await indexedDB.databases();
      const userDb = dbs.find((db) => db.name?.startsWith('StudyTracker_'));
      if (userDb?.name) return userDb.name;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('No StudyTracker DB found');
  });
}

// Injects local-only display data (never pushed to sync_queue / Supabase —
// same raw-IndexedDB technique as e2e/roadmap-booking-live.spec.ts's
// seedRoadmap helper) so this-week views aren't blank. Lives only in this
// ephemeral Playwright browser context; the real "Tests" roadmap in Supabase
// is never touched.
async function injectLocalDisplayData(page, dbName) {
  await page.evaluate(
    async ({ dbName, materialId, materialTitle }) => {
      function uuid() {
        return crypto.randomUUID();
      }
      const now = new Date();
      const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek);
      const wednesday = new Date(monday);
      wednesday.setDate(monday.getDate() + 2);
      const iso = (d) => d.toISOString();
      const dateStr = (d) => d.toISOString().slice(0, 10);

      const events = [
        // Completes the roadmap's own real planned Tuesday session.
        {
          kind: 'SessionLogged',
          payload: {
            sessionId: uuid(),
            materialId,
            sessionTitle: `${materialTitle} · session 1 of 1`,
            slotDate: '2026-06-28',
            weekIndex: 0,
            plannedMinutes: 17,
            startedAt: '2026-06-28T10:00:00.000Z',
            endedAt: '2026-06-28T10:17:00.000Z',
            activeMinutes: 17,
            pauseCount: 0,
            totalPauseMinutes: 0,
            pomodorosCompleted: 0,
            source: 'active',
            resolution: 'completed',
            duration: 17,
            description: `${materialTitle} · session 1 of 1`,
            date: '2026-06-28',
          },
          createdAt: '2026-06-28T10:17:00.000Z',
        },
        // Manual logged sessions this week (the "Log a session" feature's shape).
        {
          kind: 'SessionLogged',
          payload: {
            source: 'manual',
            sessionId: uuid(),
            duration: 45,
            date: dateStr(monday),
            description: 'Mock interview practice',
            timeOfDay: 'evening',
          },
          createdAt: iso(new Date(monday.getTime() + 20 * 60 * 60 * 1000)),
        },
        {
          kind: 'SessionLogged',
          payload: {
            source: 'manual',
            sessionId: uuid(),
            duration: 35,
            date: dateStr(wednesday),
            description: 'System design notes review',
            timeOfDay: 'morning',
          },
          createdAt: iso(new Date(wednesday.getTime() + 10 * 60 * 60 * 1000)),
        },
      ];

      await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('events', 'readwrite');
          const store = tx.objectStore('events');
          for (const event of events) store.add(event);
          tx.oncomplete = () => {
            db.close();
            resolve(undefined);
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    },
    { dbName, materialId: TESTS_MATERIAL_ID, materialTitle: TESTS_MATERIAL_TITLE },
  );
}

async function hideOverlays(page) {
  await page.addStyleTag({
    content: `
      #astro-dev-toolbar, astro-dev-toolbar, [data-vite-dev-id] .vite-error-overlay,
      vite-error-overlay { display: none !important; }
    `,
  });
}

async function shot(page, name, opts = {}) {
  await page.waitForTimeout(400);
  if (opts.fullPage) {
    // Resize the viewport to the full content height *before* shooting,
    // rather than using Playwright's fullPage capture (which resizes at
    // capture time and can catch resize-sensitive charts mid-redraw/blank).
    const contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1280, height: contentHeight });
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: path.join(OUT_DIR, name) });
  if (opts.fullPage) {
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  console.log(`captured ${name}`);
}

async function gotoAndSettle(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await hideOverlays(page);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
  });

  await signIn(page);

  const dbName = await userDbName(page);
  await injectLocalDisplayData(page, dbName);

  // ---- app_home.png ----
  await gotoAndSettle(page, `${APP_URL}/study/home`);
  await shot(page, 'app_home.png', { fullPage: true });

  // ---- app_week.png ----
  await gotoAndSettle(page, `${APP_URL}/study/week`);
  await shot(page, 'app_week.png', { fullPage: true });

  // ---- app_roadmap.png ----
  await gotoAndSettle(page, `${APP_URL}/study/roadmap`);
  await shot(page, 'app_roadmap.png', { fullPage: true });

  // ---- app_roadmaps.png ----
  await gotoAndSettle(page, `${APP_URL}/study/roadmaps`);
  await shot(page, 'app_roadmaps.png', { fullPage: true });

  // ---- app_replan.png ----
  await gotoAndSettle(page, `${APP_URL}/study/replan`);
  await shot(page, 'app_replan.png', { fullPage: true });

  // ---- app_session.png (pre-session setup fallback, non-destructive) ----
  await gotoAndSettle(page, `${APP_URL}/study/session`);
  await shot(page, 'app_session.png');

  // ---- app_onboarding_plan.png ----
  // Use "+ Plan your next roadmap" from /study/roadmaps so the active "Tests"
  // roadmap is untouched; this only creates a draft (discarded afterward).
  await gotoAndSettle(page, `${APP_URL}/study/roadmaps`);

  const planNextLink = page.locator('a.rmd-slim-add, a.btn-accent', { hasText: /Plan your next roadmap/i });
  await planNextLink.first().click();
  await page.waitForURL(/\/study\/onboarding\/1/, { timeout: 10000 });
  await page.waitForTimeout(800);

  // Step 1: deadline
  await page.locator('#target-date').fill(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  await page.locator('.onboarding-continue-btn').click();
  await page.waitForURL(/\/study\/onboarding\/2/, { timeout: 10000 });
  await page.waitForTimeout(500);

  // Step 2: hours + study days
  await page.getByRole('button', { name: '6h', exact: true }).click();
  for (const day of ['Mon', 'Wed', 'Fri']) {
    await page
      .locator('.field-group')
      .filter({ hasText: 'Study days' })
      .getByRole('button', { name: day, exact: true })
      .click();
  }
  await page.locator('.onboarding-continue-btn').click();
  await page.waitForURL(/\/study\/onboarding\/3/, { timeout: 10000 });
  await page.waitForTimeout(500);

  // Step 3: add a material
  await page.locator('.onboarding-add-manually-btn').click();
  await page.waitForTimeout(300);
  const row = page.locator('.material-row').last();
  await row.locator('input[type="text"][placeholder="Material title"]').fill('System Design Primer');
  await row.locator('input[type="number"]').fill('600');
  await page.waitForTimeout(300);

  // At the 1280px desktop viewport, Step3Materials renders the live
  // schedule preview side-by-side automatically (onboarding-materials-grid) —
  // "Build my plan" is a mobile-only button that navigates to /preview.
  await page.locator('.onboarding-preview-stats').waitFor({ state: 'visible', timeout: 10000 });
  // Expand the collapsed calendar panel so booked sessions are visible.
  await page.locator('.finish-toggle').click();
  await page.locator('.onboarding-calendar-panel').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(1000);
  await hideOverlays(page);
  await page.locator('.onboarding-materials-preview-slot').screenshot({
    path: path.join(OUT_DIR, 'app_onboarding_plan.png'),
  });
  console.log('captured app_onboarding_plan.png');

  // Clean up: discard the draft so /study/roadmaps returns to its prior state.
  await gotoAndSettle(page, `${APP_URL}/study/roadmaps`);
  const discardBtn = page.getByRole('button', { name: 'Discard' });
  if (await discardBtn.isVisible().catch(() => false)) {
    await discardBtn.click();
    await page.waitForTimeout(500);
  }

  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
