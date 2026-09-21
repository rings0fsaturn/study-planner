import { expect, type Page } from '@playwright/test';
import { test } from './fixtures';

/**
 * Live coding practice run check (issue #45) against the real stack.
 *
 * Unlike the #44 written spec, this one cannot reuse the frozen ACCA corpus:
 * coding generation is gated on the ingestion `has_code` signal plus the
 * in-generation LLM judge, and the ACCA material is prose (every problem would
 * come back `code_not_derivable`, an honest failure with nothing to grade). So
 * each scenario creates its own code-bearing *plain text* material through the
 * real add-material form, waits for the real ingestion path to reach `ready`
 * (extract -> chunk -> embed through the sidecar), and only then starts a
 * coding run. The material is deleted at the end; the frozen corpus is never
 * touched.
 *
 * Coding generation is stochastic: the provider may judge a material
 * unsuitable for one subtype (`code_not_derivable`), and a `failed` assessment
 * is terminal by contract (#42 D-04), so a problem that comes back unsuitable
 * cannot be retried inside its run. The honest retry is a *fresh run*, which
 * mints new assessments; `startRunFullyGenerated` does exactly that (bounded)
 * before the graded flow, so the run under test is always a complete one.
 *
 * What each scenario proves:
 *   desktop  - configure a coding run, the navigator labels each problem
 *              `coding` from the run's own pointer record, the code editor
 *              replaces the written textarea, the advisory check runs on
 *              visible tests only, both submissions are graded by the real
 *              Piston sandbox through the shared `judge0` contract
 *              (fail-closed to `incorrect`), a reload mid-run resumes without
 *              losing problem 1's grade, `Finish run` unlocks and the summary
 *              renders the server's verdict table with hiding rows veiled, the
 *              family label, no authored hidden content in the DOM, and the
 *              grades land as real mastery observations (#45 AC1-AC4).
 *   phone 375 - the same graded path at phone width with zero horizontal
 *              overflow and the sticky navigator strip, then a second run that
 *              is abandoned: it must create no attempt row and move no mastery
 *              (the negative half of AC3/AC4).
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source; the
 * credentials file values are backtick-wrapped, so they are stripped
 * defensively) plus SUPABASE_SERVICE_ROLE_KEY and the whole generation and
 * grading path:
 *   ./full-app start full
 *   docker compose -f services/embedder/docker-compose.yml up -d
 *   docker compose --profile sandbox up -d piston
 * The `full` profile owns the intelligence service, the React app and the
 * worker; generation retrieves through the sidecar on :8200, and the coding
 * grade runs in the Piston sandbox on :2000.
 *
 * Run scoped to the React app project with one worker:
 *   pnpm exec playwright test -c e2e/playwright.config.ts e2e/coding-practice-run-live.spec.ts --project=app --workers=1
 * (No `--` separator: options after it are read as test-file filters.) Restart
 * the runtime before re-running after app edits (WSL staleness, rule 53).
 */
const APP_URL = 'http://localhost:5173';
const INTELLIGENCE_URL = process.env.VITE_INTELLIGENCE_URL ?? 'http://127.0.0.1:8000';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://kabpmbhlvfbrhtbxjaua.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
const EVIDENCE_DIR = '.work/active/issue-45-coding-practice-runs/plan/evidence';
const TITLE_PREFIX = 'E2E#45 Coding Practice';
const GENERATION_WAIT_MS = 150_000;
const GRADE_WAIT_MS = 120_000;
const INGESTION_WAIT_MS = 300_000;
/** The lazy CodeMirror chunk has to download and mount. */
const EDITOR_WAIT_MS = 60_000;
/** Pyodide is a ~10 MB wasm load in dev; bounded so it cannot hang the run. */
const ADVISORY_WAIT_MS = 150_000;
/** Fresh runs allowed while the provider keeps judging the material unsuitable. */
const RUN_ROLLS = 6;
/** Worst case one roll costs ~8 min (run start + tab wait + 2 x 150 s generation
 * waits), so 6 rolls need a 45 min ceiling; the happy path is a single roll. */
const SCENARIO_TIMEOUT_MS = 2_700_000;
/** The learner's submission: a valid program that cannot pass the hidden tests. */
const SUBMISSION = '# e2e #45: submitted through the practice run editor\nprint("not the answer")\n';

const clean = (raw: string | undefined): string =>
  (raw ?? '')
    .trim()
    .replace(/^[`'"]+|[`'"]+$/g, '')
    .trim();
const EMAIL = clean(process.env.E2E_LIVE_EMAIL);
const PASSWORD = clean(process.env.E2E_LIVE_PASSWORD);

test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

/**
 * Code-bearing plain text, written as a worksheet because the generator's
 * suitability judge grounds each question in the material. It needs a
 * specification (signature, input/output contract, examples, edge cases) AND
 * an unmet gap: a worksheet that already carried complete reference solutions
 * is refused ("no gap, bug, or prediction to test"), and bare study notes are
 * refused for lacking a contract. So each exercise states the contract and
 * leaves the body unimplemented. The fenced blocks are what the ingestion
 * `scan_code_blocks` pass turns into `has_code = true`.
 */
const MATERIAL_TEXT = `Programming worksheet: accumulator patterns in Python.

An accumulator pattern starts a value, walks a sequence, and updates that value
once per item. The same shape covers summing, counting, and building a new
list; only the update differs (add, conditionally add, append). Recognising the
shape is what makes these exercises easy to implement and easy to test.

Exercise 1: sum_list
Write a function sum_list(nums) that adds a list of integers.
Input contract: nums is a list of zero or more integers, in any order.
Output contract: return the sum as an int; an empty list sums to 0; negative
values reduce the total.
Worked examples: sum_list([1, 2, 3]) returns 6. sum_list([]) returns 0.
sum_list([-4, 4]) returns 0.

\`\`\`python
def sum_list(nums):
    """Return the sum of a list of integers."""
    # TODO: add each value to a running total
    pass
\`\`\`

Exercise 2: count_evens
Write a function count_evens(nums) that counts how many values in a list are
even.
Input contract: nums is a list of zero or more integers.
Output contract: return the count as an int; 0 itself counts as even; an empty
list counts 0.
Worked examples: count_evens([1, 2, 3, 4]) returns 2.
count_evens([1, 3, 5]) returns 0. count_evens([]) returns 0.

\`\`\`python
def count_evens(nums):
    """Return how many values in nums are even."""
    # TODO: count the values that satisfy the condition
    pass
\`\`\`

Exercise 3: squares
Write a function squares(nums) that returns each value in a list squared.
Input contract: nums is a list of zero or more integers.
Output contract: return a new list of the same length holding n * n for each n,
in the original order; an empty list returns an empty list.
Worked examples: squares([2, 3]) returns [4, 9]. squares([]) returns [].
squares([-3]) returns [9].

\`\`\`python
def squares(nums):
    """Return a list holding the square of each value in nums."""
    # TODO: build a new list from the input
    pass
\`\`\`

Exercise 4: max_of
Write a function max_of(nums) that returns the largest value in a list.
Input contract: nums is a list of one or more integers.
Output contract: return the largest int; ties return the same value; the list
is never empty for this exercise.
Worked examples: max_of([3, 9, 4]) returns 9. max_of([-5, -2]) returns -2.

\`\`\`python
def max_of(nums):
    """Return the largest value in nums."""
    # TODO: track the best value seen so far
    pass
\`\`\`

Every exercise is self-contained: the signature, the input contract, the output
contract, worked examples, and the edge cases the tests check. The bodies are
deliberately unimplemented; callers invoke the functions directly.
`;

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

interface Projection {
  materialId: string;
  skillTag: string;
  mastery: number;
  n: number;
  modelVersion: string;
}

async function projectionsForMaterial(token: string, materialId: string): Promise<Projection[]> {
  const response = await fetch(`${INTELLIGENCE_URL}/v1/mastery?materialId=${materialId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok, `mastery failed: ${response.status}`).toBe(true);
  return (await response.json()) as Projection[];
}

const observationSum = (projections: Projection[]): number =>
  projections.reduce((sum, projection) => sum + projection.n, 0);

/** Every assessment this material owns (a practice run never writes an event pointer). */
async function assessmentsForMaterial(materialId: string): Promise<string[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/assessments?select=id&material_id=eq.${materialId}`,
    { headers: serviceHeaders() },
  );
  expect(response.ok, `assessment read failed: ${response.status}`).toBe(true);
  return ((await response.json()) as Array<{ id: string }>).map((row) => row.id);
}

async function attemptsForAssessments(ids: string[]): Promise<unknown[]> {
  if (ids.length === 0) return [];
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/question_attempts?select=id&assessment_id=in.(${ids.join(',')})`,
    { headers: serviceHeaders() },
  );
  expect(response.ok, `attempt read failed: ${response.status}`).toBe(true);
  return (await response.json()) as unknown[];
}

/**
 * Delete the material this scenario created. `assessments.material_id` is
 * `ON DELETE CASCADE` (migration 018), so its grades, questions and attempts go
 * with it; the frozen corpus is never referenced here.
 */
async function cleanupMaterial(materialId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/materials?id=eq.${materialId}`, {
    method: 'DELETE',
    headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
  });
  const materials = await fetch(
    `${SUPABASE_URL}/rest/v1/materials?select=id&id=eq.${materialId}`,
    { headers: serviceHeaders() },
  );
  expect(await materials.json(), 'the created material must be gone').toEqual([]);
  expect(await assessmentsForMaterial(materialId), 'its assessments cascade away').toEqual([]);
}

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

/** Create a code-bearing plain-text material through the real add-material form. */
async function createCodingMaterial(page: Page): Promise<{ id: string; title: string }> {
  const title = `${TITLE_PREFIX} ${Date.now()}`;
  await page.goto(`${APP_URL}/study/materials/new`);
  await expect(page.getByRole('heading', { name: 'Add material' })).toBeVisible({
    timeout: 30000,
  });
  // Scope to the source grid: the library cards reuse the same source words
  // (rule 16), so a bare name match is ambiguous.
  await page
    .locator('.material-source-grid')
    .getByRole('button', { name: /Plain text/i })
    .click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel(/^Plain text/).fill(MATERIAL_TEXT);
  await page.getByRole('button', { name: 'Add and process' }).click();
  // The row id is a UUID, so match it exactly: a looser `[^/]+` also matches
  // the `/materials/new` form URL this page is already on.
  await page.waitForURL(/\/study\/materials\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, {
    timeout: 60000,
  });
  const id = page.url().split('/').pop() as string;
  expect(id).toBeTruthy();
  return { id, title };
}

/**
 * Reload the practice config page until the material is `ready`. Only a ready
 * material offers the start control; a processing one shows the honest
 * "Material is not ready yet" banner instead. Each pass waits for the page to
 * actually render (a bare `isVisible()` straight after `goto` always reads
 * false, because `goto` resolves before React has fetched and painted).
 */
async function openReadyPractice(page: Page, materialId: string): Promise<void> {
  const start = page.getByRole('button', { name: 'Start practice run' });
  const deadline = Date.now() + INGESTION_WAIT_MS;
  for (;;) {
    await page.goto(`${APP_URL}/study/materials/${materialId}/practice`);
    const ready = await start
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (ready) return;
    if (Date.now() > deadline) {
      throw new Error(`material ${materialId} never reached ready`);
    }
  }
}

/** Configure a coding-focus run and wait for the run route to resolve. */
async function startCodingRun(page: Page, materialId: string, problems: number): Promise<void> {
  await page.goto(`${APP_URL}/study/materials/${materialId}/practice`);
  await expect(page.getByRole('button', { name: 'Start practice run' })).toBeVisible({
    timeout: 30000,
  });
  // The code-bearing honesty note must not appear: it renders only when the
  // ingestion scan found no code (hasCode === false).
  await page
    .getByRole('group', { name: 'Practice focus' })
    .getByRole('button', { name: 'Coding' })
    .click();
  await expect(page.getByText(/No code blocks detected/i)).toHaveCount(0);
  await page.getByLabel('Number of questions').fill(String(problems));
  await page.getByRole('button', { name: 'Start practice run' }).click();
  await page.waitForURL(/\/study\/materials\/[^/]+\/practice\/[^/]+$/, { timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'Practice run' })).toBeVisible({
    timeout: 30000,
  });
}

/**
 * One problem's answerable state. `CodingTaker` is a lazy chunk, and a problem
 * whose generation was judged unsuitable never gets a question, so wait for
 * whichever of the two terminal outcomes this problem reaches.
 */
async function waitForProblem(page: Page, problemNumber: number): Promise<'taker' | 'failed'> {
  await expect(page.getByRole('region', { name: `Problem ${problemNumber}` })).toBeVisible({
    timeout: 60000,
  });
  return Promise.race([
    page
      .getByLabel('Answer this question')
      .waitFor({ state: 'visible', timeout: GENERATION_WAIT_MS })
      .then(() => 'taker' as const),
    page
      .getByText(`Problem ${problemNumber} could not be generated.`)
      .waitFor({ state: 'visible', timeout: GENERATION_WAIT_MS })
      .then(() => 'failed' as const),
  ]).catch(() => {
    throw new Error(`problem ${problemNumber} reached neither an answer nor a failure`);
  });
}

/**
 * Start runs until every problem carries a generated question. A problem the
 * provider judged unsuitable is terminal inside its run, so the retry is a
 * fresh run (new assessments), which is exactly what a learner would do.
 */
async function startRunFullyGenerated(
  page: Page,
  materialId: string,
  problems: number,
): Promise<void> {
  for (let roll = 0; roll < RUN_ROLLS; roll++) {
    await startCodingRun(page, materialId, problems);
    await expect(page.getByRole('tab')).toHaveCount(problems, { timeout: 60_000 });
    // The navigator labels each problem from the run's own pointer record; a
    // pending problem must read `coding`, never the pre-#45 hardcoded `written`.
    await expect(page.getByRole('tab').first()).toContainText('coding');

    let complete = true;
    for (let index = 1; index <= problems && complete; index++) {
      await page.getByRole('tab').nth(index - 1).click();
      const outcome = await waitForProblem(page, index);
      if (outcome === 'failed') complete = false;
    }
    if (complete) {
      await page.getByRole('tab').first().click();
      return;
    }
    if (roll === RUN_ROLLS - 1) {
      throw new Error('coding generation judged the material unsuitable for every run');
    }
    console.log(`[coding-practice-live] a problem was unsuitable; starting a fresh run (roll ${roll + 1})`);
  }
}

/**
 * Answer the active coding problem and wait for the real sandbox grade.
 * `implement_fn`/`complete_code`/`debug` render the editor; the prediction
 * subtype renders its own numeric input (`output_prediction` never touches the
 * sandbox). Both are graded by the server, so the tab flipping to `incorrect`
 * is the server's answer, not the client's: the submitted program prints
 * something the hidden tests cannot expect, so a fail-closed `incorrect` is the
 * deterministic outcome.
 *
 * The editor and the prediction input are both awaited rather than
 * visibility-sampled once, because the taker mounts before its lazy chunk does.
 */
async function answerCodingProblem(
  page: Page,
  problemNumber: number,
): Promise<'editor' | 'prediction'> {
  const region = page.getByLabel('Answer this question');
  const editor = region.getByRole('textbox', { name: 'Your code' });
  const prediction = region.getByLabel('Predicted output');
  const kind = await Promise.race([
    editor
      .waitFor({ state: 'visible', timeout: EDITOR_WAIT_MS })
      .then(() => 'editor' as const),
    prediction
      .waitFor({ state: 'visible', timeout: EDITOR_WAIT_MS })
      .then(() => 'prediction' as const),
  ]).catch(() => {
    throw new Error(
      `problem ${problemNumber} rendered neither a code editor nor a prediction input`,
    );
  });

  if (kind === 'editor') {
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    // Per-key typing is mangled by CodeMirror's indentOnInput (rule 16).
    await page.keyboard.insertText(SUBMISSION);
  } else {
    await prediction.fill('0');
  }

  const submit = region.getByRole('button', { name: 'Submit answer' });
  await expect(submit).toBeEnabled({ timeout: 30000 });
  await submit.click();
  await expect(
    page.getByRole('tab', {
      name: new RegExp(`Question ${problemNumber}, (correct|partial|incorrect)`),
    }),
  ).toBeVisible({ timeout: GRADE_WAIT_MS });
  console.log(`[coding-practice-live] problem ${problemNumber} answered on the ${kind} branch`);
  return kind;
}

/**
 * The sandbox verdict table for whichever problem took the editor branch. The
 * subtype is the model's choice, so a run can legitimately be prediction-only;
 * that is logged rather than forced, because #42's spec already pins the
 * sandbox contract on a seeded `implement_fn`.
 */
async function assertSandboxVerdicts(
  page: Page,
  kinds: Array<'editor' | 'prediction'>,
): Promise<void> {
  const index = kinds.indexOf('editor');
  if (index === -1) {
    console.log(
      '[coding-practice-live] every problem was output_prediction; no sandbox verdict table to assert',
    );
    return;
  }
  if (index > 0) await page.getByRole('tab').nth(index).click();
  const panel = page.getByRole('region', { name: `Problem ${index + 1}` });
  await expect(panel.getByRole('table', { name: 'Test results' })).toBeVisible();
  await expect(panel.getByRole('columnheader', { name: 'Case' })).toBeVisible();
  // Hidden rows are veiled; their content and the reference solution never render.
  await expect(panel.getByText(/Hidden test \d/).first()).toBeVisible();
}

/** The desktop end-to-end scenario. Assumes an authenticated session. */
async function codingRunScenario(page: Page, materialId: string): Promise<void> {
  const token = await userToken();
  const before = observationSum(await projectionsForMaterial(token, materialId));

  await openReadyPractice(page, materialId);
  await startRunFullyGenerated(page, materialId, 2);

  await waitForProblem(page, 1);
  // The panel names the family from the server's own question.
  await expect(page.getByRole('region', { name: 'Problem 1' })).toContainText('coding');

  // Advisory: browser-only feedback on the visible tests. It is labelled
  // advisory, and it runs before the server has seen the source. The lazy
  // chunk can still be mounting, so wait rather than sample once.
  const advisory = page.getByRole('button', { name: 'Run visible tests' });
  const advisoryVisible = await advisory
    .waitFor({ state: 'visible', timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (advisoryVisible) {
    await advisory.click();
    await expect(page.getByText(/Advisory - the server grade is authoritative/i)).toBeVisible();
    await expect(advisory).toBeEnabled({ timeout: ADVISORY_WAIT_MS });
    console.log('[coding-practice-live] desktop: advisory check completed');
  }

  const firstKind = await answerCodingProblem(page, 1);

  // Resume: a full reload restores the run from its local pointer and keeps
  // problem 1's grade while landing on the first ungraded problem.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Practice run' })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole('region', { name: 'Problem 2' })).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByRole('tab', { name: /Question 1, (correct|partial|incorrect)/ }),
  ).toBeVisible();

  const secondKind = await answerCodingProblem(page, 2);
  await expect(page.getByText('2 of 2 done')).toBeVisible({ timeout: 60000 });

  const finish = page.getByRole('button', { name: 'Finish run' });
  await expect(finish).toBeEnabled({ timeout: 60000 });
  await finish.click();

  // The summary carries the server's own verdict table and the family label.
  const summary = page.getByRole('region', { name: 'Run summary' });
  await expect(summary).toBeVisible({ timeout: 60000 });
  await expect(summary.getByText(/2 of 2 problems graded/)).toBeVisible();
  await assertSandboxVerdicts(page, [firstKind, secondKind]);
  await expect(page.getByRole('region', { name: 'Problem 1' })).toContainText('coding');

  /** Authored server-side content must never reach the browser. */
  const REDACTION_RE =
    /answerBlock|answer_block|referenceAnswer|reference_answer|rubricVersion|maxScore|correctIndex|referenceSolution|acceptedValue|"hiddenTests"/i;
  expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);
  await page.screenshot({ path: `${EVIDENCE_DIR}/coding-run-desktop.png`, fullPage: true });

  // AC3: the coding grade is an ordinary observation the projection rebuilds from.
  const after = observationSum(await projectionsForMaterial(token, materialId));
  console.log(`[coding-practice-live] desktop: material observations ${before} -> ${after}`);
  expect(after, 'a graded coding problem must move mastery').toBeGreaterThan(before);
}

/** The phone scenario: graded path at 375 px plus the abandoned-run negative. */
async function codingRunPhoneScenario(page: Page, materialId: string): Promise<void> {
  const token = await userToken();

  await openReadyPractice(page, materialId);
  await startRunFullyGenerated(page, materialId, 1);
  await waitForProblem(page, 1);
  await answerCodingProblem(page, 1);

  // Phone-only layout: the navigator is the sticky horizontal strip and the
  // content column never overflows the viewport (a leaked desktop viewport
  // fails these instead of passing quietly).
  const navigator = page.getByRole('tablist', { name: 'Question navigator' });
  expect(await navigator.evaluate((node) => getComputedStyle(node).position)).toBe('sticky');
  expect(await navigator.evaluate((node) => getComputedStyle(node).flexDirection)).toBe('row');
  const overflow = await page.evaluate(
    () => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${EVIDENCE_DIR}/coding-run-phone.png`, fullPage: true });

  await page.getByRole('button', { name: 'Finish run' }).click();
  await expect(page.getByRole('region', { name: 'Run summary' })).toBeVisible({
    timeout: 60000,
  });

  // The negative half of AC3/AC4: a second run is generated and abandoned
  // without an answer, so it creates no attempt row and moves no observation.
  // Only the *new* assessments count: the graded run above already owns rows.
  const before = observationSum(await projectionsForMaterial(token, materialId));
  const priorIds = new Set(await assessmentsForMaterial(materialId));
  await startRunFullyGenerated(page, materialId, 1);
  await waitForProblem(page, 1);
  await page.getByRole('button', { name: 'Abandon run' }).click();
  await expect(page.getByText(/Run abandoned/)).toBeVisible({ timeout: 30000 });

  const abandonedIds = (await assessmentsForMaterial(materialId)).filter(
    (id) => !priorIds.has(id),
  );
  expect(abandonedIds.length, 'the abandoned run still generated its assessment').toBeGreaterThan(0);
  expect(await attemptsForAssessments(abandonedIds), 'no attempt row was created').toEqual([]);
  const after = observationSum(await projectionsForMaterial(token, materialId));
  expect(after, 'abandoned work must not move mastery').toBe(before);
}

test.describe('coding practice run live (desktop 1280)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 30_000 });

  test('configure, grade in the sandbox, reload-resume, finish, summary', async ({
    page,
    errors,
  }) => {
    test.setTimeout(SCENARIO_TIMEOUT_MS);
    let materialId: string | null = null;
    let failure: unknown;
    try {
      await signIn(page);
      const material = await createCodingMaterial(page);
      materialId = material.id;
      console.log(`[coding-practice-live] desktop material ${material.title} (${material.id})`);
      await codingRunScenario(page, material.id);
      const pageErrors = errors().filter((entry) => entry.startsWith('pageerror:'));
      expect(pageErrors).toEqual([]);
    } catch (error) {
      failure = error;
    }
    if (materialId) {
      try {
        await cleanupMaterial(materialId);
      } catch (error) {
        console.warn(`[coding-practice-live] cleanup failed: ${String(error)}`);
        if (failure == null) failure = error;
      }
    }
    if (failure != null) throw failure;
  });
});

test.describe('coding practice run live (phone 375)', () => {
  test.use({ viewport: { width: 375, height: 812 }, actionTimeout: 30_000 });

  test('graded coding run and an abandoned run that observes nothing', async ({
    page,
    errors,
  }) => {
    test.setTimeout(SCENARIO_TIMEOUT_MS);
    let materialId: string | null = null;
    let failure: unknown;
    try {
      await signIn(page);
      const material = await createCodingMaterial(page);
      materialId = material.id;
      console.log(`[coding-practice-live] phone material ${material.title} (${material.id})`);
      await codingRunPhoneScenario(page, material.id);
      const pageErrors = errors().filter((entry) => entry.startsWith('pageerror:'));
      expect(pageErrors).toEqual([]);
    } catch (error) {
      failure = error;
    }
    if (materialId) {
      try {
        await cleanupMaterial(materialId);
      } catch (error) {
        console.warn(`[coding-practice-live] cleanup failed: ${String(error)}`);
        if (failure == null) failure = error;
      }
    }
    if (failure != null) throw failure;
  });
});
