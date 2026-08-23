# How to use this plan

> **You are the implementing agent.** This document is your runbook for one cohesive change to this codebase. Read this preamble in full before doing anything else.

## What you're holding

A phase-by-phase implementation plan for **#38 — Single Grounded Objective Assessment**. Each phase is a **vertical slice** designed so any one of them can be implemented by a fresh agent in a new context window, with only this document and the codebase as input. All decisions that the architecture depends on are locked in the Decisions log below; where the live code differs from a decision, the plan says which file to touch and what to change.

## Your job

1. **Read the document header in full first** (TL;DR, Context, Decisions log, Files-touched index).
2. **Find your starting phase**: first `☐ Not started` whose dependencies are `✅ Complete`. Implement that phase only.
3. **Run prereq verification. If any fail, STOP** and surface to the human.
4. **Follow steps in order.** Code blocks are the actual code or the exact contract to satisfy.
5. **If reality doesn't match the step — STOP.** Surface discrepancies; do not improvise.
6. **Run tests and post-verification.** All must pass before the phase is done.
7. **Update status and commit** the phase together with this plan file's status line.

## What you must NOT do

- Do not skip phases or implement multiple phases without surfacing for review.
- Do not modify the Decisions log, preamble, TL;DR, Open questions, Out-of-scope, or References.
- Do not edit any file under `services/intelligence/contracts/phase2/` — that is slice **#57**'s scope, not yours. If a contract file conflicts with what this plan requires, STOP and file the discrepancy on #57.
- Do not re-plan or re-architect — surface instead.

## Status vocabulary

`☐ Not started` · `🟡 In progress` · `🛑 Blocked: <reason>` · `✅ Complete — <sha>`

---

# Single Grounded Objective Assessment (#38)

**Slug:** `2026-08-22-issue-38-grounded-objective-assessment`
**Date written:** 2026-08-22
**Author:** wayfinder planning session (issue #38 claimed by `rings0fsaturn`)
**Plan status:** 🟡 In progress — Phase 0 (#57) ✅ · Phase 1 ✅ `2494ede` · Phase 2 ✅ `8c64f18` · Phase 3 ✅ `a782e3e` · Phase 4 ✅ `2c42c1c` · Phase 5 ✅ Complete
**Upstream:** [#38](https://github.com/rings0fsaturn/study-planner/issues/38) · parent spec [#32](https://github.com/rings0fsaturn/study-planner/issues/32) · parent map [#4](https://github.com/rings0fsaturn/study-planner/issues/4) · prerequisite contract slice [#57](https://github.com/rings0fsaturn/study-planner/issues/57)

## TL;DR

Build the first grounded assessment slice end to end: a learner picks a **ready, owner-scoped material**, configures a **minimal assessment** (one objective question, a difficulty band), the service **generates one grounded MCQ** from retrieval-driven source chunks via DeepSeek/OpenRouter behind the #54-amended provider-neutral envelopes, the learner **sees the question with citations and warnings**, and generation is **resumable from its durable job**. Hidden grading content (the answer key) is stored server-only, never reaches the browser, the event log, or telemetry. Timeout / quota / safety-block / malformed-output / repair / partial / resume behavior is implemented and tested per the PIPELINES matrix. Slice #57 (contract neutralization) is a hard prerequisite and must land first.

## Context & background

The provider seam is fully decided; do not re-litigate: DeepSeek via OpenRouter is the sole generation provider (#52/#55 closed), reasoning runs **off** for objective generation (#53/#56 closed, probe evidence: p50 ≈ 3.9–4.8 s, p95 ≈ 10.5–20.8 s with reasoning off; strict `json_schema` is the primary structured mode, `json_object` is contract-invalid for our shape), and the Phase 2 contract pack is being neutralized in place by slice **#57** (`gemini/` → `provider/`, OpenAI-style `messages[]`, flattened response envelope, `unsupported_request`, `llm_rubric`, regenerated fixtures). The live queue/worker/jobs/telemetry infrastructure from #36/#37 is reusable as-is.

**Live stack facts verified 2026-08-22 (trust these over older summaries):**

- `ingestion_jobs` already carries the contract `kind` CHECK enum `('ingestion','generation','grading','roadmap_feedback')` and the AsyncJob status enum — it was designed to host generation jobs; only `IngestionJob.to_async_job()` hardcodes `"kind": "ingestion"` (`app/ingestion/models.py:144-147`) and `async_job_from_row` ignores the row's `kind`.
- pgmq stage queues use queue-name-generic wrappers `ingestion_send(p_queue, p_payload)` / `ingestion_poll(p_queue, p_vt, p_qty)` / `ingestion_complete(p_queue, p_msg_id, p_success)` (migration `005`); a new queue only needs `pgmq.create()`.
- `generation_telemetry` exists (migration `014`) with `task` enum already including `assessment_generation`, but lacks the `questions_requested` / `questions_accepted` / `reasoning_tokens` columns that the amended telemetry contract needs — they must be added by migration.
- The app's typed-client pattern is `apps/app/src/materials/materialClient.ts` (narrow dependency interfaces + `normalizeMaterialError` + `run()` wrapper); the service-client pattern is `apps/app/src/lib/intelligenceClient.ts` (fetch + Bearer token + timeout/retry + typed errors).
- `EventStore.append(kind, payload)` is kind-agnostic (`apps/app/src/events/EventStore.ts:18`); adding `AssessmentCreated` needs **no** Dexie schema version bump (events table already indexes `kind`).
- The `PracticeThis` page (`apps/app/src/pages/materials/PracticeThis.tsx`) already implements the ready-only gate and a config form — reuse its structure for the assessment config page.

**Support docs:**

- Amended contract targets (envelopes, retry matrix): resolution comment on [#54](https://github.com/rings0fsaturn/study-planner/issues/54); slice [#57](https://github.com/rings0fsaturn/study-planner/issues/57) body is the exact file-edit mandate.
- Provider mechanics: [`research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md`](../../../research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md)
- Probe evidence: [`research/doc/deepseek-generation-probe/report.md`](../../../research/doc/deepseek-generation-probe/report.md)
- Probe implementation (adapter mechanics to mirror): [`services/intelligence/scripts/generation_probe.py`](../../../services/intelligence/scripts/generation_probe.py)
- Pipeline rules (retry/timeout matrix, redaction): [`services/intelligence/contracts/phase2/PIPELINES.md`](../../../services/intelligence/contracts/phase2/PIPELINES.md)
- WSL/env quirks: `.agents/rules/53-wsl-dev-runtime.agents.md`; dry-run discipline: `.agents/rules/80-script-dry-run-before-full-runs.agents.md`; Supabase live ops: `.agents/rules/36-supabase-live-stack.agents.md`

## Decisions log

### D-01: Reuse `ingestion_jobs` for generation jobs (`kind='generation'`) — AMENDED from "separate table"
**Status:** ✅ Agreed (amended during planning after live-schema verification)
**Context:** The original plan leaned toward a separate `generation_jobs` table to avoid touching the live ingestion pipeline.
**Decision:** Add **no new job table**. `ingestion_jobs` already has the full `kind` CHECK enum including `'generation'`; one migration adjusts the unique constraint to `(kind, material_id, attempt)` (today `(material_id, attempt)`) so a second assessment on the same material can have its own attempt-1 job, and the worker/API write `kind='generation'` rows through the existing service-role path. `GET /v1/jobs/{jobId}` then serves both kinds from one table (resume seam stays trivial).
**Rationale:** The live schema anticipated this (CHECK enum); a separate table would duplicate the shape and force dual-table job lookups. The constraint change is additive and safe: existing ingestion rows all have `kind='ingestion'` so `(kind, material_id, attempt)` uniqueness preserves today's behavior.
**Note:** `IngestionJob.to_async_job()` hardcodes `"kind": "ingestion"` and `async_job_from_row()` drops the row's kind — both must be fixed to carry `kind` through (Phase 1).

### D-02: Retrieval-driven context (not stratified sampling)
**Status:** ✅ Agreed
**Context:** Probe evidence showed groundedness (gold-support 72–86%) was only measured on retrieval-driven contexts; sampled contexts were never measured against gold. For a 754-chunk book, blind sampling would generate questions about arbitrary sections regardless of the requested skill tags.
**Decision:** The generation pipeline builds its RAG context by embedding a steer query (material title + requested `skillTags`, joined) through `embed_queries`, then calling `match_content_chunks` (service role, `top_k=5`) scoped to the material — exactly the proven path in `app/routers/retrieval.py:76-104`. If the embedder is unavailable the job fails **retryable** with `provider_unavailable` and a warning; there is no silent ungrounded fallback.
**Rationale:** Reuses verified retrieval machinery; one query-embed per generation is trivial cost; keeps citations verifiable against the actual retrieved chunk set.

### D-03: Split reads — assessments via PostgREST, questions via redacted service API
**Status:** ✅ Agreed
**Context:** `questions` carry hidden `answer_block` content. RLS alone cannot hide columns.
**Decision:** (1) `assessments` table is owner-scoped and browser-safe (recipe snapshot, status, warnings — no hidden content); RLS SELECT policy for `auth.uid()`, client-visible via PostgREST/Realtime like `materials`. (2) `questions` table is server-owned with **no** authenticated policies except a **column-level SELECT grant** (`GRANT SELECT (id, assessment_id, user_id, material_id, format, prompt, options, skill_tags, authored_difficulty, citations, created_at) ON questions TO authenticated`) plus an owner-scoped RLS SELECT policy — the `answer_block` column is readable **only** by `service_role`. (3) The app reads assessment detail through the redacted `GET /v1/assessments/{assessmentId}` API (the approved openapi surface), which assembles questions + citations + warnings and never serializes `answer_block`.
**Rationale:** Mirrors the #36/#37 split (metadata direct, content server-mediated), confines the redaction boundary to where hidden content lives, and keeps the approved API contract canonical for question reads.

### D-04: Threaded two-arm worker (ingestion + generation in one process)
**Status:** ✅ Agreed
**Context:** A generation attempt can block a single-threaded loop for up to ~30 s (worst ~90 s with the retry), which would delay ingestion queue pickup; ingestion is now fast enough (~1 min for the 572-page book on the GPU sidecar) that this matters.
**Decision:** Keep one compose service (`ingestion-worker`) but run **two threads**: the existing ingestion arm and a new generation arm, each with its own queue, poll cadence, and `max_in_flight=1`. The DeepSeek call is network-bound (OpenAI SDK HTTP wait releases the GIL), so ingestion polling continues uninterrupted. No separate deployable, no compose/env duplication.
**Rationale:** Removes cross-arm blocking entirely with a small change to `worker_main.py`; preserves the single-service ops shape.

### D-05: Hidden content — answer key is server-only, everywhere
**Status:** ✅ Agreed (contract requirement, not a choice)
**Decision:** `answer_block` (the `correctIndex` and any future hidden fields) lives only in the `questions.answer_block` jsonb column, readable by `service_role` alone. It never appears in: any API response, the redacted assessment serialization, local event payloads (`AssessmentCreated` carries only `{assessmentId, materialIds}`), telemetry records, or logs. The objective grading slice (later ticket) reads it server-side only.
**Rationale:** Acceptance criterion 3; PIPELINES redaction rule.

### D-06: Job outcome semantics for the single-question slice
**Status:** ✅ Agreed
**Context:** The Assessment status enum is `generating|ready|partial|failed`; the AsyncJob enum is `queued|running|succeeded|partial|failed|cancelled`.
**Decision:** With `questionCount=1`: accepted question ⇒ assessment `ready`, job `succeeded`; dropped slot (validation/repair exhausted, no valid citations) ⇒ assessment `failed` with `Warning(code=malformed_output|citation_missing|ungrounded)`, job `failed` non-retryable; safety block ⇒ assessment `failed` + `Warning(code=safety_block)`, job `failed` non-retryable; quota/timeout ⇒ job `failed` **retryable=true** with `retryAfterSeconds` when known, assessment stays `generating` so the UI can offer retry/resume; `provider_error`/`unsupported_request` ⇒ per error envelope retryability. `partial` is reserved for multi-question slices (enum exists; not produced here).

### D-07: Repair policy — one repair request at most
**Status:** ✅ Agreed (PIPELINES matrix)
**Decision:** On `malformed_output` (or validation failure with parseable JSON), send exactly **one** repair request carrying the validation failures, then re-validate. Still invalid ⇒ drop the slot with `Warning(code=malformed_output)` and telemetry `repairAttempted=true`. Never repair quota, safety, or timeout outcomes.

### D-08: Runtime settings (locked by #53; these are the values to implement)
**Status:** ✅ Agreed (do not re-litigate)
**Decision:** `GENERATION_MODEL=deepseek/deepseek-v4-flash-0731`, `GENERATION_BASE_URL=https://openrouter.ai/api/v1`, `GENERATION_TIMEOUT_MS=30000`, `GENERATION_MAX_OUTPUT_TOKENS=4096`, `GENERATION_TEMPERATURE=0.3`, `GENERATION_REASONING_EFFORT=off`, `OPENROUTER_API_KEY` (already in `services/intelligence/.env`). SDK `max_retries=0`; exactly **one** application-level retry for `rate_limited` (honoring `Retry-After`, capped 60 s), `provider_unavailable`, `provider_timeout`; never retry credentials/quota/safety; `unsupported_request` non-retryable. No `seed`, no `top_p`. Local schema validation after **every** response regardless of strict mode.

## Files-touched index

Service (`services/intelligence/`):

| File | Change |
|---|---|
| `supabase/migrations/018_assessments_generation.sql` | **new** — assessments, questions, constraint fix, telemetry columns, queue |
| `app/ingestion/models.py` | `IngestionJob` gains `kind`; `to_async_job()` emits it |
| `app/ingestion/telemetry.py` | `TelemetryRecord` gains `questions_requested`/`questions_accepted`/`reasoning_tokens` |
| `app/ingestion/repository.py` | generation job row helpers (or `app/generation/repo.py`, see Phase 1) |
| `app/generation/__init__.py` | **new** package |
| `app/generation/models.py` | **new** — GenerationRequest→Blueprint→Slot, normalized response dataclasses |
| `app/generation/prompts.py` | **new** — prompt template v1 + MCQ JSON schema |
| `app/generation/openrouter_client.py` | **new** — neutralized adapter (D-08) |
| `app/generation/validation.py` | **new** — format + citation validation, repair policy |
| `app/generation/context.py` | **new** — retrieval-driven RAG context (D-02) |
| `app/generation/worker.py` | **new** — `GenerationWorker` arm (D-04, D-06) |
| `app/routers/assessments.py` | **new** — generate + get endpoints (Phase 4) |
| `app/routers/serialization.py` | `async_job_from_row` passes `kind` through |
| `app/worker_main.py` | threaded two-arm main loop (D-04) |
| `app/main.py` | register assessments router |
| `.env.example`, `docker-compose.yml` | `GENERATION_*` env passthrough (worker + intelligence) |

App (`apps/app/`):

| File | Change |
|---|---|
| `src/assessments/types.ts` | **new** — contract types |
| `src/assessments/assessmentClient.ts` | **new** — service client (rule 22) |
| `src/assessments/AssessmentProvider.tsx` | **new** — context provider |
| `src/assessments/testing/fakeAssessmentClient.ts` | **new** — in-memory double |
| `src/events/EventStore.ts` / `index.ts` | `AssessmentCreated` kind constant + payload type (no schema bump) |
| `src/pages/assessments/AssessmentConfig.tsx` | **new** — config page |
| `src/pages/assessments/AssessmentDetail.tsx` | **new** — result view with citations/warnings |
| `src/App.tsx` | routes (no `/study` prefix) |
| `src/pages/materials/MaterialDetail.tsx` | "Generate assessment" entry (ready-only) |
| `e2e/assessment-generation-live.spec.ts` | **new** — env-gated live spec (Phase 7) |

## Open questions

- None blocking. Slice #39+ owns grading, the assessments hub, practice runs, and multi-question recipes; this plan only ships the single-question generation path.

## Out of scope

- Any edit under `services/intelligence/contracts/phase2/` (slice #57 owns all contract files, fixtures, and tests).
- Grading, answer-key reveal, practice runs, written/coding formats, assessment hub/list UI, Realtime wiring for assessments (PostgREST select works; the app polls the API this slice).
- Guide SSE, gated reveal, embeddings behavior, ingestion pipeline behavior.
- Any API/GPU spend beyond the single live E2E scenario in Phase 7.

## References

- Contract pack (post-#57 target): `services/intelligence/contracts/phase2/` (read `PIPELINES.md`, `openapi.yaml`, `async-job.schema.json`, `generation-blueprint.schema.json`, `question-slot.schema.json`).
- #57 body: the exact contract-file edit mandate (this plan assumes it landed).
- Context slices (code2prompt, rule 81) verified during planning: see Appendix A.

---

# Prerequisite verification (run before Phase 1)

1. `git status --short` — unrelated worktree changes (`.work/active/tracker-19-aug/`, `college/mydeliverables/phase2-review-2/`, `.agents/rules/81-*`) must be left untouched.
2. Slice #57 landed: `services/intelligence/contracts/phase2/` has **no** `gemini/` directory and `provider/generation-request.schema.json` uses `messages[]` / plain `responseSchema` / `reasoningEffort`.
3. Contract tests pass offline:
   `uv run --package intelligence pytest services/intelligence/contracts/phase2/tests/test_contracts.py`
4. If any check fails, STOP and surface — do not proceed against the old `gemini/` envelopes.

---

# Phase 1 — Data layer (migration 018) + job-kind serialization

**Goal:** Schema for assessments/questions/generation jobs and telemetry, plus the `kind` plumbing fix.

## 1.1 Migration `apps/app/supabase/migrations/018_assessments_generation.sql`

```sql
-- =============================================================================
-- 018: assessments + questions (server-owned hidden blocks), generation jobs
-- =============================================================================

-- (a) Allow one generation job per (kind, material, attempt) so a second
--     assessment on the same material can carry attempt 1.
ALTER TABLE public.ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_material_attempt_unique;
ALTER TABLE public.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_kind_material_attempt_unique
  UNIQUE (kind, material_id, attempt);

-- (b) Assessments: owner-scoped, browser-safe metadata (no hidden content).
CREATE TABLE IF NOT EXISTS public.assessments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  material_id TEXT NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  recipe JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'ready', 'partial', 'failed')),
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  grounding_version TEXT,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assessments_owner_client_unique UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_assessments_user ON public.assessments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_material ON public.assessments(material_id);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own assessments" ON public.assessments;
CREATE POLICY "Users can read own assessments"
  ON public.assessments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own assessments" ON public.assessments;
CREATE POLICY "Users can create own assessments"
  ON public.assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO service_role;
GRANT SELECT, INSERT ON public.assessments TO authenticated;

-- (c) Questions: server-owned rows with a hidden answer block.
--     No authenticated INSERT/UPDATE/DELETE; SELECT limited by column grant.
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'objective'
    CHECK (format IN ('objective', 'written', 'coding')),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  authored_difficulty INTEGER NOT NULL
    CHECK (authored_difficulty BETWEEN 1 AND 5),
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_block JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_assessment ON public.questions(assessment_id);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own questions" ON public.questions;
CREATE POLICY "Users can read own questions"
  ON public.questions FOR SELECT
  USING (auth.uid() = user_id);

-- Column-level grants: authenticated sees public columns only; the hidden
-- answer_block column is service_role-only (RLS alone cannot hide columns).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO service_role;
GRANT SELECT
  (id, assessment_id, user_id, material_id, format, prompt, options,
   skill_tags, authored_difficulty, citations, created_at)
  ON public.questions TO authenticated;

-- (d) Telemetry: columns required by the amended GenerationTelemetry contract.
ALTER TABLE public.generation_telemetry
  ADD COLUMN IF NOT EXISTS questions_requested INTEGER NOT NULL DEFAULT 0
    CHECK (questions_requested >= 0),
  ADD COLUMN IF NOT EXISTS questions_accepted INTEGER NOT NULL DEFAULT 0
    CHECK (questions_accepted >= 0),
  ADD COLUMN IF NOT EXISTS reasoning_tokens INTEGER
    CHECK (reasoning_tokens >= 0);

-- (e) pgmq queue for assessment generation (reuses the generic wrappers).
DO $$
BEGIN
  BEGIN
    PERFORM pgmq.create('assessment_generate');
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END $$;
```

**Notes:**
- `assessments` is client-INSERTable so the API (which holds only the user token) can create the row; `recipe` snapshot matches `AssessmentRecipe` (`{formats, questionCount, difficulty, skillTags}`).
- `questions` INSERT/UPDATE flow via `service_role` from the worker only.
- Follow migration `014`'s style for the header comment.

## 1.2 Job-kind plumbing

- `app/ingestion/models.py`: add `kind: str = "ingestion"` to `IngestionJob`; in `to_async_job()`, replace the hardcoded `"kind": "ingestion"` with `self.kind`.
- `app/routers/serialization.py` `async_job_from_row()`: pass `row.get("kind") or "ingestion"` into the `IngestionJob`.
- `app/userrest.py`: add `get_generation_job(job_id)` (same as `get_job`) if a distinct method reads better — or reuse `get_job` unchanged since it is one table; prefer reuse, keep `get_job`.

## 1.3 Telemetry model

- `app/ingestion/telemetry.py` `TelemetryRecord`: add `questions_requested: int = 0`, `questions_accepted: int = 0`, `reasoning_tokens: int | None = None`; include them in `to_row_dict()` (and `to_contract_dict()` for `questionsRequested`/`questionsAccepted`/`reasoningTokens`). Keep `texts_count` behavior unchanged.

## Tests

- Extend `tests/test_models.py` / `tests/test_telemetry.py`: `to_async_job()` emits the row's kind; telemetry row dict includes the three new fields when set.
- `tests/test_v1_integration.py` (or `test_materials_api.py`-style): `GET /v1/jobs/{id}` on a generation-kind row returns `"kind": "generation"`.

## Verification

- `uv run --package intelligence ruff check services/intelligence/`
- `uv run --package intelligence pytest services/intelligence/tests/test_models.py services/intelligence/tests/test_telemetry.py services/intelligence/tests/test_v1_integration.py -q`
- Migration applies: from `apps/app/`, `npx --yes supabase@latest db push --dry-run --linked --project-ref kabpmbhlvfbrhtbxjaua` (needs `SUPABASE_ACCESS_TOKEN` per rule 36), then push + probe:
  - `db query` checks `assessments`, `questions`, `assessment_generate` queue exist; `ingestion_jobs` constraint is `ingestion_jobs_kind_material_attempt_unique`.
  - Cross-user probe: user B cannot SELECT user A's assessment row.

---

# Phase 2 — Generation domain (models, prompts, adapter, validation)

**Goal:** Pure, testable modules that turn a blueprint into a validated grounded question. No I/O beyond the adapter's provider call and injected context.

## 2.1 `app/generation/models.py`

Dataclasses mirroring the amended contracts:

```python
# Envelope shapes follow the #54-amended provider contracts (post-#57 files):
# provider/generation-request.schema.json and provider/generation-response.schema.json.

@dataclass(frozen=True)
class GenerationRequest:        # from the API body
    client_id: str
    material_id: str
    recipe: dict                # AssessmentRecipe: formats, questionCount, difficulty, skillTags
    correlation_id: str

@dataclass(frozen=True)
class GenerationBlueprint:      # what the worker executes
    assessment_id: str
    job_id: str
    owner_id: str
    material_id: str
    difficulty: int             # 1..5 authored band (never overwritten)
    skill_tags: tuple[str, ...]
    correlation_id: str
    prompt_template_version: str = "v1"

@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: str
    material_id: str
    text: str
    ordinal: int

@dataclass(frozen=True)
class NormalizedGenerationResponse:  # flattened, provider-neutral
    content: str | None
    refusal: str | None
    finish_reason: str                 # stop|length|content_filter|refusal|error
    native_finish_reason: str | None
    structured_output: dict | None
    usage: dict                        # prompt_tokens, completion_tokens, total_tokens, reasoning_tokens?
    routed_provider: str | None
    outcome: str                       # ok|partial|safety_block|quota_failure|timeout|malformed_output|provider_error
    error: dict | None                 # provider-error shape
    latency_ms: float

@dataclass(frozen=True)
class AcceptedQuestion:
    question_id: str
    assessment_id: str
    material_id: str
    format: str
    prompt: str
    options: tuple[str, ...]
    skill_tags: tuple[str, ...]
    authored_difficulty: int
    citations: tuple[dict, ...]        # [{chunkId, materialId, quote}]
    answer_block: dict                 # {"correctIndex": int} — SERVER-ONLY
    warnings: tuple[dict, ...]         # [{code, message}]
```

## 2.2 `app/generation/prompts.py`

`prompt_template_version = "v1"`. Reuse the probe's proven shapes (`services/intelligence/scripts/generation_probe.py:48-84`) verbatim, with the difficulty band injected:

```python
MCQ_SCHEMA = {
    "type": "object",
    "properties": {
        "stem": {"type": "string"},
        "options": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
        "correctIndex": {"type": "integer", "minimum": 0, "maximum": 3},
        "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
        "skillTags": {"type": "array", "items": {"type": "string"}, "minItems": 1},
        "citations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "chunkId": {"type": "string"},
                    "quote": {"type": "string"},
                },
                "required": ["chunkId", "quote"],
                "additionalProperties": False,
            },
            "minItems": 1,
        },
    },
    "required": ["stem", "options", "correctIndex", "difficulty", "skillTags", "citations"],
    "additionalProperties": False,
}

SYSTEM_TEMPLATE = (
    "You author one multiple-choice exam question grounded STRICTLY in the provided source chunks. "
    "Rules: cite every chunk you used by its chunkId and quote the exact sentence fragment you "
    "grounded the question on; invent nothing outside the chunks; make distractors plausible but "
    "clearly wrong to an expert; do not copy a full sentence verbatim into the stem; target "
    "difficulty {difficulty_hint}; respond only with the required JSON object."
)

USER_TEMPLATE = (
    "Learner need (topic steer): {steer}\n\n"
    "Source chunks:\n{chunks}\n\n"
    "Author one grounded MCQ."
)

CHUNK_FMT = '<chunk id="{cid}">{text}</chunk>'

def build_messages(blueprint, chunks, *, repair_feedback: str | None = None) -> list[dict]:
    # system message: SYSTEM_TEMPLATE.format(difficulty_hint=blueprint.difficulty)
    # user message:   USER_TEMPLATE.format(steer=", ".join((material_title?, *skill_tags)), chunks=...)
    # repair:        append an assistant/user pair carrying repair_feedback and "Return ONLY the corrected JSON object."
```

## 2.3 `app/generation/openrouter_client.py` (the adapter)

Implement the neutralized provider boundary. Mirror the probe's call mechanics (`generation_probe.py:97-159, 226-228`) with the #53-locked production values:

```python
class OpenRouterGenerationClient:
    def __init__(self, *, api_key, base_url="https://openrouter.ai/api/v1",
                 model="deepseek/deepseek-v4-flash-0731", timeout_ms=30000,
                 max_output_tokens=4096, temperature=0.3, reasoning_effort="off"):
        self._client = OpenAI(base_url=base_url, api_key=api_key, max_retries=0)
        ...

    def generate(self, messages, response_schema, *, repair=False) -> NormalizedGenerationResponse:
        kwargs = {
            "model": self._model,
            "messages": messages,
            "max_tokens": self._max_output_tokens,
            "temperature": self._temperature,          # no seed, no top_p (D-08)
            "timeout": self._timeout_ms / 1000.0,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "grounded_mcq", "strict": True, "schema": response_schema},
            },
            "extra_body": {
                "provider": {"require_parameters": True},
                "reasoning": {"enabled": False},        # GENERATION_REASONING_EFFORT == "off"
            },
        }
        # ONE application-level retry (D-08) for rate_limited / provider_unavailable /
        # provider_timeout; honor Retry-After (cap 60 s); never retry credentials/quota/safety.
        # Map SDK exceptions: APITimeoutError -> provider_timeout; RateLimitError -> quota_exhausted
        # (retryAfterSeconds from Retry-After); APIStatusError 400 mentioning reasoning/effort ->
        # unsupported_request (non-retryable); 401/403 -> provider_credentials; 5xx ->
        # provider_unavailable; other APIError -> provider_error.
        # Normalize the choice: message.content / message.refusal, finish_reason (lowercase),
        # native_finish_reason, usage.completion_tokens_details.reasoning_tokens, routed_provider
        # (response.routed_provider if present), structured parse of content JSON.
```

**Outcome mapping (from #57's README mandate, D-06):**

| condition | outcome |
|---|---|
| `refusal` or null content | `safety_block` (non-retryable) |
| `finish_reason == "length"` | `malformed_output` (truncated; one repair then drop) |
| `finish_reason == "content_filter"` | `safety_block` (non-retryable) |
| `finish_reason == "error"` | `provider_error` |
| `finish_reason == "stop"` + JSON parses + schema-valid | `ok` (then citation validation) |
| `finish_reason == "stop"` + JSON parses + schema-invalid | `malformed_output` (one repair) |
| `finish_reason == "stop"` + JSON doesn't parse | `malformed_output` (one repair) |
| HTTP 429 | `quota_failure` (`quota_exhausted`, `retryAfterSeconds`) |
| HTTP 400 w/ effort/reasoning in message | `provider_error` with `unsupported_request` (non-retryable) |
| HTTP 401/402/403 | `provider_error` (`provider_credentials`, non-retryable) |
| HTTP ≥500 / connect | `provider_unavailable` (retryable, one retry) |
| request deadline | `provider_timeout` (retryable, one retry) |

Local schema validation is mandatory after every response — validate with `jsonschema.Draft202012Validator(MCQ_SCHEMA)` (the repo already depends on `jsonschema`), not just strict-mode trust.

## 2.4 `app/generation/validation.py`

```python
def validate_question(candidate: dict, blueprint: GenerationBlueprint,
                      context_ids: set[str], chunk_texts: dict[str, str]) -> tuple[dict | None, list[dict]]:
    """Returns (accepted candidate dict | None, warnings).

    Format gate (hard): stem non-empty; exactly 4 non-empty distinct options;
    correctIndex int in 0..3; difficulty int == blueprint.difficulty (authored
    band is never overwritten); skillTags non-empty list of non-empty strings.

    Citation gate (hard): every citation chunkId must be in context_ids.
    Quote handling (soft): when quote is a normalized substring of the cited
    chunk text it is 'verified'; otherwise keep the citation and add
    Warning(code='citation_unverified'). A candidate with zero valid citations
    is dropped with Warning(code='citation_missing').

    Format failures produce Warning(code='malformed_output') and return None.
    """
```

- One repair round: when the provider returns parseable JSON that fails the format gate, call the adapter once more with `repair_feedback` containing the failure list (D-07); re-validate. No repair for citation-gate failures only (they are drop-with-warning, not malformed).

## 2.5 `app/generation/context.py` (D-02)

```python
def build_context(material_id: str, skill_tags: tuple[str, ...], title: str,
                  supabase_url: str, service_key: str, client: httpx.Client) -> list[RetrievedChunk]:
    steer = " ".join((title, *skill_tags)).strip() or title
    vectors = embed_queries([steer])          # app/query_embedder.py, existing factory
    if not vectors or vectors[0] is None:
        raise IngestionError("provider_unavailable", "query embedding failed", retryable=True)
    literal = "[" + ",".join(f"{v:.8f}" for v in vectors[0]) + "]"
    # POST /rest/v1/rpc/match_content_chunks with service role:
    #   {"query_embedding": literal, "match_material_id": material_id, "top_k": 5}
    # (mirror routers/retrieval.py:79-104; note match_content_chunks is
    #  SECURITY INVOKER service-role-only — call with the service key)
    return [RetrievedChunk(...) for row in hits]
```

The embedder failure path fails the job retryable (`provider_unavailable`) per D-02.

## Tests (all offline, no network)

- `tests/test_generation_models.py` — dataclass construction, blueprint default `prompt_template_version`.
- `tests/test_generation_prompts.py` — message assembly, repair feedback insertion, difficulty hint injection, chunk formatting.
- `tests/test_generation_adapter.py` — inject a fake `OpenAI`-shaped object (or monkeypatch `chat.completions.create`) covering **every** outcome row in the D-08 mapping: stop/ok, stop/schema-invalid, length, content_filter, refusal, error, 429, 400-effort, 401, 5xx, timeout, and the single-retry behavior (called twice then failed) with `Retry-After` honored and capped.
- `tests/test_generation_validation.py` — format gate cases (each failure kind), citation-in-context accept, citation out-of-context drop, quote verified vs unverified warning, difficulty mismatch rejection, repair round-trip.
- Reuse `services/intelligence/tests/ingestion_doubles.py` patterns for fakes.

## Verification

- `uv run --package intelligence ruff check services/intelligence/`
- `uv run --package intelligence pytest services/intelligence/tests/test_generation_*.py -q`
- Dry-run discipline (rule 80): these are pure offline tests; no provider call is made.

---

# Phase 3 — Worker arm + orchestration

**Goal:** The generation pipeline runs in the worker process on the `assessment_generate` queue, persists redacted content + hidden answer blocks, emits telemetry, and transitions jobs/assessments per D-06.

## 3.1 `app/generation/worker.py`

```python
class GenerationWorker:
    def __init__(self, *, repo, queue, adapter, validator, telemetry, config): ...

    def run_once(self) -> int:  # returns processed count
        messages = self._queue.poll("assessment_generate",
                                    visibility_seconds=self._config.visibility_seconds,  # >= call budget, default 90
                                    quantity=1)
        for msg in messages:
            self._process(msg)
        return len(messages)

    def _process(self, msg):
        payload = msg.payload          # {job_id, assessment_id, material_id, correlation_id}
        # 1. mark job running (service role UPDATE ingestion_jobs SET status='running')
        # 2. load assessment row (recipe) by id; load material (title) for steer
        # 3. build_context(...) -> RetrievedChunk[]          (Phase 2.5; failure -> retryable fail)
        # 4. blueprint = GenerationBlueprint(...)
        # 5. messages = build_messages(...); resp = adapter.generate(messages, MCQ_SCHEMA)
        # 6. outcome dispatch (D-06):
        #    ok      -> validate_question -> insert question row (public cols + answer_block)
        #              -> assessment status ready; job succeeded; telemetry outcome ok
        #    malformed -> one repair (D-07); still invalid -> Warning(malformed_output)
        #              -> assessment failed; job failed non-retryable
        #    safety_block  -> Warning(safety_block); assessment failed; job failed non-retryable
        #    quota_failure -> job failed retryable (+retryAfterSeconds); assessment stays generating
        #    timeout       -> job failed retryable (provider_timeout); assessment stays generating
        #    provider_error/unsupported_request -> per envelope retryability; assessment stays generating
        # 7. telemetry: task='assessment_generation', model=GENERATION_MODEL,
        #    prompt_template_version='v1', outcome, latencyMs, input/output/reasoning tokens,
        #    repairAttempted, questionsRequested=1, questionsAccepted=0|1 (traceId=correlation_id)
        # 8. queue.complete("assessment_generate", msg.msg_id, success)
        # 9. never raise out of _process: catch, mark job failed with the mapped code, log
```

**Repo helpers** (extend `app/ingestion/repository.py` or a small `app/generation/repo.py`): `update_job_status(job_id, status, *, error_code=None, error_message=None, retryable=False, retry_after=None, result_id=None)`, `update_assessment_status(assessment_id, status, warnings)`, `insert_question(row)`, `get_assessment(assessment_id)`, `get_material_row(material_id)` — all via service-role REST, same style as `SupabaseIngestionRepo`.

**Config:** `GenerationWorkerConfig(poll_interval_seconds=1.0, visibility_seconds=90, max_in_flight=1)`, env-tunable `GENERATION_POLL_INTERVAL_SECONDS` / `GENERATION_VISIBILITY_SECONDS`.

## 3.2 `app/worker_main.py` — threaded two-arm main (D-04)

```python
def _build_generation_worker(shared_client):
    from app.generation.openrouter_client import OpenRouterGenerationClient
    from app.generation.validation import validate_question
    from app.generation.worker import GenerationWorker, GenerationWorkerConfig
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        logger.warning("OPENROUTER_API_KEY is not set: generation jobs will fail with provider_credentials")
    adapter = OpenRouterGenerationClient(
        api_key=api_key,
        base_url=os.getenv("GENERATION_BASE_URL", "https://openrouter.ai/api/v1"),
        model=os.getenv("GENERATION_MODEL", "deepseek/deepseek-v4-flash-0731"),
        timeout_ms=int(os.getenv("GENERATION_TIMEOUT_MS", "30000")),
        max_output_tokens=int(os.getenv("GENERATION_MAX_OUTPUT_TOKENS", "4096")),
        temperature=float(os.getenv("GENERATION_TEMPERATURE", "0.3")),
        reasoning_effort=os.getenv("GENERATION_REASONING_EFFORT", "off"),
    )
    return GenerationWorker(...)

def _arm_loop(worker, stop, poll_interval):
    while not stop.is_set():
        try:
            worker.run_once()
        except Exception:
            logger.exception("generation arm iteration failed; backing off")
            time.sleep(5)
        time.sleep(poll_interval)

def main():
    ...
    generation_worker = _build_generation_worker(shared_client)
    stop = threading.Event()
    generation_thread = threading.Thread(
        target=_arm_loop, args=(generation_worker, stop, generation_worker.config.poll_interval_seconds), daemon=True)
    generation_thread.start()
    # existing signal handling sets stop; existing ingestion loop unchanged
    # after loop ends: stop.set(); generation_thread.join(timeout=...)
```

- Keep the ingestion arm as-is (same loop, same `run_once`); the generation arm is a daemon thread sharing `shared_client`. Signal handlers must set the event, not just the local flag (both arms must drain).

## 3.3 Env wiring

- `services/intelligence/.env.example`: add `GENERATION_MODEL`, `GENERATION_BASE_URL`, `GENERATION_TIMEOUT_MS`, `GENERATION_MAX_OUTPUT_TOKENS`, `GENERATION_TEMPERATURE`, `GENERATION_REASONING_EFFORT` (defaults match D-08).
- `docker-compose.yml`: pass the `GENERATION_*` vars + `OPENROUTER_API_KEY` to both `intelligence` and `ingestion-worker` services (mirror how `EMBEDDING_PROVIDER`/`EMBEDDER_URL` are passed today).

## Tests

- `tests/test_generation_worker.py` — in-memory queue double + fake adapter + fake repo: full happy path (question inserted with answer_block, assessment ready, job succeeded, telemetry ok), quota (job failed retryable, assessment generating, no question row), timeout, safety (warning + failed), malformed + repair-success and repair-exhausted, citation-drop → failed with warning, embedder-unavailable → retryable fail.
- `tests/test_worker_main.py` (extend existing) — `_build_generation_worker` env parsing; threads start/stop cleanly on the stop event.

## Verification

- `uv run --package intelligence ruff check services/intelligence/`
- `uv run --package intelligence pytest services/intelligence/tests/test_generation_worker.py services/intelligence/tests/test_worker_main.py -q`
- Service suite subset: `uv run --package intelligence pytest services/intelligence/tests -q` (expect the documented pre-existing golden-fixture failures only).

---

# Phase 4 — API endpoints

**Goal:** `POST /v1/assessments/generate` (202 + AsyncJob), redacted `GET /v1/assessments/{assessmentId}`, and job polling resume.

## 4.1 `app/routers/assessments.py`

```python
router = APIRouter()

@router.post("/assessments/generate")
def generate_assessment(
    body: GenerationRequest, request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
    idempotency_key: str = Header(alias="Idempotency-Key", ...),  # contract: required, min 16 chars
) -> dict | JSONResponse:
    # 1. materialIds must contain exactly one material (slice scope); else 400 invalid_request
    # 2. ready + owner gate: client.get_material(material_id); ingestion_state == 'ready' else
    #    service_error 409 validation_failed ("material not ready")
    # 3. recipe validation: formats == ['objective'], questionCount == 1 (else 400 invalid_request);
    #    difficulty 1..5 (schema enforces); skillTags optional (default ['core'])
    # 4. INSERT assessment row via user token (RLS INSERT with auth.uid()):
    #    id=uuid, client_id=body.clientId, user_id=owner (from token), material_id, recipe,
    #    status='generating', warnings=[], correlation_id=body.correlationId
    #    - unique violation 23505 on (user_id, client_id) -> 409 conflict
    # 5. INSERT ingestion_jobs row (service-role? NO — API has no service creds; see note):
    #    kind='generation', material_id, attempt=1, correlation_id, result_id=assessment_id,
    #    status='queued'
    # 6. queue.send('assessment_generate', {job_id, assessment_id, material_id, correlation_id})
    # 7. return 202 async_job_from_row(job_row)

@router.get("/assessments/{assessmentId}")
def get_assessment(assessmentId: str, request: Request,
                   client: Annotated[UserScopedClient, Depends(get_user_client)]) -> dict:
    # 1. fetch assessment row (user token; RLS owner-scoped) -> 404 if absent
    # 2. fetch its questions (user token; column-grant SELECT) -> public columns only
    # 3. serialize Assessment contract:
    #    {id, ownerId, materialIds: [material_id], status, questions: [{id, assessmentId,
    #     materialId, format, prompt, options, skillTags, authoredDifficulty, citations}],
    #     warnings, groundingStale: false, createdAt}
    #    NEVER include answer_block. questions that fail the citation gate never exist
    #    (they are dropped pre-insert), so warnings carry the explanation.
```

**Note on job INSERT from the API:** the API holds only the user token; `ingestion_jobs` has no authenticated INSERT grant today. Options, in preference order:
1. Add a small **security-definer RPC** `enqueue_assessment_generation(p_assessment_id TEXT, p_job_id TEXT, p_material_id TEXT, p_correlation_id TEXT)` (migration 018) that INSERTs the generation job row and `pgmq.send('assessment_generate', ...)` in one transaction (service-role-effective, owner-checked inside: `IF NOT EXISTS (SELECT 1 FROM assessments WHERE id = p_assessment_id AND user_id = auth.uid()) THEN RAISE EXCEPTION ...`). This mirrors the #37 retry-RPC ownership pattern and keeps the browser/API out of the jobs table.
2. Fallback (only if the RPC is rejected at review): grant authenticated `INSERT` on `ingestion_jobs` with a `WITH CHECK` policy — weaker ownership story, not preferred.

Prefer option 1; it matches the existing DB-atomic RPC pattern (`retry_material_ingestion`, migration `009`) and the contract's "service writes local/server state first, then queues provider work" rule. The RPC also returns the job row so the endpoint can serialize the AsyncJob.

## 4.2 Register the router

- `app/main.py`: `from app.routers import assessments` + `app.include_router(assessments.router, prefix="/v1", dependencies=_V1_DEPENDENCIES)`.

## 4.3 Job polling (resume)

- `GET /v1/jobs/{jobId}` already works for any row in `ingestion_jobs` once `kind` flows through serialization (Phase 1.2). No new endpoint needed; resume = poll job until terminal, then `GET /v1/assessments/{id}`. The UI stores the assessment id from the 202 `resultId` (or the URL), so refresh-safe resume never needs the job id.

## Tests

- `tests/test_assessments_api.py` (model on `test_materials_api.py`):
  - 202 happy path with correct AsyncJob shape (`jobId`, `kind: 'generation'`, `resultId: assessment_id`, `status: 'queued'`).
  - non-ready material → 409; missing/foreign material → 404; wrong format/count → 400; duplicate clientId → 409.
  - 401 without token (endpoint security).
  - GET returns redacted Assessment; asserts **no** `answerBlock`/`correctIndex`/`answer` key anywhere in the response (walk the JSON like `test_contracts.py`'s secret-field walker).
  - GET 404 for other users' assessments; job GET works for a generation row.

## Verification

- `uv run --package intelligence ruff check services/intelligence/`
- `uv run --package intelligence pytest services/intelligence/tests/test_assessments_api.py services/intelligence/tests/test_v1_integration.py -q`
- Optional live probe (rule 36) against the dev project with a real access token: create a ready material, POST generate, observe 202, poll job → succeeded, GET assessment redacted.

---

# Phase 5 — App data layer

**Goal:** typed, dependency-injected service client + thin local-first pointer event.

## 5.1 `apps/app/src/assessments/types.ts`

Contract types (from `openapi.yaml`): `AssessmentRecipe`, `GenerationRequest`, `Question`, `Citation`, `Warning`, `Assessment`, `AsyncJob` (with `kind: 'ingestion' | 'generation' | 'grading' | 'roadmap_feedback'`), plus `AssessmentServiceErrorCode` mirroring `ServiceError.code` (rule 22).

## 5.2 `apps/app/src/assessments/assessmentClient.ts`

Model on `apps/app/src/lib/intelligenceClient.ts` (fetch + `VITE_INTELLIGENCE_URL` + Bearer) but with a **narrow dependency interface** like `materialClient.ts` so tests inject an in-memory double:

```ts
export interface AssessmentFetchLike {
  fetchJson(path: string, init?: RequestInit): Promise<unknown>
}

export interface AssessmentClientLike {
  generateAssessment(input: GenerationRequest): Promise<AsyncJob>
  getAssessment(assessmentId: string): Promise<Assessment>
  getJob(jobId: string): Promise<AsyncJob>
}

export class AssessmentClient implements AssessmentClientLike { ... }

export function normalizeAssessmentError(err: unknown): AssessmentServiceError
```

- `generateAssessment` sends `X-Request-ID` (uuid) + `Idempotency-Key` (uuid, ≥16 chars) headers; 401 → `unauthorized`; 409 → `conflict`; 429 → `quota_exhausted` with `retryAfterSeconds`; 5xx → retryable; timeout/AbortError → retryable timeout (rule 22).
- `getAssessment` returns the redacted Assessment (never contains answer data by construction; assert nothing in tests).

## 5.3 Provider

`AssessmentProvider.tsx` — createContext + `useAssessmentClient()`, mirrors `MaterialsProvider`. Instantiate the real client once with the real fetch-like; tests inject fakes.

## 5.4 Local-first pointer event (rules 30/33)

- `apps/app/src/events/EventStore.ts` (or a shared kinds module): add `export const ASSESSMENT_CREATED = 'AssessmentCreated' as const` and a payload type `{assessmentId: string, materialIds: string[]}` — matches `durable-events.schema.json` `assessmentCreatedPayload`. **No Dexie schema bump** (events table indexes `kind`; `EventStoreProvider` versions 1–5 unchanged).
- After `generateAssessment` returns 202 with `resultId`, append `AssessmentCreated` via the existing sync path (`eventStore.append` → `SyncEngine` pushes it like every other event; the durable-event envelope already has the kind). If append fails, the generation still stands (server-owned); log and continue — the event is a pointer, not the source of truth.

## Tests

- `apps/app/src/assessments/assessmentClient.test.ts` — fake fetch: success shapes, 401/409/429/5xx normalization, AbortError→timeout, retry behavior, typed error surface (rule 22 patterns from `materialClient.test.ts`).
- Cross-user/account-switch: provider unmount/remount with different userId must not share state (mirror `useMaterialLibrary.test.tsx` account-switch case).
- Event: `EventStore.append(ASSESSMENT_CREATED, {...})` stores and reads back the payload; no schema migration fired (`db.version` unchanged).

## Verification

- `pnpm --filter app exec vitest run --pool=forks src/assessments src/events` (from `apps/app/`)
- `pnpm typecheck && pnpm lint`

---

# Phase 6 — App UI

**Goal:** config → generate → result, Marginalia-styled, ready-only gated, resumable.

## 6.1 Entry point

- `apps/app/src/pages/materials/MaterialDetail.tsx`: add a primary "Generate assessment" action visible only when `isReady(material)` (the existing readiness gate from `materials/types.ts`), navigating to `/materials/${materialId}/assessments/new`. Non-ready materials keep current behavior (no entry).

## 6.2 `apps/app/src/pages/assessments/AssessmentConfig.tsx` (route `/materials/:materialId/assessments/new`)

Mirror `PracticeThis.tsx` structure (load material, ready gate banner, config card):

- Loads the material; if not ready shows the same "Material is not ready yet" banner pattern and a back link.
- Fields (minimal): difficulty band chips `1..5` (default `3`), optional skill tags (single text input, comma-separated). Question count fixed at 1; format locked to objective — no UI for them this slice.
- Submit → `client.generateAssessment({clientId: uuid, materialIds: [materialId], recipe: {formats: ['objective'], questionCount: 1, difficulty, skillTags}, correlationId: uuid})` → on 202, append `AssessmentCreated` event (Phase 5.4) and navigate to `/assessments/${job.resultId ?? assessmentId}`.
- Error surfaces: `quota_exhausted` banner with `retryAfterSeconds`; `conflict` → navigate to existing assessment if identifiable; network → retryable banner + Retry button.
- Follow rule 13 (`.field-group` primitives), rule 12 (no `/study` prefix in routes/links), design tokens from `packages/design-tokens`.

## 6.3 `apps/app/src/pages/assessments/AssessmentDetail.tsx` (route `/assessments/:assessmentId`)

- On mount (and after generate), poll `getAssessment` every 3 s while `status === 'generating'`, stop on terminal (`ready | partial | failed`), clear on unmount. Refresh-safe: the route param alone restores the view (resume seam).
- **`ready`:** render the question — prompt, 4 options (selectable list UI only; no selection behavior this slice — grading is later), `authoredDifficulty`, skill tags; citations block listing each `{chunkId, quote}`; warnings block (e.g. `citation_unverified`) as attention banners.
- **`failed`:** warnings + a Retry action → new `generateAssessment` with a **fresh clientId + correlationId** (new observation per PIPELINES) on the same material, then back to polling.
- **`generating`:** progress state (honest, no fake percentages).
- Never render any answer/`correctIndex` — by construction the API doesn't return it; the component must not even reference the field.
- Responsive: desktop + 390 px; zero console errors; screenshots per repo verification habit.

## Routes (`apps/app/src/App.tsx`)

```tsx
<Route path="/materials/:materialId/assessments/new" element={<AssessmentConfig />} />
<Route path="/assessments/:assessmentId" element={<AssessmentDetail />} />
```

## Tests

- `AssessmentConfig.test.tsx` — ready gate, field defaults, submit payload shape, 202 navigation, quota/network error banners, double-submit disabled while pending.
- `AssessmentDetail.test.tsx` — polling lifecycle (fake timers), ready render with citations/warnings, failed + retry (new clientId), generating state, unmount clears timer, refresh-restore (mount directly on route param).
- `MaterialDetail.test.tsx` — entry visible only when ready.

## Verification

- `pnpm --filter app exec vitest run --pool=forks` (full app suite; expect all green)
- `pnpm typecheck && pnpm lint`
- `pnpm build` (both `apps/marketing` and `apps/app` produce dist)
- Browser check (rule 10): `./full-app restart full`, then verify the flow on desktop + 390×844.

---

# Phase 7 — Verification sweep + live E2E

**Goal:** everything green together, live proof, docs wrapped.

## 7.1 Offline sweep

1. `uv run --package intelligence pytest services/intelligence/contracts/phase2/tests/test_contracts.py` (post-#57 fixtures; offline).
2. `uv run --package intelligence pytest services/intelligence/tests -q` — full service suite (pre-existing golden-fixture failures only).
3. `uv run --package intelligence ruff check services/intelligence/ && uv run --package intelligence ruff format --check services/intelligence/`
4. `pnpm --filter app exec vitest run --pool=forks` (full app suite)
5. `pnpm typecheck && pnpm lint`
6. `pnpm build`

## 7.2 Live E2E (env-gated, one real generation ~$0.002)

Author `e2e/assessment-generation-live.spec.ts` following rule 16 (`material-library-live.spec.ts` / `material-ingestion-live.spec.ts` patterns):

- Module-level gate on `E2E_LIVE_EMAIL` / `E2E_LIVE_PASSWORD`; own `test.describe` for skip scoping.
- Flow: sign in → create a small manual (contentless→no; needs ready) or URL material and wait for `ready` (or reuse an existing ready material by title search) → navigate to `/materials/:id/assessments/new` → configure difficulty → submit → poll the detail page until `ready` (generation with reasoning off is fast; still allow generous timeout) → assert the question renders, ≥1 citation renders, no answer text present → delete created material at the end (shared-account hygiene) → zero page/console errors.
- `test.setTimeout(...)` generous (300 s) to cover polling + generation.
- Run: `pnpm exec playwright test -c e2e/playwright.config.ts --project=app --reporter=list e2e/assessment-generation-live.spec.ts` with `./full-app start full` up (rule 10) and the env vars exported. Inspect `.dev/full-app/logs/` on failure.
- The sidecar (rule 54) must be running for the retrieval-driven context (D-02): `docker compose -f services/embedder/docker-compose.yml up -d` before the run, stop after.

## 7.3 Docs wrap

- Update this plan's per-phase status lines and `VERIFICATION.md` (append evidence per phase, mark acceptance criteria).
- Update `.work/STATUS.md` active row for the plan (or the #38 queue row) with the new link and state; bump `last_updated`.
- Commit per phase with conventional messages (`feat(service): ...`, `feat(app): ...`, `docs(phase2): ...`) + `Co-authored-by: GitHub Copilot using <model>` trailer.
- Close out on #38 with a resolution comment linking the plan + verification summary (keep the ticket open until implementation lands).

## Acceptance criteria (from #38)

1. **Generation is enabled only for ready, owner-scoped materials** — API gate (Phase 4.1 step 2) + UI gate (Phase 6.1); tests assert 409/404 and hidden entry.
2. **The generated objective Question validates against its format schema and includes verified citations or explicit warnings** — validation module (Phase 2.4), `citation_unverified`/`citation_missing`/`malformed_output` warnings; UI renders citations + warnings (Phase 6.3).
3. **Hidden grading content is never returned to the browser, local cache, event log, or telemetry** — column-grant isolation + redacted serialization (Phase 1/4); `AssessmentCreated` carries ids only (Phase 5.4); telemetry has no answer fields (Phase 3); API test walks the response for secret keys (Phase 4.4).
4. **Timeout, quota, safety block, malformed output, repair, partial, and resume behavior are tested** — adapter outcome matrix tests (Phase 2.3), worker outcome tests (Phase 3), UI retry/resume tests (Phase 6), live E2E (Phase 7.2).

---

# Appendix A — Context slices (code2prompt, rule 81)

Generated 2026-08-22 from the live checkout (branch `phase2/issue-38`) to ground this plan. Trust the live code over any summary; if a slice conflicts with the #54/#57 resolution, the discrepancy belongs to #57, not this plan.

| Slice (path) | Tokens | What it gives the implementer |
|---|---|---|
| `services/intelligence/app/routers/` (jobs, materials, retrieval, serialization) | 2,839 | endpoint patterns, serialization, retrieval call path |
| `services/intelligence/app/userrest.py` | 716 | user-token REST + RLS ownership pattern |
| `services/intelligence/app/ingestion/queue.py` | 852 | pgmq wrapper contract (`poll/complete/send`) |
| `services/intelligence/app/worker_main.py` | 1,235 | worker loop + adapter construction (Phase 3 base) |
| `services/intelligence/scripts/generation_probe.py` | 8,299 | adapter mechanics: `build_kwargs`, `classify_success`, `MCQ_SCHEMA`, prompts, local validation |
| `services/intelligence/app/ingestion/telemetry.py` | — | `TelemetryRecord` wire/row shapes |
| `apps/app/src/materials/materialClient.ts` | 3,071 | typed client + error normalization + DI pattern |
| `apps/app/src/materials/testing/fakeMaterialClient.ts` | 1,054 | in-memory double pattern |
| `apps/app/src/pages/materials/PracticeThis.tsx` | 1,915 | ready gate + config card UI pattern |
| `apps/app/src/events/EventStore.ts` + `EventStoreProvider.tsx` | 1,131 | kind-agnostic append; Dexie versions 1–5 |
| `apps/app/src/lib/intelligenceClient.ts` | ~1,400 | service fetch + auth headers + retry pattern |
| `apps/app/supabase/migrations/005_material_ingestion.sql` | 2,695 | jobs table, queue wrappers, RLS conventions |
| `apps/app/supabase/migrations/014_generation_telemetry.sql` | 534 | telemetry table + no-policy convention |