# Handover — 2026-08-14 Issue #37 review-fix sweep: verify the new ingestion code end-to-end

## Entry point

- **Branch:** `phase2/issue-37`. Session commits (unpushed):
  - `518e060` feat(intelligence): harden ingestion backpressure and Gemini layer (#37)
  - `0a58fc2` fix(intelligence): ship poll quantity as fix-forward migration (#37)
  - Prior session work: `55afc04` (ingestion readiness sweep), `2cf38fd` (#36 library).
- **Plan:** `.work/plans/archive/2026-08-14-material-ingestion-readiness/PLAN.md`
  (decisions D-01..D-05, no-deferral rule).
- **Running log:** same folder, `VERIFICATION.md` — the last entry (2026-08-14
  "Post-review fix sweep") documents every change below plus the 006 correction.
- **GitHub:** issue https://github.com/rings0fsaturn/study-planner/issues/37.
  `gh` needs the token + bounded-retry recipe in
  `.agents/rules/52-github-cli-and-token.agents.md`.
- **Rules to read before touching anything:** `16-live-e2e-authoring.agents.md`,
  `10-runtime-and-e2e.agents.md`, `36-supabase-live-stack.agents.md`,
  `53-wsl-dev-runtime.agents.md`.

## Session summary

A `/code-review` of `2cf38fd...HEAD` (issue #37) found Standards + Spec gaps:
backpressure was the one acceptance criterion unimplemented; the Gemini layer
had a flat 429/credential taxonomy, fixed-delay retries, per-chunk PATCH
writes, and per-call HTTP clients. All five fix phases landed and are
unit-tested; the service suite is **204 passed + 5 pre-existing baseline
golden-fixture failures** (`test_v1_integration.py`, untouched), contracts
**6/6**, app suite **668/668**, typecheck + lint + ruff clean.

### What changed (details in VERIFICATION.md sweep entry)

- **Backpressure:** `WorkerConfig.max_in_flight` (env `INGESTION_MAX_IN_FLIGHT`,
  default 1) → `ingestion_poll(p_qty)`; queue double honors `quantity`.
- **Gemini:** 429 w/ `Retry-After` or rate-limit hint → retryable
  `rate_limited` (honors hint, capped 60 s); 401/403 → terminal
  `provider_credentials`; full-jitter backoff (injectable `random_fn`);
  token-budget batch split (`INGESTION_MAX_BATCH_TOKENS`, default 4000);
  zero-vector chunks → embedder returns `None`, worker flags them.
- **Bulk writes:** migration `011` (`ingestion_update_chunk_embeddings` RPC,
  material-guarded) replaces ~100 PATCHes per material.
- **Migration `012`:** `content_chunks.skipped` + NULL-scan index predicate
  `(embedding IS NULL AND skipped = false)` + publish RPC re-gated on
  non-flagged chunks; fully-flagged materials fail `validation_failed`.
- **Consistency:** `PROGRESS_BY_STAGE` (embedding = 0.6 both sides); new
  `routers/serialization.py` (`service_error`, `async_job_from_row`);
  `IngestionJob.to_async_job` reused; single `_request` helper per module.
- **Guards:** publish skips already-ready materials; `set_job_running` PATCH is
  `status=not.in.(succeeded,failed,cancelled)`.
- New public error codes `rate_limited` + `provider_credentials` in
  `ERROR_CODES`, `openapi.yaml`, `provider-error.schema.json`.
- Shared `httpx.Client` threaded through worker adapters (keep-alive).

### Migrations: PUSHED and verified live (operator step done this session)

- CLI: `~/.local/bin/supabase` v2.114.0 (it was installed all along; the plan's
  "not installed" claim was stale). Dry-run confirms nothing pending.
- Pushed `011`, `012`, and `013` (`013` = fix-forward `ingestion_poll(p_qty)` —
  **006 was already applied on the remote**, so the p_qty edit to it was
  reverted and shipped as 013; never edit 006 again, the file is annotated).
- Verified live: 2- and 3-arg `ingestion_poll` overloads, chunk-embedding RPC,
  publish RPC, `skipped` column, partial-index predicate.

## Where to test the new code end-to-end

### 1. Runtime (WSL-specific — read rule 53)

Stale Vite on `/mnt/d` and the worker's env are the two classic traps:

```bash
# Worker code changed → must restart the worker process, else it runs old code
# (and the shell may still carry a placeholder GEMINI_API_KEY; dotenv never
# overrides it — unset first).
unset GEMINI_API_KEY
pnpm dev:ingestion-worker          # or: ./full-app restart full after starting it once
```

```bash
# App/API runtime (fresh state):
./full-app restart full
# sanity:
curl -s http://127.0.0.1:8000/health
curl -sI http://localhost:5173/study/sign-in
```

Env for the worker lives in gitignored `services/intelligence/.env`
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` ~53 chars
starting `AQ.Ab8`, `SUPABASE_PUBLISHABLE_KEY`). Verify the running worker's
key by LENGTH only: `tr '\0' '\n' < /proc/<pid>/environ | awk -F= '/^GEMINI_API_KEY=/{print length($2)}'` (expect 53). Never print secrets.

### 2. Live E2E spec (the primary end-to-end test of this session's code)

Spec: `e2e/material-ingestion-live.spec.ts` — text/URL/PDF to ready with
preview, retryable failure + retry, YouTube (env-gated), cross-user denial
(env-gated), 390x844 mobile round trip. Read rule 16 before running.

The PDF scenario uploads the **real fixture `e2e/pdf/sample-textbook-572page.pdf`**
(572 pages, ~23 MB — committed, not gitignored), so extraction, chunking, and
embedding run on realistic content; the whole book must reach `ready`, so that
test sets its own 600 s timeout with a 420 s card-ready wait. Expect the PDF
run to take several minutes and to consume a chunk of Gemini quota per run.

```bash
# Credentials for the shared dev account: .work/specs/test-login-cred.txt
# (format: `email: \`...\`` / `password: \`...\`` — never copy the values
# into source, tests, logs, or responses; read the file, don't echo it).
export E2E_LIVE_EMAIL=$(sed -n "s/^email: \`\(.*\)\`$/\1/p" .work/specs/test-login-cred.txt)
export E2E_LIVE_PASSWORD=$(sed -n "s/^password: \`\(.*\\)\`$/\1/p" .work/specs/test-login-cred.txt)
export E2E_INCLUDE_YOUTUBE=1        # optional; corporate network may block transcripts
export E2E_LIVE_EMAIL_2=...         # optional; cross-user test (only one dev account exists)
pnpm exec playwright test -c e2e/playwright.config.ts --project=app \
  e2e/material-ingestion-live.spec.ts --reporter=list
```

Last run (pre-sweep code): 5 passed, 2 skipped (env-gated). The sweep changed
worker + API behavior, so this spec MUST be re-run against the new code —
especially the PDF→ready path (bulk RPC), retry path, and status polling
(progress values now echo the stored 0.6 embedding stage).

### 3. Focused unit suites (fast first)

```bash
uv run --package intelligence pytest services/intelligence/tests/test_ingestion_worker.py \
  services/intelligence/tests/test_embeddings.py services/intelligence/tests/test_queue.py \
  services/intelligence/tests/test_repository.py -q
uv run --package intelligence pytest services/intelligence/contracts/phase2/tests -q
pnpm --filter app exec vitest run --pool=forks   # full app suite
```

## Remaining work (all still open)

1. **Live E2E run** against the new code (above) — the only unverified slice of
   the fix sweep.
2. **`./docker-app start/status/stop`** — Docker CLI not installed in this WSL
   distro; operator step on a Docker-enabled host. `./docker-app config` already
   validates. Worker container needs the new env keys in the compose env file.
3. **STATUS flip:** `.work/STATUS.md` row for this task stays Active until the
   live E2E + Docker checks pass (plan Phase 8).
4. **Push the branch** (`phase2/issue-37` → remote) once E2E is green — commits
   `518e060`, `0a58fc2` are local only. `gh` needs rule 52's token recipe.
5. Worktree note: `apps/marketing/.astro/settings.json` modified and `supabase/`
   untracked are pre-existing/unrelated — leave them alone.

## Suggested skills for the next session

- `project-rules` — load `.agents/rules/` index before touching the stack.
- `live-e2e` authoring rules (rule 16) are embedded in `.agents/rules/`; no
  separate skill file.
- `work-journal` — when the live E2E passes, append evidence to
  `VERIFICATION.md` and flip the STATUS row.
- `supabase` — any further live-stack probing (CLI credentials, RLS, pgmq).
- `git-commit-push` — for the branch push (or keep local, per user preference).
