---
name: runtime-and-e2e
description: Use the managed full-app lifecycle and the repository Playwright configuration for browser verification.
---

# Runtime and E2E

Use `./full-app` for runtime work that touches the React app, authenticated routes, the Intelligence Service, or generation/ingestion jobs.
The `full` profile starts the GPU sidecar (:8200), the Piston sandbox (:2000), the service, the React app, and the ingestion/generation/grading worker, while `all` also starts the marketing site.
The worker is portless: `./full-app status full` reports it as `health=running` and its log is `.dev/full-app/logs/worker.log`.
`./full-app` starts, stops, and health-checks the sidecar and Piston as Compose dependencies (rule 51), so all five dependencies move together.
`./full-app logs sidecar|piston` delegates to `docker compose logs`.
Coding generation and grading need Piston on `:2000`; embedding-dependent stages need the sidecar on `:8200`.

## Required Workflow

1. Run `./full-app status full` before changing process state.
2. Start with `./full-app start full` or restart with `./full-app restart full` only when clean state is required.
3. Verify `http://127.0.0.1:8000/health`, `http://localhost:5173/study/sign-in`, the sidecar `/health` on `:8200`, and Piston `/api/v2/runtimes` on `:2000` before opening Chromium.
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

## Log Tracing

Copy the `X-Request-ID` from devtools/network or the typed error's `requestId` and join it to backend lines with `./full-app logs intelligence --grep <request-id>`.
Frontend mints one id per logical call and reuses it across retries; the backend echoes it and logs every request and error with it.

## Process Safety

The lifecycle manager owns `.dev/full-app/state.json` and its managed process groups.
Do not hand-edit its state while managed processes are running.
Do not kill port listeners until you identify the owning process.
Leave unrelated listeners and containers untouched.
