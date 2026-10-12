import { test, expect, type Page } from '@playwright/test';

/**
 * Live assessment taking + objective grading (issue #39) against the real
 * running stack. Takes the frozen ready assessment through the UI, answers
 * the objective question, submits, and asserts the deterministic grade
 * lands (Score line + attempt history). Retry mints a fresh attempt.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source) and the
 * managed runtime (`./full-app restart full`) plus the grading worker arm.
 * Throws the attempt away via Retry semantics only - attempts are
 * append-only history on the shared dev account, so the spec answers once
 * and asserts history grows by exactly one row.
 *
 * Ready assessment (frozen #38 output, never deleted):
 * bab2b498-6654-4757-868d-1daa8b3bde57 (objective MCQ, 4 options).
 */
const APP_URL = 'http://localhost:5173';
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';
const ASSESSMENT_ID = 'bab2b498-6654-4757-868d-1daa8b3bde57';

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 15000 });
}

/**
 * The shared account carries graded history on the frozen assessment, so the
 * page hydrates into review-first mode (the #40 contract) and the taking UI
 * only appears after an explicit per-question retry. Fresh accounts land on
 * the taker directly. Wait for the settled state, then enter taking mode.
 */
async function enterTakingMode(page: Page): Promise<number> {
  const taker = page.getByLabel('Answer this question');
  const reviewPanel = page.getByLabel(/Question .* review/);
  const reviewed = await reviewPanel
    .waitFor({ state: 'visible', timeout: 30000 })
    .then(() => true, () => false);
  if (!reviewed) return 0;
  // Count before the retry: the submit below must append exactly one row.
  // (Serialized with --workers=1 so no parallel run can append in between.)
  // The panel mounts before hydrate merges the server history, so wait for a
  // non-zero count and then let one merge cycle settle before trusting it.
  const attemptButtons = reviewPanel.getByRole('button', { name: /^Attempt #\d+/ });
  await expect.poll(async () => attemptButtons.count(), { timeout: 30000 }).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  const prior = await attemptButtons.count();
  await page.getByRole('button', { name: 'Retry question' }).first().click();
  await expect(taker).toBeVisible({ timeout: 15000 });
  return prior;
}

test.describe('assessment taking live (#39)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('takes the ready assessment online and receives a grade', async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await page.goto(`${APP_URL}/study/assessments/${ASSESSMENT_ID}`);

    // Ready state renders the question + the AttemptTaker controls.
    const before = await enterTakingMode(page);
    const taker = page.getByLabel('Answer this question');
    const options = taker.getByRole('radio');
    await expect(options).toHaveCount(4);

    // Answer the first option and submit.
    await taker.getByRole('radiogroup').locator('label').first().click();
    await taker.getByRole('button', { name: 'Submit answer' }).click();

    // Honest states: submitting -> grading -> the review surface gains one
    // graded attempt (a grade landing on a retried question returns it to
    // review mode, the #40 contract - the taker unmounts instead of showing
    // its own Score line).
    const reviewPanel = page.getByLabel(/Question .* review/);
    await expect(reviewPanel).toBeVisible({ timeout: 60000 });
    const attemptButtons = reviewPanel.getByRole('button', { name: /^Attempt #\d+/ });
    await expect.poll(async () => attemptButtons.count(), { timeout: 60000 }).toBe(before + 1);
    await expect(attemptButtons.last()).toContainText(/correct · 1\.00/);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/correct index|correctIndex|answer key/i);

    // Retry returns to the answering phase with history intact.
    await page.getByRole('button', { name: 'Retry question' }).first().click();
    await expect(taker).toBeVisible({ timeout: 15000 });
    await expect(taker.getByRole('button', { name: 'Submit answer' })).toBeVisible();

    await page.screenshot({
      path: 'evidence-39-taking-graded.png',
    });
    expect(pageErrors).toEqual([]);
  });

  test('offline submit queues locally, reconnect submit grades', async ({ page, context }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await page.goto(`${APP_URL}/study/assessments/${ASSESSMENT_ID}`);

    const prior = await enterTakingMode(page);
    const taker = page.getByLabel('Answer this question');

    // Go offline and submit: the row stays queued with honest copy.
    await context.setOffline(true);
    await taker.getByRole('radiogroup').locator('label').first().click();
    await taker.getByRole('button', { name: 'Submit answer' }).click();
    await expect(taker.getByText(/Queued offline/)).toBeVisible({ timeout: 30000 });
    await expect(taker.getByText(/Attempt history/)).toBeVisible();

    // Reconnect: a fresh retry submits online and grades; the landing grade
    // returns the panel to review mode (the #40 contract), which must show a
    // new correct attempt (the drained queued row may also surface, so the
    // count grows by at least one).
    await context.setOffline(false);
    await taker.getByRole('button', { name: 'Retry question' }).click();
    await taker.getByRole('radiogroup').locator('label').first().click();
    await taker.getByRole('button', { name: 'Submit answer' }).click();
    const reviewPanel = page.getByLabel(/Question .* review/);
    await expect(reviewPanel).toBeVisible({ timeout: 60000 });
    const attemptButtons = reviewPanel.getByRole('button', { name: /^Attempt #\d+/ });
    await expect
      .poll(async () => attemptButtons.count(), { timeout: 60000 })
      .toBeGreaterThanOrEqual(prior + 1);
    await expect(attemptButtons.last()).toContainText(/correct · 1\.00/);

    await page.screenshot({
      path: 'evidence-39-offline-drain.png',
    });
    expect(pageErrors).toEqual([]);
  });
});
