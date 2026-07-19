---
name: playwright-config
description: Playwright configuration patterns to avoid common setup issues
---

# Playwright Configuration

## Common Mistakes

| Mistake | Why it breaks |
|---|---|
| `webServer` nested inside a `projects[]` entry | Playwright only reads top-level `webServer` — a per-project one is silently ignored |
| Running `playwright test` without `-c` when the config lives in a subdirectory | Playwright looks for `playwright.config.ts` in the cwd and won't find it — always run `playwright test -c e2e/playwright.config.ts` |
| Setting `baseURL` only inside `projects[].use` | Use `test.use({ baseURL })` inside a `describe` block for per-suite overrides — see below |

## Correct Pattern

`webServer` at the top level (array form for multiple dev servers), `baseURL` per project:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  use: {
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @study-tracker/marketing dev',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'pnpm --filter @study-tracker/app dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'marketing',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4321' },
    },
    {
      name: 'app',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
    },
  ],
});
```

Override `baseURL` per suite with `test.use()`:

```typescript
test.describe('Marketing site', () => {
  test.use({ baseURL: 'http://localhost:4321' });
  // tests...
});

test.describe('React app', () => {
  test.use({ baseURL: 'http://localhost:5173' });
  // tests...
});
```
