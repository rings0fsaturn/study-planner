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
