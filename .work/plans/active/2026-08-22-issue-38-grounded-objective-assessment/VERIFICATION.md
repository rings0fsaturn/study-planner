# Verification log — #38 Single Grounded Objective Assessment

> Per-phase evidence goes here as phases land. The implementer appends a dated
> entry per phase with commands run, outputs, and any deviations surfaced.
> Acceptance criteria are the four checkboxes from ticket #38.

**Plan:** [`PLAN.md`](PLAN.md) · **Ticket:** [#38](https://github.com/rings0fsaturn/study-planner/issues/38) · **Prerequisite:** [#57](https://github.com/rings0fsaturn/study-planner/issues/57)

## Acceptance criteria

- [ ] **AC-1 — Ready/owner gating:** generation is enabled only for ready, owner-scoped materials (API 409/404 + UI entry gate).
- [ ] **AC-2 — Validated + grounded question:** the generated objective Question validates against its format schema and includes verified citations or explicit warnings.
- [ ] **AC-3 — Hidden content isolation:** answer keys never reach the browser, local cache, event log, or telemetry.
- [ ] **AC-4 — Failure matrix tested:** timeout, quota, safety block, malformed output, repair, partial, and resume behavior are tested.

## Phase log

### Phase 0 — Prerequisite (#57 contract neutralization)

| Check | Result |
|---|---|
| `services/intelligence/contracts/phase2/` has no `gemini/` dir | ✅ 2026-08-23 — `git mv gemini provider`, three commits (`1f950ed`, `ae11c8a`, `98a3b12`) |
| `provider/generation-request.schema.json` uses `messages[]` / plain `responseSchema` / `reasoningEffort` | ✅ |
| `uv run --package intelligence pytest services/intelligence/contracts/phase2/tests/test_contracts.py` | ✅ 12 passed — `1f950ed` neutralized the pack; two thermo-nuclear review rounds (`ae11c8a`, `98a3b12`) hardened the flattened envelope (outcome-state conditionals, optional usage, transport outcomes without synthetic finish reason, `unsupported_request` in public ServiceError, rejection tests). Review finding 5 (embedding-request `$id` keeps `gemini/`) was intentionally kept per #54 "moves unchanged". Findings 2/4 are plan-side tensions surfaced for #38: D-08 maps `length` → `malformed_output` while the contract maps `length` → `partial` (resolved at Phase 2 by using the contract envelope outcomes for the provider response and slot-level decisions for drop/repair); `temperature const 0.3` vs `GENERATION_TEMPERATURE` env is a runtime knob outside the contract envelope. |

### Phase 1 — Data layer (migration 018) + job-kind serialization

| Check | Result |
|---|---|
| `db push --dry-run` clean; migration applied | ✅ 2026-08-23 — dry-run listed only `018_assessments_generation.sql`; push applied. Migration 018 also carries the Phase-4 `enqueue_assessment_generation` security-definer RPC (its designated home; avoids a second migration) |
| `ingestion_jobs` constraint is `ingestion_jobs_kind_material_attempt_unique` | ✅ live `db query` confirmed |
| `assessments`, `questions`, `assessment_generate` queue exist; cross-user SELECT denied | ✅ live `db query` + real-token probe: user A insert/read-back OK; user B (admin-API-created) sees no rows; probe row cleaned up |
| `to_async_job()` emits row kind; `GET /v1/jobs/{id}` returns `"kind": "generation"` | ✅ `test_ingestion_job_to_async_job_emits_row_kind` + `test_job_status_returns_generation_kind`; `serialization.async_job_from_row` passes `kind` through |
| Telemetry record carries `questions_requested` / `questions_accepted` / `reasoning_tokens` | ✅ contract dict validates against `generation-telemetry.schema.json` (post-#57, includes `reasoningTokens`) |
| Test sweep | ✅ `pytest test_models test_telemetry test_materials_api` 36 passed; `ruff check` on touched files clean (repo baseline has 5 pre-existing E501s in `test_retrieval.py`/`test_v1_integration.py`, present at HEAD~4) |

### Phase 2 — Generation domain

| Check | Result |
|---|---|
| Adapter outcome-matrix tests green (every D-08 row incl. single-retry + Retry-After cap) | ✅ 2026-08-23 — `test_generation_adapter.py`: stop/ok, schema-invalid, unparseable, length, content_filter, refusal, null content, error finish, unknown finish, 429 (retry honored, capped 60 s, then `quota_failure` + `retryAfterSeconds`), 400-effort → `unsupported_request`, 401 → `provider_credentials`, 5xx ×2 → `provider_unavailable` retryable, timeout ×2 → `provider_timeout` retryable, connection, generic APIError non-retryable, D-08 kwargs locked (no seed/top_p, strict json_schema, reasoning off) |
| Validation tests green (format gate, citation gate, quote verified/unverified, repair) | ✅ `test_generation_validation.py`: every format failure kind, difficulty mismatch, out-of-context drop, zero-citation drop, quote substring-insensitive verification, `citation_unverified` keeps citation; `test_generation_prompts.py` covers the one-repair message pair |
| ruff clean on `services/intelligence/` | ✅ on touched files (`app/generation/`, `tests/test_generation_*`); repo baseline keeps its 5 pre-existing E501s |
| Context module | ✅ `test_generation_context.py`: steer query = title + skillTags, `match_content_chunks` service-role call with top_k=5, embedder-unavailable → retryable `provider_unavailable`, RPC failures retryable |
| Plan-vs-contract tension recorded | ℹ️ D-08 maps `length` → `malformed_output` (plan) while #54 README maps `length` → `partial`; this slice implements D-08 because `partial` is reserved for multi-question slices (D-06) and a truncated single slot is a drop-after-repair. `GENERATION_TEMPERATURE` remains a runtime knob; the contract envelope's `const 0.3` is the public request shape. |

### Phase 3 — Worker arm + orchestration

| Check | Result |
|---|---|
| `test_generation_worker.py` green (happy, quota, timeout, safety, malformed±repair, citation-drop, embedder-down) | ☐ |
| Threaded two-arm worker starts/stops cleanly; ingestion arm unaffected | ☐ |
| Full service suite: only pre-existing golden-fixture failures | ☐ |

### Phase 3 — Worker arm + orchestration

| Check | Result |
|---|---|
| `test_generation_worker.py` green (happy, quota, timeout, safety, malformed±repair, citation-drop, embedder-down) | ✅ 2026-08-23 — 12 worker scenarios: happy path inserts question with `answer_block`, assessment ready, job succeeded, telemetry ok; quota keeps assessment `generating` + retryable job with `retryAfterSeconds`; timeout/unsupported retryable flags; safety warning + failed; malformed → one repair (repair feedback carries the actual validation failures) → success and repair-exhausted; format-failure repair; citation-drop without repair; unverified-quote warning on ready; embedder-down → retryable `provider_unavailable`; unexpected exception redelivers the message |
| Threaded two-arm worker starts/stops cleanly; ingestion arm unaffected | ✅ `test_worker_main.py`: `_build_generation_worker` env defaults + overrides (D-08 values), `_arm_loop` stops on the shared event and survives iteration exceptions. `main()` keeps the ingestion loop unchanged and joins the daemon generation thread on signal |
| Full service suite: only pre-existing golden-fixture failures | ✅ 379 passed / 7 failed — identical 7 pre-existing failures at baseline (5 calibration golden fixtures + 2 retrieval-probe) |
| Deviation recorded | ℹ️ D-06 needs `retryAfterSeconds` on the job for the UI; `ingestion_jobs` had no column, so migration `019_ingestion_jobs_retry_after.sql` adds `retry_after_seconds` (rule 35: new migration, 018 was already pushed) and `async_job_from_row` surfaces it in the AsyncJob error. Repo helpers live on `SupabaseIngestionRepo` (canonical service-role repo); `app/generation/repo.py` defines the narrow `GenerationRepo` protocol the worker depends on |

### Phase 4 — API endpoints

| Check | Result |
|---|---|
| `test_assessments_api.py` green (202 shape, gates, 409/400/404, redacted GET, secret-field walk) | ☐ |
| Generation-job GET via `/v1/jobs/{jobId}` works | ☐ |

### Phase 5 — App data layer

| Check | Result |
|---|---|
| `assessmentClient.test.ts` green (normalization matrix) | ☐ |
| `AssessmentCreated` appends through the existing sync path; no Dexie schema bump | ☐ |
| Account-switch test green | ☐ |

### Phase 6 — App UI

| Check | Result |
|---|---|
| Config + detail page component tests green (polling, retry, refresh-restore, ready gate) | ☐ |
| Full app suite green (`--pool=forks`) | ☐ |
| Browser flow verified desktop + 390×844, zero console errors | ☐ |

### Phase 7 — Verification sweep + live E2E

| Check | Result |
|---|---|
| Contract pytest, full service pytest, ruff, full app vitest, typecheck, lint, build — all green | ☐ |
| `assessment-generation-live.spec.ts` passes with zero page/console errors; material cleaned up | ☐ |
| STATUS.md row updated; per-phase commits made; resolution comment on #38 | ☐ |