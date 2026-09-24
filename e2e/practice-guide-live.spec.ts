import { expect, type Locator, type Page } from '@playwright/test';
import { grepIntelligenceLog, test } from './fixtures';

/**
 * Live Socratic guide check (issue #46) against the real stack.
 *
 * Uses the frozen ACCA corpus (the same grounded material #41/#44 verify
 * against), starts a written practice run, and drives the production coach:
 * the explicit request offer, the real SSE hint stream (OpenRouter + sidecar
 * retrieval), the Nudge -> Hint -> Targeted -> gated-Reveal ladder, the closed
 * reveal gate before any attempt, and the open gate after a graded attempt.
 *
 * The guide's stream is the first in-request provider call in the service, so
 * this spec is the only place the real `/v1/guide/stream` SSE path and the
 * retrieval-grounded citations are exercised end to end. It also joins the
 * browser's `X-Request-ID` to the backend log (rule 17) and sweeps the DOM for
 * hidden grading content.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (backtick-wrapped in the
 * credentials file, stripped defensively), SUPABASE_SERVICE_ROLE_KEY for
 * cleanup, plus the whole generation path:
 *   ./full-app start full
 *   docker compose -f services/embedder/docker-compose.yml up -d
 * The `full` profile owns the intelligence service, the React app and the
 * worker; generation and guide retrieval both need the GPU sidecar on :8200,
 * and the guide stream needs a live OpenRouter key. Stop the sidecar after.
 *
 * Run scoped to the React app project with one worker:
 *   pnpm exec playwright test -c e2e/playwright.config.ts e2e/practice-guide-live.spec.ts --project=app --workers=1
 * Restart the runtime before re-running after app edits (WSL staleness, rule 53).
 */
const APP_URL = 'http://localhost:5173';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://kabpmbhlvfbrhtbxjaua.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
/** The credentials file wraps values in backticks; never send them raw. */
const clean = (raw: string | undefined): string => (raw ?? '').replace(/[`"']/g, '').trim();
const EMAIL = clean(process.env.E2E_LIVE_EMAIL);
const PASSWORD = clean(process.env.E2E_LIVE_PASSWORD);
/** Frozen ACCA APM corpus, the same grounded material #41/#44 verify against. */
const MATERIAL_ID = '80c8b138-b544-4095-8dc0-1c390ac70da2';
const PROBLEMS = 2;
/** A real provider call measured 146 s once (#41); the worker can be slow. */
const GENERATION_WAIT_MS = 300_000;
/** The guide stream is a live provider call; allow the same budget. */
const HINT_WAIT_MS = 120_000;
const GRADE_WAIT_MS = 180_000;
const EVIDENCE_DIR = '.work/active/issue-46-socratic-guide/plan/evidence';
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
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({
    timeout: 30000,
  });
}

/**
 * Delete every assessment the test created on the frozen material — filtered by
 * `created_at` window, not captured responses — and verify the cascade removed
 * its questions and attempts. Fails loudly when the service-role key is missing.
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

/** Click Start on the config page and return the ISO time the run began. */
async function startRun(page: Page): Promise<string> {
  const startedAt = new Date().toISOString();
  await page.goto(`${APP_URL}/study/materials/${MATERIAL_ID}/practice`);
  await expect(page.getByRole('button', { name: 'Start practice run' })).toBeVisible({
    timeout: 30000,
  });
  await page.getByLabel('Number of questions').fill(String(PROBLEMS));
  await page.getByRole('button', { name: 'Start practice run' }).click();
  await page.waitForURL(/\/study\/materials\/[^/]+\/practice\/[^/]+$/, { timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'Practice run' })).toBeVisible({
    timeout: 30000,
  });
  return startedAt;
}

/** Start a run and require both problems to exist (one restart on a partial). */
async function startRunWithProblems(page: Page): Promise<string> {
  for (let roll = 0; roll < 2; roll++) {
    const startedAt = await startRun(page);
    try {
      await expect(page.getByRole('tab')).toHaveCount(PROBLEMS, { timeout: 30000 });
      return startedAt;
    } catch (error) {
      if (roll === 1) throw error;
      console.log('[practice-guide-live] partial generation; restarting the run once');
    }
  }
  throw new Error('unreachable');
}

async function expectProblemTaker(page: Page, problemNumber: number): Promise<void> {
  await expect(page.getByRole('region', { name: `Problem ${problemNumber}` })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByLabel('Answer this question')).toBeVisible({
    timeout: GENERATION_WAIT_MS,
  });
}

const coach = (page: Page): Locator => page.getByRole('region', { name: 'Practice coach' });
const tierChip = (page: Page): Locator => coach(page).locator('.coach-tier');

/** Open the coach from the explicit request trigger and confirm the offer. */
async function askForHelp(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /stuck/i }).click();
  const card = coach(page);
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.getByText('You asked for a hand')).toBeVisible();
  return card;
}

/** Accept the offer and wait for the real SSE hint to finish streaming. */
async function acceptAndAwaitHint(page: Page): Promise<Locator> {
  const card = coach(page);
  await card.getByRole('button', { name: 'Yes, help me' }).click();
  await expect(card.getByRole('button', { name: 'Go deeper' })).toBeEnabled({
    timeout: HINT_WAIT_MS,
  });
  // The streamed prose is real: an error frame would render the error copy and
  // leave the body empty instead.
  await expect(card.locator('.coach-body')).not.toBeEmpty();
  await expect(card.locator('.coach-error')).toHaveCount(0);
  return card;
}

/** One escalation step: click Go deeper and wait for the next tier to stream. */
async function goDeeper(page: Page, label: string): Promise<void> {
  const card = coach(page);
  await card.getByRole('button', { name: 'Go deeper' }).click();
  await expect(tierChip(page)).toHaveText(label, { timeout: HINT_WAIT_MS });
  // The chip flips immediately; the stream is still running until Go deeper is
  // enabled again.
  await expect(card.getByRole('button', { name: 'Go deeper' })).toBeEnabled({
    timeout: HINT_WAIT_MS,
  });
  await expect(card.locator('.coach-body')).not.toBeEmpty();
}

/**
 * The desktop scenario: request offer -> real stream -> ladder to the closed
 * reveal gate, then a graded attempt opens the gate and the worked step
 * streams. Returns the first guide stream's request id for the log join.
 */
async function guideScenario(page: Page): Promise<string> {
  const streamIds: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/v1/guide/stream')) {
      const id = request.headers()['x-request-id'];
      if (id) streamIds.push(id);
    }
  });

  await signIn(page);
  await startRunWithProblems(page);
  await expectProblemTaker(page, 1);

  await askForHelp(page);
  // Offer-never-force: the offer is shown before any provider call.
  expect(streamIds).toHaveLength(0);

  const card = await acceptAndAwaitHint(page);
  await expect(tierChip(page)).toHaveText('Nudge');
  await expect(card.locator('.coach-line')).toHaveCount(0);

  await goDeeper(page, 'Hint');
  await goDeeper(page, 'Targeted');
  await card.getByRole('button', { name: 'Go deeper' }).click();
  await expect(tierChip(page)).toHaveText('Reveal (gated)');
  // No attempt yet: the gate stays closed and offers the honest instruction.
  await expect(card.getByText(/submit an attempt first/i)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Reveal a worked step' })).toHaveCount(0);

  // Redaction gate: the authored rubric and reference never render.
  expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);
  await page.screenshot({ path: `${EVIDENCE_DIR}/guide-desktop.png`, fullPage: true });

  // Answer problem 1 so an owned attempt exists, then retry it to reopen the
  // taker (the run auto-advances on a landed grade).
  await card.getByRole('button', { name: 'Got it' }).click();
  await page.getByLabel('Your answer').fill(ANSWER_TEXT);
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(
    page.getByRole('tab', { name: /Question 1, (correct|partial|incorrect)/ }),
  ).toBeVisible({ timeout: GRADE_WAIT_MS });

  await page.getByRole('tab', { name: /Question 1/ }).click();
  await page.getByRole('button', { name: 'Retry question' }).click();
  await expect(page.getByLabel('Your answer')).toBeVisible({ timeout: 30000 });

  await askForHelp(page);
  await acceptAndAwaitHint(page);
  await goDeeper(page, 'Hint');
  await goDeeper(page, 'Targeted');
  await card.getByRole('button', { name: 'Go deeper' }).click();
  await expect(tierChip(page)).toHaveText('Reveal (gated)');
  const reveal = card.getByRole('button', { name: 'Reveal a worked step' });
  await expect(reveal).toBeVisible();
  await reveal.click();
  await expect(card.getByText(/reference to check against, not to paste/i)).toBeVisible({
    timeout: HINT_WAIT_MS,
  });
  await expect(card.locator('.coach-body')).not.toBeEmpty();

  expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);

  const firstStreamId = streamIds[0] ?? '';
  expect(firstStreamId, 'the browser minted an X-Request-ID for the stream').toBeTruthy();
  return firstStreamId;
}

/** The phone scenario: request offer + stream + closed gate at 375 px. */
async function guidePhoneScenario(page: Page): Promise<void> {
  await signIn(page);
  await startRunWithProblems(page);
  await expectProblemTaker(page, 1);

  await askForHelp(page);
  await acceptAndAwaitHint(page);
  await expect(tierChip(page)).toHaveText('Nudge');

  await goDeeper(page, 'Hint');
  await goDeeper(page, 'Targeted');
  await coach(page).getByRole('button', { name: 'Go deeper' }).click();
  await expect(tierChip(page)).toHaveText('Reveal (gated)');
  await expect(coach(page).getByText(/submit an attempt first/i)).toBeVisible();

  // Phone-only layout: the coach spans the width and nothing overflows.
  const overflow = await page.evaluate(
    () => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await coach(page).boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(300);
  await page.screenshot({ path: `${EVIDENCE_DIR}/guide-phone.png`, fullPage: true });
}

test.describe('practice guide live (desktop 1280)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 30_000 });

  test('request offer, stream, ladder, closed then open reveal gate', async ({ page, errors }) => {
    test.setTimeout(1_200_000);
    const testStartedAt = new Date().toISOString();
    let failure: unknown;
    let requestId = '';
    try {
      requestId = await guideScenario(page);
      // Zero console errors and zero page errors (the plan's clean-console bar).
      expect(errors()).toEqual([]);
    } catch (error) {
      failure = error;
    }
    try {
      if (requestId) {
        // Rule 17: the browser's request id joins to the backend log lines.
        const lines = await grepIntelligenceLog(requestId);
        console.log(`[practice-guide-live] request ${requestId} -> ${lines.length} backend line(s)`);
        expect(lines.length, 'the guide stream request id must appear in the service log')
          .toBeGreaterThan(0);
      }
      await cleanupRunAssessments(testStartedAt);
    } catch (error) {
      console.warn(`[practice-guide-live] cleanup/join failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});

test.describe('practice guide live (phone 375)', () => {
  test.use({ viewport: { width: 375, height: 812 }, actionTimeout: 30_000 });

  test('request offer and stream at phone width', async ({ page, errors }) => {
    test.setTimeout(900_000);
    const testStartedAt = new Date().toISOString();
    let failure: unknown;
    try {
      await guidePhoneScenario(page);
      expect(errors()).toEqual([]);
    } catch (error) {
      failure = error;
    }
    try {
      await cleanupRunAssessments(testStartedAt);
    } catch (error) {
      console.warn(`[practice-guide-live] cleanup failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});
