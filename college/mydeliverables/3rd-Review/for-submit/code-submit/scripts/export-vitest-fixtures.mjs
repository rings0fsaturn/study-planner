#!/usr/bin/env node
/**
 * Export Vitest test cases as golden JSON fixtures for Python parity tests.
 *
 * Writes to:
 *   tests/fixtures/pillar-a/progress/{name}.input.json
 *   tests/fixtures/pillar-a/progress/{name}.expected.json
 *   tests/fixtures/pillar-a/roadmap/{name}.input.json
 *   tests/fixtures/pillar-a/roadmap/{name}.expected.json
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const vitestBin = join(repoRoot, 'packages/progress/node_modules/.bin/vitest')

const progressDir = join(repoRoot, 'packages/progress')

const result = spawnSync(
  vitestBin,
  [
    'run',
    '../../scripts/fixture-export/export.test.ts',
    '--config',
    'vitest.fixture-export.config.ts',
  ],
  { cwd: progressDir, stdio: 'inherit', shell: false },
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log('Golden fixtures written to tests/fixtures/pillar-a/')
