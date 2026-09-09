import { test, expect, type Page } from '@playwright/test';

/**
 * Live assessment review surface (issue #40) against the real running stack.
 * Covers the P5 live-pass matrix: ready graded review on desktop + mobile,
 * per-question retry (fresh observation, append-only history), whole-
 * assessment retry (round appended, prior timeline collapsed-but-present),
 * and the redaction gate on what the review actually renders.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source) and the
 * managed runtime (`./full-app restart full`). Mutates the shared dev
 * account by design — retry semantics only: each scenario submits at most
 * once and asserts history grows by exactly one row per submit. Run with
 * `--workers=1` so the mutation scenarios never overlap on the account.
 *
 * Ready assessment (frozen #38 output, never deleted):
 * bab2b498-6654-4757-868d-1daa8b3bde57 (objective MCQ, 4 options; option 1
 * is the deterministic-correct pick — all prior server attempts score 1.00
 * with answer index 0).
 */
const APP_URL = 'http://localhost:5173';
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';
const ASSESSMENT_ID = 'bab2b498-6654-4757-868d-1daa8b3bde57';
const EVIDENCE_DIR = '.work/active/issue-40-assessment-review-implementation/plan/evidence';
const REDACTION_RE = /answerBlock|answer_block|correctIndex|correct_index|referenceSolution|hiddenTest|answer key/i;

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 15000 });
}

/** Open the frozen assessment and wait until the review settles on graded rows. */
async function openGradedReview(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/assessments/${ASSESSMENT_ID}`);
  // Hydration restores server rows shortly after first paint (fresh device);
  // the graded history block is the settled signal, so wait on it.
  await expect(page.locator('[aria-label="Attempt history"]').first()).toBeVisible({
    timeout: 60000,
  });
}

/** Graded history rows visible inside the review panel's history block. */
function historyRows(page: Page) {
  return page.locator('[aria-label="Attempt history"] .ar-attempt:not(.is-queued)');
}

/** Latest preserved attempt row (toggle button; innerText is CSS-uppercased, so use the name). */
function latestAttempt(page: Page) {
  return page.getByRole('button', { name: /Attempt #\d+ correct · 1\.00/ }).last();
}

/** Verdict polls until the whole assessment reads graded — in-flight rows grade server-side and the 3 s refresh picks them up. */
async function expectGradedVerdict(page: Page): Promise<void> {
  const summary = page.getByRole('region', { name: 'Assessment summary' });
  await expect(summary.getByText(/1 of 1 questions correct · score 1\.00/)).toBeVisible({
    timeout: 60000,
  });
}

test.describe('assessment review live (#40)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('desktop: ready graded review renders summary, navigator, your-pick, history — redaction clean', async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await openGradedReview(page);

    const summary = page.getByRole('region', { name: 'Assessment summary' });
    await expect(summary).toBeVisible();
    // Verdict + family chips reflect the graded state (all server attempts score 1.00).
    await expectGradedVerdict(page);
    await expect(summary.getByText('Objective 1/1')).toBeVisible();

    // Navigator rail: tablist with the graded question marked current.
    const navigator = page.getByRole('tablist', { name: 'Question navigator' });
    await expect(navigator).toBeVisible();
    await expect(page.getByRole('tab', { name: /Question 1/ })).toHaveAttribute('aria-current', 'true');

    // Your-pick marking from the server-echoed answer (fresh-device restore).
    await expect(page.getByText('your answer', { exact: true }).first()).toBeVisible();
    await expect(page.locator('[aria-label="Answer options with your selection"] .ar-option.is-selected')).toHaveCount(1);

    // Preserved history, oldest → latest; at least one graded row exists and the latest is expanded.
    const rows = historyRows(page);
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(latestAttempt(page)).toBeVisible();

    // Whole-assessment retry control present once, in the summary.
    await expect(page.getByRole('button', { name: 'Retry assessment' })).toHaveCount(1);

    // Redaction gate: nothing hidden ever renders.
    expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);

    await page.screenshot({ path: `${EVIDENCE_DIR}/review-40-ready-desktop.png`, fullPage: true });
    expect(pageErrors).toEqual([]);
  });

  test.describe('mobile 375×812', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('strip navigator + single column renders the same graded review without page overflow', async ({ page }) => {
      test.setTimeout(180_000);
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await signIn(page);
      await openGradedReview(page);

      // The navigator is the same tablist (rail ↔ strip is a CSS switch).
      await expect(page.getByRole('tablist', { name: 'Question navigator' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Assessment summary' })).toBeVisible();
      await expectGradedVerdict(page);
      await expect(page.getByText('your answer', { exact: true }).first()).toBeVisible();
      await expect(latestAttempt(page)).toBeVisible();

      // No horizontal page overflow at the mobile viewport.
      const overflow = await page.evaluate(
        () => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);
      await page.screenshot({ path: `${EVIDENCE_DIR}/review-40-ready-mobile.png`, fullPage: true });
      expect(pageErrors).toEqual([]);
    });
  });

  test('per-question retry mints a fresh attempt; history stays append-only', async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await openGradedReview(page);
    await expectGradedVerdict(page);

    const before = await historyRows(page).count();
    expect(before).toBeGreaterThan(0);

    // Retry returns the panel to the taking UI.
    await page.getByRole('button', { name: 'Retry question' }).click();
    const taker = page.getByLabel('Answer this question');
    await expect(taker).toBeVisible({ timeout: 15000 });

    // Answer deterministically (option 1 = correct pick) and submit.
    await taker.getByRole('radiogroup', { name: 'Answer options' }).locator('label').first().click();
    await taker.getByRole('button', { name: 'Submit answer' }).click();

    // The grade lands; the panel returns to the review card with one more graded row.
    await expect(historyRows(page)).toHaveCount(before + 1, { timeout: 90000 });
    await expect(latestAttempt(page)).toBeVisible();
    await expectGradedVerdict(page);

    expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);
    await page.screenshot({ path: `${EVIDENCE_DIR}/review-40-retry-question.png`, fullPage: true });
    expect(pageErrors).toEqual([]);
  });

  test('whole-assessment retry appends a round; prior timeline collapses but stays present', async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await openGradedReview(page);
    await expectGradedVerdict(page);

    const summary = page.getByRole('region', { name: 'Assessment summary' });
    const before = await historyRows(page).count();

    // Capture the current round before retrying (the seed lands shortly after rows hydrate).
    let meta = '';
    await expect
      .poll(
        async () => {
          meta = await summary.locator('.ar-summary-meta').innerText();
          return meta;
        },
        { timeout: 15000 },
      )
      .toMatch(/Attempt \d+ of \d+/i);
    const round = Number(meta.match(/Attempt (\d+) of \d+/i)?.[1] ?? '1');

    // Whole-assessment retry: every question returns to taking mode and a new
    // round is appended to the timeline.
    await page.getByRole('button', { name: 'Retry assessment' }).click();
    await expect(summary).toContainText(new RegExp(`Attempt ${round + 1} of ${round + 1}`, 'i'));
    const taker = page.getByLabel('Answer this question');
    await expect(taker).toBeVisible({ timeout: 15000 });

    // The prior round is collapsed-but-present in the timeline record (D-06).
    await expect(page.locator('.ar-timeline-prior summary')).toContainText(
      /Previous attempt timeline — \d+ attempt/,
    );

    // Answer once: fan-out submit mints one fresh observation.
    await taker.getByRole('radiogroup', { name: 'Answer options' }).locator('label').first().click();
    await taker.getByRole('button', { name: 'Submit answer' }).click();
    await expect(historyRows(page)).toHaveCount(before + 1, { timeout: 90000 });
    await expect(latestAttempt(page)).toBeVisible();
    await expectGradedVerdict(page);

    expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);
    await page.screenshot({ path: `${EVIDENCE_DIR}/review-40-retry-assessment.png`, fullPage: true });
    expect(pageErrors).toEqual([]);
  });
});
