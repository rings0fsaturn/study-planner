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
