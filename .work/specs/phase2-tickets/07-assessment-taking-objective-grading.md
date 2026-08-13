## Parent

- Implementation spec: #32
- Wayfinder map: #4

## What to build

Deliver assessment taking for the grounded objective Question. A learner can answer online or from the redacted offline cache, record a local attempt, queue it offline, and receive authoritative normalized grading after connection.

## Acceptance criteria

- [ ] Assessment content cache contains only the envelope and visible payload.
- [ ] Attempts use the approved per-question event and retry identity semantics.
- [ ] Objective grading returns normalized score and per-skill observations without exposing hidden answers.
- [ ] Offline append, queue, retry, fresh-device restore, account switching, and event order are tested.

## Blocked by

- Ticket #06 — Single Grounded Objective Assessment
