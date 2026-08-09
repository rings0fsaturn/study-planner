# VERIFICATION — Unblock `./full-app start full`

Plan: [`PLAN.md`](PLAN.md) · Started: 2026-08-08

## Acceptance criteria

| # | Criterion | How to verify | Status |
|---|---|---|---|
| A1 | `./full-app` executes (no `bash\r` error) | `./full-app status full` prints service rows | ✅ |
| A2 | `full-app` + `scripts/full_app.py` committed with LF terminators | `file full-app scripts/full_app.py` → "ASCII text" (no CRLF) | ✅ |
| A3 | Repo `.gitattributes` pins the POSIX launcher scripts to `eol=lf` | `git check-attr -a full-app` shows `text` + `eol=lf` | ✅ |
| A4 | `pnpm dev:intelligence` no longer exits on a missing `SUPABASE_JWT_SECRET` | `timeout 8 pnpm dev:intelligence` reaches the `uvicorn` spawn (or `./full-app start full` boots intelligence) | ✅ |
| A5 | Intelligence service healthy on :8000 | `curl -sf http://127.0.0.1:8000/health` → 200 | ✅ |
| A6 | React app healthy on :5173 | `curl -sf http://localhost:5173/study/sign-in` → 200 | ✅ |
| A7 | `./full-app status full` reports both `health=healthy` | `./full-app status full` | ✅ |
| A8 | No regression in typecheck/lint/app-tests | `pnpm -r typecheck`, `pnpm -r lint`, `pnpm --filter @study-tracker/app test` green | ✅* |

`*` — see the 2026-08-08 handoff-agent entry below: 2 TZ-sensitive app tests fail under the
default vitest threads pool on WSL (pre-existing, environmental); 563/563 green with
`--pool=forks`. typecheck + lint fully green.

## Log

- **2026-08-08 (handoff agent)** Executed Phase 1–4 per PLAN.md; committed `3d4589a`.
  - **A1–A3 ✅** — `full-app`/`scripts/full_app.py` confirmed LF (`file` → ASCII text; index
    blobs were already LF — CRLF was a checkout artifact). Created repo-root `.gitattributes`
    (4 lines: `full-app`, `scripts/full_app.py`, `scripts/dev-intelligence.mjs`, `*.sh` →
    `text eol=lf`); `git check-attr -a` confirms `text`+`eol=lf` on all four. Committed with
    the gate change in `3d4589a` (`fix(infra): unblock ./full-app start full …`).
  - **A4 ✅ (Option B)** — `scripts/dev-intelligence.mjs`: `SUPABASE_JWT_SECRET` gate demoted
    to a `console.warn` (no exit); added a `SUPABASE_URL` required-exit gate. Verified with
    `env -u SUPABASE_JWT_SECRET -u SUPABASE_URL timeout 20 pnpm dev:intelligence` → warning
    printed, `uvicorn` spawned on :8000 (killed after). Kept the HS256 warning message so a
    symmetric project isn't silently misconfigured.
  - **A5/A6/A7 ✅** — `./full-app start full` → both services running;
    `curl -sf http://127.0.0.1:8000/health` → 200; `curl -sf
    http://localhost:5173/study/sign-in` → 200; `./full-app status full` →
    `intelligence … health=healthy` / `app … health=healthy`.
  - **Extra fix during boot:** the app's first start failed with
    `Cannot find module '@rollup/rollup-linux-x64-gnu'` — the `node_modules` was
    Windows-built (no Linux rollup optional dep). `pnpm install --force` reinstalled native
    deps (done in 1m37s); second start clean. Recorded here + in STATUS.md.
  - **A8 ✅*** — `pnpm -r typecheck` 0 errors (app tsc + marketing astro check); `pnpm -r
    lint` clean; `pnpm --filter @study-tracker/app test` → **561/563** under the default
    threads pool, **563/563** with `vitest run --pool=forks`. The 2 failures are
    `seedTestData.test.ts` TZ assertions ("uses the browser-local date key…", "books local
    today…") — off-by-one dates because the mid-run `process.env.TZ='Asia/Kolkata'` mutation
    is ignored by worker threads on WSL Linux (plain `node -e` respects it; forks pool
    respects it). Pre-existing environmental flake, unrelated to the launcher changes (which
    touch zero app source). Follow-up: either set the pool to `forks` or rewrite the tests to
    seed TZ via `NODE_OPTIONS`/`TZ` env at worker start.
  - **`./.venv`** existed and was used by the intelligence launcher (`uv run --package
    intelligence uvicorn …`) — no re-sync needed.

- **2026-08-08 (diagnosis session)** Blocked start reproduced and root-caused.
  - Blocker 1: `file full-app` → "with CRLF line terminators"; `./full-app` →
    `/usr/bin/env: 'bash\r': No such file or directory`. Applied `sed -i 's/\r$//'` to
    `full-app` + `scripts/full_app.py` (kept in tree, uncommitted). Re-ran
    `./full-app status full` → `intelligence: stopped port=8000` / `app: stopped
    port=5173` ✅ (launcher now executable; A1 satisfied locally, A2/A3 pending commit).
  - Blocker 2: `timeout 15 pnpm dev:intelligence` → printed
    "SUPABASE_JWT_SECRET is required for dev:intelligence." and exited 1 before
    spawning `uv` (`scripts/dev-intelligence.mjs:14-19`). Confirmed `security.py:76-86`
    dispatches on JWT `alg` header and supports ES256/JWKS WITHOUT a secret; the gate is
    stricter than the service design. `.env` has the secret commented out.
  - Blocker 3: ran `uv sync` at repo root → created `./.venv` (gitignored) with
    `intelligence`, `py-progress`, `py-roadmap-engine`, `uvicorn 0.49.0`.
    `uv run --package intelligence python -c "import uvicorn"` resolves. Cleared.
  - Non-blockers confirmed: `lsof`/`ps`/`python3`/`uv`/`node`/`pnpm` present in WSL;
    `services/intelligence/.env` + `apps/app/.env.local` populated; ports :8000/:5173
    free.
  - **Next:** handoff agent executes Phase 1–4 in PLAN.md. A2–A8 pending.