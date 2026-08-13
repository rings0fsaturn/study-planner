import { test, expect, type Page } from '@playwright/test';

/**
 * Live Material Library check (Phase 2 ticket #36) against the real running
 * app and a real Supabase login. Creates a throwaway contentless manual
 * material through the UI, inspects the detail page, exercises the picker
 * (non-ready row opens detail instead of selecting), and deletes the material
 * again so the account is left unchanged.
 *
 * Requires E2E_LIVE_EMAIL and E2E_LIVE_PASSWORD (test credentials are kept out
 * of source); the suite is skipped when they are not set.
 */
const APP_URL = 'http://localhost:5173';
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 15000 });
}

test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

test('material library: create, inspect, picker, delete round trip', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const materialTitle = `E2E library check ${Date.now()}`;

  await signIn(page);

  await page.goto(`${APP_URL}/study/materials`);
  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible();

  await page.getByRole('button', { name: 'Add material' }).click();
  await expect(page.getByRole('heading', { name: 'Add material' })).toBeVisible();

  await page.getByRole('button', { name: /Plain text/i }).click();
  await page.getByLabel('Title').fill(materialTitle);
  await page.getByRole('button', { name: 'Add and process' }).click();

  await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Pending', { exact: true })).toBeVisible();
  await expect(page.getByText(/Grounded generation is disabled/i)).toBeVisible();

  await page.getByRole('button', { name: '← Back to library' }).click();
  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible();

  await page.getByRole('button', { name: 'Select for assessment' }).click();
  const picker = page.getByRole('dialog', { name: /Choose materials for assessment/i });
  await expect(picker).toBeVisible();
  await expect(picker.getByText(materialTitle)).toBeVisible();
  const pendingRow = picker.locator('label').filter({ hasText: materialTitle });
  await expect(pendingRow.getByRole('checkbox')).toBeDisabled();
  await pendingRow.getByRole('link', { name: 'View' }).click();

  await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete material' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete material' }).click();

  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible();
  await expect(page.getByText(materialTitle)).not.toBeVisible();

  expect(pageErrors).toEqual([]);
});

test.use({ viewport: { width: 390, height: 844 } });

test('material library mobile: create and delete round trip', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const materialTitle = `E2E mobile check ${Date.now()}`;

  await signIn(page);

  await page.goto(`${APP_URL}/study/materials`);
  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible();

  await page.getByRole('button', { name: 'Add material' }).click();
  await page.getByRole('button', { name: /Plain text/i }).click();
  await page.getByLabel('Title').fill(materialTitle);
  await page.getByRole('button', { name: 'Add and process' }).click();

  await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Pending', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete material' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete material' }).click();

  await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
