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
