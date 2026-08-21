## Parent

- Implementation spec: #32
- Wayfinder map: #4

## What to build

Deliver end-to-end material ingestion. File, URL, text, and YouTube materials move through extraction, chunking, embedding, ready, and failed states, with visible progress and safe recovery.

## Acceptance criteria

- [x] The approved ingestion lifecycle and owner-scoped async jobs are observable to the learner.
- [x] Extraction, chunking, normalized embeddings, ready gating, retry, and terminal failure behavior work end to end.
- [x] Partial extracted content remains displayable while RAG generation stays blocked until ready.
- [x] Queue retry, idempotency, backpressure, and representative provider failures are tested.

## Status (2026-08-17)

Implemented and verified on branch `phase2/issue-37` (commits `55afc04`, `518e060`,
`0a58fc2`, `24f99dd`, `57253f8`, `344798e`, `441bcd5`, `f467f76`, `f08c47c`, `7e15ef8`).
Evidence: `.work/plans/archive/2026-08-14-material-ingestion-readiness/VERIFICATION.md`
(gates 0-11, live E2E 5 passed / 2 env-gated skips). Follow-ups owned by other plans:
the 572-page PDF scenario's post-throttle full-book validation
(`2026-08-14-ingestion-performance-baseline`) and the local Qwen3 GPU embedder sidecar
path (`2026-08-16-dockerize-embed`).

## Blocked by

- Ticket #04 — Material Library and Attachment
