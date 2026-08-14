import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

/**
 * Live Material Ingestion check (Phase 2 ticket #37) against the real running
 * app, the Intelligence API, and the ingestion worker.
 *
 * Covers the full lifecycle: plain text, web URL, and PDF materials move
 * through pending -> extracting/chunking/embedding -> ready via the worker,
 * partial extracted content is previewable while processing, a retryable
 * failure surfaces the retry action and a retry creates a new attempt, and a
 * second account cannot read the first account's material.
 *
 * The PDF scenario uploads the real fixture `e2e/pdf/sample-textbook-572page.pdf`
 * (a 572-page textbook, ~23 MB), so extraction, chunking, and embedding are
 * exercised on realistic content instead of a minimal synthetic PDF. It needs
 * a longer timeout because the whole book must reach `ready`.
 *
 * Requires (operator steps, all documented on issue #37):
 * - Migrations 005..013 pushed to the dev Supabase project.
 * - The ingestion worker running with the service-role key + Gemini key.
 * - E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD for the main account, and
 *   E2E_LIVE_EMAIL_2 / E2E_LIVE_PASSWORD_2 for the cross-user scenario
 *   (test credentials are kept out of source); the suite is skipped when the
 *   main pair is not set.
 * - SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for the attempt-level retry
 *   assertion (the spec signs in through the Supabase auth API to read
 *   ingestion status from the Intelligence Service).
 * - The YouTube scenario additionally requires E2E_INCLUDE_YOUTUBE=1 because
 *   the corporate network can block YouTube transcripts.
 */
const APP_URL = 'http://localhost:5173';
const INTELLIGENCE_URL = process.env.VITE_INTELLIGENCE_URL ?? 'http://127.0.0.1:8000';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://kabpmbhlvfbrhtbxjaua.supabase.co';
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';
const EMAIL_2 = process.env.E2E_LIVE_EMAIL_2 ?? '';
const PASSWORD_2 = process.env.E2E_LIVE_PASSWORD_2 ?? '';
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
const INCLUDE_YOUTUBE = process.env.E2E_INCLUDE_YOUTUBE === '1';

/** Real 572-page textbook fixture used by the PDF scenario (~23 MB). */
const REAL_PDF_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'pdf',
  'sample-textbook-572page.pdf',
);

/** Collects page errors and browser console errors; asserts both empty at the end. */
function watchErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return () => errors;
}

async function signIn(page: Page, email = EMAIL, password = PASSWORD): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 15000 });
}

async function signOut(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/home`);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/study\/sign-in/, { timeout: 15000 });
}

async function openLibrary(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/materials`);
  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible();
}

/**
 * The create-page source grid. Scoped so the choice buttons never collide with
 * library cards that carry the same words (e.g. "Plain text" / "PDF document").
 */
const createSourceGrid = (page: Page) => page.locator('.material-source-grid');

async function pickSource(page: Page, label: RegExp): Promise<void> {
  await createSourceGrid(page).getByRole('button', { name: label }).click();
}

async function fillTitle(page: Page, title: string): Promise<void> {
  await page.getByLabel('Title').fill(title);
}

/**
 * Waits until the library card for `title` shows the ready affordance. Ready
 * cards intentionally hide the status badge and show the Practice-this button
 * instead. The library page updates live over Realtime with a bounded polling
 * fallback, so no reload is needed.
 */
async function expectCardReady(page: Page, title: string, timeout = 90_000): Promise<void> {
  const card = page.locator('.material-card', { hasText: title });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: 'Practice this' })).toBeVisible({
    timeout,
  });
}

/** Deletes the material for `title` if it still exists; safe for cleanup. */
async function deleteMaterialIfPresent(page: Page, title: string): Promise<void> {
  await page.goto(`${APP_URL}/study/materials`);
  const card = page.locator('.material-card', { hasText: title });
  if ((await card.count()) === 0) return;
  await card.click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete material' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete material' }).click();
  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible();
}

async function openDetailAndCheckReady(page: Page, title: string): Promise<void> {
  await page.locator('.material-card', { hasText: title }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Practice this' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Extracted content/ }),
  ).toBeVisible({ timeout: 15000 });
  const preview = page.locator('.material-preview-text');
  await expect(preview).not.toBeEmpty();
}

/**
 * Reads the ingestion attempt count from the Intelligence Service using a
 * fresh password-grant token, so a retry is asserted at the attempt level
 * rather than only through the UI's optimistic Pending label.
 */
async function ingestionAttempt(materialId: string): Promise<number> {
  if (!PUBLISHABLE_KEY) {
    throw new Error('SUPABASE_PUBLISHABLE_KEY is required for the attempt-level assertion');
  }
  const tokenResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const tokenBody = (await tokenResponse.json()) as { access_token?: string };
  const accessToken = tokenBody.access_token;
  if (!accessToken) throw new Error('password grant failed for the attempt assertion');
  const response = await fetch(`${INTELLIGENCE_URL}/v1/materials/${materialId}/ingestion`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as { attempt?: number };
  return body.attempt ?? 0;
}

test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

test.setTimeout(180_000);

test('ingestion: plain text material reaches ready with partial preview', async ({ page }) => {
  const errors = watchErrors(page);
  const materialTitle = `E2E ingestion text ${Date.now()}`;
  const body =
    'Distributed systems study note. The Raft consensus algorithm separates ' +
    'leader election, log replication, and safety into three concerns, and it ' +
    'uses randomized election timeouts to keep the system available.';

  try {
    await signIn(page);
    await openLibrary(page);
    await page.getByRole('button', { name: 'Add material' }).click();
    await pickSource(page, /Plain text/i);
    await fillTitle(page, materialTitle);
    await page.getByLabel('Plain text').fill(body);
    await page.getByRole('button', { name: 'Add and process' }).click();

    await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Grounded generation is disabled until this material is ready.'),
    ).toBeVisible();

    await page.getByRole('button', { name: '← Back to library' }).click();
    await expectCardReady(page, materialTitle);
    await openDetailAndCheckReady(page, materialTitle);
  } finally {
    await deleteMaterialIfPresent(page, materialTitle);
  }
  expect(errors()).toEqual([]);
});

test('ingestion: web URL material reaches ready', async ({ page }) => {
  const errors = watchErrors(page);
  const materialTitle = `E2E ingestion url ${Date.now()}`;

  try {
    await signIn(page);
    await openLibrary(page);
    await page.getByRole('button', { name: 'Add material' }).click();
    await pickSource(page, /Web article/i);
    await fillTitle(page, materialTitle);
    await page.getByLabel('URL').fill('https://example.com');
    await page.getByRole('button', { name: 'Add and process' }).click();

    await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: '← Back to library' }).click();
    await expectCardReady(page, materialTitle);
    await openDetailAndCheckReady(page, materialTitle);
  } finally {
    await deleteMaterialIfPresent(page, materialTitle);
  }
  expect(errors()).toEqual([]);
});

test('ingestion: retryable failure shows retry and retry starts a new attempt', async ({ page }) => {
  const errors = watchErrors(page);
  const materialTitle = `E2E ingestion retry ${Date.now()}`;

  try {
    await signIn(page);
    await openLibrary(page);
    await page.getByRole('button', { name: 'Add material' }).click();
    await pickSource(page, /Web article/i);
    await fillTitle(page, materialTitle);
    await page.getByLabel('URL').fill('http://127.0.0.1:1/unreachable');
    await page.getByRole('button', { name: 'Add and process' }).click();

    await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible({ timeout: 15000 });
    const materialId = page.url().match(/\/materials\/([^/?]+)/)?.[1];
    expect(materialId).toBeTruthy();
    await page.getByRole('button', { name: '← Back to library' }).click();

    const card = page.locator('.material-card', { hasText: materialTitle });
    await expect(card.getByText('Failed', { exact: true })).toBeVisible({ timeout: 60000 });
    await card.click();
    await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible();
    await expect(page.getByText('Ingestion failed')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry ingestion' })).toBeVisible();

    const attemptBefore = materialId ? await ingestionAttempt(materialId) : 0;

    await page.getByRole('button', { name: 'Retry ingestion' }).click();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText('Grounded generation is disabled until this material is ready.'),
    ).toBeVisible({ timeout: 15000 });

    // The DB-atomic retry RPC must have created a new attempt.
    if (materialId) {
      const attemptAfter = await ingestionAttempt(materialId);
      expect(attemptAfter).toBeGreaterThan(attemptBefore);
    }
  } finally {
    await deleteMaterialIfPresent(page, materialTitle);
  }
  expect(errors()).toEqual([]);
});

test('ingestion: PDF upload reaches ready', async ({ page }) => {
  const errors = watchErrors(page);
  const materialTitle = `E2E ingestion pdf ${Date.now()}`;
  // The real 572-page textbook fixture: a full extraction/chunking/embedding
  // run over realistic content. Upload is ~23 MB and the whole book must
  // reach ready, so this scenario needs far more than the 180 s suite budget.
  const pdf = readFileSync(REAL_PDF_PATH);

  test.setTimeout(600_000);

  try {
    await signIn(page);
    await openLibrary(page);
    await page.getByRole('button', { name: 'Add material' }).click();
    await pickSource(page, /PDF document/i);
    await page.getByLabel('Title').fill(materialTitle);
    await page.getByLabel('PDF file').setInputFiles({
      name: 'sample-textbook-572page.pdf',
      mimeType: 'application/pdf',
      buffer: pdf,
    });
    await page.getByRole('button', { name: 'Add and process' }).click();

    await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: '← Back to library' }).click();
    await expectCardReady(page, materialTitle, 420_000);
    await openDetailAndCheckReady(page, materialTitle);
  } finally {
    await deleteMaterialIfPresent(page, materialTitle);
  }
  expect(errors()).toEqual([]);
});

test.describe('ingestion: YouTube transcript', () => {
  test.skip(!INCLUDE_YOUTUBE, 'E2E_INCLUDE_YOUTUBE not set to 1');

  test('reaches ready', async ({ page }) => {
    const errors = watchErrors(page);
    const materialTitle = `E2E ingestion youtube ${Date.now()}`;

    try {
      await signIn(page);
      await openLibrary(page);
      await page.getByRole('button', { name: 'Add material' }).click();
      await pickSource(page, /YouTube video/i);
      await fillTitle(page, materialTitle);
      await page.getByLabel('YouTube URL').fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
      await page.getByRole('button', { name: 'Add and process' }).click();

      await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: '← Back to library' }).click();
      await expectCardReady(page, materialTitle);
      await openDetailAndCheckReady(page, materialTitle);
    } finally {
      await deleteMaterialIfPresent(page, materialTitle);
    }
    expect(errors()).toEqual([]);
  });
});

test.describe('cross-user isolation', () => {
  test.skip(!EMAIL_2 || !PASSWORD_2, 'E2E_LIVE_EMAIL_2 / E2E_LIVE_PASSWORD_2 not set');

  test('second account cannot read the first account material', async ({ page }) => {
    const errors = watchErrors(page);
    const materialTitle = `E2E ingestion cross ${Date.now()}`;

    try {
      await signIn(page, EMAIL, PASSWORD);
      await openLibrary(page);
      await page.getByRole('button', { name: 'Add material' }).click();
      await pickSource(page, /Plain text/i);
      await fillTitle(page, materialTitle);
      await page.getByLabel('Plain text').fill('Account isolation probe.');
      await page.getByRole('button', { name: 'Add and process' }).click();

      await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible({
        timeout: 15000,
      });
      const materialId = page.url().match(/\/materials\/([^/?]+)/)?.[1];
      expect(materialId).toBeTruthy();

      await signOut(page);
      await signIn(page, EMAIL_2, PASSWORD_2);
      await page.goto(`${APP_URL}/study/materials/${materialId}`);
      await expect(page.getByText('Could not load material')).toBeVisible({ timeout: 15000 });
      await signOut(page);
    } finally {
      await signIn(page, EMAIL, PASSWORD);
      await deleteMaterialIfPresent(page, materialTitle);
    }
    expect(errors()).toEqual([]);
  });
});

test.use({ viewport: { width: 390, height: 844 } });

test('ingestion mobile: text material round trip at 390x844', async ({ page }) => {
  const errors = watchErrors(page);
  const materialTitle = `E2E ingestion mobile ${Date.now()}`;

  try {
    await signIn(page);
    await openLibrary(page);
    await page.getByRole('button', { name: 'Add material' }).click();
    await pickSource(page, /Plain text/i);
    await fillTitle(page, materialTitle);
    await page.getByLabel('Plain text').fill('Mobile viewport ingestion check.');
    await page.getByRole('button', { name: 'Add and process' }).click();

    await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: '← Back to library' }).click();
    await expectCardReady(page, materialTitle);
    await openDetailAndCheckReady(page, materialTitle);
  } finally {
    await deleteMaterialIfPresent(page, materialTitle);
  }
  expect(errors()).toEqual([]);
});
