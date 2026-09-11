---
title: Phase 2 contract fixtures
purpose: Exercise representative provider outcomes and public grading/embedding shapes
audience: implementers, reviewers
status: approved
last_updated: 2026-08-09
---

## Fixture inventory

Each fixture is mapped to its canonical JSON Schema in `manifest.json` and is validated by `tests/test_contracts.py`.
The `generation-success` and `generation-malformed` fixtures mirror captured DeepSeek probe records
(`research/doc/deepseek-generation-probe/raw.jsonl`): real `finish_reason`, `native_finish_reason`,
usage with reasoning tokens, and routed provider identifiers.
The `generation-partial` fixture exercises the truncated-output (`length`) branch, a phenomenon the
probe captured but with exact record details synthesized.
The `generation-safety-block`, `generation-quota-failure`, and `generation-timeout` fixtures
exercise envelope branches no probe run captured (refusal, 429, deadline) and are synthesized from
the #54 finish-reason mapping.
The timeout fixture carries no `usage` because an app-level deadline abort yields no provider usage;
a 429 quota response may still carry provider-reported usage.

| Fixture | Contract | Purpose |
|---|---|---|
| `generation-success.json` | OpenRouter generation response | accepted structured output |
| `generation-malformed.json` | OpenRouter generation response | repair exhausted |
| `generation-safety-block.json` | OpenRouter generation response | refusal branch, synthesized (no refusal captured by the probe) |
| `generation-quota-failure.json` | OpenRouter generation response | quota normalization, synthesized (429 branch) |
| `generation-timeout.json` | OpenRouter generation response | deadline normalization, synthesized (no provider usage) |
| `generation-partial.json` | OpenRouter generation response | truncated output normalized to partial |
| `written-grading.json` | written grading response | normalized written score and per-skill observation |
| `embedding-batch.json` | embedding request | batch input and 768-dimension configuration |
| `coding-answer.json` | coding answer | public source and sandbox configuration |
| `execution-pass.json` | execution result | passing run |
| `execution-compile-failure.json` | execution result | compile failure without hidden tests |
| `execution-sandbox-timeout.json` | execution result | timeout/sandbox failure |
| `guide-start.json`, `guide-delta.json`, `guide-citation.json`, `guide-done.json`, `guide-error.json` | guide HintFrame | every enforceable SSE frame kind |
| `provider-timeout.json` | provider error | normalized retryable provider failure |
| `async-job-ingestion.json` | async job | ingestion job with attempt identity |
| `gated-reveal.json` | gated reveal | acknowledgement with no hidden content |

## OpenAPI-validated fixtures

These fixtures target schemas declared inline in `openapi.yaml`, which the JSON-only manifest loader cannot reference, so `tests/test_contracts.py` validates each one directly against the named component schema instead of through `manifest.json`.

| Fixture | Contract | Purpose |
|---|---|---|
| `attempt-submit.json`, `attempt-created.json`, `attempt-record-queued.json`, `attempt-record-graded.json` | `AttemptSubmit`, `AttemptCreated`, `AttemptRecord` | objective attempt submission, queueing, and the public graded record |
| `written-question.json` | `Question` | a written question as the client sees it, with subtype and no key material |
| `written-attempt-submit.json` | `AttemptSubmit` with `WrittenAnswer` | a learner's free-text written submission |
| `written-attempt-record.json` | `AttemptRecord` with `WrittenAnswer` and `QuestionGraded` | a graded written attempt with the per-criterion `rubricBreakdown` |
| `assessment-recipe-scoped.json` | `AssessmentRecipe` with `AssessmentScope` | a chapter-scoped generation request (PDF pages plus the section label that steers retrieval) |
