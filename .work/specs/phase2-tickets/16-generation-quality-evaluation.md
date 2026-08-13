## Parent

- Implementation spec: #32
- Wayfinder map: #4

## What to build

Deliver the offline evaluation harness for groundedness, retrieval, difficulty calibration, deduplication/diversity, and mastery-estimator selection. Evaluation remains outside the online generation hot path.

## Acceptance criteria

- [ ] Gold samples, shared folds, attempt-count gates, and activation thresholds are explicit and reproducible.
- [ ] Groundedness, retrieval, difficulty, diversity, deduplication, and mastery candidates are measured.
- [ ] The harness uses redacted telemetry and cannot block ordinary generation unless an explicit activation gate is enabled.
- [ ] Failure to meet a gate fails closed and produces actionable results.

## Blocked by

- Ticket #06 — Single Grounded Objective Assessment
- Ticket #11 — Mastery and Adaptive Difficulty
