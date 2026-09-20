import { expect, type Page } from '@playwright/test';
import { test } from './fixtures';

/**
 * Live mastery and adaptive-difficulty check (issue #43, Phase 6) against the
 * real stack.
 *
 * Two self-contained scenarios:
 *   (a) the stateless projection contract: a seeded graded observation is
 *       inserted through PostgREST (service role), `/v1/mastery` reports the
 *       fresh per-skill projection (single correct -> mastery ~0.51, still
 *       uncertain, modelVersion `bkt-v1`), a second GET returns byte-identical
 *       output (rebuildable), `/v1/mastery/recommendations` moves one band
 *       down from the mid band (target ~0.7 expected correctness), and the
 *       row's deletion makes the projection disappear again (no server store).
 *   (b) the Adaptive practice surface: the Practice-this page for the frozen
 *       ACCA material renders an enabled Adaptive difficulty chip, and
 *       selecting it is honoured.
 *
 * The seeded attempt targets an existing pre-owned assessment of the frozen
 * ACCA material (the account's own history) and is deleted by its marker
 * client_attempt_id afterwards; only rows this spec created are touched.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source; the
 * credentials-file values are backtick-wrapped, so they are stripped here)
 * plus SUPABASE_SERVICE_ROLE_KEY, the managed runtime, and the app at 5173:
 *   ./full-app start full
 * Restart the runtime before re-running after app edits (WSL staleness,
 * rule 53). No generation and no GPU sidecar are needed: mastery is a pure
 * read over durable grades, and the chip check does not start a run.
 *
 * Run scoped to the React app project with one worker:
 *   pnpm exec playwright test -c e2e/playwright.config.ts e2e/mastery-live.spec.ts --project=app --workers=1
 * (No `--` separator: options after it are read as test-file filters.)
 */
const APP_URL = 'http://localhost:5173';
const INTELLIGENCE_URL = process.env.VITE_INTELLIGENCE_URL ?? 'http://127.0.0.1:8000';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://kabpmbhlvfbrhtbxjaua.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
/** The frozen ACCA corpus material; its existing assessments are the account's history. */
const ACCA_MATERIAL_ID = '80c8b138-b544-4095-8dc0-1c390ac70da2';
/** Distinctive per-run marker so cleanup can never touch another window. */
const SKILL_TAG = 'E2E mastery probe';
/** Structural keys that must never reach a response. */
const REDACTION_RE = /answerBlock|answer_block|referenceSolution|reference_solution|hiddenTests|hidden_tests/i;

const clean = (raw: string | undefined): string => (raw ?? '').replace(/[`"']/g, '').trim();
const EMAIL = clean(process.env.E2E_LIVE_EMAIL);
const PASSWORD = clean(process.env.E2E_LIVE_PASSWORD);

test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

function serviceHeaders(): Record<string, string> {
  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
}

async function userToken(): Promise<string> {
  if (!PUBLISHABLE_KEY) throw new Error('SUPABASE_PUBLISHABLE_KEY not set');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  expect(response.ok, `sign-in failed: ${response.status}`).toBe(true);
  const body = (await response.json()) as { access_token?: string };
  expect(body.access_token).toBeTruthy();
  return body.access_token as string;
}

async function mastery(token: string, query = ''): Promise<unknown> {
  const response = await fetch(`${INTELLIGENCE_URL}/v1/mastery${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok, `mastery failed: ${response.status}`).toBe(true);
  return response.json();
}

function walkKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const child of value) walkKeys(child, keys);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      keys.push(key);
      walkKeys(child, keys);
    }
  }
  return keys;
}

async function seedObservation(marker: string): Promise<string> {
  const assessments = (await (
    await fetch(
      `${SUPABASE_URL}/rest/v1/assessments?material_id=eq.${ACCA_MATERIAL_ID}&select=id&limit=1&order=created_at.desc`,
      { headers: serviceHeaders() },
    )
  ).json()) as Array<{ id: string }>;
  expect(assessments.length, 'the ACCA material must carry a pre-existing assessment').toBeGreaterThan(0);
  const assessmentId = assessments[0].id;
  const questions = (await (
    await fetch(`${SUPABASE_URL}/rest/v1/questions?assessment_id=eq.${assessmentId}&select=id&limit=1`, {
      headers: serviceHeaders(),
    })
  ).json()) as Array<{ id: string }>;
  expect(questions.length).toBeGreaterThan(0);
  const questionId = questions[0].id;

  const users = (await (
    await fetch(`${SUPABASE_URL}/rest/v1/question_attempts?select=user_id&limit=1`, {
      headers: serviceHeaders(),
    })
  ).json()) as Array<{ user_id: string }>;
  expect(users.length).toBeGreaterThan(0);

  const { randomUUID } = await import('node:crypto');
  const attemptId = randomUUID();
  const row = {
    id: attemptId,
    client_attempt_id: marker,
    user_id: users[0].user_id,
    assessment_id: assessmentId,
    question_id: questionId,
    answer: { index: 0 },
    status: 'graded',
    correlation_id: marker,
    job_id: null,
    submitted_at: '2026-09-20T00:00:00Z',
    graded_at: '2026-09-20T00:01:00Z',
    grade: {
      score: 1.0,
      correct: true,
      grader: 'objective',
      perSkill: [{ score: 1.0, correct: true, skillTag: SKILL_TAG }],
      attemptId,
      questionId,
      materialId: ACCA_MATERIAL_ID,
    },
  };
  const response = await fetch(`${SUPABASE_URL}/rest/v1/question_attempts`, {
    method: 'POST',
    headers: { ...serviceHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  expect(response.ok, `attempt seed failed: ${response.status} ${await response.text()}`).toBe(true);
  return marker;
}

async function cleanupObservation(marker: string): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/question_attempts?client_attempt_id=eq.${marker}`,
    { method: 'DELETE', headers: { ...serviceHeaders(), Prefer: 'return=minimal' } },
  );
  expect(response.ok, `attempt cleanup failed: ${response.status}`).toBe(true);
}

test.describe('mastery live', () => {
  test('rebuildable projection and one-band recommendation over a fresh grade', async () => {
    const token = await userToken();
    const marker = `e2e-mastery-${Date.now()}`;
    const query = `?materialId=${ACCA_MATERIAL_ID}&skillTag=${encodeURIComponent(SKILL_TAG)}`;

    await expect
      .poll(async () => (await mastery(token, query)) as unknown[])
      .toHaveLength(0, { timeout: 15_000 });

    await seedObservation(marker);

    await expect
      .poll(
        async () => {
          const projections = (await mastery(token, query)) as Array<Record<string, unknown>>;
          return projections;
        },
        { timeout: 30_000 },
      )
      .toHaveLength(1);

    const projections = (await mastery(token, query)) as Array<Record<string, unknown>>;
    const projection = projections[0];
    expect(projection.skillTag).toBe(SKILL_TAG);
    expect(projection.materialId).toBe(ACCA_MATERIAL_ID);
    expect(projection.n).toBe(1);
    // One correct at cold start: mastery ~0.51, still uncertain (bake-off
    // parameters; a single observation must not claim mastery).
    expect(projection.mastery as number).toBeGreaterThan(0.4);
    expect(projection.mastery as number).toBeLessThan(0.6);
    expect(projection.uncertainty as number).toBeGreaterThan(0.9);
    expect(projection.confidence as number).toBe(1 - (projection.uncertainty as number));
    expect(projection.modelVersion).toBe('bkt-v1');
    for (const key of walkKeys(projections)) {
      expect(key).not.toMatch(REDACTION_RE);
    }

    // Rebuildable: a second, independent GET returns the identical projection.
    expect(await mastery(token, query)).toEqual(projections);

    // One-band recommendation targeting ~0.7: mastery 0.51 < 0.65 -> one band
    // easier, with model-version context, never more than one step.
    const recommendations = (await mastery(
      token,
      `/recommendations${query}&currentBand=3`,
    )) as Array<Record<string, unknown>>;
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].currentBand).toBe(3);
    expect(recommendations[0].recommendedBand).toBe(2);
    expect(recommendations[0].targetExpectedCorrectness).toBe(0.7);
    expect(recommendations[0].modelVersion).toBe('bkt-v1');
    for (const key of walkKeys(recommendations)) {
      expect(key).not.toMatch(REDACTION_RE);
    }

    // No server store: deleting the durable row removes the projection.
    await cleanupObservation(marker);
    await expect
      .poll(async () => (await mastery(token, query)) as unknown[])
      .toHaveLength(0, { timeout: 15_000 });
  });

  test('adaptive difficulty is selectable on the practice page', async ({ page }: { page: Page }) => {
    await page.goto(`${APP_URL}/study/sign-in`);
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 90_000 });
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`${APP_URL}/study/materials/${ACCA_MATERIAL_ID}/practice`);
    await expect(page.getByRole('button', { name: 'Start practice run' })).toBeVisible({
      timeout: 30_000,
    });

    const adaptive = page.getByRole('button', { name: 'Adaptive', exact: true });
    await expect(adaptive).toBeEnabled();
    await adaptive.click();
    await expect(adaptive).toHaveClass(/selected/);
    await expect(page.getByText(/one band at a time/)).toBeVisible();
  });
});