## Parent

- Implementation spec: #32
- Wayfinder map: #4

## What to build

Deliver the first grounded assessment slice. A learner selects a ready material, configures a minimal assessment, generates one objective Question, sees citations and warnings, and can resume generation from its durable job.

## Acceptance criteria

- [ ] Generation is enabled only for ready, owner-scoped materials.
- [ ] The generated objective Question validates against its format schema and includes verified citations or explicit warnings.
- [ ] Hidden grading content is never returned to the browser, local cache, event log, or telemetry.
- [ ] Timeout, quota, safety block, malformed output, repair, partial, and resume behavior are tested.

## Blocked by

- Ticket #05 — Material Ingestion and Readiness
