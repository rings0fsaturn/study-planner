# Handoff - #38 implementation planning (Single Grounded Objective Assessment)

> Handoff prompt for the next wayfinder session. The provider seam is fully
> resolved (tickets #52, #55, #56, #53, #54 closed); the frontier is #38
> implementation planning against the amended provider-neutral contracts.
> Slice #57 (contract-edit) is the immediate prerequisite file work.

<handoff_prompt>

<role>
You are an engineering agent operating the `/wayfinder` skill ("Work through
the map" mode) for repository `study-planner-web`, working the GitHub tracker
`rings0fsaturn/study-planner`. This session plans implementation for exactly
ONE slice from Phase 2 map [#4](https://github.com/rings0fsaturn/study-planner/issues/4):
**#38 - Single Grounded Objective Assessment** - and stops after the plan is
produced. You are planning, not building: production implementation happens
via the approved vertical-slice workflow, and contract-file edits belong to
slice #57, not this planning session.
</role>

<start_here>
1. Read `AGENTS.md`, then `.work/STATUS.md`, then the rules index
   `.agents/rules/README.agents.md` and every rule its index selects for the
   task (minimum: 52-github-cli-and-token, 53-wsl-dev-runtime,
   80-script-dry-run-before-full-runs, 81-code2prompt-prompting).
2. Load map [#4](https://github.com/rings0fsaturn/study-planner/issues/4) body
   (low-res view) and ticket
   [#38](https://github.com/rings0fsaturn/study-planner/issues/38) body.
   Check `git status --short` and preserve unrelated worktree changes.
3. Claim #38 by assigning it to `rings0fsaturn` BEFORE any work, per the
   tracker-ops convention on map #4.
</start_here>

<decision_context>
The provider seam is fully decided; do not re-litigate:

- **#54 closed (2026-08-22)**: the Phase 2 provider pack is neutralized in
  place (`contracts/phase2/gemini/` -> `provider/`) behind the retained
  normalized boundary. Request envelope is OpenAI-style `messages[]` with a
  plain JSON-Schema `responseSchema`; response envelope is flattened
  (`content`/`refusal`, lowercase `finishReason`, optional `routedProvider` +
  `reasoningTokens`). All #54 decisions are recorded in its resolution comment;
  the file edits themselves graduate to slice **#57** (child of #4/#38).
- **#53 closed**: reasoning off by default (`reasoningEffort` knob),
  `GENERATION_TIMEOUT_MS` per-task (30 s default), `GENERATION_MAX_OUTPUT_TOKENS`
  default 4096, temperature pinned 0.3 with no `top_p`, no seed; mandatory
  local schema validation after every response; SDK `max_retries=0` plus exactly
  ONE application-level retry (rate_limited honoring Retry-After capped 60 s,
  provider_unavailable, provider_timeout); non-retryable `unsupported_request`
  code; optional `reasoningTokens` telemetry.
- **#56 evidence**: objective generation runs reasoning OFF; strict json_schema
  is the primary structured mode (json_object returns a foreign contract shape
  and is invalid); six tiers all accepted; reasoning tiers breach the 30 s
  budget with no groundedness gain.
- **#55 mechanics**: model `deepseek/deepseek-v4-flash-0731` via OpenRouter
  (`base_url="https://openrouter.ai/api/v1"`) through the OpenAI Python SDK.
</decision_context>

<goal>
Produce an implementation plan for slice #38 that a fresh agent can execute:
a learner selects a ready, owner-scoped material; configures a minimal
assessment; generates one grounded objective Question; sees citations and
warnings; and can resume generation from its durable job. The plan must:
- respect the #54-amended contract pack (the XML slices below are the live
  source of truth; if a schema or fixture conflicts with the #54 resolution,
  record the discrepancy and route the fix to slice #57, do not edit files),
- cover every #38 acceptance criterion (ready/owner-scoped gating, format
  schema validation with citations-or-warnings, hidden-content exclusion from
  browser/cache/event-log/telemetry, and timeout / quota / safety-block /
  malformed / repair / partial / resume behavior),
- call the roadmap-engine and shared primitives boundaries instead of
  duplicating logic,
- plan the #57 contract-edit work first as the prerequisite file slice,
  since #38's generation code depends on the neutralized `provider/` envelopes.
</goal>

<definition_of_done>
1. Ticket claimed before work.
2. A complete #38 implementation plan produced (phases, file paths, tests,
   verification commands) respecting the amended contracts.
3. Any contract discrepancy found while planning is filed back to #57, not
   edited in place.
4. `.work/STATUS.md` row updated if state changed; `last_updated` bumped.
5. Session stops after #38 planning; no production implementation.
</definition_of_done>

<do_not>
- Do not edit any contract files, fixtures, or tests (slice #57 owns that).
- Do not implement #38 code; this session plans only.
- Do not spend API/GPU budget or re-run probes; the evidence base is complete.
- Do not touch embeddings behavior, browser code, guide SSE, or written grading.
- Do not modify the immutable sections of any plan doc.
</do_not>

<context_slices>
The following XML slices are generated by `code2prompt -F xml` (rule 81) from
the live checkout. Trust the code over any summary above; if a slice is stale
relative to the #54 resolution, the discrepancy belongs to slice #57.

<slice name="phase2-contract-pack">
The full approved Phase 2 contract pack under `services/intelligence/contracts/phase2/`
- 46 files, ~21K tokens. This is the implementation authority for objects,
APIs, events, transformations, telemetry, fixtures, and validation. Note: the
directory is still named `gemini/` in this slice because slice #57 has not yet
renamed it; the #54 resolution defines the target neutralized shapes.
<files>
phase2
├── PIPELINES.md
├── README.md
├── TRACEABILITY.md
├── async-job.schema.json
├── coding-answer.schema.json
├── content-chunk.schema.json
├── durable-events.schema.json
├── execution-result.schema.json
├── fixtures
│   ├── README.md
│   ├── async-job-ingestion.json
│   ├── coding-answer.json
│   ├── embedding-batch.json
│   ├── execution-compile-failure.json
│   ├── execution-pass.json
│   ├── execution-sandbox-timeout.json
│   ├── gated-reveal.json
│   ├── generation-malformed.json
│   ├── generation-partial.json
│   ├── generation-quota-failure.json
│   ├── generation-safety-block.json
│   ├── generation-success.json
│   ├── generation-timeout.json
│   ├── guide-citation.json
│   ├── guide-delta.json
│   ├── guide-done.json
│   ├── guide-error.json
│   ├── guide-start.json
│   ├── manifest.json
│   ├── provider-timeout.json
│   ├── telemetry-embedding.json
│   ├── telemetry-ingestion.json
│   └── written-grading.json
├── gemini
│   ├── README.md
│   ├── embedding-request.schema.json
│   ├── gated-reveal-response.schema.json
│   ├── generation-request.schema.json
│   ├── generation-response.schema.json
│   ├── guide-hint-frame.schema.json
│   └── written-grading-response.schema.json
├── generation-blueprint.schema.json
├── generation-telemetry.schema.json
├── openapi.yaml
├── provider-error.schema.json
├── question-slot.schema.json
├── service-objects.schema.json
└── tests
    └── test_contracts.py


      <file path="PIPELINES.md">
        ```md
        ---
title: Phase 2 object transformations and pipeline stages
purpose: Specify every Phase 2 transformation, owner, persistence boundary, and failure result
audience: implementers, reviewers
status: approved
last_updated: 2026-08-09
related:
  - ./openapi.yaml
  - ./service-objects.schema.json
  - ./durable-events.schema.json
  - ./generation-telemetry.schema.json
---

## Cross-pipeline rules

The authenticated Supabase JWT `sub` is the owner for every service object, job, cursor, vector, and event.
Every request carries required `X-Request-ID`; asynchronous work also carries `correlationId` and a required `Idempotency-Key`. `clientAttemptId` remains the local retry identity for an offline submission.
The service writes local/server state first, then queues provider work. A retry reuses the job and idempotency key; a user retry creates a new attempt or correlation ID when it represents a new observation.
Provider payloads are never durable product events. Telemetry is redacted, server-owned, and keyed by trace ID.
Answer keys, rubrics, reference solutions, and hidden tests remain server-only and are never in a client response, local-first event, or Supabase snapshot exposed to the browser.

## Material ingestion transformation

| Stage | Input -> output | Owner | Persistence | Failure |
|---|---|---|---|---|
| Accept | `MaterialCreate` -> `Material` + `AsyncJob(ingestion)` | service | server material row and job | invalid request is `400`; duplicate idempotency is `409` or original job |
| Extract | source -> normalized full text | service extractor | server object storage; no browser copy | retryable fetch/provider failure sets `failed`, `retryable=true` |
| Chunk | full text -> `ContentChunk[]` | service | server chunk rows | malformed/empty content is terminal `validation_failed` |
| Embed | chunk batch -> 768-dimensional vectors | Gemini adapter | server vector index | timeout/unavailable retries with bounded backoff; quota is terminal until quota resets |
| Publish | all valid chunks/vectors -> `ready` | service | update material and job atomically | partial batches remain `embedding`; no `ready` state until all chunks pass |

### Material creation, upload, and trigger-driven enqueue

Material creation is a client `INSERT` of the server-owned row (RLS owner-scoped), followed
by a Postgres trigger that enqueues the ingestion job. A `file` material stays `pending`
until its private-Storage upload is complete: the client uploads to
`material-raw/<ownerId>/<materialId>/...` and then calls the upload-completion RPC, which is
the only thing that allows the enqueue to fire. The worker rejects missing or incomplete
objects without creating chunks. Text, URL, and YouTube materials enqueue on insert.

### Ingestion status, preview, and retry

Progress is observable through Realtime material-row updates (with bounded polling fallback
on the client) and through `GET /v1/materials/{materialId}/ingestion` plus
`GET /v1/jobs/{jobId}`. Partial extracted content remains displayable through
`GET /v1/materials/{materialId}/content` while RAG generation stays blocked until `ready`.

A retry reuses the material identity but creates a new ingestion attempt and a new
`correlationId`. Retry is owned by the database: the client calls
`retry_material_ingestion` (an owner-checked, DB-atomic RPC that locks the
material row), so a double-clicked retry returns the same in-flight job instead
of stacking a second attempt. Prior chunks are invalidated only after the new
extraction succeeds; `ready` is published atomically through
`ingestion_publish_ready` only when every valid chunk of the current attempt
has a normalized vector. Stale chunks from a replaced or retried attempt can
never become `ready`.

## Assessment generation transformation

`GenerationRequest` -> `GenerationBlueprint` -> `QuestionSlot[]` -> RAG `Citation[]` -> Gemini JSON request -> normalized provider response -> structural/citation validation -> one repair request at most -> redacted `Assessment`.

The blueprint owner selects the authored difficulty band from the request and the rebuildable mastery projection. `authoredDifficulty` is never overwritten by observed difficulty. A candidate is accepted only when its format, required fields, skill tags, and citations validate against the blueprint.

Safety blocks produce `Assessment(status=partial|failed)` and `Warning(code=safety_block)` without retrying identical content. Quota failures and timeouts preserve the job, are retryable according to the error envelope, and never fabricate questions. Malformed structured output gets one repair attempt; after that, the slot is dropped with `malformed_output`. Partial generation commits only accepted redacted questions and telemetry.

## Practice, grading, and event transformation

`PracticeRunCreate` -> `PracticeRun` -> `AttemptSubmit` -> `QuestionAttempted` -> server grader -> `QuestionGraded` -> per-skill BKT observation.

Objective grading is deterministic. Written grading uses the normalized rubric response and keeps the rubric server-side. Coding grading uses Judge0 behind the service and keeps hidden tests server-side. A grade is one-to-one with an attempt ID. Offline attempts can queue locally and sync later; grades are server-authoritative. A retry of a submission creates a fresh attempt and therefore a fresh KT observation. Paused, abandoned, timed-out, and unsubmitted work creates no mastery observation.

## Mastery and roadmap-feedback transformation

`QuestionGraded` -> BKT update for each `(materialId, skillTag)` -> `MasteryProjection` -> one-band `AdaptiveRecommendation` targeting approximately `0.7` expected correctness -> advisory roadmap signal.

Mastery and recommendations are rebuildable projections, identified by `modelVersion`; they do not replace durable graded history. Roadmap feedback is an advisory `RoadmapFeedbackRecorded` event and must not silently rewrite pinned roadmap decisions.

## Guide stream and gated reveal transformation

`GuideRequest` + owned question + learner work + active line + tier -> RAG context -> Gemini stream -> normalized `HintFrame` SSE frames.

Frames are ordered by `sequence` and share `correlationId`: `start`, zero or more `delta`/`citation`, then exactly one `done` or `error`. A disconnect is retryable only before `done`; the client must not append duplicate sequence numbers. Guide hints contain no answer key.

`RevealRequest` requires the explicit confirmation gate and a valid owned attempt. The public result is only a gated acknowledgement and safe explanation. Answer keys, rubrics, reference solutions, and hidden tests remain server-only and never appear in responses, events, caches, or telemetry. A denied gate is `403`.

## Retry, timeout, and normalization matrix

| Failure | Normalized code | Retryable | Policy |
|---|---|---:|---|
| HTTP 429/provider quota | `quota_exhausted` | no until `retryAfterSeconds` | return quota envelope; do not busy-loop |
| safety finish/block | `safety_block` | no | redact candidate and record telemetry |
| connect/5xx | `provider_unavailable` | yes | max 2 retries, exponential 250/1000 ms |
| request deadline | `provider_timeout` | yes | generation 30 s, embeddings 10 s, grading 30 s, guide idle 15 s |
| invalid JSON/schema | `malformed_output` | one repair only | then partial/failure with warning |
| service validation | `validation_failed` | no | preserve accepted prior state |

## Persistence boundary summary

Local-first clients persist only thin event pointers, attempts, and redacted caches through `EventStore` and `SyncEngine`. Supabase/service storage owns material content, question hidden blocks, grading, vectors, jobs, and telemetry. Every remote read/write is scoped by authenticated owner ID. Projections can be rebuilt from durable events and server-owned content.

## Local record to server envelope

The local record's `clientEventId`, `kind`, `ownerId`, `createdAt`, `correlationId`, and redacted `payload` are copied into the durable-event envelope. The sync boundary adds `eventId`, sends the `Idempotency-Key`, and preserves client IDs on retry. Server-only grading material is joined during grading and is never copied into the local payload or response.

        ```
      </file>
      <file path="README.md">
        ```md
        ---
title: Phase 2 object, provider, and pipeline contracts
purpose: Keep Assessments, Practice, Gemini integration, grading, knowledge tracing, and roadmap feedback aligned across service boundaries
audience: implementers, reviewers, API consumers
status: approved
last_updated: 2026-08-09
related:
  - ./openapi.yaml
  - ./PIPELINES.md
  - ./TRACEABILITY.md
  - ./gemini/README.md
---

## Contract pack entry point

This folder is the approved implementation-facing contract pack for Phase 2.
The Wayfinder task [Phase 2 Object, Provider, and Pipeline Contract Pack](https://github.com/rings0fsaturn/study-planner/issues/22) owns this scope.

The contracts must describe both object shapes and the transformations between stages.
`.work/` retains planning history; this folder is the source candidate for implementation and generated client types.
The pack is indexed from the [Phase 2 Wayfinder map](https://github.com/rings0fsaturn/study-planner/issues/4).

## Contract files

- [openapi.yaml](./openapi.yaml) - approved public domain schemas and endpoint surface.
- [PIPELINES.md](./PIPELINES.md) - approved transformations, persistence, and failure behavior.
- [TRACEABILITY.md](./TRACEABILITY.md) - field and object provenance from the Phase 2 decisions.
- [service-objects.schema.json](./service-objects.schema.json) - canonical service object envelope.
- [durable-events.schema.json](./durable-events.schema.json) - canonical durable event envelope.
- [content-chunk.schema.json](./content-chunk.schema.json), [generation-blueprint.schema.json](./generation-blueprint.schema.json), and [question-slot.schema.json](./question-slot.schema.json) - canonical transformation objects.
- [coding-answer.schema.json](./coding-answer.schema.json) and [execution-result.schema.json](./execution-result.schema.json) - public coding and execution contracts.
- [provider-error.schema.json](./provider-error.schema.json) - normalized provider failure contract.
- [async-job.schema.json](./async-job.schema.json) - owner-scoped job/status/result contract used by `GET /v1/jobs/{jobId}`.
- [generation-telemetry.schema.json](./generation-telemetry.schema.json) - canonical redacted telemetry.
- [gemini/README.md](./gemini/README.md) - Gemini provider boundary and normalized response rules.
- [gemini/generation-request.schema.json](./gemini/generation-request.schema.json) - exact generation, grading, guide, and reveal request.
- [gemini/generation-response.schema.json](./gemini/generation-response.schema.json) - normalized provider response envelope.
- [gemini/embedding-request.schema.json](./gemini/embedding-request.schema.json) - exact batch embedding request.
- [gemini/written-grading-response.schema.json](./gemini/written-grading-response.schema.json) - normalized written grading.
- [gemini/guide-hint-frame.schema.json](./gemini/guide-hint-frame.schema.json) - normalized stream frame.
- [gemini/gated-reveal-response.schema.json](./gemini/gated-reveal-response.schema.json) - gated reveal result.

## Contract status rule

All schemas in this pack are approved for implementation.
Implementation must not add fields only in a consumer or provider adapter.
When a field changes, update the schema, transformation document, traceability row, and corresponding typed implementation together.

## Boundary guarantees

- This pack does not choose unresolved UI presentation in the material, review, or roadmap-feedback tickets.
- This pack does not persist raw Gemini payloads as product events.
- This pack does not expose hidden answers, rubrics, reference solutions, or hidden tests to clients.
- A gated reveal returns only an acknowledgement and safe explanation; it never returns hidden content.
- `X-Request-ID` is required on every HTTP request; `correlationId` joins related work and `Idempotency-Key` is required for mutations. `clientAttemptId` remains the local retry identity for attempts.
- No unresolved UI decision is represented as an API requirement.
- Local-first events remain thin and Supabase/service objects remain owner-scoped.

        ```
      </file>
      <file path="TRACEABILITY.md">
        ```md
        ---
title: Phase 2 contract traceability
purpose: Link contract objects and pipeline guarantees to the decisions that established them
audience: implementers, reviewers
status: approved
last_updated: 2026-08-09
---

## Canonical navigation

- [Phase 2 Wayfinder map](https://github.com/rings0fsaturn/study-planner/issues/4)
- [Phase 2 Object, Provider, and Pipeline Contract Pack](https://github.com/rings0fsaturn/study-planner/issues/22)

## Decision-to-contract mapping

| Contract area | Decision source | Current artifact |
|---|---|---|
| Assessment and Question atom | [Assessment types, formats & scoring](https://github.com/rings0fsaturn/study-planner/issues/6) | `openapi.yaml` QuestionBase and Assessment |
| Attempts and server grading | [Persistence & local-first fit](https://github.com/rings0fsaturn/study-planner/issues/10) and [Practice session model](https://github.com/rings0fsaturn/study-planner/issues/16) | `openapi.yaml` QuestionGraded and `PIPELINES.md` |
| Material and ingestion lifecycle | [Content ingestion & storage design](https://github.com/rings0fsaturn/study-planner/issues/7) | `PIPELINES.md` |
| Gemini and streaming ownership | [AI backend home & streaming](https://github.com/rings0fsaturn/study-planner/issues/9) | `gemini/README.md` |
| Generation and hidden content | [Grounded assessment-generation pipeline](https://github.com/rings0fsaturn/study-planner/issues/13) | `PIPELINES.md`, `Citation`, `Warning` |
| Mastery interface and BKT | [Grading to mastery signal mapping](https://github.com/rings0fsaturn/study-planner/issues/14) and [KT model & adaptive-difficulty loop](https://github.com/rings0fsaturn/study-planner/issues/15) | `openapi.yaml` MasteryProjection and AdaptiveRecommendation |
| Async and service ownership | [Data + service architecture refactor](https://github.com/rings0fsaturn/study-planner/issues/17) | `PIPELINES.md` |
| Quality telemetry | [Generation-quality evaluation harness](https://github.com/rings0fsaturn/study-planner/issues/18) | `generation-telemetry.schema.json` |
| Durable event envelope | [Persistence & local-first fit](https://github.com/rings0fsaturn/study-planner/issues/10) | `durable-events.schema.json` |
| Provider/service identity | [Data + service architecture refactor](https://github.com/rings0fsaturn/study-planner/issues/17) | `service-objects.schema.json` and `gemini/` |
| KT model and parity boundary | [KT model & adaptive-difficulty loop](https://github.com/rings0fsaturn/study-planner/issues/15) | `openapi.yaml` MasteryProjection and shared validation fixtures; no generated TS/Python types are claimed |
| Named transformation objects | [Grounded assessment-generation pipeline](https://github.com/rings0fsaturn/study-planner/issues/13) | `content-chunk.schema.json`, `generation-blueprint.schema.json`, `question-slot.schema.json` |
| Coding execution and public grading | [Hybrid client/server code execution](https://github.com/rings0fsaturn/study-planner/issues/9) | `coding-answer.schema.json`, `execution-result.schema.json` |
| Provider errors and request identity | [Data + service architecture refactor](https://github.com/rings0fsaturn/study-planner/issues/17) | `provider-error.schema.json`, `openapi.yaml`, `gemini/` |
| Guide SSE framing | [AI backend home & streaming](https://github.com/rings0fsaturn/study-planner/issues/9) | `gemini/guide-hint-frame.schema.json`, `openapi.yaml`, guide fixtures |
| Async job status and public result | [Data + service architecture refactor](https://github.com/rings0fsaturn/study-planner/issues/17) | `async-job.schema.json`, `openapi.yaml` `GET /v1/jobs/{jobId}` |

- **2026-08-14** Extended the material/ingestion area for issue #37: retry endpoint,
  partial-content preview endpoint, `uploadCompleteAt` on Material, `attempt` on
  IngestionStatus/AsyncJob, trigger-driven enqueue, upload-then-ingest for files, and
  atomic ready publish with stale-chunk invalidation. Rationale: issues #7 and #8
  resolutions plus grill D-01..D-05 (2026-08-14).
- **2026-08-14** Retry ownership moved from the FastAPI endpoint (header-only
  Idempotency-Key, no dedup) to the DB-atomic `retry_material_ingestion` RPC (owner
  check, row lock, in-flight idempotency); the retry endpoint was removed from
  `openapi.yaml` and the service. Ready publish moved to the transactional
  `ingestion_publish_ready` RPC; `enqueue_material_ingestion` gained an in-flight
  duplicate guard; server-owned material columns are protected by a BEFORE UPDATE
  guard trigger. Rationale: gate-6/7 live probes (2026-08-14) showed double-click
  retry could stack attempts and ready publish was two non-atomic REST updates.

## Approval rule

All contract areas are approved by this pack. Decision issues remain rationale sources; implementation must not add consumer-only fields or widen server-only content.
JSON Schema and OpenAPI validation plus representative fixtures are the explicit parity/type-validation boundary until generators are introduced; this pack does not claim generated TypeScript or Python types.

## Verification links

- OpenAPI and JSON Schema validator: `tests/test_contracts.py`
- Representative provider and failure fixtures: `fixtures/README.md`
- Live boundary evidence: `services/intelligence/app/main.py`, `app/middleware.py`, `app/security.py`, and `apps/app/src/events/EventStoreProvider.tsx`
- Fixture-to-schema mapping: `fixtures/manifest.json`

        ```
      </file>
      <file path="async-job.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/async-job.schema.json",
  "title": "AsyncJob",
  "type": "object",
  "additionalProperties": false,
  "required": ["jobId", "kind", "status", "ownerId", "correlationId", "createdAt"],
  "properties": {
    "jobId": { "type": "string", "minLength": 1 },
    "kind": { "type": "string", "enum": ["ingestion", "generation", "grading", "roadmap_feedback"] },
    "status": { "type": "string", "enum": ["queued", "running", "succeeded", "partial", "failed", "cancelled"] },
    "ownerId": { "type": "string", "minLength": 1 },
    "correlationId": { "type": "string", "minLength": 1 },
    "attempt": { "type": "integer", "minimum": 1 },
    "resultId": { "type": "string", "minLength": 1 },
    "result": {},
    "error": { "$ref": "provider-error.schema.json" },
    "createdAt": { "type": "string", "format": "date-time" },
    "completedAt": { "type": "string", "format": "date-time" }
  }
}

        ```
      </file>
      <file path="coding-answer.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/coding-answer.schema.json",
  "title": "CodingAnswer",
  "type": "object",
  "additionalProperties": false,
  "required": ["language", "source", "config"],
  "properties": {
    "language": { "type": "string", "enum": ["python", "javascript", "typescript", "java", "cpp", "csharp", "go", "rust"] },
    "source": { "type": "string", "minLength": 1, "maxLength": 100000 },
    "config": {
      "type": "object", "additionalProperties": false,
      "required": ["stdin", "timeLimitMs", "memoryLimitMb"],
      "properties": {
        "stdin": { "type": "string", "maxLength": 20000 },
        "timeLimitMs": { "type": "integer", "minimum": 100, "maximum": 30000 },
        "memoryLimitMb": { "type": "integer", "minimum": 16, "maximum": 1024 }
      }
    }
  }
}

        ```
      </file>
      <file path="content-chunk.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/content-chunk.schema.json",
  "title": "ContentChunk",
  "type": "object",
  "additionalProperties": false,
  "required": ["chunkId", "materialId", "text", "ordinal"],
  "properties": {
    "chunkId": { "type": "string", "minLength": 1 },
    "materialId": { "type": "string", "minLength": 1 },
    "text": { "type": "string", "minLength": 1 },
    "ordinal": { "type": "integer", "minimum": 0 },
    "startSeconds": { "type": "number", "minimum": 0 }
  }
}

        ```
      </file>
      <file path="durable-events.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/durable-events.schema.json",
  "title": "Phase2DurableEvent",
  "description": "The server envelope for a local-first event. The local record's clientEventId, ownerId, createdAt, correlationId, and payload are copied into this envelope; the server adds eventId and accepts the client idempotency key.",
  "oneOf": [
    { "$ref": "#/$defs/assessmentCreated" },
    { "$ref": "#/$defs/questionAttempted" },
    { "$ref": "#/$defs/questionGraded" },
    { "$ref": "#/$defs/guideRequested" },
    { "$ref": "#/$defs/guideCompleted" },
    { "$ref": "#/$defs/roadmapFeedbackRecorded" }
  ],
  "$defs": {
    "envelope": {
      "type": "object", "additionalProperties": false,
      "required": ["eventId", "clientEventId", "kind", "ownerId", "createdAt", "correlationId", "payload"],
      "properties": {
        "eventId": { "type": "string", "minLength": 1 },
        "clientEventId": { "type": "string", "minLength": 1 },
        "kind": { "type": "string" },
        "ownerId": { "type": "string", "minLength": 1 },
        "createdAt": { "type": "string", "format": "date-time" },
        "correlationId": { "type": "string", "minLength": 1 },
        "idempotencyKey": { "type": "string", "minLength": 16, "maxLength": 128 },
        "payload": { "type": "object" }
      }
    },
    "assessmentCreated": { "allOf": [{ "$ref": "#/$defs/envelope" }, { "properties": { "kind": { "const": "AssessmentCreated" }, "payload": { "$ref": "#/$defs/assessmentCreatedPayload" } } }] },
    "questionAttempted": { "allOf": [{ "$ref": "#/$defs/envelope" }, { "properties": { "kind": { "const": "QuestionAttempted" }, "payload": { "$ref": "#/$defs/questionAttemptedPayload" } } }] },
    "questionGraded": { "allOf": [{ "$ref": "#/$defs/envelope" }, { "properties": { "kind": { "const": "QuestionGraded" }, "payload": { "$ref": "#/$defs/questionGradedPayload" } } }] },
    "guideRequested": { "allOf": [{ "$ref": "#/$defs/envelope" }, { "properties": { "kind": { "const": "GuideRequested" }, "payload": { "$ref": "#/$defs/guideRequestedPayload" } } }] },
    "guideCompleted": { "allOf": [{ "$ref": "#/$defs/envelope" }, { "properties": { "kind": { "const": "GuideCompleted" }, "payload": { "$ref": "#/$defs/guideCompletedPayload" } } }] },
    "roadmapFeedbackRecorded": { "allOf": [{ "$ref": "#/$defs/envelope" }, { "properties": { "kind": { "const": "RoadmapFeedbackRecorded" }, "payload": { "$ref": "#/$defs/roadmapFeedbackPayload" } } }] },
    "id": { "type": "string", "minLength": 1 },
    "assessmentCreatedPayload": { "type": "object", "additionalProperties": false, "required": ["assessmentId", "materialIds"], "properties": { "assessmentId": { "$ref": "#/$defs/id" }, "materialIds": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/id" } } } },
    "questionAttemptedPayload": { "type": "object", "additionalProperties": false, "required": ["attemptId", "clientAttemptId", "questionId", "submittedAt"], "properties": { "attemptId": { "$ref": "#/$defs/id" }, "clientAttemptId": { "$ref": "#/$defs/id" }, "questionId": { "$ref": "#/$defs/id" }, "submittedAt": { "type": "string", "format": "date-time" }, "answerKind": { "type": "string", "enum": ["objective", "written", "coding"] }, "elapsedSeconds": { "type": "integer", "minimum": 0 } } },
    "questionGradedPayload": { "type": "object", "additionalProperties": false, "required": ["attemptId", "questionId", "score", "correct", "gradedAt"], "properties": { "attemptId": { "$ref": "#/$defs/id" }, "questionId": { "$ref": "#/$defs/id" }, "score": { "type": "number", "minimum": 0, "maximum": 1 }, "correct": { "type": "boolean" }, "gradedAt": { "type": "string", "format": "date-time" }, "grader": { "type": "string", "enum": ["objective", "gemini_rubric", "judge0"] }, "publicFeedback": { "type": "string", "maxLength": 4000 } } },
    "guideRequestedPayload": { "type": "object", "additionalProperties": false, "required": ["questionId", "tier"], "properties": { "questionId": { "$ref": "#/$defs/id" }, "tier": { "type": "string", "enum": ["nudge", "concept", "strategy", "worked_step"] }, "requestId": { "$ref": "#/$defs/id" } } },
    "guideCompletedPayload": { "type": "object", "additionalProperties": false, "required": ["questionId", "outcome"], "properties": { "questionId": { "$ref": "#/$defs/id" }, "outcome": { "type": "string", "enum": ["done", "error"] }, "frameCount": { "type": "integer", "minimum": 1 } } },
    "roadmapFeedbackPayload": { "type": "object", "additionalProperties": false, "required": ["roadmapId", "signal"], "properties": { "roadmapId": { "$ref": "#/$defs/id" }, "signal": { "type": "string", "enum": ["too_easy", "too_hard", "too_fast", "too_slow", "irrelevant", "useful"] }, "materialId": { "$ref": "#/$defs/id" } } }
  }
}

        ```
      </file>
      <file path="execution-result.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/execution-result.schema.json",
  "title": "NormalizedExecutionGradingResult",
  "type": "object",
  "additionalProperties": false,
  "required": ["outcome", "compile", "runtime", "publicFeedback"],
  "properties": {
    "outcome": { "type": "string", "enum": ["passed", "failed", "compile_error", "runtime_error", "timeout", "sandbox_error"] },
    "compile": { "$ref": "#/$defs/processResult" },
    "runtime": { "$ref": "#/$defs/processResult" },
    "publicFeedback": { "type": "string", "maxLength": 4000 },
    "score": { "type": "number", "minimum": 0, "maximum": 1 },
    "correct": { "type": "boolean" }
  },
  "$defs": {
    "processResult": {
      "type": "object", "additionalProperties": false, "required": ["status"],
      "properties": {
        "status": { "type": "string", "enum": ["not_run", "succeeded", "failed", "timed_out", "sandbox_denied"] },
        "exitCode": { "type": ["integer", "null"] },
        "stdout": { "type": "string", "maxLength": 20000 },
        "stderr": { "type": "string", "maxLength": 20000 },
        "durationMs": { "type": "integer", "minimum": 0 }
      }
    }
  }
}

        ```
      </file>
      <file path="fixtures/README.md">
        ```md
        ---
title: Phase 2 contract fixtures
purpose: Exercise representative provider outcomes and public grading/embedding shapes
audience: implementers, reviewers
status: approved
last_updated: 2026-08-09
---

## Fixture inventory

Each fixture is mapped to its canonical JSON Schema in `manifest.json` and is validated by `tests/test_contracts.py`.

| Fixture | Contract | Purpose |
|---|---|---|
| `generation-success.json` | Gemini generation response | accepted structured output |
| `generation-malformed.json` | Gemini generation response | repair exhausted |
| `generation-safety-block.json` | Gemini generation response | non-retryable safety result |
| `generation-quota-failure.json` | Gemini generation response | quota normalization |
| `generation-timeout.json` | Gemini generation response | deadline normalization |
| `generation-partial.json` | Gemini generation response | accepted subset of slots |
| `written-grading.json` | written grading response | score and per-skill observation |
| `embedding-batch.json` | embedding request | batch input and 768-dimension configuration |
| `coding-answer.json` | coding answer | public source and sandbox configuration |
| `execution-pass.json` | execution result | passing run |
| `execution-compile-failure.json` | execution result | compile failure without hidden tests |
| `execution-sandbox-timeout.json` | execution result | timeout/sandbox failure |
| `guide-start.json`, `guide-delta.json`, `guide-citation.json`, `guide-done.json`, `guide-error.json` | guide HintFrame | every enforceable SSE frame kind |
| `provider-timeout.json` | provider error | normalized retryable provider failure |
| `async-job-ingestion.json` | async job | ingestion job with attempt identity |
| `gated-reveal.json` | gated reveal | acknowledgement with no hidden content |

        ```
      </file>
      <file path="fixtures/async-job-ingestion.json">
        ```json
        {
  "jobId": "job-ing-01",
  "kind": "ingestion",
  "status": "queued",
  "ownerId": "user-01",
  "correlationId": "corr-ing-01",
  "attempt": 2,
  "resultId": "material-01",
  "createdAt": "2026-08-14T09:00:00Z"
}

        ```
      </file>
      <file path="fixtures/coding-answer.json">
        ```json
        {"language":"python","source":"print(2 + 2)","config":{"stdin":"","timeLimitMs":2000,"memoryLimitMb":128}}

        ```
      </file>
      <file path="fixtures/embedding-batch.json">
        ```json
        {"provider":"gemini","model":"gemini-embedding-001","taskType":"retrieval_document","dimension":768,"ownerId":"user-1","traceId":"trace-embed","requestId":"req-embed","correlationId":"corr-embed","inputs":[{"chunkId":"chunk-1","text":"Normalization reduces duplicate scale."},{"chunkId":"chunk-2","text":"Vectors support retrieval grounding."}],"timeoutMs":10000}

        ```
      </file>
      <file path="fixtures/execution-compile-failure.json">
        ```json
        {"outcome":"compile_error","compile":{"status":"failed","exitCode":1,"stdout":"","stderr":"SyntaxError","durationMs":12},"runtime":{"status":"not_run"},"publicFeedback":"The submission did not compile.","score":0,"correct":false}

        ```
      </file>
      <file path="fixtures/execution-pass.json">
        ```json
        {"outcome":"passed","compile":{"status":"not_run"},"runtime":{"status":"succeeded","exitCode":0,"stdout":"4\n","stderr":"","durationMs":18},"publicFeedback":"All public checks passed.","score":1,"correct":true}

        ```
      </file>
      <file path="fixtures/execution-sandbox-timeout.json">
        ```json
        {"outcome":"timeout","compile":{"status":"succeeded","exitCode":0,"stdout":"","stderr":"","durationMs":20},"runtime":{"status":"timed_out","exitCode":null,"stdout":"","stderr":"Execution exceeded the time limit.","durationMs":2000},"publicFeedback":"Execution was stopped by the sandbox time limit.","score":0,"correct":false}

        ```
      </file>
      <file path="fixtures/gated-reveal.json">
        ```json
        {"questionId":"question-1","attemptId":"attempt-1","gateSatisfied":true,"explanation":"The gated reveal was recorded; answer material remains server-only."}

        ```
      </file>
      <file path="fixtures/generation-malformed.json">
        ```json
        {"provider":"gemini","model":"gemini-2.5-flash","traceId":"trace-malformed","correlationId":"corr-malformed","candidates":[{"index":0,"text":"not-json","finishReason":"STOP"}],"finishReason":"STOP","safetyFeedback":[],"usage":{"promptTokens":100,"outputTokens":2,"totalTokens":102},"outcome":"malformed_output","error":{"code":"malformed_output","retryable":false,"message":"repair validation failed","requestId":"req-malformed","correlationId":"corr-malformed"}}

        ```
      </file>
      <file path="fixtures/generation-partial.json">
        ```json
        {"provider":"gemini","model":"gemini-2.5-flash","traceId":"trace-partial","candidates":[{"index":0,"text":"accepted","finishReason":"STOP"}],"structuredOutput":{"acceptedQuestions":1},"finishReason":"STOP","safetyFeedback":[],"usage":{"promptTokens":200,"outputTokens":40,"totalTokens":240},"outcome":"partial"}

        ```
      </file>
      <file path="fixtures/generation-quota-failure.json">
        ```json
        {"provider":"gemini","model":"gemini-2.5-flash","traceId":"trace-quota","correlationId":"corr-quota","candidates":[],"finishReason":"OTHER","safetyFeedback":[],"usage":{"promptTokens":80,"outputTokens":0,"totalTokens":80},"outcome":"quota_failure","error":{"code":"quota_exhausted","retryable":false,"message":"provider quota exhausted","requestId":"req-quota","correlationId":"corr-quota","retryAfterSeconds":60}}

        ```
      </file>
      <file path="fixtures/generation-safety-block.json">
        ```json
        {"provider":"gemini","model":"gemini-2.5-flash","traceId":"trace-safety","correlationId":"corr-safety","candidates":[],"finishReason":"SAFETY","safetyFeedback":[{"category":"HARM_CATEGORY_DANGEROUS_CONTENT","blocked":true,"probability":"HIGH"}],"usage":{"promptTokens":80,"outputTokens":0,"totalTokens":80},"outcome":"safety_block","error":{"code":"safety_block","retryable":false,"message":"provider safety block","requestId":"req-safety","correlationId":"corr-safety"}}

        ```
      </file>
      <file path="fixtures/generation-success.json">
        ```json
        {"provider":"gemini","model":"gemini-2.5-flash","traceId":"trace-success","candidates":[{"index":0,"text":"{\"prompt\":\"What is normalization?\"}","finishReason":"STOP"}],"structuredOutput":{"prompt":"What is normalization?"},"finishReason":"STOP","safetyFeedback":[],"usage":{"promptTokens":100,"outputTokens":20,"totalTokens":120},"outcome":"ok"}

        ```
      </file>
      <file path="fixtures/generation-timeout.json">
        ```json
        {"provider":"gemini","model":"gemini-2.5-flash","traceId":"trace-timeout","correlationId":"corr-timeout","candidates":[],"finishReason":"TIMEOUT","safetyFeedback":[],"usage":{"promptTokens":80,"outputTokens":0,"totalTokens":80},"outcome":"timeout","error":{"code":"provider_timeout","retryable":true,"message":"provider deadline","requestId":"req-timeout","correlationId":"corr-timeout"}}

        ```
      </file>
      <file path="fixtures/guide-citation.json">
        ```json
        {"frame":"citation","sequence":2,"correlationId":"corr-guide","citations":[{"chunkId":"chunk-1","materialId":"mat-1","quote":"A normalized value has a consistent scale."}]}

        ```
      </file>
      <file path="fixtures/guide-delta.json">
        ```json
        {"frame":"delta","sequence":1,"correlationId":"corr-guide","text":"What value should this expression produce?"}

        ```
      </file>
      <file path="fixtures/guide-done.json">
        ```json
        {"frame":"done","sequence":3,"correlationId":"corr-guide"}

        ```
      </file>
      <file path="fixtures/guide-error.json">
        ```json
        {"frame":"error","sequence":3,"correlationId":"corr-guide","error":{"code":"provider_timeout","retryable":true,"requestId":"req-guide","correlationId":"corr-guide"}}

        ```
      </file>
      <file path="fixtures/guide-start.json">
        ```json
        {"frame":"start","sequence":0,"correlationId":"corr-guide","text":"Let us inspect the first step."}

        ```
      </file>
      <file path="fixtures/manifest.json">
        ```json
        [
  {
    "file": "generation-success.json",
    "schema": "../gemini/generation-response.schema.json"
  },
  {
    "file": "generation-malformed.json",
    "schema": "../gemini/generation-response.schema.json"
  },
  {
    "file": "generation-safety-block.json",
    "schema": "../gemini/generation-response.schema.json"
  },
  {
    "file": "generation-quota-failure.json",
    "schema": "../gemini/generation-response.schema.json"
  },
  {
    "file": "generation-timeout.json",
    "schema": "../gemini/generation-response.schema.json"
  },
  {
    "file": "generation-partial.json",
    "schema": "../gemini/generation-response.schema.json"
  },
  {
    "file": "written-grading.json",
    "schema": "../gemini/written-grading-response.schema.json"
  },
  {
    "file": "embedding-batch.json",
    "schema": "../gemini/embedding-request.schema.json"
  },
  {
    "file": "coding-answer.json",
    "schema": "../coding-answer.schema.json"
  },
  {
    "file": "execution-pass.json",
    "schema": "../execution-result.schema.json"
  },
  {
    "file": "execution-compile-failure.json",
    "schema": "../execution-result.schema.json"
  },
  {
    "file": "execution-sandbox-timeout.json",
    "schema": "../execution-result.schema.json"
  },
  {
    "file": "guide-start.json",
    "schema": "../gemini/guide-hint-frame.schema.json"
  },
  {
    "file": "guide-delta.json",
    "schema": "../gemini/guide-hint-frame.schema.json"
  },
  {
    "file": "guide-citation.json",
    "schema": "../gemini/guide-hint-frame.schema.json"
  },
  {
    "file": "guide-done.json",
    "schema": "../gemini/guide-hint-frame.schema.json"
  },
  {
    "file": "guide-error.json",
    "schema": "../gemini/guide-hint-frame.schema.json"
  },
  {
    "file": "provider-timeout.json",
    "schema": "../provider-error.schema.json"
  },
  {
    "file": "async-job-ingestion.json",
    "schema": "../async-job.schema.json"
  },
  {
    "file": "gated-reveal.json",
    "schema": "../gemini/gated-reveal-response.schema.json"
  },
  {
    "file": "telemetry-ingestion.json",
    "schema": "../generation-telemetry.schema.json"
  },
  {
    "file": "telemetry-embedding.json",
    "schema": "../generation-telemetry.schema.json"
  }
]
        ```
      </file>
      <file path="fixtures/provider-timeout.json">
        ```json
        {"code":"provider_timeout","message":"The provider exceeded its deadline.","retryable":true,"requestId":"req-1","correlationId":"corr-1"}

        ```
      </file>
      <file path="fixtures/telemetry-embedding.json">
        ```json
        {"traceId":"trace-embed-1","ownerId":"user-1","task":"embedding","model":"gemini-embedding-001","promptTemplateVersion":"embedding-v1","outcome":"ok","latencyMs":212.7,"inputTokens":4120,"outputTokens":0,"repairAttempted":true}

        ```
      </file>
      <file path="fixtures/telemetry-ingestion.json">
        ```json
        {"traceId":"trace-ingestion-1","ownerId":"user-1","task":"ingestion","model":"pypdf","promptTemplateVersion":"ingestion-v1","outcome":"ok","latencyMs":12050.4,"inputTokens":0,"outputTokens":0,"repairAttempted":false}

        ```
      </file>
      <file path="fixtures/written-grading.json">
        ```json
        {"score":0.75,"correct":true,"rubricVersion":"rubric-v3","feedback":"Correct core explanation; add the edge case.","perSkill":[{"skillTag":"normalization","score":0.75,"correct":true}],"outcome":"ok"}

        ```
      </file>
      <file path="gemini/README.md">
        ```md
        ---
title: Gemini provider boundary
purpose: Define exact Gemini requests and normalized provider results behind the Intelligence Service
audience: implementers, reviewers
status: approved
last_updated: 2026-08-09
related:
  - ./generation-request.schema.json
  - ./generation-response.schema.json
  - ./embedding-request.schema.json
  - ./written-grading-response.schema.json
  - ./guide-hint-frame.schema.json
  - ./gated-reveal-response.schema.json
---

## Provider identity and configuration

The only approved generation model is `gemini-2.5-flash`; the only approved embedding model is `gemini-embedding-001` with dimension `768`. Requests use the Gemini SDK `contents`, `systemInstruction`, `generationConfig`, `safetySettings`, and `responseSchema` fields. Structured generation always sets `responseMimeType=application/json`, `temperature` and `topP` within schema bounds, and a bounded `maxOutputTokens`.

Every request includes owner scope, artifact IDs, `traceId`, `correlationId`, task, prompt-template version, and an explicit timeout. The browser never sees a provider key, SDK object, raw response, or raw prompt.

## Normalized results

`generation-response.schema.json` is the provider-neutral envelope for assessment generation, written grading, guide reveal, and provider failures. `provider-error.schema.json` is the shared normalized error shape with public code, retryability, request ID, correlation ID, and optional retry-after.

Written grading, guide stream frames, and gated reveals have narrower schemas so a provider adapter cannot accidentally return hidden rubric material or an unanchored hint. A gated reveal is an acknowledgement only; hidden answers remain server-only.

## Stream framing

Guide responses use `text/event-stream`. Each `data:` value is one `HintFrame` JSON object. Frames share a correlation ID, increase sequence monotonically from zero, and terminate with exactly one `done` or `error` frame. Provider deltas are normalized before they cross the service boundary.

## Error and retry policy

Safety blocks are non-retryable. Quota errors honor provider retry metadata but are not retried inside the request after the bounded policy. Transport/5xx errors retry twice with 250 ms then 1000 ms backoff. Generation is capped at 30 seconds, embedding at 10 seconds, grading at 30 seconds, and guide idle time at 15 seconds. All exhausted failures map to the public `ServiceError` codes in `../openapi.yaml`.

        ```
      </file>
      <file path="gemini/embedding-request.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/gemini/embedding-request.schema.json",
  "title": "GeminiEmbeddingRequest",
  "type": "object",
  "additionalProperties": false,
  "required": ["provider", "model", "taskType", "dimension", "traceId", "requestId", "correlationId", "inputs"],
  "properties": {
    "provider": { "const": "gemini" },
    "model": { "const": "gemini-embedding-001" },
    "taskType": { "enum": ["retrieval_document", "retrieval_query"] },
    "dimension": { "const": 768 },
    "ownerId": { "type": "string", "minLength": 1 },
    "traceId": { "type": "string", "minLength": 1 },
    "requestId": { "type": "string", "minLength": 1 },
    "correlationId": { "type": "string", "minLength": 1 },
    "inputs": { "type": "array", "minItems": 1, "maxItems": 100, "items": { "type": "object", "additionalProperties": false, "required": ["chunkId", "text"], "properties": { "chunkId": { "type": "string", "minLength": 1 }, "text": { "type": "string", "minLength": 1, "maxLength": 20000 } } } },
    "timeoutMs": { "const": 10000 }
  }
}

        ```
      </file>
      <file path="gemini/gated-reveal-response.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/gemini/gated-reveal-response.schema.json",
  "title": "GatedRevealAcknowledgement",
  "type": "object",
  "additionalProperties": false,
  "required": ["questionId", "attemptId", "gateSatisfied", "explanation"],
  "properties": {
    "questionId": { "type": "string", "minLength": 1 },
    "attemptId": { "type": "string", "minLength": 1 },
    "gateSatisfied": { "const": true },
    "explanation": { "type": "string", "minLength": 1, "maxLength": 500 },
    "revealedAt": { "type": "string", "format": "date-time" }
  }
}

        ```
      </file>
      <file path="gemini/generation-request.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/gemini/generation-request.schema.json",
  "title": "GeminiGenerationRequest",
  "type": "object",
  "additionalProperties": false,
  "required": ["provider", "task", "model", "artifactIds", "traceId", "requestId", "correlationId", "promptTemplateVersion", "contents", "generationConfig", "responseSchema"],
  "properties": {
    "provider": { "const": "gemini" },
    "task": { "enum": ["assessment_generation", "written_grading", "guide_hint", "guide_reveal"] },
    "model": { "const": "gemini-2.5-flash" },
    "artifactIds": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "ownerId": { "type": "string", "minLength": 1 },
    "traceId": { "type": "string", "minLength": 1 },
    "requestId": { "type": "string", "minLength": 1 },
    "correlationId": { "type": "string", "minLength": 1 },
    "promptTemplateVersion": { "type": "string", "pattern": "^v[0-9]+$" },
    "contents": { "type": "array", "minItems": 1, "items": { "type": "object", "additionalProperties": false, "required": ["role", "parts"], "properties": { "role": { "enum": ["user", "model"] }, "parts": { "type": "array", "minItems": 1, "items": { "type": "object", "additionalProperties": false, "required": ["text"], "properties": { "text": { "type": "string", "minLength": 1 } } } } } } },
    "systemInstruction": { "type": "object", "additionalProperties": false, "required": ["parts"], "properties": { "parts": { "type": "array", "minItems": 1, "items": { "type": "object", "required": ["text"], "properties": { "text": { "type": "string" } } } } } },
    "ragContext": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["chunkId", "materialId", "quote"], "properties": { "chunkId": { "type": "string" }, "materialId": { "type": "string" }, "quote": { "type": "string" }, "startSeconds": { "type": "number", "minimum": 0 } } } },
    "responseSchema": { "type": "object", "required": ["type", "properties"], "properties": { "type": { "const": "OBJECT" }, "properties": { "type": "object" }, "required": { "type": "array", "items": { "type": "string" } }, "propertyOrdering": { "type": "array", "items": { "type": "string" } } } },
    "generationConfig": { "type": "object", "additionalProperties": false, "required": ["temperature", "topP", "maxOutputTokens", "responseMimeType"], "properties": { "temperature": { "type": "number", "minimum": 0, "maximum": 2 }, "topP": { "type": "number", "exclusiveMinimum": 0, "maximum": 1 }, "maxOutputTokens": { "type": "integer", "minimum": 1, "maximum": 65536 }, "responseMimeType": { "const": "application/json" }, "seed": { "type": "integer", "minimum": 0 } } },
    "safetySettings": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["category", "threshold"], "properties": { "category": { "type": "string" }, "threshold": { "type": "string" } } } },
    "timeoutMs": { "const": 30000 }
  }
}

        ```
      </file>
      <file path="gemini/generation-response.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/gemini/generation-response.schema.json",
  "title": "NormalizedGeminiResponse",
  "type": "object",
  "additionalProperties": false,
  "required": ["provider", "model", "traceId", "candidates", "finishReason", "usage", "outcome"],
  "properties": {
    "provider": { "const": "gemini" },
    "model": { "type": "string", "enum": ["gemini-2.5-flash", "gemini-embedding-001"] },
    "traceId": { "type": "string", "minLength": 1 },
    "correlationId": { "type": "string", "minLength": 1 },
    "providerRequestId": { "type": "string" },
    "candidates": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["index", "text"], "properties": { "index": { "type": "integer", "minimum": 0 }, "text": { "type": "string" }, "finishReason": { "type": "string" } } } },
    "structuredOutput": { "type": "object" },
    "finishReason": { "enum": ["STOP", "MAX_TOKENS", "SAFETY", "RECITATION", "OTHER", "TIMEOUT"] },
    "safetyFeedback": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["category", "blocked"], "properties": { "category": { "type": "string" }, "blocked": { "type": "boolean" }, "probability": { "type": "string" } } } },
    "usage": { "type": "object", "additionalProperties": false, "required": ["promptTokens", "outputTokens", "totalTokens"], "properties": { "promptTokens": { "type": "integer", "minimum": 0 }, "outputTokens": { "type": "integer", "minimum": 0 }, "totalTokens": { "type": "integer", "minimum": 0 } } },
    "outcome": { "enum": ["ok", "partial", "safety_block", "quota_failure", "timeout", "malformed_output", "provider_error"] },
    "error": { "$ref": "../provider-error.schema.json" }
  }
}

        ```
      </file>
      <file path="gemini/guide-hint-frame.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/gemini/guide-hint-frame.schema.json",
  "title": "NormalizedGuideHintFrame",
  "type": "object",
  "additionalProperties": false,
  "required": ["frame", "sequence", "correlationId"],
  "properties": {
    "frame": { "type": "string", "enum": ["start", "delta", "citation", "done", "error"] },
    "sequence": { "type": "integer", "minimum": 0 },
    "correlationId": { "type": "string", "minLength": 1 },
    "text": { "type": "string", "maxLength": 4000 },
    "citations": { "type": "array", "items": { "$ref": "#/$defs/citation" } },
    "error": { "$ref": "#/$defs/error" }
  },
  "allOf": [
    { "if": { "properties": { "frame": { "const": "start" } } }, "then": { "required": ["text"], "not": { "anyOf": [{ "required": ["citations"] }, { "required": ["error"] }] } } },
    { "if": { "properties": { "frame": { "const": "delta" } } }, "then": { "required": ["text"], "not": { "anyOf": [{ "required": ["citations"] }, { "required": ["error"] }] } } },
    { "if": { "properties": { "frame": { "const": "citation" } } }, "then": { "required": ["citations"], "not": { "anyOf": [{ "required": ["text"] }, { "required": ["error"] }] } } },
    { "if": { "properties": { "frame": { "const": "done" } } }, "then": { "not": { "anyOf": [{ "required": ["text"] }, { "required": ["citations"] }, { "required": ["error"] }] } } },
    { "if": { "properties": { "frame": { "const": "error" } } }, "then": { "required": ["error"], "not": { "anyOf": [{ "required": ["text"] }, { "required": ["citations"] }] } } }
  ],
  "$defs": {
    "citation": { "type": "object", "additionalProperties": false, "required": ["chunkId", "materialId", "quote"], "properties": { "chunkId": { "type": "string", "minLength": 1 }, "materialId": { "type": "string", "minLength": 1 }, "quote": { "type": "string", "minLength": 1, "maxLength": 2000 } } },
    "error": { "type": "object", "additionalProperties": false, "required": ["code", "retryable", "requestId", "correlationId"], "properties": { "code": { "type": "string" }, "retryable": { "type": "boolean" }, "requestId": { "type": "string", "minLength": 1 }, "correlationId": { "type": "string", "minLength": 1 }, "retryAfterSeconds": { "type": "integer", "minimum": 1 } } }
  }
}

        ```
      </file>
      <file path="gemini/written-grading-response.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/gemini/written-grading-response.schema.json",
  "title": "NormalizedWrittenGrading",
  "type": "object",
  "additionalProperties": false,
  "required": ["score", "correct", "rubricVersion", "feedback", "perSkill", "outcome"],
  "properties": { "score": { "type": "number", "minimum": 0, "maximum": 1 }, "correct": { "type": "boolean" }, "rubricVersion": { "type": "string", "minLength": 1 }, "feedback": { "type": "string" }, "perSkill": { "type": "array", "items": { "type": "object", "required": ["skillTag", "score", "correct"], "properties": { "skillTag": { "type": "string" }, "score": { "type": "number", "minimum": 0, "maximum": 1 }, "correct": { "type": "boolean" } } } }, "outcome": { "enum": ["ok", "malformed_output", "safety_block", "quota_failure", "timeout"] } }
}

        ```
      </file>
      <file path="generation-blueprint.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/generation-blueprint.schema.json",
  "title": "GenerationBlueprint",
  "type": "object",
  "additionalProperties": false,
  "required": ["format", "questionCount", "difficulty", "skillTags"],
  "properties": {
    "format": { "type": "string", "enum": ["objective", "written", "coding"] },
    "questionCount": { "type": "integer", "minimum": 1, "maximum": 100 },
    "difficulty": { "type": "integer", "minimum": 1, "maximum": 5 },
    "skillTags": { "type": "array", "items": { "type": "string", "minLength": 1 } }
  }
}

        ```
      </file>
      <file path="generation-telemetry.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/generation-telemetry.schema.json",
  "title": "GenerationTelemetry",
  "type": "object",
  "additionalProperties": false,
  "required": ["traceId", "ownerId", "task", "model", "promptTemplateVersion", "outcome", "latencyMs", "inputTokens", "outputTokens"],
  "properties": { "traceId": { "type": "string" }, "ownerId": { "type": "string" }, "task": { "enum": ["ingestion", "embedding", "assessment_generation", "written_grading", "guide_hint", "guide_reveal"] }, "model": { "type": "string" }, "promptTemplateVersion": { "type": "string" }, "outcome": { "enum": ["ok", "partial", "safety_block", "quota_failure", "timeout", "malformed_output", "provider_error"] }, "latencyMs": { "type": "number", "minimum": 0 }, "inputTokens": { "type": "integer", "minimum": 0 }, "outputTokens": { "type": "integer", "minimum": 0 }, "repairAttempted": { "type": "boolean" }, "questionsRequested": { "type": "integer", "minimum": 0 }, "questionsAccepted": { "type": "integer", "minimum": 0 } }
}

        ```
      </file>
      <file path="openapi.yaml">
        ```yaml
        openapi: 3.1.0
info:
  title: Study Tracker Phase 2 Intelligence API
  version: 1.1.0
  description: Public, owner-scoped contract. Hidden answer keys, rubrics, reference solutions, and hidden tests are server-only.
  x-contract-status: approved
servers:
  - url: /
paths:
  /v1/materials:
    post:
      operationId: createMaterial
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/IdempotencyKey' }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/MaterialCreate' } } } }
      responses: { '202': { description: Accepted, content: { application/json: { schema: { $ref: '#/components/schemas/AsyncJob' } } } }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '409': { $ref: '#/components/responses/Conflict' }, '429': { $ref: '#/components/responses/Quota' } }
  /v1/materials/{materialId}/ingestion:
    get:
      operationId: getIngestionStatus
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/MaterialId' }]
      responses: { '200': { description: Ingestion status, content: { application/json: { schema: { $ref: '#/components/schemas/IngestionStatus' } } } }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } }
  /v1/materials/{materialId}/content:
    get:
      operationId: getMaterialContentPreview
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/MaterialId' }]
      responses: { '200': { description: Partial extracted content preview, content: { application/json: { schema: { $ref: '#/components/schemas/MaterialContentPreview' } } } }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } }
  /v1/assessments/generate:
    post:
      operationId: generateAssessment
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/IdempotencyKey' }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/GenerationRequest' } } } }
      responses: { '202': { description: Accepted, content: { application/json: { schema: { $ref: '#/components/schemas/AsyncJob' } } } }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '409': { $ref: '#/components/responses/Conflict' }, '429': { $ref: '#/components/responses/Quota' } }
  /v1/assessments/{assessmentId}:
    get:
      operationId: getAssessment
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/AssessmentId' }]
      responses: { '200': { description: Redacted assessment, content: { application/json: { schema: { $ref: '#/components/schemas/Assessment' } } } }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } }
  /v1/practice-runs:
    post:
      operationId: createPracticeRun
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/IdempotencyKey' }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/PracticeRunCreate' } } } }
      responses: { '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/PracticeRun' } } } }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } }
  /v1/practice-runs/{runId}/attempts:
    post:
      operationId: submitAttempt
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/RunId' }, { $ref: '#/components/parameters/IdempotencyKey' }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/AttemptSubmit' } } } }
      responses: { '202': { description: Accepted, content: { application/json: { schema: { $ref: '#/components/schemas/AsyncJob' } } } }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '409': { $ref: '#/components/responses/Conflict' } }
  /v1/attempts/{attemptId}/grade:
    post:
      operationId: gradeAttempt
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/AttemptId' }, { $ref: '#/components/parameters/IdempotencyKey' }]
      responses: { '202': { description: Accepted, content: { application/json: { schema: { $ref: '#/components/schemas/AsyncJob' } } } }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } }
  /v1/jobs/{jobId}:
    get:
      operationId: getJob
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/JobId' }]
      responses: { '200': { description: Owner-scoped asynchronous job status and public result, content: { application/json: { schema: { $ref: '#/components/schemas/AsyncJob' } } } }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } }
  /v1/mastery:
    get:
      operationId: getMastery
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { in: query, name: materialId, schema: { $ref: '#/components/schemas/Id' } }, { in: query, name: skillTag, schema: { type: string } }]
      responses: { '200': { description: Rebuildable mastery projection, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/MasteryProjection' } } } } }, '401': { $ref: '#/components/responses/Unauthorized' } }
  /v1/guide/stream:
    post:
      operationId: streamGuide
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/IdempotencyKey' }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/GuideRequest' } } } }
      responses: { '200': { description: SSE stream; each data value is a HintFrame, content: { text/event-stream: { schema: { $ref: '#/components/schemas/HintFrame' } } } }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '429': { $ref: '#/components/responses/Quota' } }
  /v1/guide/reveal:
    post:
      operationId: revealGuide
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/IdempotencyKey' }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/RevealRequest' } } } }
      responses: { '200': { description: Gated acknowledgement only; no hidden content, content: { application/json: { schema: { $ref: '#/components/schemas/RevealResponse' } } } }, '403': { $ref: '#/components/responses/Forbidden' }, '401': { $ref: '#/components/responses/Unauthorized' } }
  /v1/roadmap/feedback:
    post:
      operationId: submitRoadmapFeedback
      security: [{ bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/RequestId' }, { $ref: '#/components/parameters/IdempotencyKey' }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/RoadmapFeedback' } } } }
      responses: { '202': { description: Accepted advisory signal, content: { application/json: { schema: { $ref: '#/components/schemas/AsyncJob' } } } }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT, description: Supabase access token; sub is the ownership key. }
  parameters:
    RequestId: { in: header, name: X-Request-ID, required: true, schema: { $ref: '#/components/schemas/Id' } }
    IdempotencyKey: { in: header, name: Idempotency-Key, required: true, schema: { type: string, minLength: 16, maxLength: 128 } }
    MaterialId: { in: path, name: materialId, required: true, schema: { $ref: '#/components/schemas/Id' } }
    AssessmentId: { in: path, name: assessmentId, required: true, schema: { $ref: '#/components/schemas/Id' } }
    RunId: { in: path, name: runId, required: true, schema: { $ref: '#/components/schemas/Id' } }
    AttemptId: { in: path, name: attemptId, required: true, schema: { $ref: '#/components/schemas/Id' } }
    JobId: { in: path, name: jobId, required: true, schema: { $ref: '#/components/schemas/Id' } }
  responses:
    BadRequest: { description: Invalid request, content: { application/json: { schema: { $ref: '#/components/schemas/ServiceError' } } } }
    Unauthorized: { description: Missing or invalid JWT, content: { application/json: { schema: { $ref: '#/components/schemas/ServiceError' } } } }
    Forbidden: { description: Ownership or reveal gate denied, content: { application/json: { schema: { $ref: '#/components/schemas/ServiceError' } } } }
    NotFound: { description: Object not found in owner scope, content: { application/json: { schema: { $ref: '#/components/schemas/ServiceError' } } } }
    Conflict: { description: Idempotency or state conflict, content: { application/json: { schema: { $ref: '#/components/schemas/ServiceError' } } } }
    Quota: { description: Provider or user quota exhausted, content: { application/json: { schema: { $ref: '#/components/schemas/ServiceError' } } } }
  schemas:
    Id: { type: string, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' }
    Timestamp: { type: string, format: date-time }
    DifficultyBand: { type: integer, minimum: 1, maximum: 5 }
    MaterialCreate: { type: object, additionalProperties: false, required: [clientId, kind, title, source], properties: { clientId: { $ref: '#/components/schemas/Id' }, kind: { type: string, enum: [manual, url, youtube, file] }, title: { type: string, minLength: 1, maxLength: 300 }, source: { type: string, minLength: 1 }, roadmapId: { $ref: '#/components/schemas/Id' } } }
    Material: { type: object, additionalProperties: false, required: [id, ownerId, title, kind, ingestionState, createdAt], properties: { id: { $ref: '#/components/schemas/Id' }, ownerId: { $ref: '#/components/schemas/Id' }, title: { type: string }, kind: { type: string, enum: [manual, url, youtube, file] }, ingestionState: { type: string, enum: [pending, extracting, chunking, embedding, ready, failed] }, chunkCount: { type: integer, minimum: 0 }, groundingVersion: { type: string }, uploadCompleteAt: { type: string, format: date-time }, createdAt: { $ref: '#/components/schemas/Timestamp' }, updatedAt: { $ref: '#/components/schemas/Timestamp' } } }
    IngestionStatus: { type: object, additionalProperties: false, required: [materialId, state, progress, updatedAt], properties: { materialId: { $ref: '#/components/schemas/Id' }, state: { type: string }, progress: { type: number, minimum: 0, maximum: 1 }, attempt: { type: integer, minimum: 1 }, retryable: { type: boolean }, error: { $ref: '#/components/schemas/ServiceError' }, updatedAt: { $ref: '#/components/schemas/Timestamp' } } }
    MaterialContentPreview: { type: object, additionalProperties: false, required: [materialId, state, updatedAt], properties: { materialId: { $ref: '#/components/schemas/Id' }, state: { type: string }, previewText: { type: string, maxLength: 10000 }, chunkCount: { type: integer, minimum: 0 }, ready: { type: boolean }, updatedAt: { $ref: '#/components/schemas/Timestamp' } } }
    AssessmentRecipe: { type: object, additionalProperties: false, required: [formats, questionCount], properties: { formats: { type: array, minItems: 1, items: { type: string, enum: [objective, written, coding] } }, questionCount: { type: integer, minimum: 1, maximum: 100 }, difficulty: { $ref: '#/components/schemas/DifficultyBand' }, skillTags: { type: array, items: { type: string } } } }
    GenerationRequest: { type: object, additionalProperties: false, required: [clientId, materialIds, recipe, correlationId], properties: { clientId: { $ref: '#/components/schemas/Id' }, materialIds: { type: array, minItems: 1, items: { $ref: '#/components/schemas/Id' } }, recipe: { $ref: '#/components/schemas/AssessmentRecipe' }, correlationId: { $ref: '#/components/schemas/Id' }, masterySnapshotVersion: { type: string } } }
    Question: { type: object, additionalProperties: false, required: [id, assessmentId, materialId, format, prompt, skillTags, authoredDifficulty], properties: { id: { $ref: '#/components/schemas/Id' }, assessmentId: { $ref: '#/components/schemas/Id' }, materialId: { $ref: '#/components/schemas/Id' }, format: { type: string }, prompt: { type: string }, options: { type: array, items: { type: string } }, skillTags: { type: array, minItems: 1, items: { type: string } }, authoredDifficulty: { $ref: '#/components/schemas/DifficultyBand' }, citations: { type: array, items: { $ref: '#/components/schemas/Citation' } } } }
    Assessment: { type: object, additionalProperties: false, required: [id, ownerId, materialIds, status, questions, createdAt], properties: { id: { $ref: '#/components/schemas/Id' }, ownerId: { $ref: '#/components/schemas/Id' }, materialIds: { type: array, minItems: 1, items: { $ref: '#/components/schemas/Id' } }, status: { type: string, enum: [generating, ready, partial, failed] }, questions: { type: array, items: { $ref: '#/components/schemas/Question' } }, warnings: { type: array, items: { $ref: '#/components/schemas/Warning' } }, groundingStale: { type: boolean }, createdAt: { $ref: '#/components/schemas/Timestamp' } } }
    PracticeRunCreate: { type: object, additionalProperties: false, required: [clientId, mode, questionIds, correlationId], properties: { clientId: { $ref: '#/components/schemas/Id' }, mode: { type: string, enum: [written, coding, mixed] }, questionIds: { type: array, minItems: 1, items: { $ref: '#/components/schemas/Id' } }, materialIds: { type: array, items: { $ref: '#/components/schemas/Id' } }, correlationId: { $ref: '#/components/schemas/Id' } } }
    PracticeRun: { type: object, additionalProperties: false, required: [id, ownerId, mode, status, problemCount, createdAt], properties: { id: { $ref: '#/components/schemas/Id' }, ownerId: { $ref: '#/components/schemas/Id' }, mode: { type: string }, status: { type: string }, problemCount: { type: integer, minimum: 1 }, materialIds: { type: array, items: { $ref: '#/components/schemas/Id' } }, createdAt: { $ref: '#/components/schemas/Timestamp' } } }
    AttemptSubmit: { type: object, additionalProperties: false, required: [clientAttemptId, questionId, answer, submittedAt, correlationId], properties: { clientAttemptId: { $ref: '#/components/schemas/Id' }, questionId: { $ref: '#/components/schemas/Id' }, answer: {}, submittedAt: { $ref: '#/components/schemas/Timestamp' }, elapsedSeconds: { type: integer, minimum: 0 }, correlationId: { $ref: '#/components/schemas/Id' } } }
    QuestionGraded: { type: object, additionalProperties: false, required: [attemptId, questionId, materialId, score, correct, gradedAt, grader], properties: { attemptId: { $ref: '#/components/schemas/Id' }, questionId: { $ref: '#/components/schemas/Id' }, materialId: { $ref: '#/components/schemas/Id' }, score: { type: number, minimum: 0, maximum: 1 }, correct: { type: boolean }, perSkill: { type: array, items: { $ref: '#/components/schemas/PerSkillObservation' } }, explanation: { type: string }, grader: { type: string, enum: [objective, gemini_rubric, judge0] }, modelVersion: { type: string }, gradedAt: { $ref: '#/components/schemas/Timestamp' } } }
    PerSkillObservation: { type: object, additionalProperties: false, required: [skillTag, score, correct], properties: { skillTag: { type: string }, score: { type: number, minimum: 0, maximum: 1 }, correct: { type: boolean }, confidence: { type: number, minimum: 0, maximum: 1 } } }
    MasteryProjection: { type: object, additionalProperties: false, required: [materialId, skillTag, mastery, uncertainty, confidence, n, modelVersion], properties: { materialId: { $ref: '#/components/schemas/Id' }, skillTag: { type: string }, mastery: { type: number, minimum: 0, maximum: 1 }, uncertainty: { type: number, minimum: 0, maximum: 1 }, confidence: { type: number, minimum: 0, maximum: 1 }, n: { type: integer, minimum: 0 }, recentTrend: { type: number }, modelVersion: { type: string } } }
    GuideRequest: { type: object, additionalProperties: false, required: [questionId, learnerWork, tier, correlationId], properties: { questionId: { $ref: '#/components/schemas/Id' }, learnerWork: { type: string, maxLength: 20000 }, activeLine: { type: integer, minimum: 1 }, tier: { type: string, enum: [nudge, concept, strategy, worked_step] }, correlationId: { $ref: '#/components/schemas/Id' }, materialIds: { type: array, items: { $ref: '#/components/schemas/Id' } } } }
    HintFrame: { $ref: './gemini/guide-hint-frame.schema.json' }
    RevealRequest: { type: object, additionalProperties: false, required: [questionId, attemptId, confirmation, correlationId], properties: { questionId: { $ref: '#/components/schemas/Id' }, attemptId: { $ref: '#/components/schemas/Id' }, confirmation: { const: true }, correlationId: { $ref: '#/components/schemas/Id' } } }
    RevealResponse: { $ref: './gemini/gated-reveal-response.schema.json' }
    RoadmapFeedback: { type: object, additionalProperties: false, required: [roadmapId, signal, correlationId], properties: { roadmapId: { $ref: '#/components/schemas/Id' }, signal: { type: string }, correlationId: { $ref: '#/components/schemas/Id' }, context: { type: object } } }
    Citation: { type: object, additionalProperties: false, required: [chunkId, materialId, quote], properties: { chunkId: { $ref: '#/components/schemas/Id' }, materialId: { $ref: '#/components/schemas/Id' }, quote: { type: string, minLength: 1, maxLength: 2000 }, startSeconds: { type: number, minimum: 0 } } }
    Warning: { type: object, additionalProperties: false, required: [code, message], properties: { code: { type: string }, message: { type: string }, questionId: { $ref: '#/components/schemas/Id' } } }
    AsyncJob: { type: object, additionalProperties: false, required: [jobId, kind, status, ownerId, correlationId, createdAt], properties: { jobId: { $ref: '#/components/schemas/Id' }, kind: { type: string, enum: [ingestion, generation, grading, roadmap_feedback] }, status: { type: string, enum: [queued, running, succeeded, partial, failed, cancelled] }, ownerId: { $ref: '#/components/schemas/Id' }, correlationId: { $ref: '#/components/schemas/Id' }, resultId: { $ref: '#/components/schemas/Id' }, result: {}, error: { $ref: '#/components/schemas/ServiceError' }, createdAt: { $ref: '#/components/schemas/Timestamp' }, completedAt: { $ref: '#/components/schemas/Timestamp' } } }
    ServiceError: { type: object, additionalProperties: false, required: [code, message, requestId, retryable], properties: { code: { type: string, enum: [invalid_request, unauthorized, forbidden, not_found, conflict, safety_block, quota_exhausted, rate_limited, provider_credentials, provider_unavailable, provider_timeout, malformed_output, validation_failed, internal_error] }, message: { type: string }, requestId: { $ref: '#/components/schemas/Id' }, correlationId: { $ref: '#/components/schemas/Id' }, retryable: { type: boolean }, retryAfterSeconds: { type: integer, minimum: 1 } } }

        ```
      </file>
      <file path="provider-error.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/provider-error.schema.json",
  "title": "NormalizedProviderError",
  "type": "object",
  "additionalProperties": false,
  "required": ["code", "message", "retryable", "requestId", "correlationId"],
  "properties": {
    "code": { "type": "string", "enum": ["safety_block", "quota_exhausted", "rate_limited", "provider_credentials", "provider_unavailable", "provider_timeout", "malformed_output"] },
    "message": { "type": "string", "minLength": 1 },
    "retryable": { "type": "boolean" },
    "requestId": { "type": "string", "minLength": 1 },
    "correlationId": { "type": "string", "minLength": 1 },
    "retryAfterSeconds": { "type": "integer", "minimum": 1 }
  }
}

        ```
      </file>
      <file path="question-slot.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/question-slot.schema.json",
  "title": "QuestionSlot",
  "type": "object",
  "additionalProperties": false,
  "required": ["slotId", "format", "difficulty", "skillTags"],
  "properties": {
    "slotId": { "type": "string", "minLength": 1 },
    "format": { "type": "string", "enum": ["objective", "written", "coding"] },
    "difficulty": { "type": "integer", "minimum": 1, "maximum": 5 },
    "skillTags": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "citationCount": { "type": "integer", "minimum": 0 }
  }
}

        ```
      </file>
      <file path="service-objects.schema.json">
        ```json
        {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://study-tracker.local/contracts/phase2/service-objects.schema.json",
  "title": "Phase2ServiceObjects",
  "type": "object",
  "additionalProperties": false,
  "required": ["ownerId", "correlationId", "id", "kind", "state"],
  "properties": { "ownerId": { "type": "string", "minLength": 1 }, "correlationId": { "type": "string", "minLength": 1 }, "id": { "type": "string", "minLength": 1 }, "kind": { "enum": ["material", "ingestion_job", "assessment", "question", "practice_run", "attempt", "mastery_projection", "guide_stream", "roadmap_feedback"] }, "state": { "type": "string", "minLength": 1 }, "version": { "type": "integer", "minimum": 1 }, "createdAt": { "type": "string", "format": "date-time" }, "updatedAt": { "type": "string", "format": "date-time" } }
}

        ```
      </file>
      <file path="tests/test_contracts.py">
        ```py
        from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest
import yaml


ROOT = Path(__file__).parents[1]
SECRET_FIELDS = {"answerkey", "rubric", "referencesolution", "hiddentests", "hiddenanswer"}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="ascii"))


def walk_values(value: object):
    yield value
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from walk_values(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_values(child)


def assert_no_secret_fields(value: object) -> None:
    for item in walk_values(value):
        if isinstance(item, str):
            assert item.replace("_", "").replace("-", "").lower() not in SECRET_FIELDS


def test_openapi_31_has_structurally_complete_operations() -> None:
    document = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="ascii"))
    assert document["openapi"] == "3.1.0"
    assert document["info"]["x-contract-status"] == "approved"
    assert "/v1/jobs/{jobId}" in document["paths"]
    assert "ServiceError" in document["components"]["schemas"]
    for path, path_item in document["paths"].items():
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete", "options", "head"}:
                continue
            assert operation["operationId"], path
            assert operation["security"], path
            assert operation["responses"], path
            refs = {parameter.get("$ref") for parameter in operation.get("parameters", [])}
            assert "#/components/parameters/RequestId" in refs, path
            if method in {"post", "put", "patch", "delete"}:
                assert "#/components/parameters/IdempotencyKey" in refs, path
            for response in operation["responses"].values():
                assert "description" in response or "$ref" in response, path


def test_openapi_refs_resolve_locally() -> None:
    document = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="ascii"))

    def resolve_pointer(pointer: str) -> object:
        current: object = document
        for token in pointer[2:].split("/"):
            token = token.replace("~1", "/").replace("~0", "~")
            assert isinstance(current, dict) and token in current, pointer
            current = current[token]
        return current

    def visit(value: object) -> None:
        if isinstance(value, dict):
            ref = value.get("$ref")
            if isinstance(ref, str):
                if ref.startswith("#/"):
                    resolve_pointer(ref)
                else:
                    target = (ROOT / ref.split("#", 1)[0]).resolve()
                    assert target.is_file(), ref
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(document)


def test_every_json_schema_and_fixture_validates() -> None:
    schemas = {load_json(path)["$id"]: load_json(path) for path in ROOT.rglob("*.schema.json")}
    for schema_path in sorted(ROOT.rglob("*.schema.json")):
        schema = load_json(schema_path)
        jsonschema.Draft202012Validator.check_schema(schema)

    for item in load_json(ROOT / "fixtures/manifest.json"):
        schema = load_json(ROOT / "fixtures" / item["schema"])
        instance = load_json(ROOT / "fixtures" / item["file"])
        resolver = jsonschema.RefResolver.from_schema(schema, store=schemas)
        jsonschema.Draft202012Validator(schema, resolver=resolver, format_checker=jsonschema.FormatChecker()).validate(instance)


def test_public_contracts_reject_hidden_fields() -> None:
    public_schema_paths = [
        ROOT / "gemini/gated-reveal-response.schema.json",
        ROOT / "gemini/guide-hint-frame.schema.json",
        ROOT / "execution-result.schema.json",
        ROOT / "durable-events.schema.json",
    ]
    for path in public_schema_paths:
        assert_no_secret_fields(load_json(path))

    reveal = load_json(ROOT / "fixtures/gated-reveal.json")
    assert_no_secret_fields(reveal)
    assert "explanation" in reveal
    assert "content" not in reveal

    events = load_json(ROOT / "durable-events.schema.json")
    assert_no_secret_fields(events)
    assert "$defs" in events
    assert {"assessmentCreated", "questionAttempted", "questionGraded", "guideRequested", "guideCompleted", "roadmapFeedbackRecorded"} <= set(events["$defs"])


def test_public_error_matrix_is_explicit() -> None:
    document = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="ascii"))
    codes = document["components"]["schemas"]["ServiceError"]["properties"]["code"]["enum"]
    assert {"safety_block", "quota_exhausted", "provider_timeout", "malformed_output"} <= set(codes)


def test_guide_frame_conditionals_reject_mixed_payloads() -> None:
    schema = load_json(ROOT / "gemini/guide-hint-frame.schema.json")
    invalid = {"frame": "done", "sequence": 1, "correlationId": "corr", "text": "not allowed"}
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft202012Validator(schema).validate(invalid)

        ```
      </file>
</files>
</slice>

<slice name="issue-54-handover">
The #54 contract-neutralization handoff (the planning mandate that produced
today's decisions and the #57 graduation rule).
<files>
2026-08-22-issue-54-contract-neutralization-handoff.md


      <file path="">
        ```md
        # Handoff - Phase 2 contract neutralization: resolve #54

> Handoff prompt for the next wayfinder session. Tickets #52, #55, #56, #53 are
> closed; the frontier is grilling ticket #54 (provider-neutral contract pack),
> then #38 implementation planning.

<handoff_prompt>

<role>
You are an engineering agent operating the `/wayfinder` skill ("Work through the
map" mode) for repository `study-planner-web`, working the GitHub tracker
`rings0fsaturn/study-planner`. This session resolves exactly ONE decision
ticket from Phase 2 map [#4](https://github.com/rings0fsaturn/study-planner/issues/4):
claim it, resolve it, post the resolution comment, close it, append one decision
line to map #4, update `.work/STATUS.md` if state changed, and stop. You are
planning, not building: production implementation happens only via a graduated
slice. Create the contract-edit work as a NEW child issue of #4/#38 and do not
edit any contract files yourself.
</role>

<start_here>
1. Read `AGENTS.md`, then `.work/STATUS.md`, then the rules index
   `.agents/rules/README.agents.md` and every rule its index selects for your
   task (minimum: 52-github-cli-and-token, 53-wsl-dev-runtime,
   80-script-dry-run-before-full-runs).
2. Load map [#4](https://github.com/rings0fsaturn/study-planner/issues/4) body
   (low-res view). Check `git status --short` and preserve unrelated worktree
   changes.
3. Claim ticket #54 by assigning it to `rings0fsaturn` BEFORE any work
   (`gh issue edit 54 --repo rings0fsaturn/study-planner --add-assignee rings0fsaturn`).
</start_here>

<where_we_left_off>
Branch `phase2/issue-38`, latest commit `f25dd42`. The DeepSeek provider-switch
effort has four of five tickets closed on 2026-08-22:

- **#52 Provision OpenRouter access** - CLOSED. `OPENROUTER_API_KEY` lives in
  `services/intelligence/.env` (never print/commit it; ~$2 credit remaining).
  Compose passes it to both `intelligence` and `ingestion-worker` by env
  reference.
- **#55 Research DeepSeek/OpenRouter mechanics** - CLOSED. Findings committed
  at `research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md`.
- **#56 Probe DeepSeek x Qwen sidecar quality** - CLOSED. Evidence + report at
  `research/doc/deepseek-generation-probe/{raw.jsonl, contexts.json,
  summary.json, report.md}`; probe script
  `services/intelligence/scripts/generation_probe.py` (10 unit tests); runbook
  under `.work/plans/active/2026-08-22-deepseek-qwen-generation-probe/`.
- **#53 Generation runtime settings** - CLOSED. Resolution comment records the
  eight locked runtime decisions (below) and maps the reasoning-re-test
  obligations onto slices [#41](https://github.com/rings0fsaturn/study-planner/issues/41)
  (written_grading) and [#46](https://github.com/rings0fsaturn/study-planner/issues/46)
  (guide_hint/guide_reveal) via cross-reference comments on those tickets.

Map #4 fog already records that the provider seam has only #54 open.
</where_we_left_off>

<decisions_already_made>
Do not re-litigate these (map #4 records them):

Standing provider decisions:
1. Sole generation provider: `deepseek/deepseek-v4-flash-0731` via OpenRouter,
   called through the OpenAI Python SDK
   (`base_url="https://openrouter.ai/api/v1"`), behind a repository-owned
   model-neutral interface. No SDK types leak past the seam. Gemini chat
   removed outright; Ollama fallback dropped from spec #32 text. Gemini remains
   embeddings-fallback only.
2. Reasoning OFF for objective question generation (#56 evidence).

#53 runtime decisions that constrain the contract shapes (resolution comment
on #53 is authoritative):
3. Reasoning effort is an explicit neutral knob defaulting off for every task;
   written_grading / guide tasks flip on only after a probe re-test.
4. Timeout becomes per-task config `GENERATION_TIMEOUT_MS` (30 s default for
   assessment_generation), replacing the single `timeoutMs: 30000` const.
5. Output budget `GENERATION_MAX_OUTPUT_TOKENS`, default 4096.
6. Temperature pinned at 0.3; top_p omitted; no seed pinning.
7. Local schema validation after EVERY response regardless of strict mode or
   require_parameters: a contract requirement, not adapter folklore.
8. Retry matrix: SDK `max_retries=0`; exactly ONE application-level retry for
   retryable classes (rate_limited honoring Retry-After capped at 60 s,
   provider_unavailable, provider_timeout); never retry credentials, quota, or
   safety outcomes; malformed output follows #13's one-repair-else-drop rule;
   a NEW non-retryable `unsupported_request` code joins the provider-error
   enum for capability/tier-rejection 400s.
9. Optional integer `reasoningTokens` field joins
   `generation-telemetry.schema.json` (from
   `completion_tokens_details.reasoning_tokens`, omitted when absent).
10. Env naming: keep `OPENROUTER_API_KEY`; add `GENERATION_MODEL`,
    `GENERATION_BASE_URL`, `GENERATION_TIMEOUT_MS`,
    `GENERATION_MAX_OUTPUT_TOKENS`, `GENERATION_TEMPERATURE`,
    `GENERATION_REASONING_EFFORT`.
</decisions_already_made>

<ticket_54_brief>
Question: how does the approved Gemini-shaped contract pack become internally
consistent with the new provider reality while preserving the public normalized
boundary?

Planning-session lean (re-decidable on the ticket): neutralize the existing
`services/intelligence/contracts/phase2/gemini/*` envelopes IN PLACE (rename
the dir to e.g. `provider/` or keep paths but generalize) rather than adding an
`openrouter/` sibling. The README already calls the response envelope
provider-neutral and nothing is implemented yet, so this is the cheapest
moment. Decide:

- Envelope field mapping: OpenAI-style roles and finish reasons
  (`stop|length|content_filter|error` plus `native_finish_reason`) mapped onto
  the normalized outcome enums; refusal handling (`message.refusal`); usage
  incl. optional reasoning-token counts; where `require_parameters` and routing
  constraints live (adapter detail, not public contract); placement of the new
  `unsupported_request` error code.
- Whether the request envelope keeps Gemini-native fields (`responseSchema`
  OBJECT shape, `responseMimeType`, `safetySettings`, `timeoutMs` const) or
  becomes neutral (a plain JSON Schema object; per-task timeout and token
  budgets per #53; sampling reflecting temperature-only pinning).
- Embeddings scope note: `gemini/embedding-request.schema.json` legitimately
  stays Gemini-shaped because Gemini remains the embeddings fallback; decide
  explicitly whether it stays put, moves, or gets a README note rather than
  blanket-renaming the whole dir.
- Fixture regeneration approach: the six `generation-*.json` fixtures +
  `manifest.json` + `tests/test_contracts.py` regenerated against captured
  DeepSeek shapes (`research/doc/deepseek-generation-probe/raw.jsonl` holds
  sanitized real responses to seed them); touch affected written-grading and
  guide fixtures only where envelope shapes change there.
- Mechanical refactors to specify: `openapi.yaml` refs, `PIPELINES.md` wording,
  `TRACEABILITY.md`, the gemini dir README, and the `gemini_rubric` grader enum
  in `durable-events.schema.json` (free rename; zero graded events exist).
- Spec #32 text amendment (replace the Gemini-default/Ollama-fallback policy)
  and map #4 Notes wording.
- Scope boundary: decide and specify everything above, then GRADUATE the file
  edits into ONE new implementation-slice ticket (child of #4/#38; labels
  `wayfinder:phase2` plus a type label; a `## Parent` section naming spec #32 /
  map #4 / slice #38; a `## Blocked by` section naming real blockers) rather
  than editing contracts yourself.
</ticket_54_brief>

<environment_gotchas>
- **gh CLI**: token from `.env.git.local` via
  `export GH_TOKEN=$(grep '^TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')`;
  wrap every call in a 5-attempt retry loop; transient api.github.com TLS/EOF
  failures are network flakiness, not config. `gh issue view` without `--json`
  can die on GraphQL deprecation; prefer `--json`.
- **Secrets**: never print/echo/log keys; keep values in shell variables.
  `OPENROUTER_API_KEY` in `services/intelligence/.env`.
- **WSL runtime** (rule 53): dotenv never overrides exported env vars; launch
  scripts with `env -u OPENROUTER_API_KEY ... uv run --package intelligence ...`
  so the `.env` loader owns values. Vite does not watch `/mnt/d`. `pkill -f`
  can kill your own shell; use character classes or PIDs.
- **Rule 80**: dry-run any script after every code edit before full runs;
  prefer offline checks (python parse, ruff, unit tests). Contract-test runs
  are offline: run `uv run --package intelligence pytest
  services/intelligence/contracts/phase2/tests/test_contracts.py` style checks
  with no API key.
- **Git**: conventional commits with body +
  `Co-authored-by: GitHub Copilot using <your model name>`. Untracked
  `.work/active/tracker-19-aug/` and `college/mydeliverables/phase2-review-2/`
  are pre-existing unrelated work; leave them alone. Check NEW files for em/en
  dash characters (repo convention).
</environment_gotchas>

<definition_of_done>
1. Ticket claimed (assignee set) before work started.
2. Decision(s) recorded as a resolution comment on #54; ticket closed.
3. Map #4 updated: one Decisions-so-far line; the provider-seam fog entry fully
   resolved (annotate or remove it once #54 closes); nothing silently dropped.
4. The graduated implementation-slice ticket carries `## Parent` (spec #32 /
   map #4 / slice #38), labels `wayfinder:phase2` (+ type), and a
   `## Blocked by` section naming its real blockers.
5. `.work/STATUS.md` row added/updated in the same session; `last_updated`
   bumped.
6. Session stops after ONE ticket resolution. Next frontier: #38
   implementation planning against the amended contracts.
</definition_of_done>

<do_not>
- Do not edit any contract files, fixtures, manifests, or tests yourself; that
  belongs to the graduated slice.
- Do not start implementing #38.
- Do not touch embeddings behavior, browser code, guide SSE, written grading,
  or harness #48.
- Do not re-run the quality probe or spend API credits; the evidence base is
  complete for this decision.
- Do not resolve more than one wayfinder ticket this session.
- Do not modify the immutable sections of any plan doc (Decisions log,
  preamble, TL;DR, out-of-scope).
</do_not>

</handoff_prompt>
        ```
      </file>
</files>
</slice>

<slice name="status-index">
`.work/STATUS.md` - the read-first project state index (current rows, active
plans, done work).
<files>
STATUS.md


      <file path="">
        ```md
        ---
title: study-planner-web — STATUS (read-first index)
status: active living document
last_updated: 2026-08-22 (provider-neutral contract amendment #54 — gemini/ -> provider/, slice #57)
location_note: >
  This is .work/STATUS.md — the single read-first index, living at the root of .work/ (inside the
  repo, tracked on purpose so git clean can't delete it). Paths below are relative to .work/ (non-.work
  targets use ../). Reshaped 2026-06-25 from the former MASTER_TRACKER.md into the scannable
  Active/Queued/Done/Reference/Gotchas model; the full long-form detail is preserved in
  master-tracker-detail.md.
tags:
  "[APP]": product web app
  "[RESEARCH]": research tier (synthetic generator → metrics → validation → report)
  "[PILLAR-A]": Pillar-A rigour / calibration / change-detection
  "[KT]": Pillar-B knowledge-tracing bench
  "[DISSERTATION]": M.Tech dissertation & review deliverables
  "[INFRA]": repo infra / housekeeping
update_protocol: >
  Update the affected row in the same session work changes state; bump last_updated. Push detail
  into the spec/plan/VERIFICATION/handover and link it. The linked canonical file wins over this
  index on any conflict — fix the row, don't paper over it. Code is ground truth.
---

# study-planner-web — STATUS

> **Read first.** The whole project at a glance — a study-plan web app **plus** the M.Tech research
> behind its algorithms. One row per item, tagged by workstream. Full long-form detail (markers,
> SHAs, findings) lives in [`master-tracker-detail.md`](master-tracker-detail.md); folder map in
> [`README.md`](README.md). Keep this short — push depth down and link it.

## Active

- **[APP][RESEARCH] Retrieval quality program — embedding bake-off follow-up (issue #37).** ✅ Implemented + verified 2026-08-15. 30-question multi-gold probe (16→30, Q15 fixed, altSnippets); hybrid BM25+dense retrieval (migrations `015`/`016`, tsvector+GIN, weighted RRF k=60 wL=0.7 pool 25) **+7 recall@3**; Qwen3-Reranker-0.6B sidecar (`services/reranker/`, compose port 8100) + typed client (6 tests) **+4 recall@1, +7 recall@3, MRR 0.858**; title-prefix and ONNX-int8 **rejected** (no gain / r@1 collapse to 0.10). Final: r@1 0.70→0.77, r@3 0.83→0.97, MRR 0.788→0.858 vs dense baseline. Service 229 passed (+5 pre-existing golden-fixture failures confirmed unrelated); repo typecheck/lint clean. **Follow-ups:** production wiring of the rerank step into a retrieval endpoint (client + sidecar exist, no caller yet); ~~restore the dev corpus embeddings (wiped since 2026-08-15) before the next live probe~~ → ✅ done 2026-08-19 ([corpus-restore plan](plans/archive/2026-08-19-corpus-restore/PLAN.md) — re-ingested at `80c8b138-…`, now `754 chunks / 754 embedded / qwen-sidecar`, accepted as the new durable baseline under Decision A; frozen 788 metrics are tied to the retired pre-C3 60-token overlap split); a second corpus to confirm the levers generalize. → plan [`plans/archive/2026-08-15-retrieval-quality-program/PLAN.md`](plans/archive/2026-08-15-retrieval-quality-program/PLAN.md) · results [`research/doc/2026-08-15-retrieval-quality-program-results.md`](../research/doc/2026-08-15-retrieval-quality-program-results.md)

- **[APP][RESEARCH] PDF ingestion performance & embedding-quality baseline (telemetry).** 🟡 2026-08-14: the approved `GenerationTelemetry` contract is implemented as the metrics layer — migration `014` (`generation_telemetry`, service-role only), worker emits contract-shaped records per stage + per-batch Gemini calls (latency/tokens/attempts/outcome), `traceId` = job correlation id. Live baseline on the 572-page PDF found the E2E failure's real cause: the worker **burst past the provider's per-minute token quota** (free tier RPM 100 · TPM 30 k · RPD 1000, per AI Studio dashboard) — 27 k tokens in ~10 s, 8th call 429. Fixes implemented: **C8 TPM throttle** (`TokenRateLimiter`, `INGESTION_MAX_TOKENS_PER_MINUTE` default 25 k — the full book then fits RPD 1000 in ~9-10 min), **C2 resume-on-retry** (identical re-extractions keep embedded vectors), **C3 overlap 60→30**. The 16-question retrieval probe was superseded by the completed 30-question retrieval-quality program (2026-08-15, row below). **Open:** full-book PDF E2E re-run under the C8 throttle (likely superseded by the Qwen3 GPU sidecar path — confirm before closing). FINDINGS + metrics artifacts in the plan folder. → plan [`plans/active/2026-08-14-ingestion-performance-baseline/PLAN.md`](plans/active/2026-08-14-ingestion-performance-baseline/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-08-14-ingestion-performance-baseline/VERIFICATION.md)
- **[APP][INFRA] Dockerized full app + internal infra dependency removal.** ✅ Implemented and live-verified 2026-08-09. `docker-compose.yml` now runs the whole product: `web` (multi-stage Node/nginx image serving the Astro site at `/` and the React app at `/study` with SPA fallback, proxying `/api/v1/*` to the service) and `intelligence` (public `python:3.12-slim` / `ghcr.io/astral-sh/uv` base images). Removed the internal corporate image-mirror defaults and the corporate CA build secret from Docker, compose, READMEs, agent rules, historical plans, and the 3rd-Review submission copy; public npm registry is the default (operator override documented in rule 50). New: `docker/frontend.Dockerfile`, `docker/nginx.conf`, `docker/.env.example`; `.dockerignore` now excludes secrets and heavy dirs; root `package.json` pins `packageManager: pnpm@10.33.2`. Live verification passed (both containers healthy; marketing `/`, app `/study/sign-in`, deep SPA route, `/health`, and `/api/v1/` proxy all as expected; bundle inlines `/api`). Intentionally preserved content, not dependencies: a YouTube video title in `capture-screenshots.mjs` and the sanitization guide `filter-guide.txt`. Run with `./docker-app start`. → plan [`plans/active/2026-08-09-docker-full-app-and-public-registry-migration/PLAN.md`](plans/active/2026-08-09-docker-full-app-and-public-registry-migration/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-08-09-docker-full-app-and-public-registry-migration/VERIFICATION.md)

- **[APP][INFRA] Docker lifecycle launcher + runtime docs refresh.** ✅ Implemented 2026-08-09. New root `./docker-app` launcher (start/stop/restart/status/logs/config/help) resolves the env file (`--env-file PATH`, else `apps/app/.env.local`, else `.env`) and delegates to `docker compose`; `full-app` stays the local-development process manager. Root README rewritten around the Docker quick start (product overview, env vars, URLs, health checks); `services/intelligence/README.md` Docker sections simplified and Colima/Lima/SSH-forward troubleshooting removed; rule 51 renamed `51-docker-colima` → `51-docker-runtime` and rewritten Docker-only; `AGENTS.md`, `design/architecture.md`, `research/kt-bench/README.md`, and `docker/.env.example` updated to the launcher. Historical `.work/` plans/handovers keep their historically accurate Colima mentions (OQ-01). → plan [`plans/active/2026-08-09-docker-lifecycle-launcher-and-docs/PLAN.md`](plans/active/2026-08-09-docker-lifecycle-launcher-and-docs/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-08-09-docker-lifecycle-launcher-and-docs/VERIFICATION.md)

- **[APP] Learner Growth wayfinder charted — achievements, evidence-backed sharing, community (independent of Phase 2).** ✅ Charting done 2026-08-09; decisions pending. Wayfinder map + tickets live on **GitHub Issues** (`rings0fsaturn/study-planner`): map [#23], frontier ticket **#24 Scope and release shape**, blocked tickets #25–#31. Destination = **implementation-ready spec + prototypes** (nothing implemented until approved) for (1) progress/mastery **achievements**, (2) **evidence-backed shareable achievement pages** (LinkedIn/social, shows *what the learner did*), (3) a moderated **community forum** for chat + Q&A. Charted defaults (re-decidable on the tickets): spec+prototypes shape, async Q&A first, no public profiles initially, opt-in immutable snapshot shares, mastery consumed from Phase 2's contract (no parallel model). Dependency spine: #24→#25→#26→#28→#30, #25→#27, #24→#29→#28, #24→#31. Fog: community IA, moderation/safety, community UX prototype, public projection + backend schema, achievement computation/cache, notifications, search, evaluation/rollout. Out of scope: multiplayer/peer, leaderboards, platform posting APIs, raw event-log exposure, parallel mastery model, anonymous unmoderated posting. **Next:** work the frontier — run `/wayfinder 23` (ticket #24 first). → plan [`plans/active/2026-08-09-learner-growth-wayfinder/PLAN.md`](plans/active/2026-08-09-learner-growth-wayfinder/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-08-09-learner-growth-wayfinder/VERIFICATION.md)

- **[APP][RESEARCH][KT] Phase 2 contract pack approved (2026-08-09):** GitHub task [Phase 2 Object, Provider, and Pipeline Contract Pack](https://github.com/rings0fsaturn/study-planner/issues/22) closed. Canonical OpenAPI 3.1, Gemini envelopes, durable events, service objects, pipeline transformations, telemetry, fixtures, and validation now live under `../services/intelligence/contracts/phase2/`.

- **[APP][RESEARCH][KT] Phase 2 Wayfinder update (2026-08-09):** the claimed **KT model & adaptive-difficulty loop** decision is resolved and closed on GitHub issue [#15](https://github.com/rings0fsaturn/study-planner/issues/15). Production direction is concept-level BKT behind the #14 mastery interface, with immediate per-skill updates, neutral uncertain cold start, one-band adaptive difficulty targeting approximately 0.7 expected correctness, and advisory rebuildable roadmap signals. Downstream roadmap-feedback UX and generation-quality evaluation are now unblocked on the map.

- **[APP][INFRA] Unblock `./full-app start full` — CRLF shebang + Intelligence JWT-secret gate.** ✅ Fixed 2026-08-08 (`3d4589a`). `./full-app start full` (Intelligence :8000 + React app :5173) now boots both healthy. Three blockers cleared: (1) **CRLF shebang** — `full-app` + `scripts/full_app.py` had CRLF (no `.gitattributes`; Windows-checkout autocrlf fallout) → `bash\r: No such file or directory`; stripped to LF + added repo-root `.gitattributes` pinning `full-app`, `scripts/full_app.py`, `scripts/dev-intelligence.mjs`, `*.sh` to `eol=lf`. (2) **JWT-secret gate** — `scripts/dev-intelligence.mjs` hard-exited without `SUPABASE_JWT_SECRET`, but the service (`app/security.py`) verifies ES256/RS256 via JWKS with no secret; gate relaxed to require `SUPABASE_URL` and only **warn** when the secret is absent. (3) missing intelligence venv — `uv sync` at repo root created `./.venv` (gitignored). Also fixed during verification: Windows-built `node_modules` lacked `@rollup/rollup-linux-x64-gnu` → `pnpm install --force` reinstalled native deps. Smoke: typecheck ✅, lint ✅, app tests 563/563 with `vitest --pool=forks` (2 TZ-sensitive tests fail under the default threads pool on WSL — pre-existing, see Gotchas). Out of scope: tree-wide LF renormalize. → plan [`plans/active/2026-08-08-full-app-start-blockers/PLAN.md`](plans/active/2026-08-08-full-app-start-blockers/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-08-08-full-app-start-blockers/VERIFICATION.md) · handover [`handovers/2026-08-08-full-app-start-blockers.md`](handovers/2026-08-08-full-app-start-blockers.md)

- **[APP][INFRA] Recover `prototype/wf17-inline-hint-guide` to a runnable build/test/fix loop.** ✅ Fixed 2026-08-08 — Phases 0–2 green, loop runs clean (`7759422`, `8ac3805`). The Phase-2 wayfinder **#12 inline-hint** prototype branch (Wave 1 — three variant surfaces: ghost-text / margin-rail / popover, mounted at `/study/practice-prototype?variant=A|B|C`) is now buildable/typecheckable/testable on this host. Three fault layers cleared: (1) host toolchain — documented workaround `C:\Users\user\AppData\Roaming\npm\pnpm.cmd` (bare `AppData\Local\pnpm` shim corrupted); `corepack`/`npx` blocked, Python/`uv` missing, `./full-app` POSIX-only; (2) deps — wiped `node_modules` + replaced the junk `allowBuilds:` block with `onlyBuiltDependencies: [esbuild, sharp]`, reinstall exit 0 with only `vitest@1.6.1` → **62/62 test files, 563 tests green**; (3) tsc — the 3 reported `@dnd-kit/react@0.4.0` errors (`SwapDndContext.tsx:74/81`, `SwappableSlotRow.tsx:137`) were **fallout from the corrupted graph, not a real code-vs-types mismatch** — installed v0.4 types accept `children` (via `PropsWithChildren`) and the `DragOverlay` render-prop, so no source edit was needed. Phase 2 also fixed one genuine pre-existing failure: Node 25.6.1's experimental webstorage shadows jsdom's `localStorage` (empty `Object`) breaking `SyncProvider.test.tsx`'s `vi.spyOn(localStorage, 'getItem')` — added a portable in-memory `Storage` guard in `apps/app/src/test/setup.ts`. Green (don't regress): `-r typecheck`, `-r lint`, app build, marketing build (6 pages), `pnpm dev:app`. **Next:** #12 implementer runs Phase 3 (the variant-iteration loop); flip this row to Done in `.work/` after this plan's docs are committed. Plan → [`plans/active/2026-08-08-prototype-wf17-build-test-fix/PLAN.md`](plans/active/2026-08-08-prototype-wf17-build-test-fix/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-08-08-prototype-wf17-build-test-fix/VERIFICATION.md) · handover [`handovers/2026-08-08-prototype-wf17-build-test-fix-handover.md`](handovers/2026-08-08-prototype-wf17-build-test-fix-handover.md).

- **[APP][RESEARCH][KT] Phase 2 charted — Assessments + LLM-guided Practice (wayfinder map).** 🟡 Charting done 2026-07-31; decisions pending. Wayfinder map + tickets live on **GitHub Issues** (`rings0fsaturn/study-planner`): map [#4], frontier tickets #5–#12, blocked tickets #13–#16. Destination = **feature-rich spec + working prototypes** (M.Tech capstone: no ship-fast/deferrals). Locked: tiered-Socratic guide · hybrid on-demand triggers · inline-hint surface (Copilot UX, hints not answers) · **full RAG** grounding · **full KT/adaptation coupling** · hybrid client/server code execution. Research banked: open-notebook (port, don't run) + **#11 Judge0 CE** (closed). Out of scope: multiplayer/peer, voice/podcast, proctoring. **Tackle order = 4 waves** (see PLAN.md): W0 frame #5→#6→#10 · W1 de-risk #12 · W2 infra #9→#7→#8 · W3 downstream #13→#14→#15→#16. **Resolved:** #11 Judge0 CE · **#5 App IA** (2 tabs Assessments+Practice, Roadmaps-style hubs; material-scoped 1+ materials = RAG source + KT target; Settings→header menu for clean 6-tab mobile bar; path-param routes; local-first records + online generation) · **#6 Assessment types/formats/scoring** (Question is the gradeable atom + mixed-format material-scoped Assessment container; 3 families/closed format enum — objective auto-grade, written LLM-rubric, coding Judge0; unified `score∈[0,1]`+per-skill-binary `correct` KT contract, τ≈0.6; difficulty 1..5 authored band + reserved empirical slot for #15) · **#10 Persistence & local-first fit** (**Wave 0 complete**; three-layer split — thin local-first `AssessmentCreated` pointer event + server-owned Supabase `assessments`/`questions` content rows [migration `004`, #13] + non-synced redacted `assessmentContentCache`; per-Question runId-grouped `QuestionAttempted`→`QuestionGraded`, 1:1, retry = fresh KT observation; **all grading server-side** [no client-side answer keys; attempts queue offline, grades on reconnect]; mastery = `masteryCache` projection [calibrationCache precedent], `MasteryUpdated` reserved for #14; Dexie **v5→v6** [live schema is v5, not v3 as the rule doc says] adds only the two cache tables — new event kinds are rows in `events`). **Next:** Wave 0 done → frontier = **#12 Inline-hint live guide** (Wave-1 prototype, highest-uncertainty centerpiece, unblocks #16) + **infra chain #9→#7→#8** (Wave 2, unblocks #13); #14 now unblocked (#6+#10) but sequenced in Wave 3. Run `/wayfinder 4 12` or `/wayfinder 4 9`; one decision ticket per session. → plan [`plans/active/2026-07-31-phase2-wayfinder/PLAN.md`](plans/active/2026-07-31-phase2-wayfinder/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-07-31-phase2-wayfinder/VERIFICATION.md) · research [`../research/external/open-notebook-findings.md`](../research/external/open-notebook-findings.md) · [`../research/external/code-sandbox-comparison.md`](../research/external/code-sandbox-comparison.md)
- **[APP] Progress Lab pace-indicators rework - three dated finishes + coordinate crosshair + clear end dates.** 🟡 Implemented and self-verified 2026-07-19; awaiting reviewer verification. Finish-aware domains, clipped trajectories, goal and dated flags, the GP connector, the mouse-only crosshair, the three-finish narrative, current-versus-historical wiring, and responsive browser coverage are complete. Current pace names the existing projection as the current trajectory; +N preserves capacity math and Replan parity; historical weeks keep the goal, Plan, and crosshair while withholding forecast and scenario data. The complete app suite passed 563 tests, repository typecheck and lint passed, the seeded E2E passed with zero console or page errors, all three viewport screenshots passed manual inspection, and protected capacity and Replan files remain byte-identical. **Option X** remains intact. **Next:** independent reviewer verification; keep this task active and unarchived until every phase is verified. → plan [`plans/active/2026-07-19-progress-lab-pace-indicators/PLAN.md`](plans/active/2026-07-19-progress-lab-pace-indicators/PLAN.md) · handoff [`HANDOFF.md`](plans/active/2026-07-19-progress-lab-pace-indicators/HANDOFF.md) · log [`VERIFICATION.md`](plans/active/2026-07-19-progress-lab-pace-indicators/VERIFICATION.md) · mocks [`active/progress-lab-pace-indicators/mocks/final.html`](active/progress-lab-pace-indicators/mocks/final.html)
- **[APP][RESEARCH][KT] Phase 2 Material library UX decision.** ✅ Resolved 2026-08-11 on live GitHub issue `#19`: dedicated library plus contextual add flows; full source types; list-first browse; ready-only generation; contentless planning materials; archive/restore; replace-keep-id with stale dependent content; linked usage; responsive multi-select pickers; and offline read-only behavior. Resolution is recorded on map `#4` and ticket `#19` is closed. Next Phase 2 frontier remains the generation-quality evaluation task and the roadmap-feedback UX decision.

- **[APP][RESEARCH][KT] Material Library prototype refinement — Q1–Q22 locked + prototype updated (wayfinder #33).** 🟡 2026-08-13: HITL grilling closed the remaining material-library interaction decisions (responsive card grid; readiness-led detail; primary + overflow card actions; ready-only assessment/practice pickers with a roadmap-planning boundary for contentless materials; persistent picker footer; inline replace keep-ID; permanent-source-removal delete warning; dedicated Practice-this config page; context-aware empty states). Throwaway prototype at `apps/app/src/prototype/material-library/` refined to match; decisions recorded on map `#4` and issue `#33`; implementation ticket `#36` unblocked. → plan [`plans/active/2026-08-13-material-library-ux-refinement/PLAN.md`](plans/active/2026-08-13-material-library-ux-refinement/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-08-13-material-library-ux-refinement/VERIFICATION.md)

- **[APP][RESEARCH][KT] Material Library and Attachment production slice (issue #36).** ✅ Implemented + live-verified 2026-08-13. First production vertical slice of the Phase 2 Material Library: migration `004` (owner-scoped `public.materials`, RLS, per-user indexes, content-version/replaced-at for stale detection) pushed to the dev Supabase project; typed dependency-injected `MaterialClient` with normalized typed errors (rule 22); `MaterialsProvider`; responsive card-grid library with search/status/archived filters and context-aware empty states; readiness-led detail (practice primary, retry, replace keep-ID inline, archive/restore, referenced-delete confirm, stale banner, usage from MaterialAdded events); source-card create flow with contentless manual support; reusable ready-only `MaterialPicker` (bottom sheet / side panel, persistent footer, disabled rows open detail); Practice-this config seam. Routes `/materials`, `/materials/new`, `/materials/:materialId`, `/materials/:materialId/practice`; nav entry added; dev prototype route removed. Verified: app typecheck + lint clean, 49 focused tests (incl. cross-user/account-switch client test), full suite 612/612 (`--pool=forks`), app build, and live E2E `e2e/material-library-live.spec.ts` desktop + 390×844 round trips (create → inspect → picker → delete) with zero page errors; account left clean. Code-review pass fixed the replace-kind bug and removed the fictional event-derived usage. Boundaries: ingestion execution = #37; generation/regenerate = #38; assessment pointer events = #38; no Dexie cache (server authoritative). → plan [`plans/active/2026-08-13-material-library-implementation/PLAN.md`](plans/active/2026-08-13-material-library-implementation/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-08-13-material-library-implementation/VERIFICATION.md)

- **[APP][RESEARCH][KT] Phase 2 generation-quality evaluation decision.** ✅ Resolved 2026-08-11 on map `#4`, live GitHub issue `#18`: offline groundedness, difficulty calibration, deduplication/diversity, and mastery-estimator bake-off are defined with explicit pipeline, gold-sample, attempt-count, and shared-fold gates. Evaluation stays out of the generation hot path; implementation remains execution work.
- **[APP][RESEARCH][KT] Phase 2 assessment review / feedback surface UI/UX decision.** ✅ Resolved 2026-08-11 on map `#4`, live GitHub issue `#20`: summary-led mistake review; responsive question navigator; progressive family-specific feedback; citations and warnings; per-question and full-assessment retry; preserved attempt history; honest partial states; and shared question-review primitives for Practice. Implementation remains execution work.
- **[APP] Finish-date projection is contradictory across surfaces (behind vs. early vs. late).** 🟡 Diagnosed 2026-07-18 (Cowork), plan written, not yet implemented. Root causes: (1) burn-up "behind" measures actual vs. **capacity-reserved** schedule (~60h) while the finish targets **material content** (~40h) — `progress.ts:250` vs `:221/309`; (2) Roadmap/Week show the **GP** projection while Replan silently uses **analytic** (`Replan.tsx:74-93`, `gpCurve: []`). Fix (user decisions): single **material-content baseline** for deficit + planned line, and single **owner** = `ProgressSnapshot.projection` (Replan consumes it; delete `computeFinish`); plus a conservative guard so GP can't claim early when the flat pace says late. 3 vertical-slice phases; latent all-sessions-bleed flagged as OQ-03. **Next:** native side commits the plan docs (Step 0), then Codex implements Phase 1. → plan [`plans/active/2026-07-18-projection-inconsistency/PLAN.md`](plans/active/2026-07-18-projection-inconsistency/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-07-18-projection-inconsistency/VERIFICATION.md) · diagnosis [`DIAGNOSIS.md`](plans/active/2026-07-18-projection-inconsistency/DIAGNOSIS.md)
- **[APP] Interactive Week burn-up chart modal.** ✅ Decision 01 selected the full Progress Lab workspace: chart ranges, model layers, pace scenarios, and a replanning entry point inside the click-open modal.
  The functional mocks were corrected against the live `BurnUpChart.tsx` and supplied screenshot so the default modal preserves the original scale, geometry, layers, card chrome, and Marginalia treatment.
  Decision 02 selected the always-on right rail so controls and chart feedback stay visible together.
  Decision 03 selected a whole-card hover and keyboard-focus cue that leaves the existing card quiet at rest.
  The modal now uses a viewport-fit, no-scroll layout: the chart flexes to remaining height, compact controls move below it, and short viewports receive denser spacing without hiding controls.
  A reported interaction bug was corrected: opener-only zoom styling no longer leaks into the modal, every actual dot is now a pointer and keyboard checkpoint with a responsive summary card, and the scenario action keeps bottom clearance through the short-height breakpoint.
  Decision 04 selected fixed range presets for Full plan, 30 days, and This week.
  A follow-up axis correction now gives every observed checkpoint an aligned X-axis mark: wide views label all June observations, compact long-range views keep labelled start and Today anchors with rust minor ticks, and This week labels every checkpoint.
  The Y-axis retains the complete `0m` to `9h 30m` cumulative-hour scale.
  Browser and screenshot review passed at 1440x900, 1024x600, and 390x844 with no X-label collisions or internal modal/control-rail overflow; the Today marker's pointer-event layering was also corrected so the final checkpoint remains clickable.
  The canonical implementation plan and verification log were committed in `845499b`.
  Phase 1 was verified and committed in `eeaee51`: reusable chart helpers, deterministic observed-date ticks, the semantic whole-card opener, 13 focused tests, clean app typecheck, and a live collision-free default-card screenshot are complete.
  Phase 2 was verified and committed in `a932df1`: the accessible body portal, fixed ranges, independent layer controls, checkpoint summaries, focus and dismissal behavior, and responsive Marginalia layout are complete.
  All measured regions report zero overflow at 1440x900, 1024x600, and 390x844, with no console or page errors.
  Phase 3 was verified and committed in `3998be6`: the capacity model is shared with Replan, pace increments are validated, current-week scenarios preserve exact finish parity, and historical mode stays inspection-only.
  Phase 4 was verified and committed in `f0cc209`: Week owns the complete current and historical modal flow, the authenticated seeded E2E passes, Replan prefill has exact finish parity, all required regions report zero overflow, all SVG labels remain in bounds, and the three required screenshots were manually inspected.
  Final verification passed all 555 app tests, app and repository typechecks, zero-warning app and repository lint, and the focused Playwright spec with no browser console or page errors.
  **Next:** no implementation work remains for this plan. -> plan [`plans/active/2026-07-18-week-progress-lab/PLAN.md`](plans/active/2026-07-18-week-progress-lab/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-07-18-week-progress-lab/VERIFICATION.md) · mock [`active/week-chart-modal/mocks/`](active/week-chart-modal/mocks/DECISIONS.md)
- **[APP][INFRA] Standard E2E "app-explore" base — reusable Playwright fixtures + flagship walkthrough.** ☐ Planned 2026-07-04 (Cowork), not yet implemented. Builds `e2e/support/` (auth + app-ready fixtures, `seedEvents`/`readEvents`, central selector registry) + one flagship `e2e/app-explore.spec.ts` driving the full journey (sign-in → onboarding/draft-roadmap → add materials → home → start session → log ad-hoc → open roadmaps → book session), so new tests are written on top instead of re-inlining boilerplate. Auth defaults to a hermetic throwaway Supabase user (live opt-in via `E2E_EXPLORE_MODE=live`); bans `waitForTimeout` (canonical `waitForAppReady` instead). Grounded 2026-07-04: `e2e/` has zero shared helpers; `userDbName` is byte-identical across 2 specs; `session-log.spec.ts` clicks a non-existent `'Sign in'` button (real label `'Continue'`) and swallows failures in `try/catch` — Phase 4 refactors it onto the base as adoption proof. 5 vertical-slice phases; migrating the other specs deferred (OQ-04). **Next:** native side commits the plan docs (Step 0), then Codex implements Phase 1. → [`plans/active/2026-07-04-e2e-explore-base/PLAN.md`](plans/active/2026-07-04-e2e-explore-base/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-07-04-e2e-explore-base/VERIFICATION.md)
- **[APP][INFRA] Dev seeder rebuild for the no-slot booking model (demo-ready).** ✅ Reviewer blocker fix implemented in `337976b`.
  Step 0 planning docs are already committed in `1532a5c`.
  Phase 1 replaced the legacy slot-packed active-roadmap seed with the no-slot active roadmap model: `RoadmapCreated{materialIds}`, separate `SessionBooked`, booking-linked `SessionLogged`, and 3-letter `selectedStudyDays`.
  Phase 2 added two past no-slot roadmaps: one completed Foundations of Machine Learning plan and one abandoned System Design Interview Prep plan.
  Past roadmaps carry `MaterialAdded`, `RoadmapCreated`, `SessionBooked`, and terminal events only.
  They intentionally carry no `SessionLogged` events.
  Dev-only scope (D-01); no production logic changes.
  Key finding remains OQ-01: burn-up `actual` and `totalMinutes` are global across all `SessionLogged`, so past-roadmap sessions stay out of this seed until progress is scoped.
  Verification: Phase 2 grep guard returned `2`, app typecheck passed, app lint exited 0 with only pre-existing warnings, and live Chromium smoke showed two `/roadmaps` history rows with one `abandoned` and one `completed`.
  Phase 3 tuned the dev seed to `PAST_SESSION_SKIP_PROBABILITY = 0.01` plus slower logged-session pace (`0.78 + rand() * 0.1` early, `0.62 + rand() * 0.1` after week 1).
  Final live Phase 3 evidence after sync-settled `__wipe()` / `__seed()` / reload: Home `4 DAYS EARLY`, Week burn-up chart visible, `/roadmaps` active hero `41%`, history exactly one `abandoned` plus one `completed`, and browser console errors `0`.
  Reviewer redo fixed the UTC-vs-local day mismatch in the dev seed: seed date keys, study-day matching, booking dates, and the today-unlogged rule now use the same local calendar-day model as Home's `format(new Date(), 'yyyy-MM-dd')`, while event timestamps stay ISO.
  Added deterministic app Vitest coverage for the `Asia/Kolkata` late-evening UTC boundary and a local study-day booking left unlogged.
  Redo verification passed: `grep -c "slots"` output `0`, terminal-event grep output `2`, app typecheck passed, app lint exited 0 with the same four pre-existing warnings, app tests passed `535/535`, progress tests passed `98/98`, and live Chromium repeated the Home/Week/Roadmaps checks with console errors `0`.
  Screenshots are attached under the active plan's `screenshots/` folder.
  **Next:** use the seed for the demo or archive the row after the demo.
  -> [`plans/active/2026-07-04-demo-seed-new-model/PLAN.md`](plans/active/2026-07-04-demo-seed-new-model/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-07-04-demo-seed-new-model/VERIFICATION.md) · scratchpad [`SCRATCHPAD.md`](plans/active/2026-07-04-demo-seed-new-model/SCRATCHPAD.md)
- **[APP] Roadmap calendar — `/roadmap` detail + `/roadmaps` history.** ✅ All 7 phases Cowork-verified 2026-06-26 (review by diff + inspection; test suites authored but not run — sandbox rollup arm64 dep block). Month calendar grid with status-colored session bubbles/dots (done/pending/skipped/unplanned), month nav + swipe, hover→modal / dots→day-sheet; new `RoadmapMarkedComplete/Abandoned` events; Edit deferred and Replan stubbed but infra-ready (Python-routed `replanRoadmap` → `POST /v1/roadmap/regenerate`). Visual contract locked (D-14); Playwright visual-walkthrough specs written only (D-15). **Progress:** Step-0 baseline + Phase 1 (`deriveSlotStatuses`) committed `c50ff53`; Phase 2 (read-only current-month calendar) committed `8019007`; Phases 3–4 (month nav + session/day modals) committed `3cb0df6`; Phase 5 (mobile dots/day sheet/swipe) committed `3967553`; Phase 6 (terminal events + history) committed `192cbef`; Phase 7 (Python-routed replan seam + `/replan` stub) committed `84abbd2`. **Review:** all 7 phases ✅ Cowork-verified vs acceptance criteria (per-phase findings in VERIFICATION.md); no changes requested. **Next:** run Vitest + Playwright in a `node>=20` env with deps reinstalled to confirm the authored tests pass green, then move this row to Done. Follow-ups filed: [`issue 018`](specs/issues/018-roadmap-calendar-mobile-swipe-vertical-guard.md) (Phase-5 swipe vertical-intent guard); [`issue 010`](specs/issues/010-replan-flow-with-three-options.md) updated (Python-routed seam now exists; added runtime-validation criterion for the regenerate response). → [`plans/active/2026-06-26-roadmap-calendar/`](plans/active/2026-06-26-roadmap-calendar/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-06-26-roadmap-calendar/VERIFICATION.md)
- **[APP] Roadmaps dashboard — multi-roadmap lifecycle + re-entrant onboarding.** 🟡 Phases 1–7 implemented; Phase 7 ready for Cowork review at `734dd32`. Turns `/roadmaps` into the section dashboard (active hero + one queued draft + history), makes `/roadmap` a detail under it, re-entrant onboarding for new roadmaps (returns to `/roadmaps`), lifecycle loop: one active per non-overlapping period (D-01), explicit Complete/Abandon (D-08), deadline-passed banner on Home+dashboard+calendar (D-09); edits update **in place** (D-07), sessions attribute by **date window** (D-06), one derived draft (D-03/D-12), and `/replan` now has preview-confirm in-place commit. **Review:** P1 lifecycle-identity `4631152` ✅ Verified; P2 date-window `37a0361` ✅ Verified; P3 re-entrant onboarding `0fc02ce` → redo `521cd6d` ✅ Verified; P4 dashboard `2cba6cf` ✅ Verified; P5 ended-banner `03a2537` ✅ Verified; P6 quick edits `c771f63` → redo `d544994` ✅ Verified; P7 preview-confirm `734dd32` awaiting review. P7 also fixed the cross-phase mapper risks: active materials are scoped by current roadmap slots, and `RoadmapEdited` pins match by stable roadmap identity after in-place replans. → [`plans/active/2026-06-26-roadmaps-dashboard/`](plans/active/2026-06-26-roadmaps-dashboard/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-06-26-roadmaps-dashboard/VERIFICATION.md) · handover [`2026-06-27`](handovers/2026-06-27-roadmaps-dashboard-review.md)
- **[APP] Roadmaps dashboard — post-ship bug fixes.** 🟡 Phases A–B implemented; awaiting review. **Phase A** fixed new-roadmap onboarding mode by preserving `?new=1`/router state across intra-wizard navigations and latching mode in `OnboardingGate` (`03f7386`). **Phase B** moves history detail to `/roadmap?roadmap=<createdAt>` with a read-only calendar and back link (`5d3cfcc`). **Phase C** layout polish deferred per Rohit for a later holistic UI pass. **Phase D** implemented 2026-06-27, pending native commit/review: Home/Week/progress/calibration now use lifecycle-aware `findActiveRoadmap` (active entry else null), abandoned/completed roadmaps stop driving UI up-next/progress, and calibration keeps all session history while clearing `nextContext` when no roadmap is active. Follow-ups fixed roadmap session modal overlay behavior and scoped `/roadmap` + `/roadmaps` progress to selected-roadmap slot coverage; focused Playwright regression passed. Verification passed under Node v22.17.1: Phase D Vitest filter (`mapEvents useProgress useCalibration Home Week`), modal Vitest filter (`SessionDetailModal`), roadmap progress Vitest filter (`RoadmapCalendar Roadmaps`), app typecheck, focused browser check, and repo lint (lint exits 0 with unrelated session-file warnings). → [`plans/active/2026-06-27-roadmaps-dashboard-fixes/`](plans/active/2026-06-27-roadmaps-dashboard-fixes/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-06-27-roadmaps-dashboard-fixes/VERIFICATION.md)
- **[APP] Material-session post-ship UI bug fixes.** ✅ Phases 1-5 reviewer-verified 2026-07-03 (implemented in `0268f20`, `3c8d869`, `256616b`; no changes requested). 🟡 Phase 6 implemented 2026-07-03 in `33a98c9` and awaiting review; Phase 7 implemented 2026-07-03 in `75f734f` and awaiting review; Phase 8 implemented 2026-07-03 in `f6313f8` and awaiting review.
  Phase 1 removed the duplicate `Edit & add` roadmap-hero link; Phase 2 centered shared booking sheets; Phase 3 added the compact empty-day DaySheet add-session path; Phase 4 added study-day tint, headers, legends, and onboarding booked-chip legibility; Phase 5 fixed burn-up planned baseline, chart axes/domain, y-axis density, and GP curves.
  **Review method (Phases 1-5):** diff-vs-plan inspection on all 3 commits plus live Playwright verification against the real running app using the documented test credentials (real login, real "Tests" roadmap) rather than trusting self-reports. Independently re-ran `pnpm --filter @study-tracker/app test` (523/523), `pnpm --filter @study-tracker/progress test` (98/98), app typecheck, and repo-wide lint (0 errors, same 4 pre-existing warnings) — all matched the implementer's self-report exactly. One disclosed, sensible deviation in Phase 5 (`buildMinuteTickValues` heuristic) — reviewed and accepted, see VERIFICATION.md.
  E2E cases for BUG-2/BUG-4 remain authored-not-executed as spec files (`SUPABASE_SERVICE_ROLE_KEY` unset here); assertions independently replicated live instead. No event-model, intelligence-math, or Python changes. 4d back-to-`/roadmaps` exit remains deferred (OQ-01).
  **Addendum - Phases 6-8:** that review surfaced 3 more issues, agreed to fix here. Phase 6 (BUG-7, DaySheet scroll-into-view) is implemented pending review: `DaySheet` now scrolls its root section into view on open, `RoadmapCalendar.test.tsx` covers the jsdom `scrollIntoView` call, app typecheck and the RoadmapCalendar test filter passed, and a real-app 390px browser check confirmed the sheet becomes fully visible. Phase 7 (BUG-8, onboarding bubble truncation) ships **Option C** (icon + duration, drop the redundant "Session" label), chosen against a real-CSS mock (`mocks/proposed/bug8-bubble-truncation.html`, D-10 ✅ Agreed). Phase 8 (BUG-6, the cold-start cloud-restore race - see below) is now implemented pending review: `SyncState.initialRestorePending` gates children centrally in `SyncProvider`, the already-hydrated fast path clears immediately, the slow path clears from `restoreFromCloud()` `finally`, and **D-09 (resolved 2026-07-03)** ships **Option C1 "Notebook mark"** with reduced-motion support. The safety timeout stays 8000ms but ships as a configurable `SyncProvider` prop (`initialRestoreSafetyTimeoutMs`, env-var-backed default `VITE_INITIAL_RESTORE_TIMEOUT_MS`) rather than a hardcoded literal, per Rohit's ask to make it "easily editable... so we can adjust it later as required." Phase 8 verification passed focused typecheck/tests plus a live fresh-profile deep-link re-check: route stayed on `/study/roadmaps`, never visited `/study/onboarding/1`, and the observed boot-screen duration was about 2808ms.
  **Root cause being fixed in Phase 8:** a pre-existing cold-start cloud-restore race can transiently bounce a brand-new browser profile through `/onboarding` before landing on `/home` when deep-linking straight to a protected route right after sign-in; reproduced 3/3 times, does not affect returning users' normal browsers, untouched by Phases 1-5's diffs.
  **Addendum - Phase 9 (feature, planned 2026-07-03, not yet implemented):** BUG report "roadmap calendar shows no upcoming sessions" → **Phase 9 FEAT / D-11** adds derived **suggested upcoming sessions**: re-run the engine's `generateBookings` over *remaining* material (`buildMaterialLedger`) from today→deadline (cap-and-spread), render as a distinct read-time `suggested` bubble on empty future study-days; click = accept → `SessionBooked`. Nothing persisted until accepted; active roadmap only. Grounded against `RoadmapCalendar`/`calendarModel`/`statusStyles`; acceptance criteria pre-filled in VERIFICATION.md.
  **Next:** reviewer-verify Phases 6, 7, and 8; implement Phase 9; optionally run the authored hermetic E2E specs on a machine with `SUPABASE_SERVICE_ROLE_KEY` set.
  → plan [`plans/active/2026-07-02-material-session-ui-bugs/PLAN.md`](plans/active/2026-07-02-material-session-ui-bugs/PLAN.md) · verification [`VERIFICATION.md`](plans/active/2026-07-02-material-session-ui-bugs/VERIFICATION.md) · scratchpad [`SCRATCHPAD.md`](plans/active/2026-07-02-material-session-ui-bugs/SCRATCHPAD.md) · mocks [`study-day-indicator.html`](plans/active/2026-07-02-material-session-ui-bugs/mocks/proposed/study-day-indicator.html), [`bug8-bubble-truncation.html`](plans/active/2026-07-02-material-session-ui-bugs/mocks/proposed/bug8-bubble-truncation.html), [`bug6-branded-loading.html`](plans/active/2026-07-02-material-session-ui-bugs/mocks/proposed/bug6-branded-loading.html)
- **[DISSERTATION] 3rd-review report — architecture/research/literature context-gathering.** ✅ First phase done 2026-07-03 (**corrected same day** — see below): comprehensive trace of the whole app (every UI page/route + every engine, with a per-capability TS-vs-Python live-path determination) cross-referenced against what `../research/` actually shipped into the product, and against the dissertation's final 48-entry bibliography. Surfaced several load-bearing findings for the report's architecture/limitations chapters: session-runtime events (`SessionStarted/Paused/Resumed/Abandoned`, timer-completed `SessionLogged`) never reach cloud sync (local-only, contradicts a design-intent code comment); the TS/Python "behavioral parity" claim is empirically false for `computeCalibration` specifically (checked-in fixture encodes Python's `enriched_shrink` override, not TS's plain output); the roadmap engine has two parallel systems and the Python-mirrored one + its `/v1/roadmap/regenerate` HTTP seam are fully built/tested but have zero live callers (now corroborated by `../plans/active/2026-06-30-material-session-decoupling/DECISIONS.md` D1/§5c — the packed-slot design was explicitly retired, not just abandoned); `/v1/progress` and `/v1/calibration/prompt-detail` are dead endpoints; `enriched_shrink`/dual-prior calibration *was* cleanly promoted from research, and (found on correction) the GP cold-start/non-crossing composite *also* was — `packages/progress/src/projectFinish.ts` promoted the validated `gp_plus_analytic` design one day after the research confirmed it; the one still-open, genuine research→app gap is the split-conformal GP-interval correction specifically (narrower than first scoped — an initial pass also flagged a "scheduling algorithm" gap that turned out to be a research question explicitly retired by product decision, not a gap); Pillar-B (KT-bench) has zero integration into the shipped app. **Second phase** (git-log-grounded evolution trace, 2026-05-01 → 2026-07-02, 7 eras / 304 commits) is doc `04-application-evolution-trace.md`, covering how the app reached this state, including "the major refactor" (era 6, material/session decoupling). **Third phase** (independent re-verification of doc 04, same day): 8 fresh agents fact-checked every specific claim in doc 04 against `git log`/`git show`, found and corrected a handful of small issues (an undocumented-but-internally-consistent commit-counting convention across 5 eras, one standalone wrong total, an unsupported "reviewer-verified" claim in era 3, a section-numbering bug, and two coda claims that went stale same-day from unrelated concurrent work) — doc 04 now carries a visible "Verification notice" documenting exactly what changed. The four findings were filed as detailed tracked issues: [`019`](../specs/issues/019-session-lifecycle-events-not-synced.md) (session-sync gap, AFK, highest priority), [`020`](../specs/issues/020-calibration-fixture-parity-claim-false.md) (fixture-parity test integrity, AFK), [`021`](../specs/issues/021-orphaned-python-roadmap-regenerate-seam.md) (dead roadmap/HTTP seam, HITL — delete vs. keep vs. wire up), [`022`](../specs/issues/022-promote-validated-research-findings-to-production.md) (promote the split-conformal GP-interval fix, HITL — narrowed and corrected same day). **Next:** use all four docs as source material when drafting the 3rd-review report's system-architecture, results, development-narrative, and limitations chapters (report drafting itself not yet started — task folder stays active). → docs: [`plans/active/2026-07-03 third-review-report-work/research/01-app-architecture-and-data-flow.md`](<plans/active/2026-07-03 third-review-report-work/research/01-app-architecture-and-data-flow.md>), [`02-research-to-app-mapping.md`](<plans/active/2026-07-03 third-review-report-work/research/02-research-to-app-mapping.md>), [`03-research-to-literature-mapping.md`](<plans/active/2026-07-03 third-review-report-work/research/03-research-to-literature-mapping.md>), [`04-application-evolution-trace.md`](<plans/active/2026-07-03 third-review-report-work/research/04-application-evolution-trace.md>)
- **[PILLAR-A] A6 Phase 6 — change-detection decision.** Probe → **robust null** (no candidate beats CUSUM/CSD). Open call to Rohit: write Phase 6 around the null, or ship calibration as the headline. → [`plans/active/2026-06-18-pillar-a-custom-calibration-detection/`](plans/active/2026-06-18-pillar-a-custom-calibration-detection/PLAN.md)
- **[APP] enriched_shrink production integration.** ✅ Cowork-verified. Immediate: record the Phase-0 dual-prior small-band caveat in the claims ledger. → [`plans/active/2026-06-20-enriched-shrink-production-integration/`](plans/active/2026-06-20-enriched-shrink-production-integration/PLAN.md)
- **[RESEARCH] Phase 5 — N=1 real-data validation.** Log own sessions → export → harness → face-validity overlay + case study (circularity guard).
- **[RESEARCH] Phase 6 — report wiring.** `make figs` → `\input` generated tables/figures into `main.tex`; provenance stamps; reproducibility gate.
- **[APP][RESEARCH] Material ↔ session decoupling redesign.** ✅ All 7 phases Cowork-verified 2026-07-02 (Phase 7 rework re-checked at `6d4cc89`). Redesign retires the prescriptive dated-slot packer (root cause of `/onboarding/3?new=1`) in favor of blank session bookings plus material selection at session start. **Phase 7 rework (2026-07-02):** fixed async capacity-lever hydration (`useLiveQuery` race), made the live replan finish capacity-aware (hours/day + study days + demonstrated throughput), applied `materialDurationOverrides` on read in both `mapEvents.ts`/`roadmapProgress.ts` material paths (+ preserved on re-apply), and fixed `RoadmapReplanned.weeks` (was hardcoded `0`). Reviewer re-check corroborated `tsc --noEmit` clean and `eslint` clean on touched files directly (this sandbox has no registry access to install `pnpm`/run `vitest` — implementer's 509-test green self-report not independently re-executed; logic verified by hand instead). One non-blocking follow-up filed: a shortened material's remaining-minutes ceiling in Replan can't be lengthened back toward its pre-shorten estimate in a later replan session (only drop/re-add resets it) — doesn't violate any acceptance criterion. **Doc hygiene:** corrected stale/mis-targeted `PLAN.md` phase-status lines (Phases 2/3/4/7) that had drifted from `VERIFICATION.md`'s per-phase verdicts, including a same-commit mis-edit that landed Phase 7's status update on Phase 3's line instead. **Phase 5/6 deviation fixes (2026-07-01):** booking editor/add sheets rebuilt to the `roadmap.html` mock — new `MaterialPickerSheet` radio-list (D21: "No material · pick at start" + per-material status rows), tappable material card, "Attach" link, Day `bk-link` (replacing the native `<select>`/date shortcut); D6 pace-first pre-session recommendation implemented in `sessionPlanning` (required-rate vs demonstrated pace, clamped to the D5 soft cap). **Next:** native side commits this review (Step 0 pattern) and runs the full `pnpm` test/E2E suite on a capable machine (Phase 7's 2 new Playwright specs are authored, not yet run anywhere); file the shorten-ceiling follow-up as an issue if wanted; in parallel capture real N=1 logs → run R6/G4 (OQ-04). → plan [`plans/active/2026-06-30-material-session-decoupling/PLAN.md`](plans/active/2026-06-30-material-session-decoupling/PLAN.md) · verification [`PLAN VERIFICATION.md`](plans/active/2026-06-30-material-session-decoupling/VERIFICATION.md) · scratchpad [`SCRATCHPAD.md`](plans/active/2026-06-30-material-session-decoupling/SCRATCHPAD.md) · mocks [`mocks/index.html`](plans/active/2026-06-30-material-session-decoupling/mocks/index.html) · decisions [`plans/active/2026-06-30-material-session-decoupling/DECISIONS.md`](plans/active/2026-06-30-material-session-decoupling/DECISIONS.md) · verification [`research-eta-model-selection/VERIFICATION.md`](plans/active/2026-06-30-research-eta-model-selection/VERIFICATION.md) · tracker [`research model-selection`](handovers/2026-06-30-research-model-selection-tracker.md) · ledger [`claims`](../research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md) · UI handover [`UI`](handovers/2026-06-30-ui-planning-handoff.md)

## Queued

- **[APP][RESEARCH][KT] Phase 2 implementation tickets.** ✅ Spec #32 was split into 17 dependency-ordered GitHub issues (#33–#49) on 2026-08-12. Three prototype issues (#33–#35) now gate the unresolved Material Library, Assessment Review, and Roadmap Feedback UI surfaces. **Next frontier:** #34, #35 (prototypes), then **#38 (generation)**; #36 (library) and #37 (ingestion) are implemented.

- **[APP] Roadmap calendar follow-ups** — [`issue 018`](specs/issues/018-roadmap-calendar-mobile-swipe-vertical-guard.md) mobile swipe vertical-intent guard (low-sev); [`issue 010`](specs/issues/010-replan-flow-with-three-options.md) build `/replan` UI on the verified Python-routed seam (gated on OQ-03 service deploy).
- **[APP] PWA install** (manifest + service worker) — issue 013.
- **[APP] Plausible analytics** (017, confirm/finish) + **Week streaming narrative** (011).
- **[PILLAR-A] Deferred OQs:** OQ-01 projection wiring (drive burn-up/ETA), OQ-03 Intelligence Service deploy + auth + CORS for production.
- **[DISSERTATION] Review 2** (intermediate results) — gated on research Phases 0–3 (done) → assemble.
- **[DISSERTATION] Review 3** (full comparison + demo + journal draft) — gated on Phases 4–6.
- **[DISSERTATION] Phase II** closed-loop demo — research Phase 7 built, revealed here.

## Done

- **[RESEARCH] Generation runtime settings for the model-neutral interface (wayfinder #53).** ✅ Resolved + closed 2026-08-22. Objective generation runs DeepSeek V4 Flash 0731 via OpenRouter with reasoning **off**; `written_grading`/`guide_hint`/`guide_reveal` default off until a #56-style probe re-test proves value on their prompt shapes (obligation rides with slices #41/#46, cross-referenced on those tickets). 30 s timeout kept as per-task config (`GENERATION_TIMEOUT_MS`), `maxOutputTokens` 4096, temperature pinned 0.3 with no `top_p`, local schema re-validation mandatory despite strict mode (endpoint drift measured), SDK `max_retries=0` + one app-level retry with Retry-After honored, new non-retryable `unsupported_request` error code, optional `reasoningTokens` telemetry field, provider-neutral `GENERATION_*` env knobs around the retained `OPENROUTER_API_KEY`. Contract changes flow to #54. → resolution [on #53](https://github.com/rings0fsaturn/study-planner/issues/53) · map line on [#4](https://github.com/rings0fsaturn/study-planner/issues/4)

- **[RESEARCH] Provider-neutral contract amendment (wayfinder #54).** ✅ Resolved + closed 2026-08-22. The approved Gemini-shaped Phase 2 provider pack is neutralized in place (`contracts/phase2/gemini/` -> `provider/`) behind the retained normalized boundary: OpenAI-style request envelope (`messages[]`, plain JSON-Schema `responseSchema`, sampling = temperature + maxOutputTokens only, `reasoningEffort` knob defaulting off, per-task integer `timeoutMs`), flattened response envelope (`content` + optional `refusal`, lowercase `finishReason` `stop|length|content_filter|refusal|error` + `nativeFinishReason` passthrough, optional `routedProvider` + `reasoningTokens`), new non-retryable `unsupported_request` error, `gemini_rubric` -> `llm_rubric` (zero graded events), six generation fixtures + manifest + contract tests regenerated from captured `raw.jsonl` DeepSeek shapes; `embedding-request.schema.json` stays Gemini-shaped as the embeddings fallback only. Spec #32 provider bullet amended (Gemini/Ollama -> DeepSeek/OpenRouter sole generation provider); map #4 Decisions line added and the provider-seam fog resolved. File edits graduate to slice #57. → resolution [on #54](https://github.com/rings0fsaturn/study-planner/issues/54) · slice [#57](https://github.com/rings0fsaturn/study-planner/issues/57) · map line on [#4](https://github.com/rings0fsaturn/study-planner/issues/4)

- **[RESEARCH] DeepSeek via OpenRouter provider mechanics (wayfinder #55).** ✅ Resolved 2026-08-22 from official OpenRouter/OpenAI sources and live catalog metadata. Exact slug, SDK base URL, structured JSON modes, reasoning continuation, finish/refusal/error handling, context, pricing, latency, and rate-limit assumptions are recorded; the research agent did not run authenticated inference, while the operator separately verified the key and account. → [`2026-08-22-deepseek-openrouter-provider-mechanics.md`](../research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md)

- **[RESEARCH] DeepSeek x Qwen-sidecar generation-quality probe (wayfinder #56).** ✅ Resolved + closed 2026-08-22. 395-call offline probe (`generation_probe.py`) on the 754-chunk dev corpus: full reasoning ladder (off..max) x seeded/sampled layers + json_object fallback + reasoning_details continuation. Strict-schema contract validity >= 90% on all tiers (endpoint enforcement varies: 4/383 drifted, one record with garbage chunkIds), citation validity 83-100%, zero near-dups, copy-through <= 6.7%, all six tiers accepted (no ceiling), reasoning tiers breach the 30 s budget (p95 up to 133 s) with no groundedness gain (gold-support 72-86% vs 72.4% at off), json_object fallback contract-invalid (returns `question`/`answer`/`chunkIds` shape), continuation accepted medium..max (flaky at low), S-vs-R delta negligible, total cost ~$0.17. **Decision (user): objective generation runs reasoning off.** Evidence + report at [`research/doc/deepseek-generation-probe/`](../research/doc/deepseek-generation-probe/); inputs handed to grilling ticket #53. New repo rule [`80-script-dry-run-before-full-runs`](../.agents/rules/80-script-dry-run-before-full-runs.agents.md). → plan [`plans/active/2026-08-22-deepseek-qwen-generation-probe/PLAN.md`](plans/active/2026-08-22-deepseek-qwen-generation-probe/PLAN.md) · log [`VERIFICATION.md`](plans/active/2026-08-22-deepseek-qwen-generation-probe/VERIFICATION.md)

- **[APP][INFRA][RESEARCH] Productionize worker/embedder runtime + wire sidecar query-embedder.** ✅ Implemented + live-verified 2026-08-21. `docker-compose.yml` `ingestion-worker` + `intelligence` now carry `EMBEDDING_PROVIDER=qwen-sidecar` (alias `sidecar`), `EMBEDDER_URL/RERANKER_URL=http://host.docker.internal:8200`, all `INGESTION_*` tuning, `extra_hosts`, `healthcheck`, `depends_on: healthy`; `docker-app --with-embedder` exports `HF_TOKEN` and gates on `/health`; `services/embedder` default `EMBEDDING_BATCH_SIZE=128`; `app/query_embedder.py` factory (`is_query=True`) powers `retrieval_probe.py --provider sidecar --hybrid` → **MRR 0.703 Recall@1 0.60/0.73/0.87 on 754/qwen-sidecar** (was 0.356 cross-space, gemini control still 0.356) + gated `POST /v1/retrieval/search` (owner check, `hybrid` via `query_text`, `topK 1..50`, `RerankerClient` optional). Live fixes: `intelligence` env (`SERVICE_ROLE`, embedder vars, `extra_hosts`), `qwen-sidecar` alias in `query_embedder.py/worker_main.py/probe`, `PGRST203` overload (`query_text:null` + `>=300` + dict `code` guard) and `test_retrieval.py` expectation. Service 286 passed (+5 pre-existing golden-fixture `afternoon != evening`), ruff clean, `db push --dry-run` `up to date`. → plan [`plans/archive/2026-08-20-productionize-worker-and-query-embedder/PLAN.md`](plans/archive/2026-08-20-productionize-worker-and-query-embedder/PLAN.md) · log [`VERIFICATION.md`](plans/archive/2026-08-20-productionize-worker-and-query-embedder/VERIFICATION.md) · handover [`handovers/2026-08-20-productionize-worker-live-docker-test-handover.md`](handovers/2026-08-20-productionize-worker-live-docker-test-handover.md) · live log [`handovers/archive/2026-08-20-productionize-worker-live-verification.md`](handovers/archive/2026-08-20-productionize-worker-live-verification.md)

- **[APP][RESEARCH][KT] Material Ingestion and Readiness (issue #37).** ✅ Implemented + live-verified 2026-08-14. Granular test-fix-review sweep complete (gates 0-11). Migrations 005-013 pushed and live-probed: atomic `ingestion_publish_ready` RPC, duplicate-enqueue guard, BEFORE UPDATE guard on server-owned columns (dev PATCH of chunk_count 403/42501), DB-atomic `retry_material_ingestion` (double-click returns the same in-flight job; live retry loop reached ready). Real bugs fixed: YouTube transcripts (v1 snippet objects), chunking infinite recursion on oversized tokens, trafilatura/PDF cleaning, embedding non-numeric/non-finite leaks, worker job/material/owner binding, silent vector-count mismatch, unrecorded failures being archived, stale extract re-extraction, FastAPI retry endpoint removed with app moved to the RPC. New unit suites: models/extractors/chunking/embeddings/queue/repository/worker/API + previewClient/ingestionSubscription/useMaterialLibrary/client-failure-matrix; PracticeThis readiness gate; file replacement disabled (no upload path); detail-page self-stopping poll. **Service 186 passed (+5 pre-existing golden-fixture baseline, untouched) · contracts 6/6 · app 668/668 · root typecheck/lint clean · builds green · live E2E 5 passed / 2 env-gated skips with attempt-level retry assertion and zero page/console errors.** Follow-ups: the PDF scenario now uses the real 572-page fixture (57253f8) and its post-throttle full-book validation is tracked in the ingestion-performance-baseline plan; Docker start on a Docker-enabled host remains an operator step. → plan [`plans/archive/2026-08-14-material-ingestion-readiness/PLAN.md`](plans/archive/2026-08-14-material-ingestion-readiness/PLAN.md) · log [`VERIFICATION.md`](plans/archive/2026-08-14-material-ingestion-readiness/VERIFICATION.md) · handover [`handovers/2026-08-14-material-ingestion-e2e-completion.md`](handovers/2026-08-14-material-ingestion-e2e-completion.md)

- **[APP][RESEARCH] Dockerized Qwen embedder + provider-abstract ingestion (issue #37 follow-up).** ✅ Implemented + verified 2026-08-16. `services/embedder/` now reproduces the frozen retrieval baseline: 768-dim MRL truncation (`EMBEDDING_DIMENSIONS`), L2 normalization, model prompts (`is_query`), fp32 — **parity gate passed** (r@1 0.70 / r@3 0.83 / r@5 0.90 / MRR 0.790 on the 788-chunk corpus, fresh GPU embeddings) at **4,297 chunks/min on the RX 9070 XT vs 80 CPU** (54x). Ingestion is now provider-pluggable: `EMBEDDING_PROVIDER=gemini|sidecar` in `worker_main.py`, new `SidecarEmbedder` client (16 tests), telemetry decoupled from `isinstance(GeminiEmbedder)`, TPM limiter disabled in sidecar mode. Mixing guard: `materials.embedding_provider` column (migration `017`, **pushed + live-probed 2026-08-16**; legacy rows `NULL`) written at embed start, terminal `validation_failed` on provider mismatch, `reembed_materials.py` operator script for wholesale re-embed. Service 248 passed (+5 pre-existing golden-fixture failures); ruff clean. → plan [`plans/archive/2026-08-16-dockerize-embed/PLAN.md`](plans/archive/2026-08-16-dockerize-embed/PLAN.md) · log [`VERIFICATION.md`](plans/archive/2026-08-16-dockerize-embed/VERIFICATION.md) · handover [`handovers/archive/2026-08-16-dockerize-embed-provider-abstraction.md`](handovers/archive/2026-08-16-dockerize-embed-provider-abstraction.md)

- **[APP][RESEARCH] Live sidecar embedding E2E — re-embed, batch tuning, 572-page ingestion (issue #37 close-out).** ✅ Implemented + live-verified 2026-08-17. New operator runner `services/intelligence/scripts/sidecar_e2e.py` (preflight / sweep / reembed / pdf-run / guard-probe) writes timestamped JSON + Markdown evidence under this plan's `evidence/`. **Live runs against the hosted dev project (sidecar worker):** batch-size sweep 9 configs (cold + 3 warm each) all zero-fail with MRR 0.789 (frozen baseline 0.788) — **recommended operating point `EMBEDDING_BATCH_SIZE=128` + HTTP batch 16 = 4,381 warm chunks/min**; small legacy re-embed (`07d62b7e-…` → `qwen-sidecar`, 0 NULL); canonical 572-page PDF ingestion (754 chunks, `ready`, `qwen-sidecar`, 0 NULL, 67 telemetry records); non-destructive mixing-guard probe (`validation_failed`, non-retryable; synthetic rows deleted; no Gemini called). Runner unit tests 16; service **264 passed / 5 pre-existing golden-fixture failures unchanged**; ruff clean. Live fixes during close-out: materials insert needed `client_id` (NOT NULL); the migration-005 enqueue trigger (not manual enqueue) drives file material ingest; bodiless storage DELETE must not carry Content-Type. → plan [`plans/archive/2026-08-17-sidecar-embed-live-e2e/PLAN.md`](plans/archive/2026-08-17-sidecar-embed-live-e2e/PLAN.md) · log [`VERIFICATION.md`](plans/archive/2026-08-17-sidecar-embed-live-e2e/VERIFICATION.md) · evidence [`evidence/`](plans/archive/2026-08-17-sidecar-embed-live-e2e/evidence/)

- **[APP][RESEARCH] Full corpus restore — wipe-then-re-ingest the frozen 572p probe corpus (issue #37 follow-up).** ✅ Implemented + live-verified 2026-08-19. Live probe confirmed the recurring wipe (owner `29288e28-…`: 17 materials / 799 chunks = 11 embedded / 788 NULL, frozen `80c8b138-…` `failed/NULL`); the new operator tool `corpus_restore.py` (`preflight`/`wipe`/`restore`, 9 unit tests, ruff clean) wiped that owner's library clean (owner-scoped D-02; pre-wipe snapshot + orphan storage cleanup) and re-ingested `e2e/pdf/sample-textbook-572page.pdf` at stable ID `80c8b138-…` through the trigger-driven sidecar pipeline (D-01, D-03 no Gemini). **End state: `ready / qwen-sidecar / 754 chunks / 754 embedded / 0 NULL / 768-dim / 67 telemetry`.** **Decision A (user):** the frozen 788-chunk metrics (dense 0.788 / hybrid 0.816 / rerank 0.858) were measured on the retired pre-C3 60-token overlap split; the current 30-token chunker (`chunking.py:3-6,18`) yields 754, accepted as the **new durable baseline** (dense r@1 0.60 / r@3 0.77 / MRR 0.706; hybrid r@1 0.60 / r@3 0.80 / MRR 0.720; rerank deferred). Live-found fixes: storage listing is POST-with-body (not GET) + orphan-folder cleanup; PostgREST halfvec returns as a serialized string (parsed in `_parse_vector`); restore idempotency path re-verifies + writes evidence. Deferred follow-ups: wire a sidecar query-embedder into `retrieval_probe.py` (currently Gemini-only, `retrieval_probe.py:53-72`); re-run rerank parity on 754 (needs in-process `sentence_transformers`). → plan [`plans/archive/2026-08-19-corpus-restore/PLAN.md`](plans/archive/2026-08-19-corpus-restore/PLAN.md) · log [`VERIFICATION.md`](plans/archive/2026-08-19-corpus-restore/VERIFICATION.md) · evidence [`evidence/`](plans/archive/2026-08-19-corpus-restore/evidence/)

- **[INFRA] Agent rules/skills refresh** — added project-local `work-journal` skill mirrors, fetch typed-error normalization rule mirrors, and architecture PNG artifact (`944ce56`). → [`../.agents/skills/work-journal/SKILL.md`](../.agents/skills/work-journal/SKILL.md) · [`../.agents/rules/22-fetch-error-normalization.agents.md`](../.agents/rules/22-fetch-error-normalization.agents.md)
- **[APP] Dev production-readiness** ✅ — auth (Supabase JWT, HS256 + ES256/JWKS) on all `/v1`, resilient calibration client (timeout/retry/typed errors), Dexie-persisted stale cache + ErrorBoundary, service hardening (request-id, logging, bounds, `/readiness`, rate-limit stub, healthcheck), one-command `pnpm dev:full`. All 5 phases Cowork-verified 2026-06-25 (Phase 2 fixed in `abbac65`). → [`plans/archive/2026-06-20-dev-production-readiness/`](plans/archive/2026-06-20-dev-production-readiness/PLAN.md)
- **[APP] Web app v1 core** — slices 1a–12, 14–16 shipped (auth, session log + per-user isolation, cloud sync/restore, 4-step onboarding, active sessions, URL/YouTube materials, ProgressEngine + pace calibration, replan flow, Google OAuth, marketing site, settings, password reset). → [`specs/issues/`](specs/issues/README.md)
- **[PILLAR-A] A-series rigour A0–A5** ✅ verified (`e1c6455`…`68f4a12`). Pace calibration was an honest null under rigour. → [`plans/active/2026-06-14-pillar-a-rigour.md`](plans/active/2026-06-14-pillar-a-rigour.md)
- **[PILLAR-A] A6 calibration** ✅ — `enriched_shrink` overturns the null (Holm-surviving held-out win); archetype layer not recommended. → [`plans/active/2026-06-18-pillar-a-custom-calibration-detection/`](plans/active/2026-06-18-pillar-a-custom-calibration-detection/PLAN.md)
- **[PILLAR-A] Change-detection probe → robust NULL** (no candidate dominates the CUSUM/CSD frontier). → [`../research/doc/2026-06-20-change-detection-literature-survey.md`](../research/doc/2026-06-20-change-detection-literature-survey.md) · [`archive/unified_detector_summary.md`](archive/unified_detector_summary.md)
- **[RESEARCH] Research tier Phases 0–4, 7** ✅. → [`../college/scope/research-tasklist.md`](../college/scope/research-tasklist.md)
- **[KT] Pillar-B KT-bench Phase 4** ✅ credibility-gated — 9 pyKT cells reportable (5 NIPS2020 + 4 ACcoding). → [`../research/doc/2026-06-14-kt-credibility-tracker.md`](../research/doc/2026-06-14-kt-credibility-tracker.md)
- **[DISSERTATION] 2nd-review status deck + submission bundle** ✅ (2026-06-27) — plain-language 7-slide deck, presenter note, and runnable web-app+service zip in `../college/mydeliverables/2nd-review/`. Deck corrected to code-truth (finish-date not calibration-driven = OQ-01; only calibration wired through the service = D-03). **Drift flagged:** working tree advanced mid-session (Roadmap calendar now built, `/replan` seam done + UI stub) → deck reconcile pending Rohit's call. → [`handovers/2026-06-27-2nd-review-deck-and-submission.md`](handovers/2026-06-27-2nd-review-deck-and-submission.md)
- **[DISSERTATION] Phase I delivered** ✅ — 1st Review report/deck; 1st & 2nd Guidance calls done. → [`../college/mydeliverables/`](../college/mydeliverables/)

## Reference

- **Full workstream detail** (markers, SHAs, findings, caveats, NEXT rollup): [`master-tracker-detail.md`](master-tracker-detail.md)
- **PRD:** [`specs/prd/PRD-study-tracker-web.md`](specs/prd/PRD-study-tracker-web.md) · **Issues:** [`specs/issues/README.md`](specs/issues/README.md)
- **Research KB:** [`../research/doc/`](../research/doc/) · **Research tasklist:** [`../college/scope/research-tasklist.md`](../college/scope/research-tasklist.md)
- **Pillar-A claims ledger:** [`../research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`](../research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md)
- **Dissertation:** [`../college/mydeliverables/`](../college/mydeliverables/) · **Deploy:** [`../DEPLOYMENT.md`](../DEPLOYMENT.md) · **Folder map:** [`README.md`](README.md)

## Gotchas

- **E2E tests are written but NOT run** (environment constraint — see [`../AGENTS.md`](../AGENTS.md)).
- **pnpm builds against the public npm registry by default:** hosts that block `registry.npmjs.org` can pass `COREPACK_NPM_REGISTRY` as an operator override (see [`../.agents/rules/50-pnpm-build-registry.agents.md`](../.agents/rules/50-pnpm-build-registry.agents.md)).
- **LaTeX** builds via TinyTeX on PATH ([`../.agents/rules/60-latex-report-build.agents.md`](../.agents/rules/60-latex-report-build.agents.md)).
- **Dexie schema changes must version-up** ([`../.agents/rules/31-dexie-schema-migrations.agents.md`](../.agents/rules/31-dexie-schema-migrations.agents.md)).
- **React Router** `basename="/study"` — never include `/study` in `to` ([`../.agents/rules/12-react-router-basename.agents.md`](../.agents/rules/12-react-router-basename.agents.md)).
- **A6 calibration loose ends:** OQ-03 ledger caveat not yet added; restore the pre-registration stop-gate before any Phase 6 dataset change.
- **Git in the Cowork sandbox bricks on lock files** — Cowork never runs mutating git; the native side commits. Never gitignore `.work/`; never `git clean -fdx` at the repo root.
- **Windows toolchain (2026-08-08)** — bare `pnpm` shim corrupted on this host (`AppData\Local\pnpm` → missing `pnpm-exe\10.33.2\pnpm`); use `C:\Users\user\AppData\Roaming\npm\pnpm.cmd`. `corepack` not on PATH and PowerShell exec policy blocks `.ps1` shims (`npx.ps1`). `./full-app` + `scripts/full_app.py` are POSIX-only (`lsof`/`ps`/`os.getpgid`/`os.killpg`) — won't run on Windows.
- **Python / `uv` in WSL but absent in native Windows** (2026-08-08 correction) — in the WSL bash shell `python3` (pyenv 3.13), `uv 0.11.7` and `./.venv` (from `uv sync` at repo root) are present, so `pnpm dev:intelligence`/`uv run pytest` CAN run here; the earlier "absent on this host" note was true only for native Windows cmd/PowerShell. Still POSIX-only for `./full-app`. `services/intelligence/.env` exists (copy `.env.example` if missing).
- **Launcher-script CRLF breaks `./full-app` (2026-08-08, RESOLVED in `3d4589a`)** — repo-root `.gitattributes` pins `full-app`, `scripts/full_app.py`, `scripts/dev-intelligence.mjs`, `*.sh` to `eol=lf`; the POSIX launchers can no longer get CRLF re-introduced. Whole-tree LF renormalize remains a separate task; most working-tree ` M` noise is that autocrlf fallout — don't bulk-commit it.
- **WSL vitest threads pool ignores mid-run `process.env.TZ` (2026-08-08)** — 2 TZ-sensitive tests (`apps/app/src/dev/seedTestData.test.ts`) fail under the default threads pool on WSL Linux (expected date is off-by-one vs UTC); all 563 pass with `pnpm --filter @study-tracker/app exec vitest run --pool=forks`. Pre-existing (baseline was green on Windows-installed node_modules); not caused by the launcher fix. Fixing the tests or flipping the pool is a follow-up.
- **`pnpm install` EACCES-prunes on Windows** — can leave dangling `.pnpm` dirs (orphan `vitest@4.1.5` broke all 62 app test files). Wipe `node_modules` root + per-workspace and reinstall to recover; see `plans/active/2026-08-08-prototype-wf17-build-test-fix/`.
- **Node ≥25 experimental webstorage shadows jsdom's `localStorage` in vitest** — `globalThis.localStorage` becomes an empty `Object` (no `Storage` API), breaking `vi.spyOn(localStorage, 'getItem')`. Guard in `apps/app/src/test/setup.ts` installs an in-memory `Storage` when `localStorage.getItem` isn't a function (portable); a host-only alternative is `NODE_OPTIONS=--no-experimental-webstorage`.

        ```
      </file>
</files>
</slice>

<slice name="provider-mechanics">
`research/doc/2026-08-22-deepseek-openrouter-provider-mechanics.md` (#55) -
the OpenRouter/OpenAI SDK mechanics that constrain the adapter side of #38.
<files>
2026-08-22-deepseek-openrouter-provider-mechanics.md


      <file path="">
        ```md
        # DeepSeek V4 Flash 0731 via OpenRouter - Provider Mechanics

- Date: 2026-08-22
- Ticket: `rings0fsaturn/study-planner#55`
- Scope: OpenRouter Chat Completions with the OpenAI Python SDK
- Model slug: `deepseek/deepseek-v4-flash-0731`
- Evidence: official OpenRouter documentation, official OpenAI Python SDK source, and the unauthenticated live OpenRouter model catalog and model page
- Live inference status: not run. The operator environment did not expose an OpenRouter key, so no prompt or inference response was sent.

## Executive Findings

1. The slug is currently live in the OpenRouter catalog. It is a text-in/text-out model with `response_format`, `structured_outputs`, `reasoning`, `reasoning_effort`, tools, and `include_reasoning` listed as supported parameters.
2. Use the OpenAI Python client with `base_url="https://openrouter.ai/api/v1"` and the OpenRouter key as `api_key`. Pass OpenRouter-only request fields through `extra_body`; the official OpenRouter Python examples use this pattern for reasoning.
3. Prefer strict `json_schema` for assessment generation. Use `json_object` only as a compatibility fallback, and validate the resulting object locally because JSON mode does not enforce a schema.
4. Provider support is endpoint-specific. Use `provider: {"require_parameters": true}` when strict structured output is a requirement; otherwise routing may select an endpoint that ignores or translates a parameter.
5. Reasoning is output-token usage and is billed. Preserve `message.reasoning_details` exactly when replaying Chat Completions history. The live catalog advertises reasoning support, but the exact interaction between reasoning and strict JSON must be confirmed by the quality probe in ticket #56.
6. Do not set a single permanent latency, price, provider count, or effective context limit from today's model page. OpenRouter routes among providers and the live catalog and page already show different aggregate and endpoint-level values.

## Exact Model And Live Catalog

The live request was:

```text
GET https://openrouter.ai/api/v1/models
```

The selected record was sanitized to remove no user or credential data:

```json
{
  "id": "deepseek/deepseek-v4-flash-0731",
  "name": "DeepSeek: DeepSeek V4 Flash 0731",
  "context_length": 1310720,
  "architecture": {"input_modalities": ["text"], "output_modalities": ["text"]},
  "pricing": {
    "prompt": "0.00000008",
    "completion": "0.00000018",
    "input_cache_read": "0.000000016"
  },
  "top_provider": {
    "context_length": 1048576,
    "max_completion_tokens": 384000,
    "is_moderated": false
  },
  "supported_parameters": [
    "include_reasoning", "reasoning", "reasoning_effort", "response_format",
    "structured_outputs", "max_tokens", "tools", "tool_choice", "temperature"
  ]
}
```

The values above are a point-in-time catalog observation. The model page currently describes the model as released 2026-07-31, with 13B active parameters out of 284B total, and shows provider-specific latency, throughput, uptime, and pricing. Its aggregate page values are not the same as every endpoint's values. The effective request limit is the selected endpoint's limit, not necessarily the top-level `context_length`.

Sources:

- [OpenRouter model catalog API](https://openrouter.ai/api/v1/models)
- [OpenRouter model page](https://openrouter.ai/deepseek/deepseek-v4-flash-0731)
- [OpenRouter API overview, model routing](https://openrouter.ai/docs/api/reference/overview)

## OpenAI Python SDK Configuration

The supported shape is:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="<from operator environment>",
)
```

`base_url` is a constructor argument in the official Python SDK. The SDK appends a trailing slash and resolves relative resource paths against it, so the `/v1` suffix belongs in the configured base URL. The SDK also accepts `OPENAI_BASE_URL` and `OPENAI_API_KEY` as its standard environment fallbacks. OpenRouter's docs show the OpenRouter key passed explicitly and use `extra_body={"reasoning": ...}` for Chat Completions.

OpenRouter fields that are not part of the OpenAI SDK's generated request type should be sent with `extra_body`, for example:

```python
response = client.chat.completions.create(
    model="deepseek/deepseek-v4-flash-0731",
    messages=[{"role": "user", "content": "..."}],
    extra_body={"reasoning": {"enabled": True}},
)
```

The SDK's built-in transport retries are relevant but not sufficient as the application contract: the current source retries 408, 409, 429, and 5xx responses, honors `retry-after-ms` and `Retry-After` when reasonable, and raises `RateLimitError` after exhaustion. Set `max_retries` deliberately so this does not multiply an application retry loop.

Sources:

- [OpenRouter reasoning guide, Python OpenAI SDK example](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)
- [OpenAI Python `_client.py`](https://github.com/openai/openai-python/blob/main/src/openai/_client.py)
- [OpenAI Python `_base_client.py`](https://github.com/openai/openai-python/blob/main/src/openai/_base_client.py)
- [OpenAI Python exceptions](https://github.com/openai/openai-python/blob/main/src/openai/_exceptions.py)
- [OpenAI Python README, HTTP client and base URL](https://github.com/openai/openai-python/blob/main/README.md)

## Structured Output Modes

### Strict JSON Schema

OpenRouter accepts the Chat Completions form:

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "assessment_questions",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {"questions": {"type": "array"}},
        "required": ["questions"],
        "additionalProperties": false
      }
    }
  }
}
```

OpenRouter documents strict mode as schema enforcement, but explicitly warns that enforcement varies by endpoint. Some providers enforce natively; others translate the schema or treat it as a strong hint. `require_parameters: true` is therefore required when the application cannot accept a provider that ignores or weakens `response_format`.

OpenAI's Structured Outputs documentation makes the same distinction: `json_schema` provides schema adherence on compatible models, while a refusal or an incomplete generation can still produce a result that is not schema-shaped. The application must check the refusal and finish state before parsing.

### JSON Object Mode

```json
{"response_format": {"type": "json_object"}}
```

This requests valid JSON but does not enforce keys, types, enums, or required fields. The prompt must also explicitly tell the model to produce JSON. Use this only as a deliberately weaker fallback, followed by JSON parsing and application-schema validation.

The DeepSeek catalog advertises both `response_format` and `structured_outputs`. This is catalog capability evidence, not proof that every routed provider handles every schema equally. Ticket #56 must exercise the exact assessment schema through the selected routing policy.

Sources:

- [OpenRouter Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [OpenRouter API overview, response format](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter provider selection and `require_parameters`](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

## Reasoning And Continuation

OpenRouter's normalized request is:

```json
{
  "reasoning": {
    "enabled": true,
    "effort": "medium",
    "exclude": false
  }
}
```

`effort` and `max_tokens` are alternative controls, not a pair that should be sent blindly. `exclude: true` keeps reasoning internal and removes it from the returned message. Reasoning tokens count as completion/output tokens for billing. The catalog also lists the legacy `include_reasoning` field; use the unified `reasoning` object for new code.

For Chat Completions, the sanitized continuation shape is:

```json
{
  "role": "assistant",
  "content": "<assistant content>",
  "reasoning_details": [
    {
      "type": "reasoning.summary",
      "summary": "<sanitized summary>",
      "id": "<opaque id>",
      "format": "<provider format>",
      "index": 0
    }
  ]
}
```

On a follow-up request, pass the complete `reasoning_details` array back unchanged. Do not reorder, edit, summarize, or selectively drop blocks. OpenRouter documents this as necessary for reasoning continuity, especially around tool calls. In streaming responses the details occur in `choices[].delta.reasoning_details`; in non-streaming responses they occur in `choices[].message.reasoning_details`.

There was no authenticated live inference probe in this ticket, so the exact DeepSeek response detail types and whether a particular provider emits them remain UNCONFIRMED. The #56 harness must record presence and shape without persisting reasoning text or private prompts.

Source: [OpenRouter Reasoning Tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)

## Finish, Refusal, Safety, And Parsing

OpenRouter normalizes Chat Completions `finish_reason` to `tool_calls`, `stop`, `length`, `content_filter`, or `error`, while retaining the provider value in `native_finish_reason`. A successful response can therefore still require application handling when it ends with `length`, `content_filter`, or `error`.

The documented normalized completion shape is:

```json
{
  "choices": [{
    "finish_reason": "stop",
    "native_finish_reason": "<provider value or null>",
    "message": {"role": "assistant", "content": "<sanitized content>"}
  }],
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0,
    "completion_tokens_details": {"reasoning_tokens": 0}
  }
}
```

OpenAI documents `message.refusal` as the explicit refusal branch for structured outputs. A refusal is not required to match the supplied schema. For this DeepSeek route, treat `message.refusal`, null content, `content_filter`, `error`, and `length` as non-success outcomes until the #56 live probe confirms the provider's actual behavior. Do not attempt to parse a refusal or truncated JSON as the assessment object.

OpenRouter also distinguishes pre-stream HTTP failures from mid-stream failures. After HTTP 200 and partial SSE output, failover is no longer possible; the stream terminates with an in-band error event and `finish_reason: "error"`.

Sources:

- [OpenRouter API overview, response and finish reasons](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter errors and debugging](https://openrouter.ai/docs/api/reference/errors-and-debugging)
- [OpenAI Structured Outputs, refusals and incomplete responses](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Python ChatCompletion message type](https://github.com/openai/openai-python/blob/main/src/openai/types/chat/chat_completion_message.py)

## HTTP Errors, 429, And Retry Metadata

The standard pre-stream error envelope is:

```json
{
  "error": {
    "code": 429,
    "message": "<sanitized message>",
    "metadata": {
      "error_type": "rate_limit_exceeded",
      "provider_code": "<optional provider code>"
    }
  }
}
```

OpenRouter documents 400, 401, 402, 403, 408, 429, 502, and 503 as relevant API errors. A 429 can be an OpenRouter platform limit, DDoS protection, or an upstream provider limit. On platform rate limits, the error may include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. When all attempted providers provide a retry hint, `Retry-After` may also be present. Honor `Retry-After` when present; otherwise use bounded exponential backoff with jitter and a cap.

The OpenAI Python SDK retries 429 and 5xx responses by default and parses `retry-after-ms`, `Retry-After` seconds, and HTTP-date forms. Its current implementation accepts a server delay up to 60 seconds before falling back to exponential backoff. Application code should still preserve the metadata and avoid retrying non-transient 400, 401, 403, 402, and model-not-found errors.

For `stream: true`, an error after the first bytes is not a new HTTP 429. It is an SSE event with a top-level error and a choice whose `finish_reason` is `error`. The caller must treat the generated result as incomplete and must not transparently replay it as if no output had been delivered.

Sources:

- [OpenRouter limits and rate limits](https://openrouter.ai/docs/api/reference/limits)
- [OpenRouter errors and debugging](https://openrouter.ai/docs/api/reference/errors-and-debugging)
- [OpenAI Python retry implementation](https://github.com/openai/openai-python/blob/main/src/openai/_base_client.py)
- [OpenAI Python exception hierarchy](https://github.com/openai/openai-python/blob/main/src/openai/_exceptions.py)

## Context, Latency, Pricing, And Rate Limits

| Concern | Verified observation or rule | Implementation implication |
|---|---|---|
| Context | Catalog `context_length`: 1,310,720; current top provider: 1,048,576; top provider `max_completion_tokens`: 384,000 | Budget against the selected endpoint and reserve output/reasoning space. Do not hard-code the aggregate value as the usable request limit. |
| Input/output | Text only in the live catalog | Do not assume image, audio, or PDF input support for this slug. |
| Price | Catalog snapshot: $0.08/M prompt, $0.18/M completion, $0.016/M cached input; model page shows provider-specific prices and current aggregate values | Record usage and model/provider identifiers from responses. Treat cost estimates as dynamic. Reasoning increases completion-token cost. |
| Latency | Model page reports provider-specific P50 latency and throughput, with materially different values by provider | Use measured p50/p95 from #56, not a documentation or page headline, for the 30-second generation decision. |
| Platform rate limits | OpenRouter's documented free limits apply to model IDs ending `:free`: 20 RPM and 50 RPD below $10 lifetime credits, or 20 RPM and 1,000 RPD after that threshold | The exact paid slug is not a `:free` variant. Still handle upstream 429s, DDoS protection, and provider capacity errors. No fixed paid-model RPM guarantee was established. |
| Fallback | OpenRouter can try other providers after 5xx or rate limiting if routing preferences allow | Keep fallbacks enabled unless endpoint capability or privacy constraints require pinning. Use `require_parameters` for strict JSON. |

Sources:

- [Live OpenRouter catalog](https://openrouter.ai/api/v1/models)
- [Live OpenRouter model page](https://openrouter.ai/deepseek/deepseek-v4-flash-0731)
- [OpenRouter limits](https://openrouter.ai/docs/api/reference/limits)
- [OpenRouter API overview](https://openrouter.ai/docs/api/reference/overview)

## Ticket Implications

### #54 - Amend Phase 2 contracts

The contract should become provider-neutral and model-independent. It should carry the parsed assessment result plus explicit outcomes for refusal, truncation, content filtering, provider error, and retry exhaustion. Keep OpenRouter request details behind the provider adapter. Include usage counts, optional reasoning-token counts, normalized `finish_reason`, and opaque provider metadata only where the public contract needs it. Do not expose an OpenAI SDK object or raw reasoning blocks as the application domain object.

Use strict `json_schema` as the primary generation mode and make `json_object` a named fallback with local validation. Require provider capability filtering when strictness is mandatory.

### #56 - DeepSeek and Qwen generation-quality probe

Run the same grounded inputs with reasoning enabled and disabled. Record schema validity, refusal/truncation/content-filter outcomes, citation validity, groundedness, latency p50/p95, prompt/completion/reasoning token counts, and observed cost. Run with the exact slug and record the routed provider and model from the response, without recording prompts, answer text, reasoning text, or hidden evaluation content.

The probe must test strict schema plus reasoning together, strict schema without reasoning, and JSON-object fallback. It must verify that a continuation containing untouched `reasoning_details` is accepted. Start with a conservative output budget that leaves room for reasoning; a 30-second timeout remains an assumption to validate rather than a provider guarantee.

### #53 - Decide generation runtime settings

Do not resolve the default from catalog price or model-page latency alone. The decision should use #56's quality and measured latency data. A likely safe baseline is strict schema, `require_parameters: true`, bounded output tokens, explicit timeout, SDK retries disabled or coordinated with one application retry layer, and reasoning enabled only if the quality gain justifies its output-token cost and latency. The exact effort level remains open until the probe.

## Verification Record

- `curl`/Python catalog probe: passed; exact slug found and sanitized capability metadata recorded above.
- Model-page fetch: passed; page and provider sections inspected.
- Official documentation fetches: passed for OpenRouter API overview, structured outputs, reasoning, limits, errors, and provider selection.
- Official SDK source fetches: passed for `_client.py`, `_base_client.py`, `_exceptions.py`, and ChatCompletion message types.
- Authenticated inference probe: not run because no OpenRouter key was available in the operator environment.
- Repository production tests: not run; no production code was modified.
- Worktree note: pre-existing `docker-compose.yml` modification and `.work/active/tracker-19-aug/` were left untouched.

        ```
      </file>
</files>
</slice>

<slice name="generation-probe-report">
`research/doc/deepseek-generation-probe/report.md` (#56) - measured quality,
latency, and reasoning evidence behind the locked runtime settings.
<files>
report.md


      <file path="">
        ```md
        # DeepSeek V4 Flash 0731 x Qwen-sidecar generation-quality probe

- Model: `deepseek/deepseek-v4-flash-0731` · Material: `80c8b138-b544-4095-8dc0-1c390ac70da2`
- Generated: 2026-08-22T05:31:53Z · Seed: 20260822

> Note: in `json_object` mode (arm C) DeepSeek returns its own shape (`question`/`options`/`answer`/`chunkIds`) instead of the requested contract (`stem`/`correctIndex`/`difficulty`/`skillTags`/`citations`), so contract-level metrics for `R:json` are empty by construction.

## Validity per tier

| group | n | schema-valid % | citation-valid % | gold-support % | outcomes |
|---|---|---|---|---|---|
| R:high | 31 | 96.8% | 83.3% | n/a | {'ok': 31} |
| R:json | 30 | 0.0% | 25.9% | n/a | {'ok': 27, 'malformed_json': 1, 'truncated': 2} |
| R:low | 31 | 96.8% | 86.7% | n/a | {'ok': 30, 'provider_error': 1} |
| R:max | 31 | 96.8% | 93.3% | n/a | {'ok': 31} |
| R:medium | 31 | 93.5% | 96.5% | n/a | {'ok': 30, 'provider_error': 1} |
| R:off | 30 | 100.0% | 86.7% | n/a | {'ok': 30} |
| R:xhigh | 31 | 96.8% | 93.3% | n/a | {'ok': 31} |
| S:high | 30 | 96.7% | 93.1% | 86.2% | {'ok': 29, 'malformed_json': 1} |
| S:low | 30 | 90.0% | 85.2% | 77.8% | {'ok': 27, 'malformed_json': 1, 'provider_error': 1, 'truncated': 1} |
| S:max | 30 | 96.7% | 89.7% | 75.9% | {'ok': 29, 'provider_error': 1} |
| S:medium | 30 | 96.7% | 86.2% | 72.4% | {'ok': 29, 'provider_error': 1} |
| S:off | 30 | 96.7% | 93.1% | 72.4% | {'ok': 29, 'provider_error': 1} |
| S:xhigh | 30 | 100.0% | 100.0% | 83.3% | {'ok': 30} |

## Grounding and craft

| group | copy-through % | distractor cos | near-dup % | pos hist | vocab |
|---|---|---|---|---|---|
| R:high | 0.0% | 0.394 | 0.0% | {'0': 6, '1': 14, '2': 6, '3': 3} | 55 |
| R:json | 0.0% | n/a | 0.0% | {'0': 0, '1': 0, '2': 1, '3': 0} | 0 |
| R:low | 0.0% | 0.423 | 0.0% | {'0': 9, '1': 15, '2': 5, '3': 0} | 58 |
| R:max | 0.0% | 0.405 | 0.0% | {'0': 16, '1': 10, '2': 3, '3': 1} | 68 |
| R:medium | 0.0% | 0.437 | 0.0% | {'0': 13, '1': 11, '2': 4, '3': 1} | 59 |
| R:off | 6.7% | 0.443 | 0.0% | {'0': 14, '1': 10, '2': 5, '3': 0} | 55 |
| R:xhigh | 3.3% | 0.407 | 0.0% | {'0': 10, '1': 14, '2': 5, '3': 1} | 62 |
| S:high | 0.0% | 0.393 | 0.0% | {'0': 16, '1': 11, '2': 0, '3': 1} | 57 |
| S:low | 3.7% | 0.407 | 0.0% | {'0': 14, '1': 12, '2': 1, '3': 0} | 59 |
| S:max | 3.5% | 0.423 | 0.0% | {'0': 21, '1': 6, '2': 1, '3': 0} | 62 |
| S:medium | 0.0% | 0.394 | 0.0% | {'0': 12, '1': 13, '2': 3, '3': 0} | 59 |
| S:off | 3.5% | 0.448 | 0.0% | {'0': 18, '1': 8, '2': 2, '3': 1} | 59 |
| S:xhigh | 3.3% | 0.403 | 0.0% | {'0': 17, '1': 10, '2': 3, '3': 0} | 65 |

## Difficulty distribution (self-assessed)

| group | band counts |
|---|---|
| R:high | {'1': 6, '2': 10, '3': 5, '4': 4, '5': 4} |
| R:json | {} |
| R:low | {'1': 6, '2': 8, '3': 8, '4': 7} |
| R:max | {'1': 5, '2': 13, '3': 5, '4': 5, '5': 2} |
| R:medium | {'1': 5, '2': 13, '3': 5, '4': 4, '5': 2} |
| R:off | {'1': 2, '2': 14, '3': 8, '4': 5} |
| R:xhigh | {'1': 6, '2': 10, '3': 7, '4': 4, '5': 3} |
| S:high | {'3': 27} |
| S:low | {'2': 2, '3': 25} |
| S:max | {'2': 2, '3': 26} |
| S:medium | {'3': 27} |
| S:off | {'3': 29} |
| S:xhigh | {'2': 1, '3': 29} |

## Latency and economics

| group | p50 ms | p95 ms | >30 s | prompt | completion | reasoning | r/share | cost $ |
|---|---|---|---|---|---|---|---|---|---|
| R:high | 9849.7 | 102308.9 | 5 | 13914 | 27250 | 25589 | 0.939 | 0.006018 |
| R:json | 11946.7 | 184328.9 | 3 | 11263 | 32687 | 0 | 0.0 | 0.006785 |
| R:low | 14581.8 | 100540.9 | 10 | 13751 | 38455 | 38911 | 1.0119 | 0.008022 |
| R:max | 6619.3 | 57129.5 | 5 | 18577 | 13217 | 7198 | 0.5446 | 0.003865 |
| R:medium | 11441.9 | 40024.9 | 3 | 14348 | 25520 | 22314 | 0.8744 | 0.005741 |
| R:off | 4830.9 | 20754.6 | 0 | 13751 | 4947 | 0 | 0.0 | 0.001991 |
| R:xhigh | 6102.2 | 59455.9 | 4 | 14912 | 22969 | 20250 | 0.8816 | 0.005327 |
| S:high | 12558.1 | 30573.0 | 3 | 56272 | 34122 | 30321 | 0.8886 | 0.010644 |
| S:low | 16464.5 | 133647.9 | 9 | 57180 | 49212 | 38550 | 0.7833 | 0.013433 |
| S:max | 11756.8 | 106190.3 | 5 | 59106 | 29608 | 25498 | 0.8612 | 0.010058 |
| S:medium | 11506.0 | 40895.8 | 5 | 57552 | 30861 | 27437 | 0.8891 | 0.010159 |
| S:off | 3973.4 | 10547.0 | 0 | 57564 | 5580 | 0 | 0.0 | 0.00561 |
| S:xhigh | 15033.9 | 41537.2 | 6 | 56430 | 38176 | 35342 | 0.9258 | 0.011386 |

## Continuation acceptance (K)

| tier | accepted | latency ms | finish |
|---|---|---|---|
| high | True | 30925.0 | stop |
| low | False | 32845.6 | error |
| max | True | 57129.5 | stop |
| medium | True | 20803.1 | stop |
| xhigh | True | 59909.8 | stop |

## S vs R delta (sidecar handoff cost)

| metric | S (retrieval-driven) | R (sampled) |
|---|---|---|
| schema_valid | 0.9611333333333334 | 0.9677166666666667 |
| copy_through | 0.023216666666666667 | 0.016666666666666666 |
| near_dup_rate | 0.0 | 0.0 |

        ```
      </file>
</files>
</slice>
</context_slices>

</handoff_prompt>
