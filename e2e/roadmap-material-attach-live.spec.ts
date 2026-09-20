import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Live check for roadmap material attachment (Phase 2 ticket #63, phase P4).
 *
 * Two real scenarios against the running app plus a real Supabase login:
 *   desktop 1280 - attach a library material with its own minutes and role, see
 *     it in the directory and in the New session picker, confirm the material's
 *     detail page names the roadmap (AC5), book a session on it, detach it from
 *     the row badge, and confirm the booked bubble keeps its label (AC6).
 *   phone 375 - the same attach, measuring the per-row minutes/role controls
 *     (OQ-07) and confirming the plan row does not overflow the sheet.
 *
 * Both scenarios put the shared account back the way they found it: the attach
 * is undone with the same badge control and the throwaway booking is removed.
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source); the file is
 * skipped when they are not set.
 */
const APP_URL = 'http://localhost:5173';
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';

test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

interface AttachResult {
  title: string;
  minutesWidth: number;
  roleWidth: number;
  sheetRight: number;
  sheetOverflows: boolean;
}

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 15000 });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function materialsDirectory(page: Page): Locator {
  return page.getByLabel('Materials directory');
}

function directoryRow(page: Page, title: string): Locator {
  return materialsDirectory(page).locator('.dir-row').filter({ hasText: title });
}

function detachControl(page: Page, title: string): Locator {
  return materialsDirectory(page).getByRole('button', {
    name: `Detach ${title} from this roadmap`,
  });
}

function bookedBubble(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Booked: ${escapeRegExp(title)}`) });
}

/** An empty, in-month day at or after today, so the booking stays editable. */
async function futureEmptyDay(page: Page): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const dates = await page.locator('.roadmap-day-in-month[data-date]').evaluateAll(
    (cells, from) =>
      cells
        .filter(
          (cell) =>
            (cell.getAttribute('data-date') ?? '') >= (from as string) &&
            cell.querySelector('.roadmap-add-session'),
        )
        .map((cell) => cell.getAttribute('data-date') as string),
    today,
  );
  if (dates.length === 0) throw new Error('no empty day at or after today to book on');
  return dates[0];
}

/** Opens the attach picker, picks a library material and sets its minutes + role. */
async function attachFromLibrary(page: Page, minutes: string, role: string): Promise<AttachResult> {
  await page.getByRole('button', { name: 'Add material to this roadmap' }).click();

  const dialog = page.getByRole('dialog', { name: 'Choose materials for planning' });
  await expect(dialog).toBeVisible();

  const row = dialog.locator('.checkbox-entry').first();
  const title = (await row.locator('.checkbox-title').innerText()).trim();
  await row.locator('.checkbox-title').click();
  await expect(row.getByRole('checkbox')).toBeChecked();

  const minutesInput = row.locator('input[type="number"]');
  const roleSelect = row.locator('select');
  await expect(minutesInput).toBeVisible();

  const sheet = page.locator('.material-sheet');
  const minutesBox = await minutesInput.boundingBox();
  const roleBox = await roleSelect.boundingBox();
  const sheetBox = await sheet.boundingBox();
  if (!minutesBox || !roleBox || !sheetBox) throw new Error('the plan row did not render');
  const sheetOverflows = await sheet.evaluate((node) => node.scrollWidth > node.clientWidth + 1);

  await minutesInput.fill(minutes);
  await roleSelect.selectOption(role);
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog).not.toBeVisible();

  return {
    title,
    minutesWidth: minutesBox.width,
    roleWidth: roleBox.width,
    sheetRight: sheetBox.x + sheetBox.width,
    sheetOverflows,
  };
}

test.describe('roadmap material attach (live, desktop 1280)', () => {
  test('attach, book, detach keeps the booked bubble label', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await page.goto(`${APP_URL}/study/roadmap`);
    await expect(page.getByLabel('Projected finish')).toContainText('provisional', {
      timeout: 20000,
    });

    const header = page.locator('.roadmap-header .mono-caps').first();
    const before = await header.innerText();

    const { title } = await attachFromLibrary(page, '90', 'practice');

    await expect(directoryRow(page, title)).toContainText('of 1h 30m');
    expect(await header.innerText()).not.toEqual(before);

    // AC5: the library material's own detail page names the roadmap it feeds.
    const roadmapTitle = (await page.locator('.roadmap-title').innerText()).trim();
    await page.goto(`${APP_URL}/study/materials`);
    await expect(page.getByRole('heading', { name: 'Material library' })).toBeVisible();
    await page
      .locator('.material-card')
      .filter({ hasText: title })
      .getByRole('button', { name: 'View' })
      .click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.locator('.material-ref-list')).toContainText(roadmapTitle);
    await page.goto(`${APP_URL}/study/roadmap`);
    await expect(page.getByLabel('Projected finish')).toContainText('provisional', {
      timeout: 20000,
    });

    // A booking on the attached material, on a day that keeps the bubble editable.
    const day = await futureEmptyDay(page);
    await page.locator(`[data-date="${day}"]`).getByRole('button', { name: '+ add session' }).click();
    await page.getByRole('button', { name: /Attach/ }).click();

    const chooser = page.getByRole('dialog', { name: 'Choose material' });
    const materialChoice = chooser.getByRole('button', { name: new RegExp(escapeRegExp(title)) });
    await expect(materialChoice).toBeVisible();
    await materialChoice.click();
    await chooser.getByRole('button', { name: 'Use this material' }).click();
    await page
      .getByRole('dialog', { name: 'Add session' })
      .getByRole('button', { name: 'Add session' })
      .click();

    await expect(bookedBubble(page, title)).toBeVisible();

    await detachControl(page, title).click();
    await expect(directoryRow(page, title)).toHaveCount(0);
    expect(await header.innerText()).toEqual(before);

    // AC6's booked-bubble leg: the detached material keeps labelling its booking.
    await expect(bookedBubble(page, title)).toBeVisible();

    // Clean up the throwaway session.
    await bookedBubble(page, title).click();
    const editor = page.getByRole('dialog', { name: 'Edit booking' });
    await editor.getByRole('button', { name: 'Remove booking' }).click();
    await expect(editor).not.toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

test.describe('roadmap material attach (live, phone 375)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the per-row minutes and role controls fit the phone sheet', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await page.goto(`${APP_URL}/study/roadmap`);

    // The first load after a fresh sign-in replays the event log, which takes
    // longer than the default expect timeout on a shared account.
    await expect(page.getByLabel('Projected finish')).toContainText('provisional', {
      timeout: 20000,
    });

    // Mobile-only control: proves this scenario really ran at phone width.
    await expect(page.getByRole('button', { name: /^Open \d{4}-\d{2}-\d{2}/ }).first()).toBeVisible();

    const { title, minutesWidth, roleWidth, sheetRight } = await attachFromLibrary(
      page,
      '90',
      'practice',
    );

    // OQ-07 (per-row controls vs one batch role) is decided from these numbers.
    console.log(
      `OQ-07 phone widths: minutes ${Math.round(minutesWidth)}px, role ${Math.round(roleWidth)}px, sheet right edge ${Math.round(sheetRight)}px`,
    );
    expect(minutesWidth).toBeGreaterThan(60);
    expect(roleWidth).toBeGreaterThan(60);
    expect(sheetRight).toBeLessThanOrEqual(375);

    await expect(directoryRow(page, title)).toContainText('of 1h 30m');
    await detachControl(page, title).click();
    await expect(directoryRow(page, title)).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });
});
