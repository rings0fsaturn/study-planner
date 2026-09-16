import { test as base, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Collects page errors + console errors; the fixture attaches them on failure. */
export async function watchErrors(page: Page): Promise<() => string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return () => errors;
}

/**
 * Grep the managed intelligence log for a request id (logging-tracing P3).
 * Returns matching lines; empty when the runtime is not running.
 */
export async function grepIntelligenceLog(requestId: string): Promise<string[]> {
  const logPath = join(
    process.cwd(),
    '.dev',
    'full-app',
    'logs',
    'intelligence.log',
  );
  try {
    const content = await readFile(logPath, 'utf8');
    return content.split('\n').filter((line) => line.includes(requestId));
  } catch {
    return [];
  }
}

type TracedFixtures = {
  errors: () => string[];
};

export const test = base.extend<TracedFixtures>({
  errors: async ({ page }, use, testInfo) => {
    const getErrors = await watchErrors(page);
    await use(getErrors);
    const errors = getErrors();
    if (errors.length > 0) {
      await testInfo.attach('console-errors', {
        body: Buffer.from(errors.join('\n'), 'utf8'),
        contentType: 'text/plain',
      });
    }
  },
});

export { expect } from '@playwright/test';
