---
name: playwright-full-app-lifecycle
description: Run Playwright against the full StudyTracker app using the managed lifecycle CLI
---

# Playwright Full App Lifecycle

## When This Rule Applies

Use this rule before running browser/e2e tests that touch the StudyTracker React app,
authenticated routes, or the intelligence service.

The full app is managed by `./full-app`, not by manually chaining Vite and uvicorn.
The default full profile starts:

| Service | URL | Manager profile |
|---|---|---|
| Intelligence service | `http://127.0.0.1:8000/health` | `intelligence` |
| React app | `http://localhost:5173/study/` | `app` |

The `full` profile means `intelligence` + `app`. The `all` profile also includes
the Astro marketing site on `http://localhost:4321/`.

## Standard Lifecycle Commands

```bash
./full-app status full      # inspect before touching process state
./full-app start full       # idempotent
./full-app stop full        # idempotent
./full-app restart full     # use when you need a clean backend/frontend pair
```

`pnpm dev:full` is expected to call `./full-app start full`. Prefer the direct
`./full-app` commands for explicit process lifecycle work.

## Process State and Logs

The Python lifecycle manager owns process state under `.dev/full-app/`.

| Path | Purpose |
|---|---|
| `.dev/full-app/state.json` | Managed PIDs, process groups, ports, health URLs, and log paths |
| `.dev/full-app/logs/intelligence.log` | Intelligence service output |
| `.dev/full-app/logs/app.log` | Vite app output |
| `.dev/full-app/logs/marketing.log` | Astro marketing output when using `all` or `marketing` |

Do not hand-edit `.dev/full-app/state.json` unless the file is obviously corrupt
and all managed processes have already been stopped.

## Port Conflict Policy

The manager must not kill processes it did not start. If startup reports a blocked
port, inspect the listener before taking action:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:4321 -sTCP:LISTEN
```

If the process is unrelated, leave it alone and report the conflict. If it is a
known stale local dev process, stop it deliberately by PID or from the owning
terminal, then rerun:

```bash
./full-app start full
```

## Playwright Commands

Use the repo Playwright config explicitly:

```bash
pnpm exec playwright test -c e2e/playwright.config.ts --project=app --reporter=list
```

For a focused real-login Chromium check, run:

```bash
pnpm exec playwright test -c e2e/playwright.config.ts --project=app e2e/roadmap-booking-live.spec.ts --reporter=list
```

The Playwright config should keep `webServer` at the top level and use
`pnpm dev:full` for the app server. Do not put `webServer` inside a project entry.

## Effective Browser Test Methodology

1. Run `./full-app status full`; if stopped, run `./full-app start full`.
2. Verify the service endpoints before opening Chromium — `curl -i http://127.0.0.1:8000/health`
   and `curl -i http://localhost:5173/study/sign-in`.
3. Run the smallest relevant Playwright test first.
4. If a browser test fails, inspect `.dev/full-app/logs/` before changing app code.
5. Use `./full-app restart full` only when logs or state suggest stale runtime state.
6. Leave the app running only when the user wants to try it; otherwise run
   `./full-app stop full`.

## Common Mistakes

- Do not start app e2e runs with `pnpm dev:app`; it skips the Python service.
- Do not use `localhost:8000` for intelligence health checks in this environment;
  use `127.0.0.1:8000`.
- Do not reintroduce `wait-on http-get://localhost:8000/health`; it caused the
  original localhost vs `127.0.0.1` mismatch.
- Do not kill port listeners blindly. The manager intentionally fails with
  diagnostics for foreign processes.
- In Codex/macOS sandboxed runs, Chromium may need escalated execution if it
  fails with Mach port or browser-launch permission errors.
