---
name: playwright-config
description: Playwright configuration patterns to avoid common setup issues
---

# Playwright Configuration

## Common Mistakes

### Mistake 1: webServer inside projects[]

Placing `webServer` inside a `projects[]` entry has **no effect**. Playwright ignores it there.

```json
// ❌ BROKEN - webServer here is ignored
"projects": [
  {
    "name": "chromium",
    "use": { "baseURL": "http://localhost:4321" },
    "webServer": {  // This does nothing!
      "command": "pnpm dev",
      "url": "http://localhost:4321"
    }
  }
]
```

### Mistake 2: Config file not found

Running `pnpm test:e2e` without specifying the config path when it's in a subdirectory:

```bash
# ❌ BROKEN - looks for playwright.config.ts in current dir
playwright test

# ✅ CORRECT - point to the config file explicitly
playwright test -c e2e/playwright.config.ts
```

### Mistake 3: baseURL not applying

Setting `baseURL` only in the project config without using it in tests:

```typescript
// ❌ BROKEN - project baseURL doesn't override test-level config properly
const config = {
  use: { baseURL: 'http://localhost:4321' },  // not used by tests
  projects: [{
    name: 'marketing',
    use: { baseURL: 'http://localhost:4321' }  // not used either
  }]
}
```

## Correct Pattern

### 1. webServer at top level (as array for multiple)

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
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4321',
      },
    },
    {
      name: 'app',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
    },
  ],
});
```

### 2. Use baseURL in test via test.use()

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

### 3. Always pass -c flag

```json
// package.json
{
  "scripts": {
    "test:e2e": "playwright test -c e2e/playwright.config.ts"
  }
}
```

## Summary

| Rule | Correct |
|---|---|
| `webServer` location | Top level of config, not in projects[] |
| Config path | Always use `-c` flag when config is in subdirectory |
| baseURL override | Use `test.use({ baseURL })` inside describe blocks |