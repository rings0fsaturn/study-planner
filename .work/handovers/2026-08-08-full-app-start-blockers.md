# Handover — Unblock `./full-app start full`

**Date:** 2026-08-08 · **From:** diagnosis session (opencode) · **To:** next implementation agent
**Plan:** `.work/plans/active/2026-08-08-full-app-start-blockers/PLAN.md`
**Log:** `.work/plans/active/2026-08-08-full-app-start-blockers/VERIFICATION.md`

## TL;DR

`./full-app start full` won't start. Three blockers found; one already removed locally.
You need to: commit the CRLF fix + add `.gitattributes`, relax the JWT-secret gate in the
intelligence launcher, then boot the stack and run the smoke regression.

## Environment

- Host is WSL Linux at `/mnt/d/study/git/study-planner-web` (the user also pointed at
  Windows Python `C:\Users\user\AppData\Local\Programs\Python\Python313`, but the repo's
  `./full-app` is POSIX-only — run it from the WSL shell, not Windows cmd/PowerShell).
- In WSL: `python3` (pyenv 3.13), `uv 0.11.7`, `node v24.14.0`, `pnpm 10.33.2`, `lsof`,
  `ps` are all present. The STATUS.md gotcha "Python/uv absent on this host" is stale
  for WSL — it is only true in a native Windows shell. Update that gotcha when done.
- `./.venv` (workspace root, gitignored) was created this session by `uv sync` and already
  contains `intelligence` + `uvicorn`. If you blow it away, re-run `uv sync` at repo root.

## The three blockers

1. **CRLF on launcher scripts (FATAL).** `full-app` (bash) + `scripts/full_app.py` had
   CRLF; shebangs broke with `bash\r: No such file or directory`. No `.gitattributes`
   exists — whole-tree CRLF is autocrlf fallout (out of scope to renormalize fully). 
   **Already done locally (uncommitted):** `sed -i 's/\r$//' full-app scripts/full_app.py`.
   `./full-app status full` now runs. You commit it + a minimal `.gitattributes` pinning
   the POSIX scripts to `eol=lf`:
   ```
   full-app text eol=lf
   scripts/full_app.py text eol=lf
   scripts/dev-intelligence.mjs text eol=lf
   *.sh text eol=lf
   ```
2. **JWT-secret gate (FATAL).** `scripts/dev-intelligence.mjs:14-19` hard-exits if
   `SUPABASE_JWT_SECRET` is unset. `services/intelligence/.env` has it commented out
   ("Not needed — ES256/JWKS"). The service code `app/security.py:76-86` dispatches on
   the JWT `alg` header and supports ES256/RS256 via JWKS with **no** secret. So the gate
   is stricter than the service. **Fix (Option B, recommended):** change the gate to
   require `SUPABASE_URL` and only **warn** (console.error, but don't exit) when
   `SUPABASE_JWT_SECRET` is missing. Alternate Option A: set the real secret in
   `services/intelligence/.env` (Supabase dashboard → Settings → API → JWT Secret); never
   commit it.
3. **Missing intelligence venv (resolved this session).** `uv sync` at repo root created
   `./.venv`. Just ensure `./.venv` exists before booting; recreate with `uv sync` if gone.

## Exact steps

1. Audit current state: `file full-app scripts/full_app.py` (should already be LF),
   `git status --short full-app scripts/full_app.py`.
2. Create `.gitattributes` at repo root with the four lines above.
3. Edit `scripts/dev-intelligence.mjs`: replace the hard `process.exit(1)` block
   (lines 14-19) — require `SUPABASE_URL` (exit if absent); demote the `SUPABASE_JWT_SECRET`
   absence to a warning. Keep the message so an HS256 project is not silently broken.
4. `git add full-app scripts/full_app.py scripts/dev-intelligence.mjs .gitattributes` and
   commit (the user will tell you when to commit — do not push unprompted).
5. `./full-app start full` — wait for both `started` lines.
6. `./full-app status full` — both `health=healthy`.
7. Smoke (do not regress the 2026-08-08 green baseline):
   `pnpm -r typecheck && pnpm -r lint && pnpm --filter @study-tracker/app test`.
8. Update `.work/STATUS.md`: add/flip the `[APP][INFRA]` row to Done with commit SHA;
   fix the two gotchas (CRLF → resolved via .gitattributes; "Python/uv absent" →
   present-in-WSL). Append the result to VERIFICATION.md (A1–A8 ✅).

## Stop conditions / when to escalate

- If `./full-app start full` still fails intelligence health after Phase 2, read
  `.dev/full-app/logs/intelligence.log` — likely a missing env var or a Supabase JWKS
  fetch failure (network). Report the log tail; do not invent a fix.
- If typecheck/lint flag CRLF in other files, that's the separate tree-wide renormalize
  task — **do not expand scope** here. Note it and stop.
- Do not run on Windows cmd/PowerShell — `./full-app` + `scripts/full_app.py` use `lsof`,
  `ps`, `os.getpgid`, `os.killpg`, `start_new_session=True` (POSIX-only). WSL only.

## Files touched this session (state of the tree)

- `full-app` — CRLF stripped (uncommitted). WAS "with CRLF line terminators".
- `scripts/full_app.py` — CRLF stripped (uncommitted).
- `.venv/` — created by `uv sync` (gitignored; not committed).
- No app/engine source modified.