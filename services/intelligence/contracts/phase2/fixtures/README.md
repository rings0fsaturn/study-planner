---
title: Phase 2 contract fixtures
purpose: Exercise representative provider outcomes and public grading/embedding shapes
audience: implementers, reviewers
status: approved
last_updated: 2026-08-09
---

## Fixture inventory

Each fixture is mapped to its canonical JSON Schema in `manifest.json` and is validated by `tests/test_contracts.py`.
The six `generation-*.json` fixtures are seeded from sanitized DeepSeek probe shapes
(`research/doc/deepseek-generation-probe/raw.jsonl`): real `finish_reason`, `native_finish_reason`,
refusal, usage with reasoning tokens, and routed provider identifiers.

| Fixture | Contract | Purpose |
|---|---|---|
| `generation-success.json` | OpenRouter generation response | accepted structured output |
| `generation-malformed.json` | OpenRouter generation response | repair exhausted |
| `generation-safety-block.json` | OpenRouter generation response | non-retryable safety result |
| `generation-quota-failure.json` | OpenRouter generation response | quota normalization |
| `generation-timeout.json` | OpenRouter generation response | deadline normalization |
| `generation-partial.json` | OpenRouter generation response | accepted subset of slots |
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
