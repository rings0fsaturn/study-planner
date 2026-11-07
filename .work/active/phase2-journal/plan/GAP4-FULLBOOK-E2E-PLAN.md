# Gap 4 plan - full-book PDF E2E at scale (2026-10-22)

_Goal: paper-grade timing evidence for the full ingestion path (upload to ready) through the sidecar, beyond the single-book existence proof._

## Ground facts

- Canonical precedent: `e2e/material-ingestion-live.spec.ts` uploads the 572-page fixture (~23 MB), waits minutes for card-ready, own 600 s timeout (rule 16). It proves readiness, not timings.
- Queued upstream as `full-book-pdf-e2e-sidecar`.
- Needs live credentials (`E2E_LIVE_EMAIL`/`E2E_LIVE_PASSWORD`) + managed runtime; mutates the shared dev account, so cleanup (delete created materials) is mandatory per rule 16.

## Steps

1. Start managed runtime + sidecar; confirm service, app, sidecar health.
2. Dry run per rule 80: run the ingestion spec's smallest scoped scenario first (or a short-text material) to confirm the timing harness works.
3. Full run: 572-page fixture through the live spec with stage-timing capture (upload done, extraction done, chunks written, embeddings done, card ready). Record chunk count, NULL count, wall-clock per stage.
4. Write `research/doc/2026-XX-fullbook-e2e.md` (stage timing table + counts) + JSON; clean up created materials; close gap 4 in the brief.

## Acceptance

- Stage timings + 754-chunk reconciliation (matches durable baseline or the drift is explained).
- Shared account cleaned; no leftover materials breaking strict-mode locators.

## Cost

- One full-book pipeline run (minutes of GPU + worker time); live-spec budget only. Sequential, never parallel with other live work.
