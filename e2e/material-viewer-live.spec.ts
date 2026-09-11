import { test, expect, type Page } from '@playwright/test';

/**
 * Live pdf.js viewer (issue #62, P5) against the real running stack and the
 * frozen ready corpus material ("ACCA APM Study Text", 572 pages). The viewer
 * loads the private PDF through a short-lived signed URL and range-fetches it,
 * so this scenario is also the check that the worker is wired: a missing
 * `workerSrc` paints a blank canvas with only a console warning.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD, the managed runtime, the
 * detached ingestion worker and the GPU sidecar (rules 10/53/54). The corpus
 * material is the frozen retrieval baseline and is never deleted.
 */
const APP_URL = 'http://localhost:5173';
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';
const CORPUS_TITLE = 'ACCA APM Study Text';
const CHAPTER_5 = 'Chapter 5 Budgeting and control';
const CHAPTER_5_LABEL = `${CHAPTER_5} (p.156)`;

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 15000 });
}

async function openViewer(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/materials`);
  // The app gates on the event-store sync ("Still bringing things over") right
  // after sign-in, and the shared dev account's history makes that routinely
  // longer than a default expect timeout.
  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible({
    timeout: 30_000,
  });
  const card = page.locator('.material-card', { hasText: CORPUS_TITLE });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { name: CORPUS_TITLE })).toBeVisible();
  await page.getByRole('link', { name: 'Open in viewer' }).click();
  await expect(page.getByRole('heading', { name: CORPUS_TITLE })).toBeVisible({
    timeout: 30_000,
  });
}

/** The canvas must have real ink on it, not just the right dimensions. */
async function darkPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.pdf-canvas');
    if (!canvas || canvas.width === 0) return -1;
    const context = canvas.getContext('2d');
    if (!context) return -1;
    const height = Math.min(canvas.height, 400);
    const { data } = context.getImageData(0, 0, canvas.width, height);
    let dark = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 200) dark += 1;
    }
    return dark;
  });
}

/** Waits for the first page to paint, then for a chapter jump to repaint. */
async function expectRendered(page: Page): Promise<void> {
  await expect(page.locator('.pdf-canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => darkPixels(page), { timeout: 60_000 }).toBeGreaterThan(0);
}

test.describe('material viewer (live)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('renders the PDF, jumps to a chapter, and hands a page range to the config', async ({ page }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    try {
      await signIn(page);
      await openViewer(page);

      // 1. The document is range-fetched from a signed URL and painted.
      await expectRendered(page);
      await expect(page.getByRole('spinbutton', { name: 'Page' })).toHaveValue('1');
      await expect(page.getByText('of 572')).toBeVisible();

      // 2. Chapter jump: the outline's own page (Chapter 5 is pdf 156).
      await page.getByLabel('Jump to chapter').selectOption({ label: CHAPTER_5_LABEL });
      await expect(page.getByRole('spinbutton', { name: 'Page' })).toHaveValue('156');

      // 3. A range is selected from the pages actually on screen.
      await page.getByRole('button', { name: 'Set first page' }).click();
      await page.getByRole('spinbutton', { name: 'Page' }).fill('213');
      await page.getByRole('button', { name: 'Set last page' }).click();
      await expect(page.getByText('Assess pages 156–213')).toBeVisible();

      // 4. The range is handed to the assessment config as a typed range.
      await page.getByRole('button', { name: 'Assess these pages' }).click();
      await page.waitForURL(/\/assessments\/new\?from=156&to=213/, { timeout: 15_000 });
      await expect(page.getByLabel('From page')).toHaveValue('156');
      await expect(page.getByLabel('To page')).toHaveValue('213');
      await expect(page.getByRole('button', { name: CHAPTER_5 })).not.toHaveClass(/selected/);

      // 5. The handoff produces a grounded question with citations.
      await page.getByRole('button', { name: 'Generate question' }).click();
      await page.waitForURL(/\/study\/assessments\/[^/]+$/, { timeout: 15_000 });
      const failed = page.getByRole('button', { name: 'Retry generation' });
      await expect(page.getByRole('heading', { name: 'Citations' }).or(failed)).toBeVisible({
        timeout: 120_000,
      });
      if (await failed.isVisible()) {
        await failed.click();
        await expect(page.getByRole('heading', { name: 'Citations' })).toBeVisible({
          timeout: 120_000,
        });
      }
      await expect(page.getByText(/chunk [0-9a-f]+/).first()).toBeVisible();
    } finally {
      // The corpus material is the frozen retrieval baseline: never delete it.
    }

    expect(pageErrors).toEqual([]);
  });
});

test.use({ viewport: { width: 375, height: 812 } });

test.describe('material viewer (live, mobile)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('mobile: renders, jumps to a chapter and hands the range over at 375px', async ({ page }) => {
    test.setTimeout(300_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    try {
      await signIn(page);
      await openViewer(page);

      await expectRendered(page);
      await expect(page.getByText('of 572')).toBeVisible();

      await page.getByLabel('Jump to chapter').selectOption({ label: CHAPTER_5_LABEL });
      await expect(page.getByRole('spinbutton', { name: 'Page' })).toHaveValue('156');
      await page.getByRole('button', { name: 'Set first page' }).click();
      await page.getByRole('button', { name: 'Set last page' }).click();
      await expect(page.getByText('Assess pages 156–156')).toBeVisible();

      await page.getByRole('button', { name: 'Assess these pages' }).click();
      await page.waitForURL(/\/assessments\/new\?from=156&to=156/, { timeout: 15_000 });
      await expect(page.getByLabel('From page')).toHaveValue('156');
      await expect(page.getByLabel('To page')).toHaveValue('156');
      await expect(page.getByRole('button', { name: 'Generate question' })).toBeVisible();
    } finally {
      // The corpus material is the frozen retrieval baseline: never delete it.
    }

    expect(pageErrors).toEqual([]);
  });
});
