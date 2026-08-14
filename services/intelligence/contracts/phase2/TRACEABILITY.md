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
