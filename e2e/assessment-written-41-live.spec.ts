import { test, expect, type Page } from '@playwright/test';

/**
 * Live written assessment + rubric grading (issue #41) against the real stack.
 * Covers the P5 live-pass matrix (user-confirmed 3.a): generate a written
 * question, answer it in the browser, get a real `llm_rubric` grade, read the
 * criterion breakdown in the #40 review surface at desktop and mobile widths,
 * retry into a fresh observation, and confirm a reload restores the learner's
 * own written answer.
 *
 * Both authored subtypes are exercised: the plain scenarios take whatever
 * subtype the model authors, and the long-form scenario steers the family
 * through the config's skill-tag field (`build_written_messages` folds title +
 * skill tags into the topic steer).
 *
 * Every scenario is self-contained: each generates its own assessment. Do not
 * reintroduce a module-scoped id shared between scenarios — Playwright restarts
 * the worker process after a failure, which silently resets module state and
 * turns the dependent scenarios into skips (observed live 2026-09-11).
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD (kept out of source) and the
 * managed runtime plus the detached ingestion worker, plus the GPU sidecar on
 * :8200 (generation retrieves through it — a stopped sidecar fails generation
 * with "embedding sidecar request failed: Connection refused"):
 *   ./full-app start full
 *   setsid nohup bash scripts/run-detached-ingestion-worker.sh >/dev/null 2>&1 </dev/null &
 *   docker compose -f services/embedder/docker-compose.yml up -d
 * The worker is what turns a submitted written answer into a grade, and it is
 * also what generates the question itself.
 *
 * Mutates the shared dev account by design (four scenarios, four assessments,
 * one or two attempts each). Run scoped to the React app project with one
 * worker:
 *   pnpm test:e2e e2e/assessment-written-41-live.spec.ts --project=app --workers=1
 * (No `--` separator: options after it are read as test-file filters, so
 * --project/--workers would be silently dropped and every project would run.)
 * and restart the runtime before re-running after app edits (WSL staleness).
 *
 * Grounded material: 80c8b138-b544-4095-8dc0-1c390ac70da2 (ACCA APM Study
 * Text, ready, 754 chunks) — the frozen corpus the retrieval work verified.
 * Verified against the live account 2026-09-10: the other ready materials
 * (`E2E assessment*`) carry a single chunk and cannot ground a written rubric.
 */
const APP_URL = 'http://localhost:5173';
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';
const MATERIAL_ID = '80c8b138-b544-4095-8dc0-1c390ac70da2';
const EVIDENCE_DIR = '.work/active/issue-41-written-assessment-rubric-grading/plan/evidence';
/** Authored rubric/reference vocabulary must never reach the browser. */
const REDACTION_RE =
  /answerBlock|answer_block|referenceAnswer|reference_answer|rubricVersion|rubric_version|maxPoints|max_points|correctIndex|referenceSolution|hiddenTest|answer key/i;
/** Skill-tag steer that asks for a multi-part answer (→ `long_form`). */
const LONG_FORM_STEER = 'multi-part comparison, extended derivation, essay-length analysis';
/** Bounds one authored generation attempt. A real live run measured 146 s on a
 *  slow provider call (the adapter's own timeout plus its single retry), so the
 *  taker-or-retryable UI can take far longer than a healthy 20-35 s. */
const GENERATION_WAIT_MS = 300_000;

const ANSWER_TEXT =
  'The rubric is applied to the firm in the case: performance is judged on both financial and ' +
  'non-financial measures, and the variance analysis identifies which critical success factor ' +
  'the shortfall actually comes from.';

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // The hosted dev project's auth API is shared and can answer slowly; the
  // wait is generous but a real failure still fails here.
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 90000 });
  // Let the authenticated shell settle before navigating again: a goto issued
  // mid-restore gets bounced back to /home by the auth gate.
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({
    timeout: 30000,
  });
}

/**
 * Generate one written question from the frozen material and return the
 * assessment id from the URL. `skillTags` is the only handle the UI has on the
 * authored subtype (D-01/D-04).
 *
 * The citation gate is strict and drops a candidate whose cited chunk is
 * outside the retrieval context without repairing it (a model hallucination,
 * observed live 2026-09-11), so a failed attempt is possible. Each "Retry
 * generation" mints a fresh job — and a fresh assessment id, so the id is read
 * after the loop. Bounded, to stay deterministic without masking a real bug
 * (same pattern as e2e/assessment-generation-live.spec.ts).
 */
async function generateWrittenAssessment(page: Page, skillTags?: string): Promise<string> {
  await page.goto(`${APP_URL}/study/materials/${MATERIAL_ID}/assessments/new`);
  // A bounce back to /home (auth gate or bad material id) must fail loudly here
  // rather than as an unclear timeout on the picker.
  await expect(page).toHaveURL(/\/assessments\/new$/, { timeout: 30000 });
  await expect(page.getByText('Question family')).toBeVisible({ timeout: 60000 });
  if (skillTags) {
    await page.getByLabel('Skill tags (optional, comma-separated)').fill(skillTags);
  }
  // Assert the chip actually took: a re-render between the click and the
  // Generate click can revert the selection, and the request would then carry
  // `objective` while the spec believes it asked for written (observed live
  // 2026-09-11 — assessment stored with recipe.formats ["objective"]).
  const writtenChip = page.getByRole('button', { name: 'Written', exact: true });
  await writtenChip.click();
  await expect(writtenChip).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Generate question' }).click();
  await page.waitForURL(/\/study\/assessments\/[^/]+$/, { timeout: 60000 });
  await expectWrittenTakerOrRetry(page, 4);
  const assessmentId = page.url().split('/').pop() ?? '';
  expect(assessmentId).not.toBe('');
  return assessmentId;
}

/**
 * Settle the generation screen: the authored taker, or the retryable
 * "Generation was interrupted" state, which this clicks to mint a fresh job.
 */
async function expectWrittenTakerOrRetry(page: Page, attempts: number): Promise<void> {
  const taker = page.getByLabel('Answer this question');
  const failed = page.getByRole('button', { name: 'Retry generation' });
  for (let attempt = 0; attempt < attempts; attempt++) {
    await expect(taker.or(failed)).toBeVisible({ timeout: GENERATION_WAIT_MS });
    if ((await failed.count()) === 0 || !(await failed.isVisible())) break;
    await failed.click();
  }
  await expect(taker).toBeVisible({ timeout: GENERATION_WAIT_MS });
}

/** The titled heading follows the assessment's family (#41 P4). */
async function expectWrittenFamily(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Written assessment' })).toBeVisible({
    timeout: 60000,
  });
}

/**
 * Wait for the generated question's taking UI (the textarea is the written
 * signal) and assert the textarea shape the authored subtype asks for.
 */
async function expectWrittenTaker(page: Page) {
  const taker = page.getByLabel('Answer this question');
  await expect(taker).toBeVisible({ timeout: GENERATION_WAIT_MS });
  const textarea = page.getByLabel('Your answer');
  await expect(textarea).toBeVisible();
  // innerText reflects CSS text-transform, so the authored subtype reads uppercase.
  const label = await page.locator('label[for$="-written-answer"]').innerText();
  const rows = Number(await textarea.getAttribute('rows'));
  const subtype = /long form/i.test(label) ? 'long_form' : /short answer/i.test(label) ? 'short_answer' : null;
  if (subtype === null) {
    throw new Error(`written question rendered without an authored subtype label: "${label}"`);
  }
  expect(rows).toBe(subtype === 'long_form' ? 8 : 3);
  return { taker, textarea, subtype };
}

/** The review card's criterion table — the #40 shell filled by #41. */
async function expectRubricBreakdown(page: Page): Promise<void> {
  const table = page.getByRole('table', { name: 'Rubric breakdown' });
  await expect(table).toBeVisible({ timeout: 120000 });
  const rows = table.locator('tbody tr:not(.ar-rubric-feedback-row)');
  expect(await rows.count()).toBeGreaterThanOrEqual(1);
  // Each criterion publishes its share of the rubric total and an outcome tag.
  expect(await table.locator('.ar-rubric-share').count()).toBeGreaterThanOrEqual(1);
  expect(await table.locator('.ar-rubric-outcome .tag').count()).toBeGreaterThanOrEqual(1);
}

/**
 * Answer the visible written question and wait for the real LLM grade to land.
 * The answer gate is shared with the server: blank text cannot submit.
 */
async function answerAndAwaitGrade(page: Page, text: string): Promise<void> {
  const taker = page.getByLabel('Answer this question');
  const submit = taker.getByRole('button', { name: 'Submit answer' });
  await expect(submit).toBeDisabled();
  await taker.getByLabel('Your answer').fill(text);
  await expect(submit).toBeEnabled();
  await submit.click();

  await expectRubricBreakdown(page);
  const summary = page.getByRole('region', { name: 'Assessment summary' });
  await expect(summary.getByText(/1 of 1 questions correct|0 of 1 questions correct/)).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByText(/Skills observed/)).toBeVisible();
}

test.describe('written assessment live (#41)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('generates a written question, grades a real answer, and renders the rubric breakdown', async ({ page }) => {
    test.setTimeout(600_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 800 });

    await signIn(page);
    await generateWrittenAssessment(page);
    // The taker only exists once the question is authored; the family heading
    // is honest at that point (it reads the question's format).
    const { subtype } = await expectWrittenTaker(page);
    await expectWrittenFamily(page);
    console.log(`scenario 1 authored subtype: ${subtype}`);

    await answerAndAwaitGrade(page, ANSWER_TEXT);
    // The learner's own answer stays reviewable inside the review card.
    await expect(page.getByText(/Your answer:/)).toBeVisible();

    // Redaction gate: the authored rubric and reference never render.
    expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);

    await page.screenshot({
      path: `${EVIDENCE_DIR}/written-41-graded-desktop.png`,
      fullPage: true,
    });

    // Mobile width: same review, no horizontal overflow.
    await page.setViewportSize({ width: 375, height: 812 });
    await expectRubricBreakdown(page);
    const overflow = await page.evaluate(
      () => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: `${EVIDENCE_DIR}/written-41-graded-mobile.png`,
      fullPage: true,
    });

    expect(pageErrors).toEqual([]);
  });

  test('a reload restores the learner-written answer and its rubric breakdown', async ({ page }) => {
    test.setTimeout(600_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    const assessmentId = await generateWrittenAssessment(page);
    await expectWrittenFamily(page);
    await answerAndAwaitGrade(page, ANSWER_TEXT);

    // Restore path: the server echoes the learner's own answer (#40 D-01),
    // and the breakdown comes back with the stored grade.
    await page.goto(`${APP_URL}/study/assessments/${assessmentId}`);
    await expect(page.getByText(/Your answer:/)).toBeVisible({ timeout: 60000 });
    await expectRubricBreakdown(page);
    expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);
    await page.screenshot({
      path: `${EVIDENCE_DIR}/written-41-restored-desktop.png`,
      fullPage: true,
    });

    expect(pageErrors).toEqual([]);
  });

  test('the skill-tag steer authors a long_form question with the long-form textarea', async ({ page }) => {
    test.setTimeout(900_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    // Nothing in the recipe selects the authored subtype (D-01/D-04), so the
    // steer is a request the model may refuse; re-roll a bounded number of
    // times rather than assert on a single roll.
    let subtype: string | null = null;
    for (let roll = 0; roll < 3 && subtype !== 'long_form'; roll++) {
      await generateWrittenAssessment(page, LONG_FORM_STEER);
      subtype = (await expectWrittenTaker(page)).subtype;
    }
    expect(subtype, 'the long-form steer never produced a long_form question in 3 rolls').toBe(
      'long_form',
    );
    await expectWrittenFamily(page);

    // The long-form question grades through the same rubric arm.
    await answerAndAwaitGrade(page, `${ANSWER_TEXT} It also weighs the operational and competitive consequences.`);
    await expect(page.getByText(/Your answer:/)).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({
      path: `${EVIDENCE_DIR}/written-41-longform-desktop.png`,
      fullPage: true,
    });
    expect(pageErrors).toEqual([]);
  });

  test('retry mints a fresh written attempt and keeps the graded one in history', async ({ page }) => {
    test.setTimeout(600_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signIn(page);
    await generateWrittenAssessment(page);
    await expectWrittenFamily(page);
    await answerAndAwaitGrade(page, ANSWER_TEXT);

    await page.getByRole('button', { name: 'Retry question' }).click();
    const taker = page.getByLabel('Answer this question');
    await expect(taker).toBeVisible({ timeout: 60000 });
    await taker.getByLabel('Your answer').fill(`${ANSWER_TEXT} A second pass adds the cash-flow consequence.`);
    await taker.getByRole('button', { name: 'Submit answer' }).click();

    // Append-only history: the retry renders the history block (it only exists
    // once a question has been retried) and keeps the first graded attempt.
    const history = page.locator('[aria-label="Attempt history"]');
    await expect(history).toBeVisible({ timeout: 180_000 });
    const rows = history.locator('.ar-attempt:not(.is-queued)');
    await expect(rows).toHaveCount(2, { timeout: 180_000 });
    await expectRubricBreakdown(page);
    await expect(page.getByText(/Your answer:/).first()).toBeVisible();

    expect(await page.locator('body').innerText()).not.toMatch(REDACTION_RE);
    await page.screenshot({
      path: `${EVIDENCE_DIR}/written-41-retry-desktop.png`,
      fullPage: true,
    });

    expect(pageErrors).toEqual([]);
  });
});
