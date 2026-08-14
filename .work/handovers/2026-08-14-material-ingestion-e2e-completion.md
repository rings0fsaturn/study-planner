# Handover — 2026-08-14 Material Ingestion (issue #37): finish the live E2E and ship

## Entry point

- **Branch:** `phase2/issue-37` (from `project/phase-2`). Nothing is committed yet.
- **Plan:** `.work/plans/active/2026-08-14-material-ingestion-readiness/PLAN.md`
  (grilled decisions D-01..D-05, no-deferral rule).
- **Running log:** same folder, `VERIFICATION.md` (acceptance criteria + per-phase evidence).
- **GitHub:** issue https://github.com/rings0fsaturn/study-planner/issues/37.
  `gh` needs the token + bounded-retry recipe in `.agents/rules/52-github-cli-and-token.agents.md`.
- **New rules to read before touching anything:** `16-live-e2e-authoring.agents.md`,
  `36-supabase-live-stack.agents.md`, `53-wsl-dev-runtime.agents.md`
  (all added today; capture this session's pitfalls).

## What this session already changed

### Migrations are PUSHED (operator step done)

- `supabase` CLI installed at `~/.local/bin/supabase` (was missing; not on PATH).
- Migration `005_material_ingestion.sql` applied to the dev project
  (`kabpmbhlvfbrhtbxjaua`) plus a new `006_fix_ingestion_poll.sql` that fixes a
  live bug (see below). Run `~/.local/bin/supabase db push --dry-run --linked
  --project-ref kabpmbhlvfbrhtbxjaua` from `apps/app/` to confirm nothing is pending.
- **Never pass `--password` to `db push`.** The CLI holds a cached DB credential
  from the original `supabase link`; a wrong `--password` (including the
  service-role key) overrides it and auth fails. An empty `--password` also works
  (falls back to the cache) but do not rely on that.
- Inspect live state with `~/.local/bin/supabase db query --linked --project-ref
  kabpmbhlvfbrhtbxjaua "SELECT ..."` (e.g. material states, pgmq queue contents,
  `pg_proc` signatures).

### Runtime env (gitignored, never commit)

`services/intelligence/.env` now holds `SUPABASE_URL`, `CORS_ORIGINS`,
`GEMINI_API_KEY` (REAL key: ~53 chars, starts `AQ.Ab8`; the old value was a
placeholder ending `LE_KEY`), `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_PUBLISHABLE_KEY`.

**Critical gotcha:** the shell may still carry the old placeholder as an
exported `GEMINI_API_KEY`. dotenv never overrides existing vars, so the worker
would use the placeholder. Always `unset GEMINI_API_KEY` before starting the
worker, then verify the running process has the right value by comparing LENGTHS
only: `tr '\0' '\n' < /proc/<pid>/environ | awk -F= '/^GEMINI_API_KEY=/{print length($2)}'`
(expect 53). Never print secret values.

### Live-verification bugs found and FIXED this session (all uncommitted)

1. **`ingestion_poll` wrapper broke against hosted pgmq.** Hosted pgmq has no
   two-argument `pgmq.read`; signature is `read(queue_name, vt, qty, conditional)`.
   Fix shipped as new migration `006_fix_ingestion_poll.sql` (rule 35: never
   rewrite an applied migration). Symptom: worker poll 404 / `function
   pgmq.read(text, integer) does not exist`.
2. **Full-text storage upload was not idempotent.** `SupabaseStorageClient.upload`
   now sends `x-upsert: true`; a redelivered extract stage re-uploads the same
   deterministic path without 409. Covered by `tests/test_repository.py`.
3. **Chunk bulk insert used `{"rows": [...]}`.** Hosted PostgREST rejects that
   with PGRST204; `replace_chunks` now POSTs a bare JSON array. Covered by test.
4. **`replace_chunks` wrote `user_id: ""`** into a NOT NULL UUID column. It now
   takes the material owner id (`worker.py` call site updated, doubles updated).
5. **Gemini embeddings were 3072-dimensional.** `batchEmbedContents` defaults to
   3072 for `gemini-embedding-001`; the schema is `halfvec(768)`. The embedder
   now sends `outputDimensionality: 768` per request.
6. **Browser file upload was dead in production.** `MaterialsProvider` built
   `MaterialClient` with only the DB table surface; storage/rpc/auth were never
   wired, so the upload threw "not configured" before any network call (unit
   tests always injected fakes, so this went unnoticed). Then, after wiring,
   `supabase.rpc` was passed as the bare function where `MaterialRpcLike` needs
   `{ rpc: fn }` — pass `supabase` itself (it has `.rpc`) like the auth surface.
7. **Upload path wrongly repeated the bucket prefix.** `from('material-raw')`
   already selects the bucket; the object name must be
   `<userId>/<materialId>/<file>` or the RLS policy fails
   (`storage.foldername(name)[1]` is the first folder INSIDE the bucket).

All of these were caught by the live E2E runs, not by unit tests. Rules
`36-supabase-live-stack.agents.md` and `16-live-e2e-authoring.agents.md`
document each pitfall.

### E2E spec state (`e2e/material-ingestion-live.spec.ts`, 7 tests)

- **4 tests pass:** plain text to ready with partial preview, web URL to ready,
  retryable failure + retry observes a new attempt, mobile 390x844 round trip.
- **1 test fixed and ready to re-run: PDF upload reaches ready.** It failed for
  three stacked reasons, all now resolved: the test never set a title (fixed
  with `fillTitle`), the provider upload wiring (bug 6 above), and the RPC shape
  (bug 6 above). Last probe confirmed browser upload 200 + `complete_material_upload`
  204, and the worker carries the material to `ready` (verified end-to-end with a
  service-role probe material earlier).
- **2 gated skips (by design):** YouTube (needs `E2E_INCLUDE_YOUTUBE=1`, the
  corporate network can block transcripts) and cross-user denial (needs
  `E2E_LIVE_EMAIL_2` / `E2E_LIVE_PASSWORD_2`; only one dev account exists).
- Test-authoring bugs fixed along the way: a module-level `test.skip` was
  skipping the whole file (scoped the YouTube skip into its own `test.describe`);
  `signIn` needed default email/password args; the ready card hides its badge and
  shows the `Practice this` BUTTON while the detail page renders it as a LINK;
  create-page source buttons must be scoped to `.material-source-grid` because
  library cards carry the same words.

## Your job: run the E2E, then finish the ticket

### 1. Runtime (currently all up; restart only if needed)

```bash
./full-app status full          # intelligence :8000 + app :5173 healthy
# marketing dev :4321 must be up too (Playwright webServer list requires it):
# if missing: nohup pnpm --filter @study-tracker/marketing dev > .dev/full-app/logs/marketing.log 2>&1 &
# ingestion worker (detached launcher; unset the polluted key first!):
unset GEMINI_API_KEY
setsid nohup bash scripts/run-detached-ingestion-worker.sh >/dev/null 2>&1 </dev/null &
pgrep -f 'app[.]worker_main' | head -1 | xargs -I{} sh -c 'tr "\0" "\n" < /proc/{}/environ | awk -F= "/^GEMINI_API_KEY=/{print \"key len=\" length(\$2)}"'
```

`scripts/run-detached-ingestion-worker.sh` is a new, uncommitted helper: it cds
to the repo root and execs `node scripts/dev-ingestion-worker.mjs` with stdout
appended to `.dev/full-app/logs/ingestion-worker.log`. A bare `nohup ... &`
inside a tool command dies with the process group on timeout; the detached
launcher survives. Kill it with `pkill -f 'app[.]worker_main'` (bracket pattern
so `pkill` does not match its own command line; see rule 53).

### 2. Credentials (never print them)

```bash
export E2E_LIVE_EMAIL=$(grep -iE "^email" .work/specs/test-login-cred.txt | cut -d: -f2- | tr -d '` \r')
export E2E_LIVE_PASSWORD=$(grep -iE "^password" .work/specs/test-login-cred.txt | cut -d: -f2- | tr -d '` \r')
```

### 3. Run the suite

```bash
pnpm exec playwright test -c e2e/playwright.config.ts --project=app e2e/material-ingestion-live.spec.ts --reporter=list --workers=3
```

Expect 5 passed, 2 skipped. If the PDF test fails, do not re-debug from
scratch: re-check the browser upload path (`from('material-raw')` + object name
without bucket prefix), the `complete_material_upload` RPC request actually
firing (capture responses), and the worker's env key length.

### 4. Shared-account hygiene (after every run, before re-runs)

```bash
SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' services/intelligence/.env | cut -d= -f2- | tr -d '\r')
SUPABASE_URL=$(grep '^SUPABASE_URL=' apps/app/.env.local | cut -d= -f2- | tr -d '\r')
curl -s -X DELETE "${SUPABASE_URL}/rest/v1/materials?title=ilike.E2E%20%25" -H "apikey: ${SRK}" -H "Authorization: Bearer ${SRK}" -H "Prefer: return=minimal" -o /dev/null
curl -s -X DELETE "${SUPABASE_URL}/rest/v1/materials?title=eq.ingestion-fixture" -H "apikey: ${SRK}" -H "Authorization: Bearer ${SRK}" -H "Prefer: return=minimal" -o /dev/null
curl -s -X DELETE "${SUPABASE_URL}/rest/v1/ingestion_jobs?material_id=not.is.null" -H "apikey: ${SRK}" -H "Authorization: Bearer ${SRK}" -o /dev/null
```

The account is clean right now (last cleanup done before this handover).

### 5. Full verification after the E2E is green

App source changed since the last full run (materialClient path, provider
wiring), so re-run everything:

```bash
pnpm --filter app exec vitest run --pool=forks        # was 623/623; 2 WSL TZ tests need forks pool
uv run --package intelligence pytest services/intelligence -q        # 120 passed + 5 PRE-EXISTING golden-fixture failures in test_v1_integration.py (verified on base; do not "fix")
uv run --package intelligence pytest services/intelligence/contracts/phase2/tests -q   # 6/6
pnpm --filter app typecheck && pnpm --filter app lint && pnpm --filter app build
pnpm --filter marketing build
uv run ruff check services/intelligence/app services/intelligence/tests   # 1 pre-existing E501 in test_v1_integration.py:103 only
```

### 6. Records and commit

- Update `VERIFICATION.md` with the live-run findings (bugs 1-7 above, migration
  006, migration pushed, E2E results) and mark PLAN.md checkboxes that are now
  done (Phase 1 operator step, Phase 5 docker partial, Phase 7 E2E, Phase 8).
- Update the `.work/STATUS.md` #37 row (keep Active until verified).
- `/code-review` pass, fix findings.
- Commit everything on `phase2/issue-37`. Scope: all modified + untracked files
  listed by `git status` (app, service, migrations 005/006, e2e spec, worker
  launcher, `scripts/run-detached-ingestion-worker.sh`, new rules
  `16-live-e2e-authoring`, `36-supabase-live-stack`, `53-wsl-dev-runtime` and the
  updated `README.agents.md`, `.work/` records). **Never** commit `.env*`
  secrets (both env files are gitignored).

## Key files map

| Area | Files |
|---|---|
| Migrations | `apps/app/supabase/migrations/005_material_ingestion.sql`, `006_fix_ingestion_poll.sql` |
| Service core | `services/intelligence/app/ingestion/{worker,repository,embeddings,queue,extractors,chunking,cleaning,models}.py` |
| Service API | `services/intelligence/app/{userrest,dependencies,worker_main}.py`, `app/routers/{materials,jobs}.py` |
| App | `apps/app/src/materials/{materialClient,types,MaterialsProvider,useMaterialLibrary,ingestionSubscription,previewClient}.ts(x)`, `pages/materials/{MaterialCreate,MaterialDetail}.tsx` |
| E2E | `e2e/material-ingestion-live.spec.ts` (model: `e2e/material-library-live.spec.ts`) |
| Runtime | `scripts/run-detached-ingestion-worker.sh`, `scripts/dev-ingestion-worker.mjs`, `docker-compose.yml`, `docker/.env.example` |
| Tests | `services/intelligence/tests/{test_repository,test_ingestion_worker,test_embeddings,test_extractors,test_chunking,test_queue,test_materials_api}.py`, `tests/ingestion_doubles.py` |
| Records | `.work/plans/active/2026-08-14-material-ingestion-readiness/{PLAN,VERIFICATION}.md`, `.work/STATUS.md` |

## Pitfalls recap (details in the new rules)

- Supabase: cached CLI credential (no `--password`), PostgREST bare-array bulk
  insert, storage `x-upsert` + no bucket prefix in object names, pgmq `read`
  four-arg signature, Gemini `outputDimensionality`, verify live contracts with
  `supabase db query`.
- WSL: Vite does not watch `/mnt/d` reliably — restart the app
  (`./full-app restart full`) after ANY app-source edit or the browser runs
  stale modules; dotenv never overrides shell vars; `pkill -f` self-match trap;
  detached launcher for the worker.
- E2E: module-level `test.skip` scope, ready card hides the badge (assert
  `Practice this`), detail `Practice this` is a link, scope create-page clicks,
  workers DO inherit env (check `--reporter=json` annotations, not the shell).
- The 5 `test_v1_integration.py` golden-fixture failures are pre-existing on
  base; do not touch them.
- Worker unit tests use in-memory doubles and cannot catch RLS/PostgREST/pgmq
  contract drift; treat the live E2E as the authority for those.
