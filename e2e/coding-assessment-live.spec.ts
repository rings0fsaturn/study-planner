import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from './fixtures';

/**
 * Live coding assessment check (issue #42, Phase 5) against the real stack.
 *
 * Three scenarios, each fully self-contained and seeded through PostgREST with
 * the service-role key (the P4 recipe, plan/VERIFICATION.md "P5 notes"):
 *   (a) an `implement_fn` question end to end: CodeMirror renders the starter,
 *       the Pyodide advisory fails and then passes honestly, a SyntaxError
 *       submission grades fail-closed 0 ("Your code did not compile.") via the
 *       real Piston sandbox, a mid-grading reload resumes through the server
 *       refresh loop, retry mints a fresh attempt, the corrected source scores
 *       1.00, and the review renders the veiled `Hidden test N` table.
 *   (b) an `output_prediction` question: read-only snippet + numeric input,
 *       deterministic objective grade, no sandbox contact (the worker's
 *       `grading.piston` verdict log line count must not move).
 *   (c) the coding flow at 375 px: advisory, sandbox grade, veiled review
 *       table, zero horizontal overflow.
 *
 * Hidden-content veil (AC4): the seeded `answer_block` carries distinctive
 * markers (a reference-solution comment, a hidden test name, a hidden stdin)
 * and the spec sweeps every /rest/v1 and /v1 response body plus the rendered
 * DOM for them. Generation itself is NOT exercised here: the LLM picks the
 * coding subtype with no UI steer (P3 decision), so the deterministic live
 * coverage is seeded rows; generation quality was proven in the P3 dry run.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source; the
 * credentials-file values are backtick-wrapped, so they are stripped here
 * defensively) plus SUPABASE_SERVICE_ROLE_KEY (seeding + cleanup), the managed
 * runtime (worker drains the assessment_grade queue) and the demand-started
 * sandbox:
 *   ./full-app start full
 *   docker compose --profile sandbox up -d
 * A stopped sandbox makes coding grades retryable, never silent; restart the
 * runtime before re-running after app edits (WSL staleness, rule 53).
 *
 * Mutates the shared dev account by design (one material + assessment per
 * scenario) and puts it back: the seeded material is deleted by id and the
 * cascade (assessments -> questions -> question_attempts, ingestion_jobs,
 * materials_chunks) is verified empty. Stale rows from failed runs are swept
 * by title prefix at scenario start. The frozen ACCA corpus is never touched.
 *
 * Run scoped to the React app project with one worker:
 *   pnpm exec playwright test -c e2e/playwright.config.ts e2e/coding-assessment-live.spec.ts --project=app --workers=1
 * (No `--` separator: options after it are read as test-file filters.)
 */
const APP_URL = 'http://localhost:5173';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://kabpmbhlvfbrhtbxjaua.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
/** The credentials file wraps values in backticks; never send them raw. */
const clean = (raw: string | undefined): string => (raw ?? '').replace(/[`"']/g, '').trim();
const EMAIL = clean(process.env.E2E_LIVE_EMAIL);
const PASSWORD = clean(process.env.E2E_LIVE_PASSWORD);
const EVIDENCE_DIR = '.work/active/issue-42-coding-assessment-sandbox-grading/plan/evidence';
const WORKER_LOG = join(process.cwd(), '.dev', 'full-app', 'logs', 'worker.log');
/** Structural keys + the seeded markers; none may reach a response or the DOM. */
const REDACTION_RE =
  /answerBlock|answer_block|referenceSolution|reference_solution|hiddenTests|hidden_tests|ref-only-77a1|H7f3aX|99 99/i;
/** Piston verdict lines the grading worker writes per executed test (D-11). */
const PISTON_LINE = 'piston execution attempt=';
/** The sandbox grade takes seconds per test; the poll window honors that. */
const GRADE_WAIT_MS = 120_000;
const ADVISORY_WAIT_MS = 120_000;

/** The authored tests both the advisory and the sandbox run (stdin -> stdout). */
const VISIBLE_TESTS = [
  { name: 'adds 1 + 2', stdin: '1 2', expectedOutput: '3' },
  { name: 'adds 10 + 20', stdin: '10 20', expectedOutput: '30' },
];
/** Hidden side lives in answer_block; the names/stdin are the veil markers. */
const ANSWER_BLOCK = {
  referenceSolution:
    '# ref-only-77a1\ndef main():\n    a, b = map(int, input().split())\n    print(a + b)\n\nmain()\n',
  hiddenTests: [
    { name: 'H7f3aX', stdin: '99 99', expectedOutput: '198' },
    { name: 'h5 7', stdin: '5 7', expectedOutput: '12' },
  ],
};
const STARTER_CODE = 'def main():\n    a, b = map(int, input().split())\n    print(a - b)\n\nmain()\n';
/** A SyntaxError submission: the fail-closed compile-error drill. */
const SYNTAX_BROKEN_SOURCE = 'def main(:\n    a, b = map(int, input().split())\n    print(a - b)\n\nmain()\n';
const CORRECT_SOURCE = 'def main():\n    a, b = map(int, input().split())\n    print(a + b)\n\nmain()\n';

test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');
test.skip(!SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY not set; cannot seed or clean up');

function serviceHeaders(): Record<string, string> {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
}

/**
 * The signed-in account's user id, read from the session the app itself
 * stored. Authoritative: Gmail dot-aliasing means several auth rows share one
 * inbox, and the admin-users listing cannot be matched reliably (verified live
 * 2026-09-19). The seeded rows must carry this exact id or RLS hides them.
 */
async function signedInUserId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('sb-kabpmbhlvfbrhtbxjaua-auth-token');
    if (!raw) throw new Error('supabase session missing from localStorage');
    const parsed = JSON.parse(raw) as { user?: { id?: unknown } };
    if (typeof parsed?.user?.id !== 'string') {
      throw new Error('supabase session carries no user id');
    }
    return parsed.user.id;
  });
}

async function supabasePost(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: { ...serviceHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed: HTTP ${response.status} ${await response.text()}`);
  }
}

/** One implement_fn question ready for the taker, seeded under `prefix`. */
async function seedImplementFn(userId: string, prefix: string): Promise<{ materialId: string; assessmentId: string }> {
  const materialId = `${prefix}-mat-${Date.now()}`;
  const assessmentId = `${prefix}-ass-${Date.now()}`;
  await supabasePost('/rest/v1/materials', {
    id: materialId,
    user_id: userId,
    client_id: crypto.randomUUID(),
    title: `E2E#42 ${prefix}`,
    kind: 'manual',
    source: '',
    ingestion_state: 'ready',
    ingestion_progress: 0,
    archived: false,
    content_version: 'e2e-v1',
    has_code: true,
    code_languages: ['python'],
  });
  await supabasePost('/rest/v1/assessments', {
    id: assessmentId,
    user_id: userId,
    client_id: crypto.randomUUID(),
    material_id: materialId,
    recipe: { formats: ['coding'], questionCount: 1, difficulty: 2, skillTags: ['core'] },
    status: 'ready',
    warnings: [],
    correlation_id: crypto.randomUUID(),
  });
  await supabasePost('/rest/v1/questions', {
    id: crypto.randomUUID(),
    assessment_id: assessmentId,
    user_id: userId,
    material_id: materialId,
    format: 'coding',
    subtype: 'implement_fn',
    prompt: 'Write a program that reads two integers a and b from stdin and prints their sum.',
    options: [],
    skill_tags: ['core'],
    authored_difficulty: 2,
    citations: [],
    answer_block: ANSWER_BLOCK,
    language: 'python',
    starter_code: STARTER_CODE,
    visible_tests: VISIBLE_TESTS,
  });
  return { materialId, assessmentId };
}

/** One output_prediction question: snippet + acceptedValue, no visible tests. */
async function seedOutputPrediction(userId: string): Promise<{ materialId: string; assessmentId: string }> {
  const materialId = `e2e42-pred-mat-${Date.now()}`;
  const assessmentId = `e2e42-pred-ass-${Date.now()}`;
  await supabasePost('/rest/v1/materials', {
    id: materialId,
    user_id: userId,
    client_id: crypto.randomUUID(),
    title: 'E2E#42 output_prediction',
    kind: 'manual',
    source: '',
    ingestion_state: 'ready',
    ingestion_progress: 0,
    archived: false,
    content_version: 'e2e-v1',
    has_code: true,
    code_languages: ['python'],
  });
  await supabasePost('/rest/v1/assessments', {
    id: assessmentId,
    user_id: userId,
    client_id: crypto.randomUUID(),
    material_id: materialId,
    recipe: { formats: ['coding'], questionCount: 1, difficulty: 2, skillTags: ['core'] },
    status: 'ready',
    warnings: [],
    correlation_id: crypto.randomUUID(),
  });
  await supabasePost('/rest/v1/questions', {
    id: crypto.randomUUID(),
    assessment_id: assessmentId,
    user_id: userId,
    material_id: materialId,
    format: 'coding',
    subtype: 'output_prediction',
    prompt: 'Predict the output the snippet prints.',
    options: [],
    skill_tags: ['core'],
    authored_difficulty: 1,
    citations: [],
    answer_block: { acceptedValue: 6 },
    language: 'python',
    starter_code: 'print(2 * 3)\n',
  });
  return { materialId, assessmentId };
}

/**
 * Delete the seeded material by id and verify the cascade emptied its
 * assessments, questions, attempts, and jobs. Fails loudly when the
 * service-role key is missing rather than leaving rows behind.
 */
async function cleanupSeeded(materialId: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/materials?id=eq.${materialId}`, {
    method: 'DELETE',
    headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
  });
  if (!response.ok) throw new Error(`material cleanup failed: HTTP ${response.status}`);
  const remaining = await fetch(`${SUPABASE_URL}/rest/v1/materials?id=eq.${materialId}&select=id`, {
    headers: serviceHeaders(),
  });
  expect(await remaining.json(), 'the seeded material must be gone after cleanup').toEqual([]);
  const assessmentRows = (await (
    await fetch(`${SUPABASE_URL}/rest/v1/assessments?material_id=eq.${materialId}&select=id`, {
      headers: serviceHeaders(),
    })
  ).json()) as Array<{ id: string }>;
  expect(assessmentRows, 'assessments cascade with their material').toEqual([]);
  const questions = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?material_id=eq.${materialId}&select=id`,
    { headers: serviceHeaders() },
  );
  expect(await questions.json(), 'questions cascade with their material').toEqual([]);
  if (assessmentRows.length > 0) {
    const attempts = await fetch(
      `${SUPABASE_URL}/rest/v1/question_attempts?select=id&assessment_id=in.(${assessmentRows
        .map((row) => row.id)
        .join(',')})`,
      { headers: serviceHeaders() },
    );
    expect(await attempts.json(), 'attempts cascade with their material').toEqual([]);
  }
}

/** Sweep leftovers of failed runs (title prefix) before seeding fresh rows. */
async function sweepPrevious(title: string): Promise<void> {
  const listing = await fetch(
    `${SUPABASE_URL}/rest/v1/materials?select=id&title=like.${encodeURIComponent(`E2E#42 ${title}*`)}`,
    { headers: serviceHeaders() },
  );
  if (!listing.ok) return;
  const rows = (await listing.json()) as Array<{ id: string }>;
  for (const row of rows) {
    await fetch(`${SUPABASE_URL}/rest/v1/materials?id=eq.${row.id}`, {
      method: 'DELETE',
      headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
    });
  }
}

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 90000 });
  // Let the authenticated shell settle before navigating again: a goto issued
  // mid-restore gets bounced back by the auth gate.
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({
    timeout: 30000,
  });
}

/** The lazy CodeMirror host; waits out the chunk load. */
function codingEditor(page: Page) {
  return page.getByRole('textbox', { name: 'Your code' });
}

/** Replace the whole editor document (per-key typing is mangled by indentOnInput). */
async function typeSource(page: Page, source: string): Promise<void> {
  const editor = codingEditor(page);
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}

/** Run the advisory and wait for both visible-test verdicts to render. */
async function runAdvisory(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Run visible tests' }).click();
  await expect(page.getByText('adds 1 + 2')).toBeVisible({ timeout: ADVISORY_WAIT_MS });
  await expect(page.getByText('adds 10 + 20')).toBeVisible({ timeout: ADVISORY_WAIT_MS });
  await expect(page.getByRole('button', { name: 'Run visible tests' })).toBeEnabled({
    timeout: ADVISORY_WAIT_MS,
  });
}

/** Buffer every /rest/v1 and /v1 body so the redaction sweep covers responses. */
function watchResponses(page: Page): () => string[] {
  const bodies: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (!/\/rest\/v1\/|\/v1\/assessments|\/v1\/attempts/.test(url)) return;
    void response.text().then((body) => {
      if (body.length < 1_000_000) bodies.push(body);
    });
  });
  return () => bodies;
}

/** The veil + structural redaction gate over responses and the rendered DOM. */
async function assertRedaction(page: Page, bodies: () => string[]): Promise<void> {
  expect(bodies().join('\n'), 'no response body may carry hidden content').not.toMatch(REDACTION_RE);
  expect(await page.locator('body').innerText(), 'no rendered DOM may carry hidden content').not.toMatch(
    REDACTION_RE,
  );
}

async function pistonExecutionCount(): Promise<number> {
  try {
    const content = await readFile(WORKER_LOG, 'utf8');
    return content.split('\n').filter((line) => line.includes(PISTON_LINE)).length;
  } catch {
    return -1;
  }
}

test.describe('coding assessment live (#42)', () => {
  test('implement_fn: advisory, fail-closed compile error, mid-grading reload resume, retry, sandbox grade, hidden veil', async ({
    page,
    errors,
  }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await sweepPrevious('implement');
    await signIn(page);
    const userId = await signedInUserId(page);
    const { materialId, assessmentId } = await seedImplementFn(userId, 'e2e42-impl');
    const bodies = watchResponses(page);

    try {
      await page.goto(`${APP_URL}/study/assessments/${assessmentId}`);
      await expect(page.getByRole('heading', { name: 'Coding assessment' })).toBeVisible({
        timeout: 60000,
      });
      const editor = codingEditor(page);
      await expect(editor).toBeVisible({ timeout: 60000 });
      // Desktop-only assertion (rule 16): the coding surface owns the card
      // width; the 375 px scenario cannot reach this.
      const editorBox = await editor.boundingBox();
      expect(editorBox?.width ?? 0).toBeGreaterThan(600);
      await expect(page.getByText(/graded against hidden tests on the server/)).toBeVisible();
      await expect(page.getByText('Advisory - the server grade is authoritative.')).toBeVisible();

      // The starter is deliberately wrong: both the advisory and the server
      // must judge it honestly.
      await runAdvisory(page);
      const failedVerdict = page.getByText(/adds 1 \+ 2/);
      await expect(failedVerdict).not.toContainText('passed');

      // Fail-closed drill: a SyntaxError submission scores 0 with honest copy.
      await typeSource(page, SYNTAX_BROKEN_SOURCE);
      await page.getByRole('button', { name: 'Submit answer' }).click();
      await expect(page.getByText('Your code did not compile.')).toBeVisible({
        timeout: GRADE_WAIT_MS,
      });
      await expect(page.getByRole('table', { name: 'Test results' })).toBeVisible();
      await expect(page.getByText('Hidden test 1')).toBeVisible();
      await expect(page.getByText('Hidden test 2')).toBeVisible();

      // Retry: fresh attempt, editor back to the starter.
      await page.getByRole('button', { name: 'Retry question' }).click();
      await expect(codingEditor(page)).toBeVisible({ timeout: 60000 });
      await typeSource(page, CORRECT_SOURCE);

      // Advisory agrees with the server on the corrected source.
      await runAdvisory(page);
      await expect(page.getByText(/adds 1 \+ 2/)).toContainText('passed');
      await expect(page.getByText(/adds 10 \+ 20/)).toContainText('passed');

      // Submit and reload while the sandbox grade is in flight: the sandbox
      // grades in ~250 ms of the worker picking the message up (measured), so
      // no in-flight text is assertable - the deterministic commit signal is
      // the POST /attempts response. The server refresh loop must resume and
      // drain the attempt after the reload.
      const submit = page.getByRole('button', { name: 'Submit answer' });
      const committed = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/attempts($|\?)/.test(response.url()),
      );
      await submit.click();
      await committed;
      await page.reload();

      // Resume: either the skeleton (still in flight) or the graded card; the
      // durable end state is the veiled review table.
      const table = page.getByRole('table', { name: 'Test results' });
      await expect(table).toBeVisible({ timeout: GRADE_WAIT_MS });
      await expect(page.getByText('Passed 2/2 hidden tests.')).toBeVisible();
      await expect(page.getByText('Hidden test 1')).toBeVisible();
      await expect(page.getByText('Hidden test 2')).toBeVisible();
      await expect(page.getByLabel('Your submitted code')).toBeVisible();
      // The learner's own corrected source restored after the reload.
      await expect(page.getByText('print(a + b)').first()).toBeVisible();
      // Both attempts preserved in history (append-only retry contract).
      const history = page.locator('[aria-label="Attempt history"]');
      await expect(history).toBeVisible();
      await expect(history.locator('.ar-attempt:not(.is-queued)')).toHaveCount(2);
      await expect(page.getByRole('region', { name: 'Assessment summary' })).toContainText(
        '1 of 1 questions correct',
      );

      await assertRedaction(page, bodies);
      await page.screenshot({ path: `${EVIDENCE_DIR}/p5-impl-desktop.png`, fullPage: true });
      expect(errors()).toEqual([]);
    } finally {
      await cleanupSeeded(materialId);
    }
  });

  test('output_prediction: deterministic grade without any sandbox contact', async ({
    page,
    errors,
  }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await sweepPrevious('output_prediction');
    await signIn(page);
    const userId = await signedInUserId(page);
    const { materialId, assessmentId } = await seedOutputPrediction(userId);
    const bodies = watchResponses(page);

    try {
      await page.goto(`${APP_URL}/study/assessments/${assessmentId}`);
      await expect(page.getByRole('heading', { name: 'Coding assessment' })).toBeVisible({
        timeout: 60000,
      });
      await expect(page.getByLabel('Code snippet')).toContainText('print(2 * 3)');
      const prediction = page.getByLabel('Predicted output');
      await expect(prediction).toBeVisible();
      // No editor, no advisory: this subtype never runs code (D-01).
      await expect(codingEditor(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Run visible tests' })).toHaveCount(0);

      const executionsBefore = await pistonExecutionCount();
      await prediction.fill('6');
      await page.getByRole('button', { name: 'Submit answer' }).click();
      await expect(page.getByText('Correct.')).toBeVisible({ timeout: GRADE_WAIT_MS });
      await expect(page.getByText('Your prediction: 6')).toBeVisible();
      await expect(page.getByRole('table', { name: 'Test results' })).toHaveCount(0);

      await assertRedaction(page, bodies);
      const executionsAfter = await pistonExecutionCount();
      expect(
        executionsAfter,
        'output_prediction must not execute anything in the sandbox',
      ).toBe(executionsBefore);
      await page.screenshot({
        path: `${EVIDENCE_DIR}/p5-prediction-desktop.png`,
        fullPage: true,
      });
      expect(errors()).toEqual([]);
    } finally {
      await cleanupSeeded(materialId);
    }
  });

  test('coding flow at 375: sandbox grade, veiled table, zero horizontal overflow', async ({
    page,
    errors,
  }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await sweepPrevious('implement-mobile');
    await signIn(page);
    const userId = await signedInUserId(page);
    const { materialId, assessmentId } = await seedImplementFn(userId, 'e2e42-impl-mobile');
    const bodies = watchResponses(page);

    try {
      await page.goto(`${APP_URL}/study/assessments/${assessmentId}`);
      await expect(page.getByRole('heading', { name: 'Coding assessment' })).toBeVisible({
        timeout: 60000,
      });
      await expect(codingEditor(page)).toBeVisible({ timeout: 60000 });

      await typeSource(page, CORRECT_SOURCE);
      await runAdvisory(page);
      await page.getByRole('button', { name: 'Submit answer' }).click();

      const table = page.getByRole('table', { name: 'Test results' });
      await expect(table).toBeVisible({ timeout: GRADE_WAIT_MS });
      await expect(page.getByText('Passed 2/2 hidden tests.')).toBeVisible();
      await expect(page.getByText('Hidden test 1')).toBeVisible();
      await expect(page.getByText('Hidden test 2')).toBeVisible();
      await expect(page.getByRole('region', { name: 'Assessment summary' })).toContainText(
        '1 of 1 questions correct',
      );

      // The mobile review must fit the 375 px viewport without page overflow.
      const overflow = await page.evaluate(
        () => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      await assertRedaction(page, bodies);
      await page.screenshot({ path: `${EVIDENCE_DIR}/p5-impl-mobile.png`, fullPage: true });
      expect(errors()).toEqual([]);
    } finally {
      await cleanupSeeded(materialId);
    }
  });
});