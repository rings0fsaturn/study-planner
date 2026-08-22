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
| `services/intelligence/contracts/phase2/` has no `gemini/` dir | ☐ |
| `provider/generation-request.schema.json` uses `messages[]` / plain `responseSchema` / `reasoningEffort` | ☐ |
| `uv run --package intelligence pytest services/intelligence/contracts/phase2/tests/test_contracts.py` | ☐ |

### Phase 1 — Data layer (migration 018) + job-kind serialization

| Check | Result |
|---|---|
| `db push --dry-run` clean; migration applied | ☐ |
| `ingestion_jobs` constraint is `ingestion_jobs_kind_material_attempt_unique` | ☐ |
| `assessments`, `questions`, `assessment_generate` queue exist; cross-user SELECT denied | ☐ |
| `to_async_job()` emits row kind; `GET /v1/jobs/{id}` returns `"kind": "generation"` | ☐ |
| Telemetry record carries `questions_requested` / `questions_accepted` / `reasoning_tokens` | ☐ |

### Phase 2 — Generation domain

| Check | Result |
|---|---|
| Adapter outcome-matrix tests green (every D-08 row incl. single-retry + Retry-After cap) | ☐ |
| Validation tests green (format gate, citation gate, quote verified/unverified, repair) | ☐ |
| ruff clean on `services/intelligence/` | ☐ |

### Phase 3 — Worker arm + orchestration

| Check | Result |
|---|---|
| `test_generation_worker.py` green (happy, quota, timeout, safety, malformed±repair, citation-drop, embedder-down) | ☐ |
| Threaded two-arm worker starts/stops cleanly; ingestion arm unaffected | ☐ |
| Full service suite: only pre-existing golden-fixture failures | ☐ |

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