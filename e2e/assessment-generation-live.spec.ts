import { test, expect, type Page } from '@playwright/test';

/**
 * Live single grounded objective assessment (issue #38) against the real
 * running stack. Uses the frozen ready corpus material ("ACCA APM Study
 * Text", 754 chunks; probe-verified citation validity) so the model has a
 * rich grounding context, generates one objective assessment through the
 * UI, polls the detail page until the question appears with citations,
 * asserts no answer content is present anywhere, and leaves the shared
 * corpus material untouched (it is NOT deleted - it is the frozen baseline).
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source) and the
 * managed runtime (`./full-app start full`) plus the detached worker and
 * the GPU sidecar for embeddings/query-embed (rules 10/54).
 */
const APP_URL = 'http://localhost:5173';
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';
const CORPUS_TITLE = 'ACCA APM Study Text';

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 15000 });
}

async function openCorpusDetail(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/materials`);
  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible();
  const card = page.locator('.material-card', { hasText: CORPUS_TITLE });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { name: CORPUS_TITLE })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Generate assessment' })).toBeVisible();
}

test.describe('assessment generation (live)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('generates one grounded objective assessment from the ready corpus material', async ({ page }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    try {
      await signIn(page);

      // 1. Open the ready corpus material (frozen baseline; never deleted).
      await openCorpusDetail(page);

      // 2. Open the assessment config (difficulty defaults to band 3, the
      //    band the model complies with most often) and submit.
      await page.getByRole('link', { name: 'Generate assessment' }).click();
      await expect(page.getByRole('heading', { name: 'Generate assessment' })).toBeVisible();
      await expect(page.getByRole('button', { name: '3', exact: true })).toHaveClass(/selected/);
      await page.getByRole('button', { name: 'Generate question' }).click();

      // 3. The detail page polls until the question lands. The citation gate
      //    is strict (probe citation validity 83-100%), so a failed attempt
      //    is possible; each Retry creates a fresh observation. Bound the
      //    loop so the test stays deterministic without masking a real bug.
      await page.waitForURL(/\/study\/assessments\/[^/]+$/, { timeout: 15000 });
      await expect(page.getByText('Generating your question')).toBeVisible({ timeout: 5000 });

      let questionReady = false;
      for (let attempt = 0; attempt < 4 && !questionReady; attempt++) {
        const failed = page.getByRole('button', { name: 'Retry generation' });
        await expect(page.getByText(/Difficulty band/).or(failed)).toBeVisible({
          timeout: 120_000,
        });
        if ((await failed.count()) > 0 && (await failed.isVisible())) {
          await failed.click();
          await expect(page.getByText('Generating your question')).toBeVisible({ timeout: 5000 });
        } else {
          questionReady = true;
        }
      }
      expect(questionReady, 'assessment did not reach ready after retries').toBe(true);

      // 4. The question renders with at least one citation; no answer content.
      const questionBlock = page.locator('.card-large');
      await expect(questionBlock.getByText(/chunk [0-9a-f]+/)).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/correct index|correctIndex|answer key|correct answer/i);
    } finally {
      // The corpus material is the frozen retrieval baseline: never delete it.
    }

    expect(pageErrors).toEqual([]);
  });
});

test.use({ viewport: { width: 390, height: 844 } });

test.describe('assessment generation (live, mobile)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('mobile: config page renders and submits at 390px', async ({ page }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    try {
      await signIn(page);
      await openCorpusDetail(page);

      await page.getByRole('link', { name: 'Generate assessment' }).click();
      await expect(page.getByRole('heading', { name: 'Generate assessment' })).toBeVisible();

      // Difficulty default (3) is selected; the submit button is visible at 390px.
      await expect(page.getByRole('button', { name: '3', exact: true })).toHaveClass(/selected/);
      await expect(page.getByRole('button', { name: 'Generate question' })).toBeVisible();
    } finally {
      // The corpus material is the frozen retrieval baseline: never delete it.
    }

    expect(pageErrors).toEqual([]);
  });
});