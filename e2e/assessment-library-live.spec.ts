import type { Page } from '@playwright/test';
import { expect, grepIntelligenceLog, test } from './fixtures';

/**
 * Live assessment-library + practice-hub check (issue #81, Phase 6) against
 * the real stack.
 *
 * Desktop (1280x720) proves the whole loop the ticket was filed for: generate
 * an objective question on the frozen ACCA material, grade it, leave the page,
 * and find it again in `/assessments` with its family, Ready tag and score;
 * click back into the shipped taking/review treatment; see the same
 * assessment in the material-detail backlink; then start a one-problem
 * written practice run, grade it, see it in `/practice` Resume, resume it,
 * finish it, and see it move to History with a working Open summary.
 * A desktop-only grid-geometry assertion (two cards share a row) fails the
 * run if a mobile viewport leaks in (rule 16).
 *
 * Phone (375x812) generates and grades its own assessment, asserts the
 * one-column layout with no overflow and a reachable sub-nav on both hubs,
 * and resumes a one-problem run left in progress at its resume point.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (backtick-wrapped in the
 * credentials file, stripped defensively) plus the whole generation path:
 *   ./full-app start full
 *   docker compose -f services/embedder/docker-compose.yml up -d
 * Generation retrieves through the GPU sidecar on :8200; grading runs in the
 * managed worker. Restart the runtime before re-running after app edits
 * (WSL staleness, rule 53).
 *
 * The suite mutates the shared dev account by design and puts it back: every
 * assessment created on the frozen material inside the test's own window is
 * deleted through PostgREST with the service-role key, and the cascade
 * removes its questions and attempts. The window, not the response log, is
 * the cleanup source of truth. The frozen ACCA material itself is never
 * deleted. Practice run pointers are local-only appends, so no server event
 * rows are created.
 *
 * Run scoped to the React app project with one worker:
 *   pnpm exec playwright test -c e2e/playwright.config.ts e2e/assessment-library-live.spec.ts --project=app --workers=1
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
/** A real provider call measured 146 s once (#41); the worker can be slow. */
const GENERATION_WAIT_MS = 300_000;
const GRADE_WAIT_MS = 180_000;
const EVIDENCE_DIR = '.work/active/assessment-library-practice-hub/plan/evidence';
const WRITTEN_ANSWER_TEXT =
  'The measure is applied to the firm in the case: performance is judged on both financial and ' +
  'non-financial measures, and the variance analysis identifies which critical success factor ' +
  'the shortfall actually comes from.';
/** Authored rubric/reference vocabulary must never reach the browser. */
const REDACTION_RE =
  /answerBlock|answer_block|referenceAnswer|reference_answer|rubricVersion|rubric_version|maxPoints|max_points|correctIndex|referenceSolution|hiddenTest|answer key/i;

/** Buffer every /rest/v1 and /v1 body so the redaction sweep covers responses. */
function watchResponses(page: Page): () => string[] {
  const bodies: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (!/\/rest\/v1\/|\/v1\/assessments|\/v1\/attempts/.test(url)) return;
    void response.text().then((body) => {
      if (body.length < 1_000_000) bodies.push(body);
    });
  });
  return () => bodies;
}

/** The redaction gate over responses and the rendered DOM. */
async function assertRedaction(page: Page, bodies: () => string[]): Promise<void> {
  expect(bodies().join('\n'), 'no response body may carry hidden content').not.toMatch(REDACTION_RE);
  expect(await page.locator('body').innerText(), 'no rendered DOM may carry hidden content').not.toMatch(
    REDACTION_RE,
  );
}

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
 * Delete every assessment the test created on the frozen material - filtered
 * by `created_at` window, not by captured responses, so a row the server
 * inserted before a transient failure is still caught - and verify the rows
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

/**
 * Generate one objective question from the frozen material through the config
 * page and return the assessment id from the URL. The Objective chip is the
 * default; assert it actually took before submitting (a re-render between
 * click and Generate can revert the selection, observed live 2026-09-11).
 */
async function generateObjectiveAssessment(page: Page): Promise<string> {
  await page.goto(`${APP_URL}/study/materials/${MATERIAL_ID}/assessments/new`);
  await expect(page).toHaveURL(/\/assessments\/new$/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Generate assessment' })).toBeVisible({
    timeout: 30000,
  });
  const objectiveChip = page.getByRole('button', { name: 'Objective', exact: true });
  await objectiveChip.click();
  await expect(objectiveChip).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Generate question' }).click();
  await page.waitForURL(/\/study\/assessments\/[^/]+$/, { timeout: 60000 });
  const taker = page.getByLabel('Answer this question');
  const failed = page.getByRole('button', { name: 'Retry generation' });
  for (let attempt = 0; attempt < 4; attempt++) {
    await expect(taker.or(failed)).toBeVisible({ timeout: GENERATION_WAIT_MS });
    if ((await failed.count()) === 0) break;
    await failed.click();
  }
  await expect(taker).toBeVisible({ timeout: GENERATION_WAIT_MS });
  const assessmentId = page.url().split('/').pop() ?? '';
  expect(assessmentId).not.toBe('');
  return assessmentId;
}

/**
 * Answer the visible objective question and wait for the real grade to land:
 * the navigator tab flips to its terminal display and the summary shows the
 * score. The taker unmounts once the grade lands (the review surface takes
 * over), so the grade is asserted where the UI actually renders it.
 */
async function answerObjectiveAndAwaitGrade(page: Page): Promise<void> {
  const taker = page.getByLabel('Answer this question');
  await expect(taker.getByRole('radio')).toHaveCount(4, { timeout: 30000 });
  await taker.locator('label').first().click();
  await taker.getByRole('button', { name: 'Submit answer' }).click();
  await expect(
    page.getByRole('tab', { name: /Question 1, (correct|partial|incorrect)/ }),
  ).toBeVisible({ timeout: GRADE_WAIT_MS });
  await expect(
    page.getByRole('region', { name: 'Assessment summary' }).getByText(/score \d+\.\d+/),
  ).toBeVisible({ timeout: 60000 });
}

/** Start a one-problem written run and wait until the run route resolves. */
async function startWrittenRun(page: Page): Promise<string> {
  await page.goto(`${APP_URL}/study/materials/${MATERIAL_ID}/practice`);
  await expect(page.getByRole('heading', { name: 'Practice this' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole('button', { name: 'Start practice run' })).toBeVisible();
  await page.getByLabel('Number of questions').fill('1');
  await page.getByRole('button', { name: 'Start practice run' }).click();
  await page.waitForURL(/\/study\/materials\/[^/]+\/practice\/[^/]+$/, { timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'Practice run' })).toBeVisible({
    timeout: 30000,
  });
  return page.url().split('/').pop() ?? '';
}

/** Answer the visible written problem and wait for the navigator grade. */
async function answerWrittenAndAwaitGrade(page: Page): Promise<void> {
  const taker = page.getByLabel('Answer this question');
  await expect(taker).toBeVisible({ timeout: GENERATION_WAIT_MS });
  const submit = taker.getByRole('button', { name: 'Submit answer' });
  await expect(submit).toBeDisabled();
  await taker.getByLabel('Your answer').fill(WRITTEN_ANSWER_TEXT);
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(
    page.getByRole('tab', { name: /Question 1, (correct|partial|incorrect)/ }),
  ).toBeVisible({ timeout: GRADE_WAIT_MS });
}

async function assertNoOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * Desktop 1280: the whole loop - generate, grade, find it in the hub, open
 * the shipped detail, see the material backlink, run practice to History.
 * Returns one generation X-Request-ID for the log join.
 */
async function desktopScenario(page: Page): Promise<string> {
  const generationIds: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/v1/assessments/generate')) {
      const id = request.headers()['x-request-id'];
      if (id) generationIds.push(id);
    }
  });
  const bodies = watchResponses(page);

  await signIn(page);

  // 1-2. Generate an objective question on the frozen material and grade it.
  const assessmentId = await generateObjectiveAssessment(page);
  await expect(page.getByRole('heading', { name: 'Objective assessment' })).toBeVisible({
    timeout: 60000,
  });
  await answerObjectiveAndAwaitGrade(page);

  // 3. Leave to /materials; the sub-nav counts are visible.
  await page.goto(`${APP_URL}/study/materials`);
  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible({
    timeout: 30000,
  });
  const subnav = page.getByRole('navigation', { name: 'Library sections' });
  await expect(subnav).toBeVisible({ timeout: 30000 });
  await expect(subnav.getByRole('link', { name: /Assessments \d+/ })).toBeVisible();
  await expect(subnav.getByRole('link', { name: /Practice \d+/ })).toBeVisible();

  // 4. The hub lists the created assessment with family, Ready and score;
  // clicking its title opens the shipped taking/review treatment. Newest rows
  // render first, so the first card carries the fresh assessment; its href
  // proves the identity before anything is clicked.
  await page.goto(`${APP_URL}/study/assessments`);
  await expect(page.getByRole('heading', { name: 'Assessments' })).toBeVisible({
    timeout: 30000,
  });
  const card = page.locator('.materials-grid article').first();
  await expect(card).toBeVisible({ timeout: 60000 });
  const cardLink = card.locator(`a[href$="/assessments/${assessmentId}"]`);
  await expect(cardLink).toBeVisible({ timeout: 60000 });
  await expect(card.getByText('Objective')).toBeVisible();
  await expect(card.getByText('Ready')).toBeVisible();
  await expect(card.getByText(/\d+\.\d{2}/)).toBeVisible();
  await cardLink.click();
  await page.waitForURL(new RegExp(`/study/assessments/${assessmentId}$`), { timeout: 30000 });
  // The assessment was already graded above, so the shipped treatment is the
  // review surface: family heading, navigator tab in its terminal state, and
  // the summary with the score. This round-trip is the ticket's complaint,
  // proven fixed.
  await expect(page.getByRole('heading', { name: 'Objective assessment' })).toBeVisible({
    timeout: 60000,
  });
  await expect(
    page.getByRole('tab', { name: /Question 1, (correct|partial|incorrect)/ }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByRole('region', { name: 'Assessment summary' }).getByText(/score \d+\.\d+/),
  ).toBeVisible({ timeout: 60000 });
  await assertRedaction(page, bodies);

  // Desktop-only: the card grid renders two cards per row, so a leaked
  // mobile viewport fails here instead of passing quietly.
  await page.goto(`${APP_URL}/study/assessments`);
  await expect(page.getByRole('heading', { name: 'Assessments' })).toBeVisible({
    timeout: 30000,
  });
  const grid = page.locator('.materials-grid').first();
  await expect(grid).toBeVisible({ timeout: 30000 });
  const columns = await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns);
  expect(columns.split(' ').filter(Boolean).length).toBeGreaterThanOrEqual(2);

  // 5. The material detail backlink lists the assessment; the placeholder is gone.
  // The section shell renders immediately; its rows arrive with hydration
  // (one list call plus N reads), so the populated list gets a generous
  // budget while a stuck loader fails loudly on the line after.
  await page.goto(`${APP_URL}/study/materials/${MATERIAL_ID}`);
  await expect(
    page.getByRole('heading', { name: 'Assessments and practice runs' }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(`.library-backlink-list a[href$="/assessments/${assessmentId}"]`)).toBeVisible({
    timeout: 180000,
  });
  await expect(page.getByText('Assessments will appear here once created.')).toHaveCount(0);

  // 6. One-problem written run: grade it, see it in Resume, resume it,
  // finish it, see it move to History with a working Open summary.
  const runId = await startWrittenRun(page);
  await expect(page.getByLabel('Answer this question')).toBeVisible({
    timeout: GENERATION_WAIT_MS,
  });
  await answerWrittenAndAwaitGrade(page);

  await page.goto(`${APP_URL}/study/practice`);
  await expect(page.getByRole('heading', { name: 'Practice' })).toBeVisible({ timeout: 30000 });
  const resumeSection = page.getByRole('region', { name: 'Resume' });
  await expect(resumeSection).toBeVisible({ timeout: 60000 });
  const resumeCard = resumeSection.locator(
    `article:has(a[href$="/materials/${MATERIAL_ID}/practice/${runId}"])`,
  );
  await expect(resumeCard).toBeVisible({ timeout: 90000 });
  await resumeCard.getByRole('link', { name: 'Resume' }).click();
  await page.waitForURL(new RegExp(`/study/materials/.*/practice/${runId}$`), {
    timeout: 30000,
  });
  await expect(page.getByRole('heading', { name: 'Practice run' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole('region', { name: 'Problem 1' })).toBeVisible({ timeout: 60000 });

  const finish = page.getByRole('button', { name: 'Finish run' });
  await expect(finish).toBeEnabled({ timeout: 60000 });
  await finish.click();
  await expect(page.getByRole('region', { name: 'Run summary' })).toBeVisible({ timeout: 60000 });

  await page.goto(`${APP_URL}/study/practice`);
  await expect(page.getByRole('heading', { name: 'Practice' })).toBeVisible({ timeout: 30000 });
  const historySection = page.getByRole('region', { name: 'History' });
  await expect(historySection).toBeVisible({ timeout: 60000 });
  const historyCard = historySection.locator(
    `article:has(a[href$="/materials/${MATERIAL_ID}/practice/${runId}"])`,
  );
  await expect(historyCard).toBeVisible({ timeout: 90000 });
  await historyCard.getByRole('link', { name: 'Open summary' }).click();
  await expect(page.getByRole('region', { name: 'Run summary' })).toBeVisible({ timeout: 60000 });

  await assertRedaction(page, bodies);
  await assertNoOverflow(page);
  await page.screenshot({ path: `${EVIDENCE_DIR}/assessment-library-desktop.png`, fullPage: true });

  const firstGenerationId = generationIds[0] ?? '';
  expect(firstGenerationId, 'the browser minted an X-Request-ID for generation').toBeTruthy();
  return firstGenerationId;
}

/** Phone 375: own assessment, one-column hubs, and a resumed run. Returns one generation X-Request-ID for the log join. */
async function phoneScenario(page: Page): Promise<string> {
  const generationIds: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/v1/assessments/generate')) {
      const id = request.headers()['x-request-id'];
      if (id) generationIds.push(id);
    }
  });
  const bodies = watchResponses(page);

  await signIn(page);

  const assessmentId = await generateObjectiveAssessment(page);
  await answerObjectiveAndAwaitGrade(page);

  for (const path of ['/study/assessments', '/study/practice']) {
    await page.goto(`${APP_URL}${path}`);
    await expect(page.getByRole('navigation', { name: 'Library sections' })).toBeVisible({
      timeout: 30000,
    });
    const grid = page.locator('.materials-grid').first();
    await expect(grid).toBeVisible({ timeout: 90000 });
    const columns = await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns);
    expect(columns.split(' ').filter(Boolean).length).toBe(1);
    await assertNoOverflow(page);
  }

  await page.goto(`${APP_URL}/study/assessments`);
  const phoneCard = page.locator('.materials-grid article').first();
  await expect(
    phoneCard.locator(`a[href$="/assessments/${assessmentId}"]`),
  ).toBeVisible({ timeout: 60000 });

  // Leave a one-problem run in progress, then resume it from the hub.
  const runId = await startWrittenRun(page);
  await expect(page.getByLabel('Answer this question')).toBeVisible({
    timeout: GENERATION_WAIT_MS,
  });
  await page.goto(`${APP_URL}/study/practice`);
  const resumeSection = page.getByRole('region', { name: 'Resume' });
  await expect(resumeSection).toBeVisible({ timeout: 60000 });
  const phoneResumeCard = resumeSection.locator(
    `article:has(a[href$="/materials/${MATERIAL_ID}/practice/${runId}"])`,
  );
  await expect(phoneResumeCard).toBeVisible({ timeout: 90000 });
  await phoneResumeCard.getByRole('link', { name: 'Resume' }).click();
  await page.waitForURL(new RegExp(`/study/materials/.*/practice/${runId}$`), {
    timeout: 30000,
  });
  await expect(page.getByRole('region', { name: 'Problem 1' })).toBeVisible({ timeout: 60000 });

  await assertRedaction(page, bodies);
  await assertNoOverflow(page);
  await page.screenshot({ path: `${EVIDENCE_DIR}/assessment-library-mobile.png`, fullPage: true });

  const firstGenerationId = generationIds[0] ?? '';
  expect(firstGenerationId, 'the browser minted an X-Request-ID for generation').toBeTruthy();
  return firstGenerationId;
}

test.describe('assessment library live (desktop 1280)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 30000 });
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('generate, grade, hub round-trip, backlink, practice to History', async ({ page, errors }) => {
    test.setTimeout(900_000);
    const testStartedAt = new Date().toISOString();
    let failure: unknown;
    let requestId = '';
    try {
      requestId = await desktopScenario(page);
      expect(errors()).toEqual([]);
    } catch (error) {
      failure = error;
    }
    try {
      if (requestId) {
        // Rule 17: the browser's request id joins to the backend log lines.
        const lines = await grepIntelligenceLog(requestId);
        console.log(`[assessment-library-live] request ${requestId} -> ${lines.length} backend line(s)`);
        expect(lines.length, 'the generation request id must appear in the service log').toBeGreaterThan(0);
      }
      await cleanupRunAssessments(testStartedAt);
    } catch (error) {
      console.warn(`[assessment-library-live] cleanup/join failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});

test.describe('assessment library live (phone 375)', () => {
  test.use({ viewport: { width: 375, height: 812 }, actionTimeout: 30000 });
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('generate, grade, one-column hubs, resume in progress', async ({ page, errors }) => {
    test.setTimeout(900_000);
    const testStartedAt = new Date().toISOString();
    let failure: unknown;
    let requestId = '';
    try {
      requestId = await phoneScenario(page);
      expect(errors()).toEqual([]);
    } catch (error) {
      failure = error;
    }
    try {
      if (requestId) {
        // Rule 17: the browser's request id joins to the backend log lines.
        const lines = await grepIntelligenceLog(requestId);
        console.log(`[assessment-library-live] request ${requestId} -> ${lines.length} backend line(s)`);
        expect(lines.length, 'the generation request id must appear in the service log').toBeGreaterThan(0);
      }
      await cleanupRunAssessments(testStartedAt);
    } catch (error) {
      console.warn(`[assessment-library-live] cleanup/join failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});
