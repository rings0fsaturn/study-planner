## Parent

- Implementation spec: #32
- Wayfinder map: #4

## What to build

Deliver end-to-end material ingestion. File, URL, text, and YouTube materials move through extraction, chunking, embedding, ready, and failed states, with visible progress and safe recovery.

## Acceptance criteria

- [ ] The approved ingestion lifecycle and owner-scoped async jobs are observable to the learner.
- [ ] Extraction, chunking, normalized embeddings, ready gating, retry, and terminal failure behavior work end to end.
- [ ] Partial extracted content remains displayable while RAG generation stays blocked until ready.
- [ ] Queue retry, idempotency, backpressure, and representative provider failures are tested.

## Blocked by

- Ticket #04 — Material Library and Attachment
