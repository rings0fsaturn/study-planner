import { test, expect, type Page } from '@playwright/test';

/**
 * Live assessment taking + objective grading (issue #39) against the real
 * running stack. Takes the frozen ready assessment through the UI, answers
 * the objective question, submits, and asserts the deterministic grade
 * lands (Score line + attempt history). Retry mints a fresh attempt.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source) and the
 * managed runtime (`./full-app restart full`) plus the grading worker arm.
 * Throws the attempt away via Retry semantics only — attempts are
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

test.describe('assessment taking live (#39)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('takes the ready assessment online and receives a grade', async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await page.goto(`${APP_URL}/study/assessments/${ASSESSMENT_ID}`);

    // Ready state renders the question + the AttemptTaker controls.
    const taker = page.getByLabel('Answer this question');
    await expect(taker).toBeVisible({ timeout: 15000 });
    const options = taker.getByRole('radio');
    await expect(options).toHaveCount(4);

    const historyHeading = taker.getByText(/Attempt history/);
    const before = (await historyHeading.count()) > 0
      ? Number((await historyHeading.innerText()).replace(/[^0-9]/g, '') || '0')
      : 0;

    // Answer the first option and submit.
    await taker.locator('label').first().click();
    await taker.getByRole('button', { name: 'Submit answer' }).click();

    // Honest states: submitting -> grading -> graded with a Score line.
    await expect(taker.getByText(/Score \d+\.\d+ · (correct|not correct)/)).toBeVisible({
      timeout: 60000,
    });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/correct index|correctIndex|answer key/i);

    // History grows by exactly one row (append-only, AC2).
    await expect(taker.getByText(/Attempt history/)).toBeVisible();
    const afterText = await taker.getByText(/Attempt history/).innerText();
    const after = Number(afterText.replace(/[^0-9]/g, '') || '0');
    expect(after).toBe(before + 1);

    // Retry returns to the answering phase with history intact.
    await taker.getByRole('button', { name: 'Retry question' }).click();
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

    const taker = page.getByLabel('Answer this question');
    await expect(taker).toBeVisible({ timeout: 15000 });

    // Go offline and submit: the row stays queued with honest copy.
    await context.setOffline(true);
    await taker.locator('label').first().click();
    await taker.getByRole('button', { name: 'Submit answer' }).click();
    await expect(taker.getByText(/Queued offline/)).toBeVisible({ timeout: 30000 });
    await expect(taker.getByText(/Attempt history/)).toBeVisible();

    // Reconnect: a fresh retry submits online and grades.
    await context.setOffline(false);
    await taker.getByRole('button', { name: 'Retry question' }).click();
    await taker.locator('label').first().click();
    await taker.getByRole('button', { name: 'Submit answer' }).click();
    await expect(taker.getByText(/Score \d+\.\d+ · (correct|not correct)/)).toBeVisible({
      timeout: 60000,
    });

    await page.screenshot({
      path: 'evidence-39-offline-drain.png',
    });
    expect(pageErrors).toEqual([]);
  });
});
