import { expect, type Page } from '@playwright/test';
import { test, grepIntelligenceLog } from './fixtures';

/**
 * Live LLM feedback-copy check (issue #68, builds on the #50 contract).
 *
 * Against the real stack with the shared dev account: seeds a throwaway
 * roadmap over the frozen ACCA material (which carries durable grades, so
 * the empty local cache adopts the server projection as `updated`), opens
 * the roadmap page, and asserts the section renders the LLM copy shaped
 * exactly as FeedbackCopy with a model-version source. A second scenario
 * forces a provider failure and asserts the static copy renders without
 * blocking. The seeded roadmap is abandoned afterward so the account is
 * left as found; no material, grade, or snapshot row is touched.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source; the
 * credentials-file values are backtick-wrapped, so they are stripped here)
 * plus SUPABASE_SERVICE_ROLE_KEY-free reads only, the managed runtime, and
 * the app at 5173:
 *   FEEDBACK_MODEL=<serving model> ./full-app start full
 * (The contract default needs an OpenRouter age attestation; the run
 * overrides it with a serving model. Restart the runtime after app edits.)
 *
 * Run scoped to the React app project with one worker:
 *   pnpm exec playwright test -c e2e/playwright.config.ts e2e/feedback-copy-live.spec.ts --project=app --workers=1
 * (No `--` separator: options after it are read as test-file filters.)
 */
const APP_URL = 'http://localhost:5173';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://kabpmbhlvfbrhtbxjaua.supabase.co';
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
/** The frozen ACCA corpus material; its durable grades drive the feedback. */
const ACCA_MATERIAL_ID = '80c8b138-b544-4095-8dc0-1c390ac70da2';

const clean = (raw: string | undefined): string => (raw ?? '').replace(/[`"']/g, '').trim();
const EMAIL = clean(process.env.E2E_LIVE_EMAIL);
const PASSWORD = clean(process.env.E2E_LIVE_PASSWORD);

test.skip(!EMAIL || !PASSWORD || !PUBLISHABLE_KEY, 'live feedback creds not set');

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

/** Seed a throwaway roadmap over the ACCA material; returns its createdAt. */
async function seedRoadmap(page: Page, materialTitle: string): Promise<string> {
  const dbName = await userDbName(page);
  return page.evaluate(
    async ({ dbName, materialId, materialTitle }) => {
      const now = new Date();
      const createdAt = now.toISOString();
      const today = createdAt.slice(0, 10);
      const deadline = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const events = [
        {
          kind: 'MaterialAdded',
          payload: {
            materialId,
            title: materialTitle,
            estimatedDuration: 120,
            kind: 'manual',
            role: 'anchor',
          },
          createdAt,
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
            materialIds: [materialId],
          },
          createdAt,
        },
        {
          kind: 'SessionBooked',
          payload: {
            roadmapCreatedAt: createdAt,
            bookingId: `e2e-feedback-${Date.now()}`,
            date: today,
            estimatedDuration: 60,
            materialId,
          },
          createdAt,
        },
      ];
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('events', 'readwrite');
          const store = tx.objectStore('events');
          for (const event of events) store.add(event);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
      return createdAt;
    },
    { dbName, materialId: ACCA_MATERIAL_ID, materialTitle },
  );
}

/** Abandon the throwaway roadmap so the account is left as found. */
async function abandonRoadmap(page: Page, roadmapCreatedAt: string): Promise<void> {
  const dbName = await userDbName(page);
  await page.evaluate(
    async ({ dbName, roadmapCreatedAt }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('events', 'readwrite');
          tx.objectStore('events').add({
            kind: 'RoadmapMarkedAbandoned',
            payload: {
              roadmapCreatedAt,
              resolvedAt: new Date().toISOString(),
              reason: 'e2e feedback-copy cleanup',
            },
            createdAt: new Date().toISOString(),
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    },
    { dbName, roadmapCreatedAt },
  );
}

async function userToken(): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  expect(response.ok, `sign-in failed: ${response.status}`).toBe(true);
  const body = (await response.json()) as { access_token?: string };
  expect(body.access_token).toBeTruthy();
  return body.access_token as string;
}

async function accaTitle(token: string): Promise<string> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/materials?id=eq.${ACCA_MATERIAL_ID}&select=title`,
    { headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } },
  );
  expect(response.ok, `material title failed: ${response.status}`).toBe(true);
  const rows = (await response.json()) as Array<{ title?: string }>;
  expect(rows.length).toBeGreaterThan(0);
  return rows[0].title ?? 'ACCA material';
}

/**
 * Open the roadmap page and stay there. A cold auth state can trip the
 * 500 ms session fallback (ProtectedRoute bounces sign-in -> home); the
 * second attempt runs with a warm session. Seeding happens after this, so
 * the live EventStore picks the roadmap up reactively with no reload.
 */
async function gotoRoadmap(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`${APP_URL}/study/roadmap`);
    // The auth-fallback bounce, when it happens, lands within ~2 s.
    await page.waitForTimeout(3000);
    if (/\/study\/roadmap/.test(page.url())) return;
  }
  expect(page.url()).toMatch(/\/study\/roadmap/);
}

test.describe('Live feedback copy (real login)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'app', 'app project only');
  });

  test.use({ viewport: { width: 1280, height: 800 }, actionTimeout: 30_000 });
  test.setTimeout(300_000);

  test('updated roadmap renders LLM copy with a request-id log join', async ({
    page,
    errors,
  }) => {
    test.setTimeout(300_000);
    const token = await userToken();
    const title = await accaTitle(token);
    await signIn(page);
    // Seed before navigating: raw IndexedDB writes bypass Dexie's
    // liveQuery, so only a fresh EventStore read sees the seeded roadmap
    // (which is then the newest unterminated, hence selected, one).
    const roadmapCreatedAt = await seedRoadmap(page, title);

    // Attach before navigating: the mount fires the copy request, and the
    // section only appears after it resolves. The predicate pins the wait
    // to the seeded roadmap so a stale selection cannot satisfy it.
    const responsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes('/v1/feedback/copy') &&
          response.request().method() === 'POST' &&
          (() => {
            try {
              const data = response.request().postDataJSON() as {
                materialIds?: unknown;
              };
              return (
                Array.isArray(data.materialIds) &&
                data.materialIds.length === 1 &&
                data.materialIds[0] === ACCA_MATERIAL_ID
              );
            } catch {
              return false;
            }
          })(),
        { timeout: 120_000 },
      )
      .catch(() => null);
    await gotoRoadmap(page);

    try {
      const section = page.getByTestId('roadmap-feedback');
      await expect(section).toBeVisible({ timeout: 60_000 });

      const copyResponse = await responsePromise;
      if (!copyResponse) throw new Error('seeded-roadmap copy request never fired');
      expect(copyResponse.status()).toBe(200);
      const copyBody = (await copyResponse.json()) as Record<string, unknown>;
      expect(Object.keys(copyBody).sort()).toEqual(
        ['advisory', 'advisoryNote', 'knowBody', 'knowTitle', 'source', 'summary', 'watchBody', 'watchTitle'],
      );
      for (const field of Object.keys(copyBody)) {
        expect(typeof copyBody[field], field).toBe('string');
        expect((copyBody[field] as string).length, field).toBeGreaterThan(0);
      }
      const requestId = copyResponse.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      // The rendered story repeats the served copy verbatim.
      await expect(section.getByText(copyBody['summary'] as string)).toBeVisible({
        timeout: 30_000,
      });
      await expect(section.getByText('Feedback refreshed')).toBeVisible();

      // AC4: no raw mastery decimals or percentages lead in the story card.
      const story = section.locator('.rfb-story-card');
      await expect(story).not.toContainText(/\d+\.\d+/);
      await expect(story).not.toContainText('%');

      // Desktop-only: the know/watch columns sit side by side.
      const knowBox = await section.getByText('What we know').boundingBox();
      const watchBox = await section.getByText('What we are watching').boundingBox();
      expect(knowBox && watchBox && Math.abs(knowBox.y - watchBox.y) < 200).toBe(true);

      // AC5: the request id joins the backend log.
      const lines = await grepIntelligenceLog(requestId);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.some((line) => line.includes('feedback copy generated'))).toBe(true);

      await section.screenshot({
        path: '.work/active/issue-68-llm-feedback-copy-provider/plan/evidence/desktop-1280.png',
      });
    } finally {
      await abandonRoadmap(page, roadmapCreatedAt);
    }

    expect(errors()).toEqual([]);
  });

  test('a forced provider failure renders the static copy without blocking', async ({
    page,
    errors,
  }) => {
    test.setTimeout(300_000);
    const token = await userToken();
    const title = await accaTitle(token);
    await signIn(page);
    // Route first, then seed, then navigate: the mount fires the copy
    // request, which the fresh EventStore read triggers for the seeded
    // roadmap. Selection does not matter here - any updated roadmap
    // exercises the static fallback path.
    let copyCalls = 0;
    await page.route('**/v1/feedback/copy', async (route) => {
      copyCalls += 1;
      await route.fulfill({ status: 500, body: '{"code":"provider_unavailable"}' });
    });
    const roadmapCreatedAt = await seedRoadmap(page, title);
    await gotoRoadmap(page);

    try {
      const section = page.getByTestId('roadmap-feedback');
      await expect(section).toBeVisible({ timeout: 60_000 });
      await expect(section.getByText('Feedback refreshed')).toBeVisible({ timeout: 30_000 });
      expect(copyCalls).toBeGreaterThan(0);
    } finally {
      await abandonRoadmap(page, roadmapCreatedAt);
    }

    // The forced 500s surface as Chromium resource logs; nothing else may.
    const noise = errors();
    expect(noise.length).toBeGreaterThan(0);
    for (const line of noise) {
      expect(line).toMatch(/Failed to load resource: .* 500/);
    }
  });

  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 }, actionTimeout: 30_000 });

    test('feedback section stacks and stays clean at phone width', async ({
      page,
      errors,
    }) => {
      test.setTimeout(300_000);
      const token = await userToken();
      const title = await accaTitle(token);
      await signIn(page);
      const roadmapCreatedAt = await seedRoadmap(page, title);
      // Observe the one copy call the mount fires: waiting for its words
      // keeps the screenshot truthful (no pre-LLM paint).
      const responsePromise = page
        .waitForResponse(
          (response) =>
            response.url().includes('/v1/feedback/copy') &&
            response.request().method() === 'POST',
          { timeout: 120_000 },
        )
        .catch(() => null);
      await gotoRoadmap(page);

      try {
        const section = page.getByTestId('roadmap-feedback');
        await expect(section).toBeVisible({ timeout: 60_000 });
        await expect(section.getByText('Feedback refreshed')).toBeVisible({
          timeout: 120_000,
        });
        const copyResponse = await responsePromise;
        if (!copyResponse) throw new Error('copy request never fired');
        expect(copyResponse.status()).toBe(200);
        const copyBody = (await copyResponse.json()) as Record<string, unknown>;
        await expect(section.getByText(copyBody['summary'] as string)).toBeVisible({
          timeout: 30_000,
        });

        // Phone-only: the know/watch columns stack vertically.
        const knowBox = await section.getByText('What we know').boundingBox();
        const watchBox = await section.getByText('What we are watching').boundingBox();
        expect(knowBox && watchBox && watchBox.y >= knowBox.y + knowBox.height - 1).toBe(true);

        await section.screenshot({
          path: '.work/active/issue-68-llm-feedback-copy-provider/plan/evidence/mobile-375.png',
        });
      } finally {
        await abandonRoadmap(page, roadmapCreatedAt);
      }

      expect(errors()).toEqual([]);
    });
  });
});
