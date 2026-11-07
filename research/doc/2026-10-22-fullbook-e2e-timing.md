# Gap-4 full-book E2E timing (2026-10-22)

- Drive: temporary Playwright spec (deleted after the run) mirroring the canonical PDF scenario - dev-account sign-in, 572-page fixture upload (~23 MB) with unique title, 10 s polling of `GET /v1/materials/{id}/ingestion` for state transitions, UI delete + card-gone verification.
- Material `02bcbd7d` reached `ready`, then was deleted; library card count 0 confirmed. Shared account left as found.

## Stage timings (seconds since upload start; 10 s poll granularity)

| at (s) | state | progress |
|---|---|---|
| 13.5 | created (detail page) | - |
| 15 | extracting | 0.25 |
| 48 | embedding | 0.60 |
| 101 | ready | 1.00 |

- Start-to-ready wall: ~88 s. No separate chunking observation (extracting to embedding between two polls).
- Content volume for the paper: the same fixture yields the durable 754-chunk baseline (0 NULL); the timing endpoint reports chunkCount 0 at poll time, so volume is cited from the baseline, not this run.
- Worker path: managed worker + GPU sidecar for embeddings; no paid-API stages in this path beyond the account's own pipeline.

## Cost

- One full-book pipeline run (minutes of worker + GPU time); sidecar stopped after.
