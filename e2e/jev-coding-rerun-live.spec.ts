import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';

/**
 * Throwaway diagnostic (2026-09-25): re-run the two coding cells with the
 * Piston sandbox up. The first matrix run reached accept + self-check on both
 * code-heavy PDFs but the self-check deferred on `piston connection refused`
 * (sandbox down), leaving them `generating` with a retryable warning.
 *
 * Prints the terminal status and the jev/self-check worker lines per material.
 * The two PDFs are the operator's material and are never deleted.
 */
const APP_URL = 'http://localhost:5173';
const WORKER_LOG = join(process.cwd(), '.dev', 'full-app', 'logs', 'worker.log');
const EMAIL = process.env.E2E_LIVE_EMAIL ?? '';
const PASSWORD = process.env.E2E_LIVE_PASSWORD ?? '';

const MATERIALS = [
  { name: 'grokking-algorithms', id: 'b5f51eab-c11d-4505-80db-88bb3627801d' },
  { name: 'CSAPP_2016', id: 'be7e88a0-909e-4db2-8a15-a14510165027' },
] as const;

async function signIn(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/study/sign-in`);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/study\/(home|onboarding)/, { timeout: 20000 });
}

const INTEREST_RE = /jev|self-check|piston|coding generation|unsuitable|deferred/;

async function interestingSince(since: number): Promise<string[]> {
  try {
    const content = await readFile(WORKER_LOG, 'utf8');
    return content
      .slice(since)
      .split('\n')
      .filter((line) => INTEREST_RE.test(line));
  } catch {
    return [];
  }
}

async function logSize(): Promise<number> {
  try {
    return (await readFile(WORKER_LOG, 'utf8')).length;
  } catch {
    return 0;
  }
}

test.describe('jev coding re-run with sandbox up (diagnostic)', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_LIVE_EMAIL / E2E_LIVE_PASSWORD not set');

  test('coding on both PDFs reaches a terminal status', async ({ page }) => {
    test.setTimeout(30 * 60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await signIn(page);

    const results: string[] = [];
    for (const material of MATERIALS) {
      const before = await logSize();
      await page.goto(`${APP_URL}/study/materials/${material.id}/assessments/new`);
      await expect(page.getByRole('heading', { name: 'Generate assessment' })).toBeVisible({
        timeout: 30000,
      });
      const group = page.getByRole('group', { name: 'Question family' });
      await group.getByRole('button', { name: 'Coding', exact: true }).click();
      await page.getByRole('button', { name: 'Generate question' }).click();
      await page.waitForURL(/\/study\/assessments\/[^/]+$/, { timeout: 30000 });

      const failed = page.getByText('Generation did not complete');
      const citations = page.getByRole('heading', { name: 'Citations' });
      const refusals = page.getByText(/code_not_derivable|does not support a grounded/);
      const generating = page.getByText('Generating your question');
      await expect(failed.or(citations).or(refusals).or(generating).first()).toBeVisible({
        timeout: 60000,
      });

      let status = 'timeout';
      const deadline = Date.now() + 8 * 60_000;
      for (;;) {
        if (await citations.first().isVisible().catch(() => false)) {
          status = 'ready';
          break;
        }
        if (await refusals.first().isVisible().catch(() => false)) {
          status = 'refused';
          break;
        }
        if (await failed.first().isVisible().catch(() => false)) {
          status = 'failed';
          break;
        }
        if (Date.now() > deadline) break;
        await page.waitForTimeout(4000);
      }
      await page.waitForTimeout(4000);
      const lines = (await interestingSince(before))
        .map((l) => {
          try {
            const j = JSON.parse(l);
            return `      [${j.logger}] ${j.msg}`;
          } catch {
            return `      ${l}`;
          }
        })
        .join('\n');
      const block =
        `\n### ${material.name} / coding\n  status=${status}\n  ${page.url()}\n` +
        `  relevant lines:\n${lines || '      (none)'}`;
      results.push(block);
      // eslint-disable-next-line no-console
      console.log(block);
    }

    const summary = results.join('\n');
    test.info().attach('jev-coding-rerun', {
      body: Buffer.from(summary, 'utf8'),
      contentType: 'text/plain',
    });
    console.log('\n============ JE V CODING RERUN ============' + summary);
    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  });
});
