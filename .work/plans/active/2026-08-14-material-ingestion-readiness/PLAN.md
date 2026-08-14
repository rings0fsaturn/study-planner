# PLAN — 2026-08-14 Material Ingestion and Readiness (issue #37)

## How to use this plan

This is the operating manual for the implementing agent. Read it completely, then
work the phases in order. Each phase is a vertical slice with its own files, tests,
and verification. Update the phase status marker, the todo list, and
`VERIFICATION.md` in the same change as the code. Code is ground truth: if a phase
doc and the live code disagree, fix the doc.

## TL;DR + Context

- GitHub issue **#37 Material Ingestion and Readiness** (spec #32, map #4) is the
  second production vertical slice of the Phase 2 Material Library.
- Issue **#36** shipped the material library UI, `MaterialClient`, migration `004`
  (owner-scoped `public.materials`), and the `pending`/`failed` placeholder state.
- This ticket delivers **end-to-end ingestion**: file, URL, text, and YouTube
  materials move through `pending -> extracting -> chunking -> embedding -> ready`
  (+ `failed`), with visible progress, partial extracted-content preview, retry,
  and safe recovery.
- **No deferral rule (user directive, 2026-08-14):** work that belongs to this issue
  is never deferred to a later ticket. The full approved topology ships in this
  ticket: Supabase/Postgres source of truth, private Storage, pgmq stage queues,
  a separate ingestion worker service, real extraction + Gemini embedding adapters,
  Realtime progress, and injected deterministic doubles in tests.

## Decisions log (grilled 2026-08-14, all user-agreed)

- **D-01 — Worker topology:** Docker runs a separate `ingestion-worker` service;
  the existing `intelligence` container owns the API and its own worker processes.
  The API never blocks on ingestion work; it persists state and enqueues.
- **D-02 — File upload lifecycle:** For PDFs the browser creates the material row
  first, uploads to private `material-raw/<userId>/<materialId>/...`, and only then
  is ingestion allowed to proceed. Upload failure marks retryable `failed`; the
  worker rejects missing/incomplete objects without creating chunks.
- **D-03 — Provider behavior:** Production code calls Gemini for embeddings and
  real extraction providers. Tests inject deterministic fake extractors, embedders,
  storage, and queues. Tests never require network, Gemini credentials, Supabase
  service credentials, or a live queue.
- **D-04 — Status updates:** The app uses Supabase Realtime for material row
  progress, with bounded polling fallback when Realtime is unavailable.
- **D-05 — Failure semantics:** Retry reuses the material identity but creates a
  new ingestion job/correlation and clears prior chunks only after the new
  extraction succeeds. Ready is published atomically only after every valid chunk
  has a normalized vector; stale chunks can never become ready.

## Architecture overview

- **Postgres (Supabase) is the source of truth** for material rows, ingestion jobs,
  attempts, chunks, and normalized vectors; pgmq stage queues carry work between
  stages; private Storage holds raw uploaded files and extracted full text.
- **Ingestion worker** (separate process/container) owns deterministic extraction,
  cleaning, chunking, and queue mechanics. The **Intelligence API** owns model
  calls (embeddings) and the authenticated material/job endpoints.
- **React app** observes progress via Realtime (+ polling fallback), uploads files
  to private Storage, and keeps generation gated on `ready`. No raw content is
  ever written to events, caches, or telemetry.

## Files-touched index (approximate; live code wins)

| Area | Files |
|---|---|
| Migration | `apps/app/supabase/migrations/005_material_ingestion.sql` (+ fix-forward 006-012) |
| Contracts | `services/intelligence/contracts/phase2/openapi.yaml`, `async-job.schema.json`, `content-chunk.schema.json`, `PIPELINES.md`, `TRACEABILITY.md`, fixtures, `tests/test_contracts.py` |
| Service ingestion core | `services/intelligence/app/ingestion/{models,extractors,cleaning,chunking,embeddings,queue,repository,worker}.py` |
| Service API | `services/intelligence/app/routers/{materials,jobs}.py`, `app/main.py`, `app/serialization.py` or equivalents |
| Worker runtime | `services/intelligence/app/worker_main.py`, `services/intelligence/Dockerfile`, `docker-compose.yml`, `scripts/dev-intelligence.mjs`, `docker/.env.example`, READMEs |
| App | `apps/app/src/materials/{materialClient,types,MaterialsProvider,useMaterialLibrary,ingestionSubscription}.ts`, `pages/materials/{MaterialCreate,MaterialDetail}.tsx`, `StatusBadge.tsx`, `materials.css` |
| Tests | `services/intelligence/tests/*`, `apps/app/src/materials/*.test.tsx`, `e2e/material-ingestion-live.spec.ts` (or similar) |
| Records | `.work/plans/active/2026-08-14-material-ingestion-readiness/{PLAN,VERIFICATION}.md`, `.work/STATUS.md` |

## Phases

Status markers: `☐ Not started` / `🟡 In progress` / `🛑 Blocked` / `✅ Complete`.

### Phase 1 — Contract and persistence

- [x] Add additive migration `005_material_ingestion.sql`:
  private `material-raw` bucket + owner-scoped storage policies; upload-readiness
  metadata; owner-scoped ingestion jobs, attempts, idempotency keys; content chunk
  rows; `halfvec(768)` embedding column + filtered HNSW index; pgmq stage queues
  (extract/chunk/embed/publish); atomic status-transition + publish guards;
  Realtime publication for material status changes.
- [x] Extend the contract pack together: retry-ingestion, partial extracted
  preview, upload readiness, job status/failure metadata; update `openapi.yaml`,
  schemas, `PIPELINES.md`, `TRACEABILITY.md`, and fixtures in the same change.
- [x] Verification: migration SQL review, contract validation tests pass
  (`uv run --package intelligence pytest services/intelligence/contracts/phase2/tests`).
- [ ] **Operator:** `supabase db push` (CLI not installed on this host;
  confirmed not applied — `column materials.upload_complete_at does not exist`).

### Phase 2 — Extraction and chunking

- [x] Deterministic extractors: plain text, web URL, YouTube transcript
  (timestamps preserved), PDF from private Storage; cleaning/normalization;
  partial-extraction display artifact; terminal `validation_failed` on empty or
  malformed content.
- [x] Structure-first recursive chunking: ~400-token target, 60-token overlap,
  `tiktoken` counting, YouTube `start_seconds` retention, ordinal ordering.
- [x] Verification: `test_extractors.py`, `test_chunking.py` green.

### Phase 3 — Embeddings and queue workers

- [x] Gemini `gemini-embedding-001` adapter: batches of 100, L2-normalized,
  NULL-scan resume; full-jitter bounded retry honoring `Retry-After` (max 2),
  per-minute quota retryable (`rate_limited`) and daily quota terminal
  (`quota_exhausted`), 401/403 terminal `provider_credentials`; timeout ->
  `provider_timeout`; zero-vector chunks flagged and skipped; provider
  abstraction for tests. Batches split by token budget; vectors persisted
  through one bulk RPC per batch.
- [x] Queue mechanics: poll/ack/redelivery/visibility timeout/backpressure
  (`max_in_flight` bounds per-cycle work via `ingestion_poll(p_qty)`);
  idempotent stages; publish `ready` atomically only after all non-flagged
  chunks embedded; stale-chunk invalidation on replace/retry.
- [x] Verification: `test_embeddings.py`, `test_queue.py`, `test_ingestion_worker.py`
  green (no network/Gemini/service credentials).

### Phase 4 — FastAPI material boundary

- [x] Authenticated owner-scoped endpoints: create material + enqueue ingestion,
  ingestion status, partial extracted preview, job status;
  `X-Request-ID` on mutations; `correlationId`; normalized errors
  (rule 22 style); non-blocking API. Retry is handled DB-atomic by the
  `retry_material_ingestion` RPC (migrations 009/010) called from the React
  client, not by an API endpoint.
- [x] Verification: `test_materials_api.py`, `test_jobs_api.py` green incl.
  cross-user isolation, missing-upload rejection, request identity.

### Phase 5 — Worker runtime and Docker

- [x] Separate `ingestion-worker` Docker service; worker health/readiness; env
  wiring (Supabase URL, service-role credential in runtime env only, Gemini key,
  queue/retry settings); local dev launcher updates; docs updated.
- [x] Verification (partial): `./docker-app config` valid; local
  `pnpm dev:ingestion-worker` boots, passes the env gate, polls
  `ingestion_poll`, and backs off gracefully (404 — migration not pushed yet).
- [ ] **Operator:** `./docker-app start` / `status` / `stop` with the worker +
  API healthy requires migration 005 pushed and the compose env file holding
  `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` /
  `GEMINI_API_KEY`.

### Phase 6 — React material flow

- [x] `MaterialClient` service-backed ingestion ops (preserve Supabase list/detail
  + account isolation); file upload to private Storage with explicit completion
  state; text/URL/YouTube/file routed through the material/job boundary.
- [x] Realtime subscription + bounded polling fallback; live status refresh;
  partial preview display while generation stays blocked; retry creates a new
  attempt without changing material identity; replace invalidates old chunks.
- [x] Verification: focused app tests green; full app suite **623/623**
  (`--pool=forks`; two interrupted-session test bugs fixed: non-spy realtime
  mock in `MaterialLibrary.test.tsx` and a half-edited `PreSessionSetup`
  fixture); typecheck + lint clean.

### Phase 7 — End-to-end and live verification

- [x] Live E2E spec authored: `e2e/material-ingestion-live.spec.ts` (7 tests —
  text/URL/PDF to ready with preview, retryable failure + retry, cross-user
  denial gated on a second account, YouTube gated on `E2E_INCLUDE_YOUTUBE`,
  mobile 390x844 round trip; compiles and lists clean under the repo Playwright
  config).
- [x] Full app suite + service suite + contract suite + repo/app typecheck +
  lint + app build + marketing build (app 623/623; service 120 passed + 5
  pre-existing golden-fixture failures; contracts 6/6; builds green).
- [ ] **Operator:** run the E2E spec live once migration 005 is pushed and the
  worker is running (env keys already placed in gitignored
  `services/intelligence/.env`).
- [ ] `/code-review` pass; fix findings.

### Phase 8 — Records and commit

- [x] Update `VERIFICATION.md` with per-phase evidence, commits, deviations.
- [ ] Update `.work/STATUS.md` row (Active -> Done only when verified complete;
  stays Active — live E2E + Docker start gated on the migration push).
- [ ] Commit all issue-owned changes on branch `phase2/issue-37`.

## Verification (top-level)

- `uv run --package intelligence pytest services/intelligence -q`
- `uv run --package intelligence pytest services/intelligence/contracts/phase2/tests -q`
- `pnpm --filter app typecheck` / `pnpm --filter app lint`
- `pnpm --filter app exec vitest run --pool=forks` (full app suite)
- `pnpm --filter app build`
- `pnpm exec playwright test -c e2e/playwright.config.ts --project=app --reporter=list`
- `./docker-app config` / `start` / `status` / `stop`
- Migration pushed to the dev Supabase project (`supabase db push`).

## Out of scope (owned by later tickets)

- Grounded assessment generation (#38), taking/grading (#39), mastery (#43),
  guide (#46), roadmap feedback (#47).
- Generation-quality evaluation (#18/#45 scope).

## References

- Issue: https://github.com/rings0fsaturn/study-planner/issues/37
- Spec: https://github.com/rings0fsaturn/study-planner/issues/32
- Decisions: map #4, resolution comments on #7 (storage/ingestion model) and
  #8 (vector store, chunking, embeddings, pgmq, backpressure).
- Contract pack: `services/intelligence/contracts/phase2/`.
- Prior slice: `.work/plans/active/2026-08-13-material-library-implementation/`.
