---
name: runtime-and-e2e
description: Use the managed full-app lifecycle and the repository Playwright configuration for browser verification.
---

# Runtime and E2E

Use `./full-app` for runtime work that touches the React app, authenticated routes, or the Intelligence Service.
The `full` profile starts the service and React app, while `all` also starts the marketing site.

## Required Workflow

1. Run `./full-app status full` before changing process state.
2. Start with `./full-app start full` or restart with `./full-app restart full` only when clean state is required.
3. Verify `http://127.0.0.1:8000/health` and `http://localhost:5173/study/sign-in` before opening Chromium.
4. Run the smallest relevant Playwright test first.
5. Inspect `.dev/full-app/logs/` before changing code after a runtime failure.
6. Stop the managed runtime when finished unless the user wants it left running.

Run Playwright with the repository config:

```bash
pnpm exec playwright test -c e2e/playwright.config.ts --project=app --reporter=list
```

Keep `webServer` at the top level of `e2e/playwright.config.ts`.
Use `pnpm dev:full` for the app web server so service-dependent flows do not run against Vite alone.
Use `test.use({ baseURL })` for suite-level overrides instead of moving `webServer` into a project.

## Process Safety

The lifecycle manager owns `.dev/full-app/state.json` and its managed process groups.
Do not hand-edit its state while managed processes are running.
Do not kill port listeners until you identify the owning process.
Leave unrelated listeners and containers untouched.
