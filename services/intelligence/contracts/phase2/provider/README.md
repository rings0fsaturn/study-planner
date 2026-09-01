---
title: OpenRouter provider boundary
purpose: Define exact OpenRouter requests and normalized provider results behind the Intelligence Service
audience: implementers, reviewers
status: approved
last_updated: 2026-08-23
related:
  - ./generation-request.schema.json
  - ./generation-response.schema.json
  - ./embedding-request.schema.json
  - ./written-grading-response.schema.json
  - ./guide-hint-frame.schema.json
  - ./gated-reveal-response.schema.json
---

## Provider identity and configuration

The sole generation provider is DeepSeek via OpenRouter, called through the OpenAI SDK with
`base_url` `https://openrouter.ai/api/v1` and SDK `max_retries=0`.
The current model slug is `deepseek/deepseek-v4-flash-0731`; the live value is configured by
`GENERATION_MODEL` (decision #53) and is a free string in the schemas, not frozen in JSON Schema.

Requests use OpenAI-style `messages[]` with roles `system|user|assistant` and a plain JSON Schema
`responseSchema` (standard draft-2020-12 keywords), which the adapter places under
`response_format.json_schema.schema` with `strict: true`.
Sampling is limited to `temperature` (0.3) and `maxOutputTokens` (default 4096); there is no seed
and no top-p (decision #53).
The `reasoningEffort` knob defaults to `off`; the adapter maps it to OpenRouter
`reasoning.enabled/effort` via `extra_body`, and `exclude: true` keeps reasoning out of returned
content.
Per-task `timeoutMs` defaults to 30000 for generation.
`require_parameters`, routing preferences, and the `response_format` mode are adapter detail, not
public contract.

Every request includes owner scope, artifact IDs, `traceId`, `correlationId`, task, prompt-template
version, and an explicit timeout.
The browser never sees a provider key, SDK object, raw response, or raw prompt.

## Structured output mode

Strict `json_schema` is the primary structured mode and is contract-mandatory for the grounded MCQ
shape; `json_object` is contract-invalid for that shape.
Local schema validation runs after every response regardless of strict mode.

## Finish-reason to outcome mapping

`generation-response.schema.json` is the provider-neutral envelope for assessment generation,
written grading, guide reveal, and provider failures.
`provider-error.schema.json` is the shared normalized error shape with public code, retryability,
request ID, correlation ID, and optional retry-after.

| finishReason | outcome |
|---|---|
| `stop` | `ok` / `partial` / `malformed_output` after local validation |
| `length` | `partial` (truncated output; repair-or-drop per pipeline rules) |
| `content_filter` | `safety_block` (non-retryable) |
| `refusal` | `safety_block` (non-retryable) |
| `error` | `provider_error` |
| absent | transport-level outcomes only (`quota_failure`, `timeout`); no synthetic finish reason |

Written grading, guide stream frames, and gated reveals have narrower schemas so a provider adapter
cannot accidentally return hidden rubric material or an unanchored hint.
A gated reveal is an acknowledgement only; hidden answers remain server-only.

## Stream framing

Guide responses use `text/event-stream`.
Each `data:` value is one `HintFrame` JSON object.
Frames share a correlation ID, increase sequence monotonically from zero, and terminate with exactly
one `done` or `error` frame.
Provider deltas are normalized before they cross the service boundary.

## Error and retry policy (decision #53 matrix)

The SDK runs with `max_retries=0`.
There is exactly ONE application-level retry for retryable classes:
`rate_limited` (honoring `Retry-After`, capped at 60 s), `provider_unavailable`, and
`provider_timeout`.
Never retry credentials, quota, safety blocks, or `unsupported_request`.
Malformed output follows the one-repair-else-drop rule.
Generation is capped at 30 s, embedding at 10 s, grading at 30 s, and guide idle time at 15 s.
All exhausted failures map to the public `ServiceError` codes in `../openapi.yaml`.

## Embeddings fallback note

`embedding-request.schema.json` moves here unchanged and stays Gemini-shaped
(`provider: const "gemini"`, `model: const "gemini-embedding-001"`, `dimension: const 768`).
Gemini is the embeddings fallback only; the Qwen3 GPU sidecar is the primary embedding provider.
This schema is deliberately NOT neutralized.