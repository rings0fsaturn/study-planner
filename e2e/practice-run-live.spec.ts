import { test, expect, type Page } from '@playwright/test';

/**
 * Live written practice run check (issue #44, Phase 4) against the real stack.
 *
 * One scenario per viewport — desktop 1280x720 and phone 375x812 — each of
 * which configures a 2-problem written run on the frozen ACCA corpus, answers
 * and grades both problems through the real `llm_rubric` arm, reloads mid-run
 * to prove resume (pause is leave-and-return, D-11), finishes the run and
 * confirms the summary. `Finish run` is gated on every problem carrying a
 * grade (`PracticeRun.tsx`), so both problems are answered by design, not by
 * preference.
 *
 * The desktop scenario asserts the >=1024 px review rail and the phone
 * scenario asserts the sticky strip plus zero horizontal overflow, so a leaked
 * viewport fails the run instead of passing quietly (rule 16).
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source; the
 * credentials-file values are backtick-wrapped, so they are stripped here
 * defensively) plus the whole generation path:
 *   ./full-app start full
 *   setsid nohup bash scripts/run-detached-ingestion-worker.sh >/dev/null 2>&1 </dev/null &
 *   docker compose -f services/embedder/docker-compose.yml up -d
 * The `full` profile has no worker (generations never leave `generating`), and
 * generation retrieves through the GPU sidecar on :8200 — without it there is
 * no query vector and nothing to ground on.
 *
 * The suite mutates the shared dev account by design (2 generations + 2 graded
 * attempts per scenario) and puts it back: every assessment created on the
 * frozen material inside the test's own window is deleted through PostgREST
 * with the service-role key, and the cascade removes their questions and
 * attempts. The window, not the response log, is the cleanup source of truth:
 * a transient server failure can insert an assessment row without ever
 * returning the 202 whose `resultId` the client would see (observed live
 * 2026-09-15 — a stuck `generating` row). The frozen ACCA material
 * (80c8b138-...) itself is never deleted. Practice run pointers and attempt
 * events are local-only appends (D-02/D-11), so no server event rows are
 * created.
 *
 * Run scoped to the React app project with one worker:
 *   pnpm exec playwright test -c e2e/playwright.config.ts e2e/practice-run-live.spec.ts --project=app --workers=1
 * (No `--` separator: options after it are read as test-file filters, so
 * --project/--workers would be silently dropped.) Restart the runtime before
 * re-running after app edits (WSL staleness, rule 53).
 */
const APP_URL = 'http://localhost:5173';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://kabpmbhlvfbrhtbxjaua.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
/** The credentials file wraps values in backticks; never send them raw. */
const clean = (raw: string | undefined): string => (raw ?? '').replace(/[`"']/g, '').trim();
const EMAIL = clean(process.env.E2E_LIVE_EMAIL);
const PASSWORD = clean(process.env.E2E_LIVE_PASSWORD);
/** Frozen ACCA APM corpus, the same grounded material #41 verifies against. */
const MATERIAL_ID = '80c8b138-b544-4095-8dc0-1c390ac70da2';
const PROBLEMS = 2;
/** A real provider call measured 146 s once (#41); the worker can be slow. */
const GENERATION_WAIT_MS = 300_000;
const GRADE_WAIT_MS = 180_000;
const EVIDENCE_DIR = '.work/active/issue-44-written-practice-runs/plan/evidence';
const ANSWER_TEXT =
  'The measure is applied to the firm in the case: performance is judged on both financial and ' +
  'non-financial measures, and the variance analysis identifies which critical success factor ' +
  'the shortfall actually comes from.';
/** Authored rubric/reference vocabulary must never reach the browser. */
const REDACTION_RE =
  /answerBlock|answer_block|referenceAnswer|reference_answer|rubricVersion|rubric_version|maxPoints|max_points|correctIndex|referenceSolution|hiddenTest|answer key/i;

test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 90000 });
  // Let the authenticated shell settle before navigating again: a goto issued
  // mid-restore gets bounced back by the auth gate.
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({
    timeout: 30000,
  });
}

/**
 * Delete every assessment the test created on the frozen material — filtered
 * by `created_at` window, not by captured responses, so a row the server
 * inserted before a transient failure is still caught — and verify the rows
 * (and their cascaded questions/attempts) are gone. Fails loudly when the
 * service-role key is missing rather than leaving graded attempts behind.
 */
async function cleanupRunAssessments(testStartedAt: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing; cannot verify account cleanup');
  }
  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
  const windowFilter = `material_id=eq.${MATERIAL_ID}&created_at=gte.${testStartedAt}`;
  const before = await fetch(
    `${SUPABASE_URL}/rest/v1/assessments?select=id&${windowFilter}&order=created_at.desc`,
    { headers },
  );
  const created = (await before.json()) as Array<{ id: string }>;
  if (created.length === 0) return;
  const ids = created.map((row) => row.id);
  const deleted = await fetch(`${SUPABASE_URL}/rest/v1/assessments?${windowFilter}`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=minimal' },
  });
  if (!deleted.ok) throw new Error(`assessment cleanup failed: HTTP ${deleted.status}`);
  const remaining = await fetch(
    `${SUPABASE_URL}/rest/v1/assessments?select=id&${windowFilter}`,
    { headers },
  );
  expect(await remaining.json(), 'the run assessments must be gone after cleanup').toEqual([]);
  const attempts = await fetch(
    `${SUPABASE_URL}/rest/v1/question_attempts?select=id&assessment_id=in.(${ids.join(',')})`,
    { headers },
  );
  expect(await attempts.json(), 'attempts cascade with their assessment').toEqual([]);
}

/** Click Start on the config page and return when the run route resolves. */
async function startRun(page: Page): Promise<number> {
  const startedAt = Date.now();
  await page.goto(`${APP_URL}/study/materials/${MATERIAL_ID}/practice`);
  await expect(page.getByRole('heading', { name: 'Practice this' })).toBeVisible({
    timeout: 30000,
  });
  // Only a ready material offers the start control; a non-ready one shows the
  // honest "Material is not ready yet" banner instead.
  await expect(page.getByRole('button', { name: 'Start practice run' })).toBeVisible();
  await page.getByLabel('Number of questions').fill(String(PROBLEMS));
  await page.getByRole('button', { name: 'Start practice run' }).click();
  await page.waitForURL(/\/study\/materials\/[^/]+\/practice\/[^/]+$/, { timeout: 60000 });
  return startedAt;
}

/**
 * Start a run and require all of its problems to exist. A transient generation
 * failure leaves a partial run (the honest "N problems were not generated"
 * path), which cannot exercise resume; restart the run once rather than mask
 * a persistent failure.
 */
async function startRunWithProblems(page: Page): Promise<number> {
  for (let roll = 0; roll < 2; roll++) {
    const startedAt = await startRun(page);
    await expect(page.getByRole('heading', { name: 'Practice run' })).toBeVisible({
      timeout: 30000,
    });
    try {
      await expect(page.getByRole('tab')).toHaveCount(PROBLEMS, { timeout: 30000 });
      return startedAt;
    } catch (error) {
      if (roll === 1) throw error;
      console.log('[practice-live] partial generation; restarting the run once');
    }
  }
  throw new Error('unreachable');
}

/** Wait for a problem's taker and log when it first becomes answerable. */
async function expectProblemTaker(page: Page, problemNumber: number): Promise<void> {
  await expect(page.getByRole('region', { name: `Problem ${problemNumber}` })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByLabel('Answer this question')).toBeVisible({
    timeout: GENERATION_WAIT_MS,
  });
}

/**
 * Answer the visible problem and wait for the real grade to land: the
 * navigator tab flips to its terminal display, which also proves the run
 * model hydrated the grade.
 */
async function answerAndAwaitGrade(page: Page, problemNumber: number, text: string): Promise<void> {
  const taker = page.getByLabel('Answer this question');
  const submit = taker.getByRole('button', { name: 'Submit answer' });
  await expect(submit).toBeDisabled();
  await taker.getByLabel('Your answer').fill(text);
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(
    page.getByRole('tab', {
      name: new RegExp(`Question ${problemNumber}, (correct|partial|incorrect)`),
    }),
  ).toBeVisible({ timeout: GRADE_WAIT_MS });
}

/**
 * The shared scenario: configure, grade both problems, reload mid-run to prove
 * resume, finish, and confirm the summary. `label` names the evidence file.
 */
async function runPracticeScenario(page: Page, label: string): Promise<void> {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await signIn(page);

  const startedAt = await startRunWithProblems(page);
  console.log(
    `[practice-live] ${label}: start -> run screen ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );
  await expect(page.getByText('0 of 2 done')).toBeVisible();

  // Problem 1: answer, real grade, auto-advance to problem 2.
  await expectProblemTaker(page, 1);
  console.log(
    `[practice-live] ${label}: start -> first problem answerable ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );
  await answerAndAwaitGrade(page, 1, ANSWER_TEXT);

  // Resume: a full reload restores the run from its local pointer and lands on
  // the first ungraded problem; problem 1's grade survives.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Practice run' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole('region', { name: 'Problem 2' })).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByRole('tab', { name: /Question 1, (correct|partial|incorrect)/ }),
  ).toBeVisible();

  // Problem 2: answer and grade, then the run can finish.
  await expectProblemTaker(page, 2);
  await answerAndAwaitGrade(page, 2, ANSWER_TEXT);
  await expect(page.getByText('2 of 2 done')).toBeVisible();

  const finish = page.getByRole('button', { name: 'Finish run' });
  await expect(finish).toBeEnabled({ timeout: 60000 });
  await finish.click();

  // The completion view: the run summary over the graded problems.
  const summary = page.getByRole('region', { name: 'Run summary' });
  await expect(summary).toBeVisible({ timeout: 60000 });
  await expect(summary.getByText(/2 of 2 problems graded/)).toBeVisible();
  await expect(page.getByText(/Your answer:/).first()).toBeVisible();

  // Redaction gate: the authored rubric and reference never render.
  expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);
  await page.screenshot({ path: `${EVIDENCE_DIR}/practice-run-${label}.png`, fullPage: true });

  expect(pageErrors).toEqual([]);
}

test.describe('practice run live (desktop 1280)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('configure, grade, reload-resume, finish, summary', async ({ page }) => {
    test.setTimeout(900_000);
    const testStartedAt = new Date().toISOString();
    let failure: unknown;
    try {
      await runPracticeScenario(page, 'desktop');
      // Desktop-only: the review rail is a 280 px column (review.css).
      const shell = page.locator('.ar-variant-b').first();
      const columns = await shell.evaluate((node) => getComputedStyle(node).gridTemplateColumns);
      expect(columns).toContain('280px');
    } catch (error) {
      failure = error;
    }
    try {
      await cleanupRunAssessments(testStartedAt);
    } catch (error) {
      console.warn(`[practice-live] cleanup failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});

test.describe('practice run live (phone 375)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('configure, grade, reload-resume, finish, summary', async ({ page }) => {
    test.setTimeout(900_000);
    const testStartedAt = new Date().toISOString();
    let failure: unknown;
    try {
      await runPracticeScenario(page, 'mobile');
      // Phone-only: the navigator is the sticky horizontal strip (review.css).
      const navigator = page.getByRole('tablist', { name: 'Question navigator' });
      expect(await navigator.evaluate((node) => getComputedStyle(node).position)).toBe('sticky');
      expect(await navigator.evaluate((node) => getComputedStyle(node).flexDirection)).toBe('row');
      const overflow = await page.evaluate(
        () => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    } catch (error) {
      failure = error;
    }
    try {
      await cleanupRunAssessments(testStartedAt);
    } catch (error) {
      console.warn(`[practice-live] cleanup failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});
