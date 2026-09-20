import { expect, type Page } from '@playwright/test';
import { test } from './fixtures';

/**
 * Live written-practice mastery check (issue #44, AC3) and the P5 timing
 * measurement against the real stack.
 *
 * Three self-contained scenarios:
 *   (a) a real graded practice run updates mastery: the sum of observations
 *       over the frozen material's projections strictly grows once the
 *       `llm_rubric` grade lands, and the run summary renders the advisory
 *       next-run band rebuilt from those grades;
 *   (b) an abandoned, ungraded run creates no observation: the window's
 *       assessments carry zero `question_attempts` rows, and the material's
 *       observation count is unchanged (AC3's negative half);
 *   (c) the P5 measurement: a 5-problem run is started and timed (start ->
 *       run screen, start -> first problem answerable) with the 429 count on
 *       the generation calls, then abandoned without grading. This is a
 *       single-sample measurement, recorded in `plan/VERIFICATION.md`; the
 *       gate is not lifted by it.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source; the
 * credentials-file values are backtick-wrapped, so they are stripped here)
 * plus SUPABASE_SERVICE_ROLE_KEY, the managed runtime, the detached worker
 * and the GPU sidecar (generation retrieves through :8200):
 *   ./full-app start full
 *   setsid nohup bash scripts/run-detached-ingestion-worker.sh >/dev/null 2>&1 </dev/null &
 *   docker compose -f services/embedder/docker-compose.yml up -d
 * Restart the runtime before re-running after app edits (WSL staleness, rule 53).
 *
 * The suite mutates the shared dev account by design and puts it back:
 * every assessment created on the frozen ACCA material inside the test's own
 * window is deleted through PostgREST with the service-role key, and the
 * cascade removes its questions and attempts. The frozen material itself is
 * never deleted.
 *
 * Run scoped to the React app project with one worker:
 *   pnpm exec playwright test -c e2e/playwright.config.ts e2e/practice-mastery-live.spec.ts --project=app --workers=1
 */
const APP_URL = 'http://localhost:5173';
const INTELLIGENCE_URL = process.env.VITE_INTELLIGENCE_URL ?? 'http://127.0.0.1:8000';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://kabpmbhlvfbrhtbxjaua.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
/** Frozen ACCA APM corpus, the same grounded material the other live specs use. */
const MATERIAL_ID = '80c8b138-b544-4095-8dc0-1c390ac70da2';
const EVIDENCE_DIR = '.work/active/issue-44-written-practice-runs/plan/evidence';
const GENERATION_WAIT_MS = 300_000;
const GRADE_WAIT_MS = 180_000;
const ANSWER_TEXT =
  'The measure is applied to the firm in the case: performance is judged on both financial and ' +
  'non-financial measures, and the variance analysis identifies which critical success factor ' +
  'the shortfall actually comes from.';

const clean = (raw: string | undefined): string => (raw ?? '').replace(/[`"']/g, '').trim();
const EMAIL = clean(process.env.E2E_LIVE_EMAIL);
const PASSWORD = clean(process.env.E2E_LIVE_PASSWORD);

test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

function serviceHeaders(): Record<string, string> {
  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
}

async function userToken(): Promise<string> {
  if (!PUBLISHABLE_KEY) throw new Error('SUPABASE_PUBLISHABLE_KEY not set');
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

interface Projection {
  materialId: string;
  skillTag: string;
  mastery: number;
  n: number;
  modelVersion: string;
}

async function projectionsForMaterial(token: string): Promise<Projection[]> {
  const response = await fetch(`${INTELLIGENCE_URL}/v1/mastery?materialId=${MATERIAL_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok, `mastery failed: ${response.status}`).toBe(true);
  return (await response.json()) as Projection[];
}

const observationSum = (projections: Projection[]): number =>
  projections.reduce((sum, projection) => sum + projection.n, 0);

/** Every assessment this window created on the frozen material. */
async function windowAssessmentIds(sinceIso: string): Promise<string[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/assessments?select=id&material_id=eq.${MATERIAL_ID}&created_at=gte.${sinceIso}&order=created_at.desc`,
    { headers: serviceHeaders() },
  );
  expect(response.ok, `window read failed: ${response.status}`).toBe(true);
  return (await response.json()) as string[];
}

async function attemptsForAssessments(ids: string[]): Promise<unknown[]> {
  if (ids.length === 0) return [];
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/question_attempts?select=id&assessment_id=in.(${ids.join(',')})`,
    { headers: serviceHeaders() },
  );
  expect(response.ok, `attempt read failed: ${response.status}`).toBe(true);
  return (await response.json()) as unknown[];
}

/** Delete the window's assessments; the cascade removes questions/attempts. */
async function cleanupWindow(sinceIso: string): Promise<void> {
  const ids = await windowAssessmentIds(sinceIso);
  if (ids.length === 0) return;
  const deleted = await fetch(
    `${SUPABASE_URL}/rest/v1/assessments?material_id=eq.${MATERIAL_ID}&created_at=gte.${sinceIso}`,
    { method: 'DELETE', headers: { ...serviceHeaders(), Prefer: 'return=minimal' } },
  );
  expect(deleted.ok, `cleanup failed: HTTP ${deleted.status}`).toBe(true);
  expect(await windowAssessmentIds(sinceIso), 'the window must be clean').toEqual([]);
}

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 90000 });
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({
    timeout: 30000,
  });
}

/** Click Start and return the wall-clock instant; waits for the run route. */
async function startRun(page: Page, problems: number): Promise<number> {
  const startedAt = Date.now();
  await page.goto(`${APP_URL}/study/materials/${MATERIAL_ID}/practice`);
  await expect(page.getByRole('button', { name: 'Start practice run' })).toBeVisible({
    timeout: 30000,
  });
  await page.getByLabel('Number of questions').fill(String(problems));
  await page.getByRole('button', { name: 'Start practice run' }).click();
  await page.waitForURL(/\/study\/materials\/[^/]+\/practice\/[^/]+$/, { timeout: 60000 });
  return startedAt;
}

async function expectTaker(page: Page, problemNumber: number): Promise<void> {
  await expect(page.getByRole('region', { name: `Problem ${problemNumber}` })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByLabel('Answer this question')).toBeVisible({
    timeout: GENERATION_WAIT_MS,
  });
}

/**
 * The shared graded-run scenario: snapshot the material's observation count,
 * run one problem through the real grade, finish, and assert the summary
 * advisory plus the grown server-side projection. `label` names the evidence.
 */
async function gradedRunScenario(page: Page, label: string): Promise<void> {
  const token = await userToken();
  const before = observationSum(await projectionsForMaterial(token));

  await signIn(page);
  await startRun(page, 1);
  await expect(page.getByRole('heading', { name: 'Practice run' })).toBeVisible({
    timeout: 30000,
  });
  await expectTaker(page, 1);

  const taker = page.getByLabel('Answer this question');
  await taker.getByLabel('Your answer').fill(ANSWER_TEXT);
  await taker.getByRole('button', { name: 'Submit answer' }).click();
  await expect(
    page.getByRole('tab', { name: /Question 1, (correct|partial|incorrect)/ }),
  ).toBeVisible({ timeout: GRADE_WAIT_MS });

  await page.getByRole('button', { name: 'Finish run' }).click();
  const summary = page.getByRole('region', { name: 'Run summary' });
  await expect(summary).toBeVisible({ timeout: 60000 });

  // The advisory is rebuilt from the fresh grade (AC3's positive half).
  const advisory = page.getByRole('region', { name: 'Adaptive difficulty' });
  await expect(advisory).toBeVisible({ timeout: 30000 });
  await expect(advisory).toContainText(/next run band \d/);
  await expect(advisory).toContainText(/graded answer/);
  await expect(advisory).toContainText('bkt-v1');
  await page.screenshot({
    path: `${EVIDENCE_DIR}/practice-mastery-summary-${label}.png`,
    fullPage: true,
  });

  // The server-side projection grew: the grade is a real observation.
  const after = observationSum(await projectionsForMaterial(token));
  console.log(
    `[practice-mastery-live] ${label}: observations for the material ${before} -> ${after}`,
  );
  expect(after).toBeGreaterThan(before);
}

test.describe('practice mastery live', () => {
  test('a graded run updates mastery and the summary shows the next-run band', async ({
    page,
    errors,
  }) => {
    test.setTimeout(900_000);
    const windowStart = new Date().toISOString();
    let failure: unknown;
    try {
      await gradedRunScenario(page, 'desktop');
      const pageErrors = errors().filter((entry) => entry.startsWith('pageerror:'));
      expect(pageErrors).toEqual([]);
    } catch (error) {
      failure = error;
    }
    try {
      await cleanupWindow(windowStart);
    } catch (error) {
      console.warn(`[practice-mastery-live] cleanup failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });

  test.describe('phone 375', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('the advisory renders at phone width without overflow', async ({ page, errors }) => {
      test.setTimeout(900_000);
      const windowStart = new Date().toISOString();
      let failure: unknown;
      try {
        await gradedRunScenario(page, 'mobile');
        // Phone-only: the content column must not overflow the viewport.
        const overflow = await page.evaluate(
          () => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        const pageErrors = errors().filter((entry) => entry.startsWith('pageerror:'));
        expect(pageErrors).toEqual([]);
      } catch (error) {
        failure = error;
      }
      try {
        await cleanupWindow(windowStart);
      } catch (error) {
        console.warn(`[practice-mastery-live] cleanup failed: ${String(error)}`);
        if (failure == null) failure = error;
      }
      if (failure != null) throw failure;
    });
  });

  test('an abandoned, ungraded run creates no observation', async ({ page }) => {
    test.setTimeout(600_000);
    const windowStart = new Date().toISOString();
    let failure: unknown;
    try {
      const token = await userToken();
      const before = observationSum(await projectionsForMaterial(token));

      await signIn(page);
      await startRun(page, 1);
      await expect(page.getByRole('heading', { name: 'Practice run' })).toBeVisible({
        timeout: 30000,
      });
      // The generation happened; the answer is never submitted.
      await expectTaker(page, 1);
      await page.getByRole('button', { name: 'Abandon run' }).click();
      await expect(page.getByText(/Run abandoned/)).toBeVisible({ timeout: 30000 });

      const ids = await windowAssessmentIds(windowStart);
      expect(ids.length, 'the run generated its assessment').toBeGreaterThan(0);
      expect(await attemptsForAssessments(ids), 'no attempt row was created').toEqual([]);
      const after = observationSum(await projectionsForMaterial(token));
      expect(after, 'abandoned work must not move mastery').toBe(before);
    } catch (error) {
      failure = error;
    }
    try {
      await cleanupWindow(windowStart);
    } catch (error) {
      console.warn(`[practice-mastery-live] cleanup failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });

  test('P5 measurement: a 5-problem run start', async ({ page }) => {
    test.setTimeout(900_000);
    const windowStart = new Date().toISOString();
    let failure: unknown;
    try {
      const quotaHits: number[] = [];
      page.on('response', (response) => {
        if (response.url().includes('/v1/assessments/generate') && response.status() === 429) {
          quotaHits.push(response.status());
        }
      });

      await signIn(page);
      const startedAt = await startRun(page, 5);
      await expect(page.getByRole('heading', { name: 'Practice run' })).toBeVisible({
        timeout: 30000,
      });
      const runScreenSeconds = (Date.now() - startedAt) / 1000;

      await expectTaker(page, 1);
      const firstProblemSeconds = (Date.now() - startedAt) / 1000;

      let tabs = 0;
      try {
        await expect(page.getByRole('tab')).toHaveCount(5, { timeout: GENERATION_WAIT_MS });
        tabs = 5;
      } catch {
        tabs = await page.getByRole('tab').count();
      }
      console.log(
        `[practice-mastery-live] P5 5-problem run: start -> run screen ${runScreenSeconds.toFixed(1)}s, ` +
          `start -> first problem answerable ${firstProblemSeconds.toFixed(1)}s, ` +
          `tabs ${tabs}/5, 429 responses ${quotaHits.length}`,
      );
      expect(tabs, 'at least the first problem must exist').toBeGreaterThan(0);

      await page.getByRole('button', { name: 'Abandon run' }).click();
      await expect(page.getByText(/Run abandoned/)).toBeVisible({ timeout: 30000 });
    } catch (error) {
      failure = error;
    }
    try {
      await cleanupWindow(windowStart);
    } catch (error) {
      console.warn(`[practice-mastery-live] cleanup failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});
