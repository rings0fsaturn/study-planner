---
title: Unblock `./full-app start full` — CRLF shebang + Intelligence JWT-secret launcher gate
status: in_progress (diagnosed; fix phases pending handoff agent)
created: 2026-08-08
owner: handoff agent
tags: [APP, INFRA]
profile: full = [intelligence, app]
---

# Unblock `./full-app start full`

## Problem

`./full-app start full` (the managed dev stack: Intelligence Service on :8000 + React
app on :5173) does not start. Three independent blockers were identified empirically in
this session on the WSL/Linux host (`/mnt/d/study/git/study-planner-web`).

## Root-cause findings (verified)

### Blocker 1 — `full-app` shell script has CRLF line endings (FATAL for the launcher)

`full-app` is a bash script whose shebang is `#!/usr/bin/env bash`. The working tree copy
has **CRLF** terminators (`file` reports "with CRLF line terminators"), so executing
`./full-app` fails before any code runs:

```
/usr/bin/env: 'bash\r': No such file or directory
```

- `scripts/full_app.py` also has CRLF (its `#!/usr/bin/env python3` shebang is likewise
  at risk; the Python body itself tolerates CRLF).
- **Systemic cause:** there is **no `.gitattributes`** in the repo and `core.autocrlf` is
  unset. A Windows checkout converted LF→CRLF across the whole tree — evidenced by the
  enormous `git status` (nearly every file shows ` M`). Node/pnpm/Vite tolerate CRLF, so
  the app/marketing dev servers are *not* blocked by it; only the POSIX shell + Python
  launcher scripts are.
- **Session action taken (reversible, kept in place):** `sed -i 's/\r$//' full-app
  scripts/full_app.py` was applied to strip CRLF from the two launcher scripts. After
  stripping, `./full-app status full` runs clean (`intelligence: stopped port=8000` /
  `app: stopped port=5173`). This is **Fix Phase 1** applied locally but NOT committed.

### Blocker 2 — `pnpm dev:intelligence` hard-requires `SUPABASE_JWT_SECRET` (FATAL)

`scripts/dev-intelligence.mjs:14-19` exits 1 if `SUPABASE_JWT_SECRET` is unset, before it
ever spawns `uv`:

```
SUPABASE_JWT_SECRET is required for dev:intelligence. ...
 ELIFECYCLE  Command failed with exit code 1.
```

- `services/intelligence/.env` has the secret **commented out** with a note: "Not needed
  for this project — it signs ES256 (asymmetric). The service verifies ES256/RS256 tokens
  via the public JWKS endpoint at SUPABASE_URL."
- The service's own auth code (`services/intelligence/app/security.py:76-86`) **dispatches
  on the JWT `alg` header at request time**: HS256 → needs the secret (`:69-73`); ES256/RS256
  → JWKS via `SUPABASE_URL` only (`:57-66`). The JWKS path needs **no** secret.
- Supabase project `kabpmbhlvfbrhtbxjaua` uses the new `sb_publishable_…` key format
  (`apps/app/.env.local`), i.e. the asymmetric era — consistent with the ES256/JWKS claim.
- **Therefore the launcher gate is stricter than the service's own design.** The
  `apps/app/.env.example` *does* document "the Intelligence Service also requires
  SUPABASE_JWT_SECRET", so the gate matches old intent — but it is now too strict for an
  ES256-only project and blocks cold start with no way to run JWKS-only.

### Blocker 3 — Intelligence Python venv absent (resolved this session)

`services/intelligence` had no venv. `uv sync` (run from repo root this session) created
`./.venv` at the workspace root with `intelligence`, `py-progress`, `py-roadmap-engine`,
`uvicorn`, etc. — `uv run --package intelligence python -c "import uvicorn"` resolves to
`./.venv/lib/python3.12/site-packages/uvicorn`. **Not a remaining blocker**; recorded so
the handoff agent knows the venv must exist (`uv sync` at repo root) on a fresh checkout.

## Non-blockers (confirmed OK)

- `lsof`, `ps`, `python3`, `uv` are all present in this WSL shell (the STATUS gotcha
  "Python/uv absent on this host" is stale for the WSL bash environment — it is true only
  for a native Windows `cmd`/PowerShell shell).
- `services/intelligence/.env` exists with `SUPABASE_URL` + `CORS_ORIGINS` set.
- `apps/app/.env.local` has `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` +
  `SUPABASE_SERVICE_ROLE_KEY` (the app reads these via Vite `loadEnv`; no `VITE_`-prefix
  needed — prior session ran `pnpm dev:app` green).
- Node v24.14.0 + pnpm 10.33.2 present; `node_modules` populated.
- No foreign process holds :8000 or :5173 (`./full-app status full` reports both stopped).

## Fix plan (phased)

### Phase 1 — Strip CRLF on launcher scripts (APPLIED locally this session, needs commit)

- `full-app` and `scripts/full_app.py`: LF terminators. (Done via `sed -i 's/\r$//'`.)
- **Durable fix:** add a repo-root `.gitattributes` so `git` never re-introduces CRLF on
  the POSIX scripts. Minimal safe set (do not force-renormalize the whole tree in this
  task — that's a separate, larger cleanup):
  ```
  full-app text eol=lf
  scripts/full_app.py text eol=lf
  scripts/dev-intelligence.mjs text eol=lf
  *.sh text eol=lf
  ```
- Commit the stripped scripts + `.gitattributes` together. Verify `./full-app status
  full` still runs clean post-commit.

### Phase 2 — Clear the Intelligence JWT-secret launcher gate

Pick ONE (recommend Option B unless the user prefers HS256):

- **Option B (recommended; matches security.py's dual-mode design):** relax
  `scripts/dev-intelligence.mjs:14-19` so it requires `SUPABASE_URL` (needed for both
  JWKS and as the service base) and only **warns** (not exits) when
  `SUPABASE_JWT_SECRET` is absent. The service decides per-token at request time, so a
  JWKS-only project boots. Keep an explicit console warning so an HS256 project isn't
  silently misconfigured.
- **Option A (alternate; supply the secret):** obtain the project JWT secret from the
  Supabase dashboard (Project Settings → API → JWT Secret) and set
  `SUPABASE_JWT_SECRET=…` in `services/intelligence/.env`. This satisfies the existing
  gate; the HS256 path then also works. Use this if the project is actually on HS256 or
  if the team wants the symmetric path live.

  > Do NOT commit the secret. `services/intelligence/.env` must stay gitignored.

### Phase 3 — Boot the full stack and verify health

```
./full-app start full
./full-app status full
```

Acceptance (see VERIFICATION.md):
- `intelligence: running … health=healthy` (GET `http://127.0.0.1:8000/health` → 200).
- `app: running … health=healthy` (GET `http://localhost:5173/study/sign-in` → 200).
- `http://localhost:4321/` reachable if `./full-app start all` (marketing optional).

### Phase 4 — Smoke regression (do not regress the green baseline)

From the prior 2026-08-08 prototype session these were green; reconfirm after the line-ending
+ launcher edits:
```
pnpm -r typecheck
pnpm -r lint
pnpm --filter @study-tracker/app test
```
The CRLF strip touched only 2 launcher scripts + added `.gitattributes`; no app/engine
source changed, so expect no test deltas. If typecheck/lint flag CRLF in other files,
that's the *separate* tree-wide renormalize task — out of scope here; do not expand.

## Out of scope

- Tree-wide CRLF→LF renormalization (`.gitattributes` `* text=auto eol=lf` + `git add
  --renormalize .`). The whole-tree `git status` noise is autocrlf fallout; handle as a
  dedicated INFRA task to avoid a massive diff here.
- Production deploy / OQ-03 Intelligence Service deploy, auth, CORS for prod.
- Anything past `./full-app start full` booting healthy.

## Next action (for the handoff agent)

1. Commit Phase 1 (`full-app`, `scripts/full_app.py` stripped + new `.gitattributes`).
2. Apply Phase 2 Option B (edit `scripts/dev-intelligence.mjs`).
3. Run `./full-app start full`; confirm both healthy (Phase 3).
4. Run the Phase 4 smoke; reconfirm green.
5. Update `.work/STATUS.md` gotchas: mark CRLF gotcha resolved-by-attribute; update the
   "Python/uv absent" gotcha to say present-in-WSL. Flip this row to Done.