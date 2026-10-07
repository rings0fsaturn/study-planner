import { expect, type Page } from '@playwright/test';
import { test } from './fixtures';

/**
 * Coach sources overflow regression (practice-coach-sources-overflow).
 *
 * A deterministic five-quote guide stream (mocked `/v1/guide/stream` SSE with
 * the exact server frame shapes) drives the real `PracticeCoach` on a real
 * one-problem run: with sources open the card must stay inside the viewport,
 * the citations list must scroll internally, and the summary must toggle by
 * pointer and keyboard while Dismiss / Go deeper stay reachable.
 *
 * Live-gated like `practice-guide-live.spec.ts`: needs E2E_LIVE_EMAIL /
 * E2E_LIVE_PASSWORD plus SUPABASE_SERVICE_ROLE_KEY for the assessment
 * cleanup. The question generation itself is live (one problem); only the
 * hint stream is mocked so the quotes are deterministic.
 *
 *   pnpm exec playwright test -c e2e/playwright.config.ts e2e/practice-coach-overflow.spec.ts --project=app --workers=1
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
const PROBLEMS = 1;
const GENERATION_WAIT_MS = 300_000;
const EVIDENCE_DIR = '.work/active/practice-coach-sources-overflow/plan/evidence';

const QUOTE_BODY =
  'Performance is judged on both financial and non-financial measures, and the variance ' +
  'analysis identifies which critical success factor the shortfall actually comes from in the ' +
  'case period under review, quoted here at length to force the disclosure past the viewport. ';

const MOCK_QUOTES = Array.from(
  { length: 5 },
  (_, index) => `E2E overflow probe quote ${index}: ${QUOTE_BODY}`,
);

/** Canned SSE body using the exact server `GuideFrame` shapes (start/delta/citation/done). */
function mockStreamBody(): string {
  const frames = [
    { frame: 'start', sequence: 0, correlationId: 'overflow-probe', text: '' },
    {
      frame: 'delta',
      sequence: 1,
      correlationId: 'overflow-probe',
      text: 'What does this line do to each character in the passage?',
    },
    {
      frame: 'citation',
      sequence: 2,
      correlationId: 'overflow-probe',
      citations: MOCK_QUOTES.map((quote, index) => ({
        chunkId: `probe-chunk-${index}`,
        materialId: MATERIAL_ID,
        quote,
      })),
    },
    { frame: 'done', sequence: 3, correlationId: 'overflow-probe' },
  ];
  return frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('');
}

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

/** Delete the assessment this check created; fails loudly without the service-role key. */
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

const coach = (page: Page) => page.getByRole('region', { name: 'Practice coach' });

/** Open the coach with the mocked five-quote stream and open the sources disclosure. */
async function openCoachWithSources(page: Page): Promise<void> {
  await page.route('**/v1/guide/stream', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: mockStreamBody(),
    });
  });
  await page
    .getByRole('region', { name: 'Problem 1' })
    .getByRole('button', { name: /stuck/i })
    .click();
  const card = coach(page);
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.getByRole('button', { name: 'Yes, help me' }).click();
  await expect(card.getByRole('button', { name: 'Go deeper' })).toBeEnabled({ timeout: 30000 });
  await expect(card.locator('.coach-body')).not.toBeEmpty();
  // NOTE: <summary> exposes no button role in the Chromium accessibility tree,
  // so the user-visible disclosure label is the locator (scoped to the card).
  await card.getByText('5 sources').click();
  await expect(card.getByText(/E2E overflow probe quote 4/)).toBeVisible();
}

async function expectContainedCard(page: Page, evidenceName: string): Promise<void> {
  const card = coach(page);
  const box = await card.boundingBox();
  const viewport = page.viewportSize();
  expect(box, 'the open coach card must have a rect').not.toBeNull();
  expect(viewport, 'the viewport must be known').not.toBeNull();
  const inViewport = (
    name: string,
    rect: { x: number; y: number; width: number; height: number },
  ): void => {
    expect(rect.x, `${name} left edge inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(rect.y, `${name} top stays inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width, `${name} right edge inside the viewport`).toBeLessThanOrEqual(
      viewport!.width,
    );
    expect(rect.y + rect.height, `${name} bottom stays inside the viewport`).toBeLessThanOrEqual(
      viewport!.height,
    );
  };
  inViewport('card', box!);
  const listBox = await card.locator('.coach-citations ul').boundingBox();
  expect(listBox, 'the citations list must have a rect').not.toBeNull();
  expect(listBox!.y, 'list top stays inside the card').toBeGreaterThanOrEqual(box!.y);
  expect(
    listBox!.y + listBox!.height,
    'list bottom stays inside the card',
  ).toBeLessThanOrEqual(box!.y + box!.height);
  const scroll = await card
    .locator('.coach-citations ul')
    .evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
  expect(scroll.scrollHeight, 'the five-quote list scrolls internally').toBeGreaterThan(
    scroll.clientHeight,
  );
  for (const name of ['Dismiss practice coach', 'Go deeper', 'Got it'] as const) {
    const action = card.getByRole('button', { name });
    await expect(action).toBeVisible();
    const actionBox = await action.boundingBox();
    expect(actionBox, `${name} must have a rect`).not.toBeNull();
    inViewport(name, actionBox!);
  }
  await page.screenshot({ path: `${EVIDENCE_DIR}/${evidenceName}` });
}

/** Pointer close/reopen plus a fully keyboard-driven toggle (Tab from Dismiss, Enter, Space). */
async function expectDisclosureToggle(page: Page): Promise<void> {
  const card = coach(page);
  const details = card.locator('details.coach-citations');
  const summary = card.getByText('5 sources');
  const quote = card.getByText(/E2E overflow probe quote 4/);
  await summary.click();
  await expect(details).not.toHaveAttribute('open', '');
  await expect(quote).toBeHidden();
  await summary.click();
  await expect(quote).toBeVisible();
  await card.getByRole('button', { name: 'Dismiss practice coach' }).focus();
  await page.keyboard.press('Tab');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(details).not.toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(quote).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(details).not.toHaveAttribute('open', '');
}

test.describe('coach sources overflow (desktop 1280)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 30_000 });

  test('open sources stay in viewport, scroll, and collapse by pointer and keyboard', async ({
    page,
    errors,
  }) => {
    test.setTimeout(900_000);
    const testStartedAt = new Date().toISOString();
    let failure: unknown;
    try {
      await signIn(page);
      await startRun(page);
      await expect(page.getByRole('region', { name: 'Problem 1' })).toBeVisible({
        timeout: GENERATION_WAIT_MS,
      });
      await openCoachWithSources(page);
      await expectContainedCard(page, 'coach-e2e-open-1280.png');
      await expectDisclosureToggle(page);
      expect(errors()).toEqual([]);
    } catch (error) {
      failure = error;
    }
    try {
      await cleanupRunAssessments(testStartedAt);
    } catch (error) {
      console.warn(`[coach-overflow] cleanup failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});

test.describe('coach sources overflow (phone 375)', () => {
  test.use({ viewport: { width: 375, height: 812 }, actionTimeout: 30_000 });

  test('open sources stay in viewport with reachable actions', async ({ page, errors }) => {
    test.setTimeout(900_000);
    const testStartedAt = new Date().toISOString();
    let failure: unknown;
    try {
      await signIn(page);
      await startRun(page);
      await expect(page.getByRole('region', { name: 'Problem 1' })).toBeVisible({
        timeout: GENERATION_WAIT_MS,
      });
      await openCoachWithSources(page);
      await expectContainedCard(page, 'coach-e2e-open-375.png');
      await expectDisclosureToggle(page);
      for (const name of ['Dismiss practice coach', 'Go deeper', 'Got it'] as const) {
        const height = (await coach(page).getByRole('button', { name }).boundingBox())!.height;
        expect(height, `${name} meets the 44px phone touch target`).toBeGreaterThanOrEqual(44);
      }
      expect(errors()).toEqual([]);
    } catch (error) {
      failure = error;
    }
    try {
      await cleanupRunAssessments(testStartedAt);
    } catch (error) {
      console.warn(`[coach-overflow] cleanup failed: ${String(error)}`);
      if (failure == null) failure = error;
    }
    if (failure != null) throw failure;
  });
});
