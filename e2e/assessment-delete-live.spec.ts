import type { Page } from '@playwright/test';
import { expect, grepIntelligenceLog, test } from './fixtures';

/**
 * Live assessment-delete check (assessment-delete P4) against the real stack.
 *
 * Round trip per viewport: sign in, generate one objective question on the
 * frozen ACCA material, open `/assessments`, click the card's corner X with a
 * real pointer click (the card carries a title link whose stretched `::after`
 * covers the whole card, so only a hit-tested click proves the X's `z-index`
 * keeps it clickable), confirm `Delete assessment` in the dialog, and watch
 * the row leave the hub once the delete worker confirms the job.
 *
 * Desktop (1280x720) additionally asserts the multi-column grid geometry (a
 * leaked mobile viewport fails loudly, rule 16). Phone (375x812) asserts the
 * one-column layout with no overflow and the same delete round trip.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (backtick-wrapped in the
 * credentials file, stripped defensively) plus the managed runtime:
 *   ./full-app start full
 * Restart the runtime before re-running after app edits (WSL staleness,
 * rule 53). The delete path needs intelligence + the deletion worker arm;
 * generation retrieves through the GPU sidecar on :8200.
 *
 * The suite mutates the shared dev account by design and puts it back: the
 * UI delete under test is the assertion, and a service-role window cleanup
 * catches leftovers when the flow fails mid-way. The frozen ACCA material
 * itself is never deleted.
 *
 * Run scoped to the React app project with one worker:
 *   pnpm exec playwright test -c e2e/playwright.config.ts e2e/assessment-delete-live.spec.ts --project=app --workers=1
 */
const APP_URL = 'http://localhost:5173';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://kabpmbhlvfbrhtbxjaua.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
/** The credentials file wraps values in backticks; never send them raw. */
const clean = (raw: string | undefined): string => (raw ?? '').replace(/[`"'']/g, '').trim();
const EMAIL = clean(process.env.E2E_LIVE_EMAIL);
const PASSWORD = clean(process.env.E2E_LIVE_PASSWORD);
/** Frozen ACCA APM corpus, the same grounded material #41 verifies against. */
const MATERIAL_ID = '80c8b138-b544-4095-8dc0-1c390ac70da2';
/** A real provider call measured 146 s once (#41); the worker can be slow. */
const GENERATION_WAIT_MS = 300_000;
/** Enqueue + worker DELETE + 3 s hub poll cadence, with headroom. */
const DELETE_WAIT_MS = 180_000;
const EVIDENCE_DIR = '.work/active/assessment-delete/plan/evidence';

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
 * inserted before a transient failure is still caught. The UI delete is the
 * assertion; this is the fallback that keeps the shared account clean.
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
 * page and return the assessment id from the URL. Grading is skipped: the
 * delete contract covers generating and ready rows alike.
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

async function assertNoOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * The delete round trip: find the fresh card by its title-link href (never
 * `.first()`, which could grab a leftover row), click its corner X with a
 * real pointer event, confirm in the dialog, and wait for the row to leave
 * the hub. Returns the delete call's X-Request-ID for the log join.
 */
async function deleteScenario(page: Page, evidenceName: string): Promise<string> {
  const deleteIds: string[] = [];
  page.on('request', (request) => {
    if (/\/v1\/assessments\/[^/]+\/delete/.test(request.url())) {
      const id = request.headers()['x-request-id'];
      if (id) deleteIds.push(id);
    }
  });

  await signIn(page);
  const assessmentId = await generateObjectiveAssessment(page);

  await page.goto(`${APP_URL}/study/assessments`);
  await expect(page.getByRole('heading', { name: 'Assessments' })).toBeVisible({
    timeout: 30000,
  });
  const card = page.locator(`.materials-grid article:has(a[href$="/assessments/${assessmentId}"])`);
  await expect(card).toBeVisible({ timeout: 60000 });
  // The card title link stretches over the whole card; this real click is the
  // proof the corner X stays hit-testable above it.
  const del = card.getByRole('button', { name: /^Delete .* assessment$/ });
  await expect(del).toBeVisible({ timeout: 30000 });
  await del.click();

  const dialog = page.getByRole('dialog', { name: 'Confirm delete this assessment?' });
  await expect(dialog).toBeVisible({ timeout: 30000 });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
  // The destructive confirm is never autofocused; Cancel owns initial focus.
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Delete assessment', exact: true }).click();

  // The card locks while the job runs, then the tombstone drops the row.
  await expect(card.getByRole('status')).toBeVisible({ timeout: 60000 });
  await expect(
    page.locator(`.materials-grid article:has(a[href$="/assessments/${assessmentId}"])`),
    'the deleted row leaves the hub once the worker confirms',
  ).toHaveCount(0, { timeout: DELETE_WAIT_MS });
  await assertNoOverflow(page);
  await page.screenshot({ path: `${EVIDENCE_DIR}/${evidenceName}`, fullPage: true });

  const deleteId = deleteIds[0] ?? '';
  expect(deleteId, 'the browser minted an X-Request-ID for the delete call').toBeTruthy();
  return deleteId;
}

test.describe('assessment delete live (desktop 1280)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 30000 });
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('corner X deletes the fresh card and the row leaves the hub', async ({ page, errors }) => {
    test.setTimeout(600_000);
    const testStartedAt = new Date().toISOString();
    let failure: unknown;
    let requestId = '';
    try {
      requestId = await deleteScenario(page, 'assessment-delete-desktop.png');
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
      expect(errors()).toEqual([]);
    } catch (error) {
      failure = error;
    }
    try {
      if (requestId) {
        // Rule 17: the browser's request id joins to the backend log lines.
        const lines = await grepIntelligenceLog(requestId);
        console.log(`[assessment-delete-live] request ${requestId} -> ${lines.length} backend line(s)`);
        expect(lines.length, 'the delete request id must appear in the service log').toBeGreaterThan(0);
      }
      await cleanupRunAssessments(testStartedAt);
    } catch (error) {
      console.warn(`[assessment-delete-live] cleanup/join failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});

test.describe('assessment delete live (phone 375)', () => {
  test.use({ viewport: { width: 375, height: 812 }, actionTimeout: 30000 });
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('corner X deletes the fresh card at one-column layout', async ({ page, errors }) => {
    test.setTimeout(600_000);
    const testStartedAt = new Date().toISOString();
    let failure: unknown;
    let requestId = '';
    try {
      requestId = await deleteScenario(page, 'assessment-delete-mobile.png');
      const grid = page.locator('.materials-grid').first();
      await expect(grid).toBeVisible({ timeout: 30000 });
      const columns = await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns);
      expect(columns.split(' ').filter(Boolean).length).toBe(1);
      expect(errors()).toEqual([]);
    } catch (error) {
      failure = error;
    }
    try {
      if (requestId) {
        // Rule 17: the browser's request id joins to the backend log lines.
        const lines = await grepIntelligenceLog(requestId);
        console.log(`[assessment-delete-live] request ${requestId} -> ${lines.length} backend line(s)`);
        expect(lines.length, 'the delete request id must appear in the service log').toBeGreaterThan(0);
      }
      await cleanupRunAssessments(testStartedAt);
    } catch (error) {
      console.warn(`[assessment-delete-live] cleanup/join failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});
