import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';

/**
 * Throwaway diagnostic (2026-09-25): drive one generation per (material,
 * family) through the real UI and record what the Jev slice-1 paths decide.
 *
 * Not a regression spec - it exists to answer "what does Jev do on real
 * code-heavy PDFs". Six cells: grokking-algorithms + CSAPP_2016, each x
 * coding / objective / written. Captures the terminal assessment status, its
 * warnings, and every `jev` worker log line for the run.
 *
 * Requires E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD, the managed runtime with
 * JEV_SLICE1_ENABLED=true, and the GPU sidecar for retrieval query-embeds.
 * The two PDFs are the operator's material and are never deleted; the created
 * assessments are cleaned up separately.
 */
const APP_URL = 'http://localhost:5173';
const WORKER_LOG = join(process.cwd(), '.dev', 'full-app', 'logs', 'worker.log');
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';

const MATERIALS = [
  { name: 'grokking-algorithms', id: 'b5f51eab-c11d-4505-80db-88bb3627801d' },
  { name: 'CSAPP_2016', id: 'be7e88a0-909e-4db2-8a15-a14510165027' },
] as const;
const FAMILIES = ['Coding', 'Objective', 'Written'] as const;

/** Family label -> the recipe `formats` value the server round-trips. */
const FORMAT_OF: Record<string, string> = {
  Coding: 'coding',
  Objective: 'objective',
  Written: 'written',
};

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 20000 });
}

/** Worker log lines mentioning jev, from the first line after `since` bytes. */
async function jevLinesSince(since: number): Promise<string[]> {
  try {
    const content = await readFile(WORKER_LOG, 'utf8');
    return content
      .slice(since)
      .split('\n')
      .filter((line) => line.includes('"logger":"jev') || line.includes('jev suitability')
        || line.includes('jev citation') || line.includes('jev passage') || line.includes('jev-unsuitable'));
  } catch {
    return [];
  }
}

async function workerLogSize(): Promise<number> {
  try {
    return (await readFile(WORKER_LOG, 'utf8')).length;
  } catch {
    return 0;
  }
}

/**
 * Generate one question: open the config for `materialId`, pick `family`,
 * submit, then wait for a terminal surface (the review's Citations heading,
 * the failure banner, or the honest `code_not_derivable` refusal).
 */
async function generate(
  page: Page,
  materialId: string,
  family: string,
): Promise<{ status: string; detail: string; url: string }> {
  await page.goto(`${APP_URL}/study/materials/${materialId}/assessments/new`);
  await expect(page.getByRole('heading', { name: 'Generate assessment' })).toBeVisible({
    timeout: 30000,
  });
  const familyGroup = page.getByRole('group', { name: 'Question family' });
  await familyGroup.getByRole('button', { name: family, exact: true }).click();
  await expect(familyGroup.getByRole('button', { name: family, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Generate question' }).click();
  await page.waitForURL(/\/study\/assessments\/[^/]+$/, { timeout: 30000 });

  // Terminal surfaces: ready review, failure banner, or a still-generating
  // state that we then poll. Wait for any of them rather than sampling.
  const failed = page.getByText('Generation did not complete');
  const citations = page.getByRole('heading', { name: 'Citations' });
  const refusals = page.getByText(/code_not_derivable|does not support a grounded/);
  const generating = page.getByText('Generating your question');

  await expect(failed.or(citations).or(refusals).or(generating).first()).toBeVisible({
    timeout: 60000,
  });

  // Poll up to 6 minutes for a non-"generating" terminal state.
  const deadline = Date.now() + 360_000;
  for (;;) {
    if (await citations.first().isVisible().catch(() => false)) {
      return { status: 'ready', detail: '', url: page.url() };
    }
    if (await refusals.first().isVisible().catch(() => false)) {
      const body = await page.locator('body').innerText();
      const line = body
        .split('\n')
        .find((l) => /code_not_derivable|does not support a grounded/.test(l));
      return { status: 'refused', detail: (line ?? '').trim(), url: page.url() };
    }
    if (await failed.first().isVisible().catch(() => false)) {
      const body = await page.locator('body').innerText();
      const line = body.split('\n').find((l) => /:/.test(l) && l.length < 200);
      return { status: 'failed', detail: (line ?? '').trim(), url: page.url() };
    }
    if (Date.now() > deadline) {
      const body = await page.locator('body').innerText();
      return { status: 'timeout', detail: body.slice(0, 200), url: page.url() };
    }
    await page.waitForTimeout(3000);
  }
}

test.describe('jev family matrix on real PDFs (diagnostic)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('6 cells: 2 materials x coding/objective/written', async ({ page }) => {
    test.setTimeout(45 * 60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await signIn(page);
    const results: string[] = [];

    for (const material of MATERIALS) {
      for (const family of FAMILIES) {
        const before = await workerLogSize();
        const outcome = await generate(page, material.id, family);
        await page.waitForTimeout(4000); // let the worker flush its jev lines
        const lines = await jevLinesSince(before);
        const verdicts = lines
          .map((l) => {
            try {
              const j = JSON.parse(l);
              return `      [${j.logger}] ${j.msg}${j.jev_verdict ? ` {verdict=${j.jev_verdict} stands=${j.jev_stands} conf=${j.jev_confidence}}` : ''}`;
            } catch {
              return `      ${l}`;
            }
          })
          .join('\n');
        results.push(
          `\n### ${material.name} / ${family} (format=${FORMAT_OF[family]})\n` +
            `  status=${outcome.status}  detail=${outcome.detail || '-'}\n` +
            `  ${outcome.url}\n` +
            `  jev lines (${lines.length}):\n${verdicts || '      (none)'}`,
        );
        // eslint-disable-next-line no-console
        console.log(results[results.length - 1]);
      }
    }

    const summary = results.join('\n');
    test.info().attach('jev-family-matrix', {
      body: Buffer.from(summary, 'utf8'),
      contentType: 'text/plain',
    });
    console.log('\n================ JE V FAMILY MATRIX ================' + summary);
    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  });
});
