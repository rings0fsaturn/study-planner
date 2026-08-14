# VERIFICATION — 2026-08-14 Material Ingestion and Readiness (issue #37)

## Acceptance criteria (from issue #37)

- [ ] The approved ingestion lifecycle and owner-scoped async jobs are observable
      to the learner.
- [ ] Extraction, chunking, normalized embeddings, ready gating, retry, and
      terminal failure behavior work end to end.
- [ ] Partial extracted content remains displayable while RAG generation stays
      blocked until ready.
- [ ] Queue retry, idempotency, backpressure, and representative provider
      failures are tested.

## Plan decisions (grilled 2026-08-14, user-agreed)

- D-01 separate `ingestion-worker` service; D-02 upload-then-ingest for files;
  D-03 real production adapters + deterministic test doubles; D-04 Realtime +
  bounded polling fallback; D-05 retry reuses identity, new job/correlation,
  atomic ready publish, stale-chunk invalidation. No issue-owned work deferred.

## Log

- **2026-08-14** Task opened on branch `phase2/issue-37`; PLAN.md written and
  approved in-session (grill D-01..D-05, no-deferral rule).
- **2026-08-14** Phase 1 complete: contract pack extended (retry endpoint,
  content-preview endpoint, `uploadCompleteAt` on Material, `attempt` on
  IngestionStatus/AsyncJob, `MaterialContentPreview` schema, async-job fixture,
  PIPELINES/TRACEABILITY updates) — contract tests 6/6 green. Migration
  `005_material_ingestion.sql` written (storage bucket + owner policies,
  materials ingestion columns, `ingestion_jobs`, `content_chunks` +
  `halfvec(768)` + filtered HNSW + `match_content_chunks` RPC, pgmq queues
  `material_extract/embed/publish` + `ingestion_poll/complete/send` wrappers,
  trigger-driven enqueue with jobId in payload, `complete_material_upload` RPC,
  Realtime publication). **Migration NOT pushed:** supabase CLI is not installed
  on this host — `supabase db push` is an operator step (UNCONFIRMED).
- **2026-08-14** Phase 2 complete: `app/ingestion/{models,cleaning,extractors,chunking}.py`
  with deterministic cleaning, text/URL(httpx+trafilatura+fallback)/PDF(pypdf)/
  YouTube(timestamps) extractors, structure-first chunking (400/60, ordinal,
  start_seconds carry, overlap tail budget fix). 32 tests green; new service
  deps (httpx, pypdf, tiktoken, trafilatura, youtube-transcript-api) added and
  uv.lock refreshed (additive only).
- **2026-08-14** Phase 3 complete: `embeddings.py` (Gemini batchEmbedContents
  adapter, batch 100, L2 normalization, 250/1000 ms retries, quota/timeout/
  malformed normalization), `queue.py` (SupabaseWorkQueue via RPC wrappers with
  read_ct), `repository.py` (SupabaseIngestionRepo + SupabaseStorageClient via
  REST/service role, NULL-scan resume), `worker.py` (extract→embed→publish
  stages, `_SkipMessage` idempotency, bounded redelivery via read_ct,
  atomic ready publish, D-05 chunk replacement). 22 tests green (10 worker).
- **2026-08-14** Phase 4 complete: `app/userrest.py` (user-scoped REST client,
  RLS-enforced, no service credentials in the API), `app/dependencies.py`,
  `routers/materials.py` (ingestion status, retry w/ Idempotency-Key + 202 +
  409 in-progress, content preview w/ truncation + ready gating),
  `routers/jobs.py` (`GET /v1/jobs/{jobId}`), wired into `main.py`. 11 API
  tests green (owner scope, idempotency, request identity, missing upload,
  preview, errors).
- **2026-08-14** Phase 5 complete: `app/worker_main.py` entrypoint with env
  gating (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; GEMINI_API_KEY
  warns), `docker-compose.yml` `ingestion-worker` service (same image, worker
  CMD, tuning envs), `docker/.env.example` extended, `scripts/
  dev-ingestion-worker.mjs` + `pnpm dev:ingestion-worker`, service README
  worker section. API env additions: `SUPABASE_PUBLISHABLE_KEY` in compose.
  Dev-group deps `jsonschema`/`pyyaml` added to root pyproject (contract tests
  require them; they were missing from the converged lockfile).
- **2026-08-14** Phase 6 mostly complete: app `MaterialRecord` extended
  (uploadCompleteAt/chunkCount/groundingVersion/extractedTextPath),
  `MaterialClient` gained `uploadMaterialFile` (private owner-scoped path,
  session guard), `completeUpload` (RPC), `markUploadFailed`; new
  `ingestionSubscription.ts` (Realtime postgres_changes + guarded no-op) and
  `previewClient.ts` (typed preview fetch, rule 22 normalization);
  `useMaterialLibrary` integrates Realtime + 15 s polling fallback (live flag);
  `MaterialCreate` file-upload flow (pick → create → upload → complete, upload
  failure → failed state); `MaterialDetail` partial extracted-content preview.
  Materials + pages tests 60/60 green; app typecheck + lint clean.
  **Full app suite NOT yet run to completion (interrupted).**
- **2026-08-14** Pre-existing baseline note: `test_v1_integration.py` golden
  fixtures fail 5/35 on the pristine base branch with a frozen lockfile
  (verified by stash + `uv sync --frozen`); unrelated to this ticket, recorded
  so a green-suite claim is not misread.
- **2026-08-14** Next session: finish Phase 6 verification (full app suite
  `--pool=forks`), then Phase 7 (E2E spec, full suites, Docker verification,
  /code-review) and Phase 8 (commit). Operator steps: `supabase db push` for
  migration 005; set `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`,
  `SUPABASE_PUBLISHABLE_KEY` in runtime env for live/E2E runs.
- **2026-08-14** Continuation session. **Phase 6 finished:** full app suite
  green **623/623** (`--pool=forks`; 68 files). Two failures from the
  interrupted session were fixed: (1) `MaterialLibrary.test.tsx` realtime mock
  assigned plain functions into `liveChannel`, so `toHaveBeenCalledWith` on a
  non-spy threw — mock now builds `vi.fn()`s typed as
  `Mock<[args...], FakeChannel>` (vitest 1.6 tuple form) and the hoisted
  `liveChannel` holds the same spies; (2) `PreSessionSetup.test.tsx` had a
  half-edited fixture (`estimatedMinutes` 45→90 left the 45 expectation
  dangling; `withSelectedMaterial` copies `estimatedMinutes` verbatim, so the
  original 45 was the correct intent — reverted). App typecheck + lint clean.
- **2026-08-14** **Phase 7 partial.** E2E spec authored:
  `e2e/material-ingestion-live.spec.ts` — 7 tests: plain text to ready with
  partial preview, web URL to ready, retryable failure (unroutable URL) +
  retry-observes-new-attempt, PDF upload (programmatic minimal-PDF fixture) to
  ready, YouTube gated on `E2E_INCLUDE_YOUTUBE=1` (corporate network can block
  transcripts), cross-user denial gated on `E2E_LIVE_EMAIL_2`/`_PASSWORD_2`
  (only one dev account exists), and a 390x844 mobile round trip. Verified it
  compiles and lists under `pnpm exec playwright test -c e2e/playwright.config.ts
  --project=app --list`. Full suites: service **120 passed + 5 pre-existing
  golden-fixture failures** (`test_v1_integration.py`, verified pre-existing on
  base; service diffs to calibration/main are import-order only), contracts
  **6/6**, app **623/623**, app typecheck ✅, app lint ✅ (exit 0),
  `pnpm --filter app build` ✅, marketing build ✅ (6 pages). Ruff on
  `services/intelligence/app` + `tests`: only 1 pre-existing E501 in the
  untouched `test_v1_integration.py:103` (101 chars on base too).
- **2026-08-14** **Migration confirmed NOT pushed:** PostgREST probe of the dev
  project returns `column materials.upload_complete_at does not exist` for
  `materials`; supabase CLI is not installed on this host. Live E2E and full
  Docker start remain operator-gated on `supabase db push` of 005.
- **2026-08-14** Operator env prepared (gitignored): `SUPABASE_PUBLISHABLE_KEY`
  + `SUPABASE_SERVICE_ROLE_KEY` added to `services/intelligence/.env`
  (`GEMINI_API_KEY` was already present; `get_user_client` reads env per
  request, so the running API picks them up without a restart). Worker boot
  sanity: `pnpm dev:ingestion-worker` passes the env gate, starts against the
  dev project, polls `ingestion_poll` (404 — migration missing) and backs off
  gracefully as designed. `./docker-app config` exits 0.
- **2026-08-14** Remaining before the ticket can close: operator runs
  `supabase db push` (005), then the live E2E (`pnpm exec playwright test -c
  e2e/playwright.config.ts --project=app e2e/material-ingestion-live.spec.ts`)
  and `./docker-app start`/`status`/`stop`; then `/code-review`, STATUS row
  flip, and the `phase2/issue-37` commit.
- **2026-08-14** **Granular test-fix-review sweep (gates 0-11, this session).**
  Every layer was tested red-first at unit level, fixed, rerun green with its
  dependency layer, then verified live where the contract touches Supabase.
  Full evidence in `SCRATCHPAD.md` (rides into archive with the task folder).
  - **Gate 0 (baseline truth):** migrations 003..010 all applied (dry-run "up
    to date"); `ingestion_poll` 006 signature live; queues/policies/bucket/
    realtime confirmed; worker + API + app healthy; baseline 68 ingestion
    tests green. Handover (migrations pushed) correct; STATUS.md row was stale.
  - **Gate 1 (models/cleaning/extraction):** 3 real bugs fixed:
    (1) trafilatura success path returned uncleaned text; (2) PDF path
    returned uncleaned text; (3) youtube-transcript-api v1 returns
    `FetchedTranscriptSnippet` dataclasses, code indexed `item["start"]` — every
    YouTube material failed retryable `provider_unavailable`. Snippet objects
    now handled via attribute access. HttpxFetcher closes self-created clients.
    New `test_models.py` (11) + 14 extractor tests.
  - **Gate 2 (chunking):** rewritten — exact joined-text token budget (separator
    costs count), indivisible oversized token kept whole (was infinite
    recursion), `target < 1` -> ValueError, exact-budget overlap tails. 17 tests.
  - **Gate 3 (embeddings):** empty batch = no request; non-numeric/non-finite
    values -> `malformed_output` (raw ValueError leaked before); injectable
    `sleep_fn` (retry delays 0.25/1.0 asserted, no real waiting); client
    lifecycle closed. 15 tests.
  - **Gate 4 (queue/storage/repository):** timeouts now `provider_timeout`
    (was swallowed as `provider_unavailable`); malformed poll JSON ->
    `malformed_output`; halfvec rejects non-finite; exact request-shape and
    ordering tests (delete-before-insert, bare-array chunks). 26 tests.
  - **Gate 5 (worker):** `_guard` now validates job/material binding + job
    owner + payload owner; extract stage restricted to `{pending, extracting}`
    (stale extract messages skipped instead of re-extracting); embedder count
    mismatch fails the attempt (was silent zip + busy loop); failure-state
    persistence failure redelivers instead of archiving an unrecorded failure
    (`_PersistenceFailure`); publish moved to a `publish_ready` repo seam.
    19 tests.
  - **Gate 6 (live persistence):** new migrations pushed + probed live:
    `007_atomic_publish_and_rls_hardening.sql` (transactional
    `ingestion_publish_ready` RPC, duplicate-enqueue guard in the trigger,
    server-owned column revoke), `008_server_owned_column_guard.sql`
    (BEFORE UPDATE guard trigger — the 007 column REVOKE proved ineffective
    against Supabase's table-level grants; dev PATCH of chunk_count now 403
    42501, service role 204). Probes: trigger enqueue exactly once; repeated
    pending PATCH creates no duplicate job; file material without
    `upload_complete_at` gets no job; dev-user `complete_material_upload`
    enqueues; retry after failure = attempt 2, no attempt 3; unembedded-chunk
    publish rejected; atomic publish -> material ready + job succeeded.
  - **Gate 7 (FastAPI boundary + retry decision):** user-approved DB-atomic
    retry. `009_db_atomic_retry.sql`: `retry_material_ingestion` RPC (owner
    check, row lock, in-flight idempotency — double-call returns the same job);
    `010_fix_retry_rpc_uuid.sql` fixed a uuid-cast bug found by the live probe.
    FastAPI retry endpoint removed (header-only idempotency, no dedup), along
    with `userrest._patch`/`set_material_pending`; `MaterialClient.retryIngestion`
    now calls the RPC; openapi.yaml/PIPELINES.md/TRACEABILITY.md updated. Live:
    retry -> new attempt, double-call -> same job id, no-job -> error; a full
    live retry loop reached `ready` through the worker.
  - **Gate 8 (React client/lifecycle):** new `previewClient.test.ts` (9),
    `ingestionSubscription.test.ts` (8), `useMaterialLibrary.test.tsx` (10,
    fake-timer polling, stops on SUBSCRIBED, resumes on error, cleanup);
    materialClient failure matrix (5). Production fixes: subscription skips
    payloads without an id; realtime updates now re-apply `includeArchived`
    (an archived row leaves the non-archived library instead of lingering).
  - **Gate 9 (UI readiness):** `PracticeThis` blocks a direct route for every
    non-ready state (was: "Start practice run" on a processing material);
    file replacement removed from the replace grid (no upload path existed —
    a file replace would have enqueued a missing object); `MaterialCreate`
    sequence tests (completion failure -> failed + markUploadFailed once, no
    completion after upload failure, PDF required, busy state);
    `MaterialDetail` polls while processing with a self-stopping 5s interval.
  - **Gate 10 (runtime):** worker restarted on the new code (old process had
    pre-change code); live smoke material reached `ready` with chunk_count +
    grounding_version through the atomic RPC. Docker: compose file validates
    (3 services; web+intelligence healthchecked; worker `unless-stopped`);
    `docker` CLI is not installed in this WSL distro (Docker Desktop
    integration), so `./docker-app start` remains an operator step on a
    Docker-enabled host — recorded, not a config change.
  - **Gate 11 (live E2E):** spec hardened — try/finally cleanup,
    pageerror + console error capture, all source-grid locators scoped,
    attempt-level retry assertion through the real API, `test.setTimeout(180s)`.
    Result: **5 passed, 2 skipped** (YouTube + cross-user, env-gated as
    designed); zero page/console errors; account left clean.
  - **Final review:** service 186 passed (+ the 5 pre-existing
    test_v1_integration.py golden-fixture failures, baseline, untouched);
    contracts 6/6; app **668/668** (`--pool=forks`); root typecheck + lint
    clean; app + marketing builds green; ruff clean except the pre-existing
    E501 at test_v1_integration.py:103.
  - **Open boundaries (documented, not defects):** `ingestion_state` remains
    client-writable (mutation-boundary ticket owns that); worker has no HTTP
    healthcheck (poll-loop logs + restart policy verified instead); file
    replacement disabled in the UI until a real upload path ships.
