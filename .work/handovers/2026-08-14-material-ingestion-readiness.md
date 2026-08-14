# Handover — 2026-08-14 Material Ingestion and Readiness (issue #37)

## Entry point

- **Branch:** `phase2/issue-37` (created from `project/phase-2`; commit the
  remaining work here).
- **Plan:** `.work/plans/active/2026-08-14-material-ingestion-readiness/PLAN.md`
  (grilled decisions D-01..D-05, no-deferral rule).
- **Running log:** same folder, `VERIFICATION.md` (acceptance criteria +
  per-phase evidence; read the Log section).
- **GitHub:** issue https://github.com/rings0fsaturn/study-planner/issues/37
  (spec #32, map #4). `gh` needs the bounded-retry + token recipe in
  `.agents/rules/52-github-cli-and-token.agents.md`.
- **STATUS.md** has an Active row pointing at this plan.

## What is being implemented

End-to-end material ingestion for the Phase 2 Material Library: text, URL,
YouTube, and PDF (private upload) materials move through
`pending → extracting → chunking → embedding → ready` (+ `failed`) with
Realtime progress, partial extracted-content preview, retry, and safe recovery.

Architecture (approved): Postgres source of truth (migration `005`), private
Storage, pgmq stage queues, separate `ingestion-worker` Docker service, real
extraction + Gemini embedding adapters, Realtime + polling fallback in the app.
Tests use deterministic doubles (no network/Gemini/service credentials).

## What is DONE (phases 1-6 code complete)

- **Phase 1 — contract + persistence.** Contract pack extended
  (`openapi.yaml`: retry + content-preview endpoints, `uploadCompleteAt`,
  `attempt`, `MaterialContentPreview`; `async-job.schema.json` `attempt`;
  `PIPELINES.md`/`TRACEABILITY.md`; fixture `async-job-ingestion.json`;
  `fixtures/README.md`; manifest). Contract tests 6/6 green. Migration
  `apps/app/supabase/migrations/005_material_ingestion.sql`: `vector` + `pgmq`
  extensions, `material-raw` bucket + owner policies, materials ingestion
  columns (`upload_complete_at`, `chunk_count`, `grounding_version`,
  `extracted_text_path`), `ingestion_jobs` (UNIQUE material_id+attempt, owner
  read policy), `content_chunks` (`halfvec(768)`, filtered HNSW, NULL-scan
  index, no client policy), `match_content_chunks` RPC, queues
  `material_extract/embed/publish`, security-definer wrappers
  `ingestion_poll(msg_id, read_ct, payload)` / `ingestion_complete` /
  `ingestion_send`, trigger `materials_enqueue_ingestion` (enqueues on
  `pending` transition; file materials wait for upload completion; payload
  carries `jobId`), `complete_material_upload` RPC (owner-only), Realtime
  publication for `materials`.
- **Phase 2 — extraction + chunking.** `services/intelligence/app/ingestion/`
  `models.py` (Material/ExtractedContent/ContentChunk/IngestionJob/QueueMessage/
  IngestionError), `cleaning.py`, `extractors.py` (HttpxFetcher, PypdfTextReader,
  YoutubeTranscriptClient, trafilatura + fallback, `extract_material` dispatch),
  `chunking.py` (structure-first, 400/60, ordinals, `start_seconds` carry,
  overlap-tail budget). 32 tests green.
- **Phase 3 — embeddings + queue + worker.** `embeddings.py` (Gemini
  batchEmbedContents, L2 normalize, 250/1000 ms retries, quota terminal),
  `queue.py`, `repository.py` (REST + service role; NULL-scan resume;
  `replace_chunks` deletes after new extraction succeeds — D-05), `worker.py`
  (extract→embed→publish, `_SkipMessage` idempotency, bounded redelivery via
  `read_ct`/`max_deliveries`, atomic ready publish with gap re-enqueue). 22
  tests green.
- **Phase 4 — FastAPI boundary.** `app/userrest.py` (user-scoped REST client —
  API has NO service credentials, RLS does scoping), `app/dependencies.py`
  (`get_user_client` needs `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`),
  `routers/materials.py` (`GET .../ingestion`, `POST .../ingestion/retry`
  with `Idempotency-Key` → 202 or 409, `GET .../content` preview ≤4000 chars
  + ready gating), `routers/jobs.py` (`GET /v1/jobs/{jobId}`). ServiceError
  shape via JSONResponse (top-level, not FastAPI `detail`). 11 tests green.
- **Phase 5 — worker runtime.** `app/worker_main.py` (env gate:
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` required, `GEMINI_API_KEY`
  warns), `docker-compose.yml` `ingestion-worker` service (same image, worker
  CMD, tuning envs), `docker/.env.example`, `scripts/dev-ingestion-worker.mjs`
  + `pnpm dev:ingestion-worker`, `services/intelligence/README.md` worker
  section. Root `pyproject.toml` dev group gained `jsonschema` + `pyyaml`
  (contract tests need them). uv.lock diff is additive-only.
- **Phase 6 — React flow.** `apps/app/src/materials/`: `types.ts` extended,
  `materialClient.ts` (+`uploadMaterialFile` with owner path + session guard,
  `completeUpload` RPC, `markUploadFailed`, shared `materialRowToRecord`),
  `ingestionSubscription.ts` (Realtime postgres_changes, RLS-scoped, guarded
  no-op when channel absent), `previewClient.ts` (typed preview fetch),
  `useMaterialLibrary.ts` (Realtime + 15 s polling fallback, `live` flag),
  `MaterialCreate.tsx` file flow (pick → create → upload → complete; upload
  failure → failed state), `MaterialDetail.tsx` partial preview panel,
  `materials.css` preview block, fakes + tests updated. Materials+pages tests
  **60/60 green**; app typecheck + lint clean.

## What is PENDING

- **Phase 6 finish:** full app suite `pnpm --filter app exec vitest run
  --pool=forks` was interrupted — run to completion (expect 600+ tests; the 2
  TZ-sensitive `dev/seedTestData` tests are a known WSL threads-pool issue, use
  `--pool=forks`).
- **Phase 7:**
  1. Live E2E spec (create text/URL material → ready via worker, PDF upload →
     ready, YouTube, forced retryable failure → retry → ready, cross-user
     denial, mobile + desktop, zero console/page errors). Model on
     `e2e/material-library-live.spec.ts` (env-gated, credentials only via env).
  2. Full suites: service tests (114 passed + 5 pre-existing golden-fixture
     failures on `test_v1_integration.py` — verified pre-existing on base),
     contract tests 6/6, app suite, app typecheck/lint, `pnpm --filter app
     build`, marketing build.
  3. Docker verification: `./docker-app config` / `start` / `status` /
     `stop`; `ingestion-worker` + `intelligence` healthy; requires
     `SUPABASE_SERVICE_ROLE_KEY` + `GEMINI_API_KEY` + `SUPABASE_PUBLISHABLE_KEY`
     in the compose env file.
  4. `/code-review` pass; fix findings.
- **Phase 8:** final `VERIFICATION.md` evidence, STATUS row flip (Active → Done
  only when verified), commit all work on `phase2/issue-37`.

## Operator steps (UNCONFIRMED items)

- **Migration push:** supabase CLI is NOT installed on this host. `supabase db
  push` (from `apps/app/`) must be run by the operator to apply `005`
  (extensions vector+pgmq, bucket, tables, RPCs, trigger, Realtime). SQL was
  self-reviewed only.
- **Runtime env keys** (never commit): `SUPABASE_SERVICE_ROLE_KEY` (worker),
  `GEMINI_API_KEY` (embeddings; without it extraction works but embed stage
  fails materials with `provider_unavailable`), `SUPABASE_PUBLISHABLE_KEY`
  (API material/jobs routes). Add to `services/intelligence/.env` for local
  dev or the compose env file for Docker.

## Key files map

| Area | Files |
|---|---|
| Migration | `apps/app/supabase/migrations/005_material_ingestion.sql` |
| Contracts | `services/intelligence/contracts/phase2/{openapi.yaml,async-job.schema.json,PIPELINES.md,TRACEABILITY.md,fixtures/*}` |
| Service core | `services/intelligence/app/ingestion/{models,cleaning,extractors,chunking,embeddings,queue,repository,worker}.py` |
| Service API | `services/intelligence/app/{userrest,dependencies,worker_main}.py`, `app/routers/{materials,jobs}.py`, `app/main.py` |
| Runtime | `docker-compose.yml`, `docker/.env.example`, `scripts/dev-ingestion-worker.mjs`, `services/intelligence/README.md`, root `pyproject.toml` (dev group), `uv.lock` |
| App | `apps/app/src/materials/{types,materialClient,ingestionSubscription,previewClient,useMaterialLibrary,MaterialsProvider}.ts(x)`, `apps/app/src/pages/materials/{MaterialCreate,MaterialDetail}.tsx`, `materials.css` |
| Tests | `services/intelligence/tests/{test_cleaning,test_extractors,test_chunking,test_embeddings,test_queue,test_ingestion_worker,test_materials_api}.py`, `tests/ingestion_doubles.py`, `apps/app/src/materials/*.test.ts(x)`, `apps/app/src/pages/materials/*.test.tsx` |

## Pitfalls for the next agent

- **Do not commit `.env*` keys.** The token/secret handling rules in
  `.agents/rules/52-github-cli-and-token.agents.md` apply to `gh` calls
  (bounded retry, `.env.git.local` TOKEN=).
- **Golden-fixture failures are pre-existing** (5 in `test_v1_integration.py`);
  verified against the pristine base with `uv sync --frozen`. Do not "fix" by
  touching fixtures.
- **Worker test stage granularity:** `IngestionWorker.run_once(queue_name)`
  drains one stage; `run_once()` drains all three. Keep using named queues in
  crash-simulation tests.
- **`--pool=forks`** is required for the app suite on WSL (2 TZ-sensitive tests
  fail under the default threads pool; pre-existing gotcha in STATUS.md).
- **Supabase REST + service role** is the worker's only DB path (no asyncpg);
  the API uses the caller's JWT (RLS) — never add service credentials to the
  API env.
- **Realtime filter is RLS-scoped** (no explicit `user_id` filter in the
  subscription); the guarded no-op keeps tests without a channel mock green.
- Ruff: line-length 100; run `uv run ruff check services/intelligence/app
  services/intelligence/tests` after edits.
