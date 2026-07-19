---
title: Frozen vs decoupled Pillar-A comparability
purpose: Summarize the dissertation-safe comparison between the frozen A-series anchor and decoupled redesign results
question: Do R2-R4 use the same rigour protocol as the frozen A-series anchor, and what claims survive?
status: complete
author: Codex
last_updated: 2026-06-30
---

## Question

R5 checks whether the material/session redesign results are comparable to the
frozen A-series baseline and records the claim strength for calibration,
detection, and finish-date projection.

## TL;DR

Protocol parity holds. The frozen anchor and decoupled runs both use 200 seeds,
9 archetypes, 3 bands, held-out scoring with 5 train and 4 held-out archetypes,
Holm as the primary correction, BH reported, and bootstrap delta CIs.

Claims are constrained:

- Calibration transfers and holds with partial sessions included.
- Detection is more CUSUM-favoring than A4/P0b, but still has fading-flame
  drift-cell exceptions.
- `gp_plus_analytic` is a small-band / cold-start fallback, not a GP
  replacement. `analytic_required_rate` is not a winning finish-date model.

## Methodology

The frozen anchor is the current-code P0b A-series run:
`synthetic-21c2cdabfa91-seed0-n5400`, stored in
`research/results/{calibration,detection,projection}/`.

The redesign result is the R1 decoupled dataset:
`synthetic-decoupled-9e6d48db2da8-seed0-n5400`, stored in separate result
directories under `research/results/*_decoupled/`. The default frozen result
directories were not clobbered by decoupled runs.

All tracks stamp the shared protocol in `_provenance`:

| Field | Frozen anchor | Decoupled result |
|---|---:|---:|
| Seeds | 200 | 200 |
| Learners | 5400 | 5400 |
| Archetypes | 9 | 9 |
| Bands | small, medium, max | small, medium, max |
| Train archetypes | 5 | 5 |
| Held-out archetypes | 4 | 4 |
| Scored split | held_out | held_out |
| Primary correction | Holm-Bonferroni | Holm-Bonferroni |
| Reported correction | Benjamini-Hochberg | Benjamini-Hochberg |

## Calibration comparability

Calibration compares `enriched_shrink` and `enriched_dual_prior` against
`hierarchical_bayes`. The denominator source changes from dated slot chunk to
material throughput, but both produce the same signal shape:
`activeMinutes / plannedMinutes`.

| Metric | Candidate | Frozen Holm wins | Decoupled Holm wins | R5 framing |
|---|---|---:|---:|---|
| context_pred_mae | enriched_shrink | 11/12 | 12/12 | holds |
| context_pred_mae | enriched_dual_prior | 11/12 | 12/12 | holds |
| recovery_mae | enriched_shrink | 6/12 | 8/12 | holds, caveated |
| recovery_mae | enriched_dual_prior | 2/12 | 8/12 | holds, caveated |

The caveat is `max|night_owl` recovery, where both enriched candidates have a
Holm-significant loss under decoupled data. Partial throughput points remain
included because the declared transfer evidence did not degrade.

## Detection comparability

Detection compares deployable candidates against `cusum`.

| Track | Frozen P0b winner | Decoupled winner | Non-CUSUM Holm wins |
|---|---|---|---|
| drift | cusum | cusum | 3 fading-flame drift cells |
| step | page_hinkley | cusum | 0 |

The R5 claim is not a pure robust-null. The honest statement is that the
decoupled cadence is more CUSUM-favoring than A4/P0b: the step
`page_hinkley` edge disappears, while fading-flame drift cells still retain
Holm-surviving `csd`/`page_hinkley` wins.

## ETA comparability

Projection compares candidate finish-date score against `gp_ard`. Oracles are
upper bounds only and are not method wins.

| Band | Frozen `gp_ard` coverage / MAE / sharpness | Decoupled `gp_ard` coverage / MAE / sharpness | Decoupled `gp_plus_analytic` coverage / MAE / sharpness |
|---|---|---|---|
| max | 0.186875 / 20.1709375 / 6.610625 | 0.18305555555555553 / 39.53 / 7.955416666666666 | 0.1948611111111111 / 52.10486111111111 / 10.707083333333333 |
| medium | 0.29080357142857144 / 9.4475 / 4.98110119047619 | 0.2765178571428571 / 15.331294642857141 / 4.715133928571428 | 0.2912053571428571 / 17.099375 / 6.221741071428571 |
| small | 0.43822916666666667 / 2.1460416666666666 / 1.9139583333333334 | 0.49370833333333336 / 2.3605625 / 1.6494375 | 0.5516041666666667 / 2.1386041666666666 / 2.2782291666666667 |

Holm verdict vs `gp_ard`:

| Candidate | Holm wins | Holm losses | R5 framing |
|---|---:|---:|---|
| analytic_required_rate | 0 | 7 | not a winning finish-date model |
| gp_plus_analytic | 4 | 4 | small-band/cold-start fallback only |
| conformal | 12 | 0 | coverage fix |
| gp_hetero_t | 12 | 0 | principled GP variant, not the #3 claim |

`gp_plus_analytic` wins all four small held-out cells and loses all four max
cells. It should be described as a fallback layered on GP for small/low-data
plans, not as a replacement for GP or conformal on data-rich plans.

## Claim Discipline

Use these phrasings:

- "Calibration transfer holds under decoupled material throughput with partial
  points included."
- "Detection is more CUSUM-favoring than A4/P0b under decoupled cadence, with
  fading-flame drift exceptions."
- "The ETA composite is qualified to the small-band/cold-start regime."

Avoid these phrasings:

- "Decoupling improves calibration."
- "Nothing beats CUSUM."
- "`gp_plus_analytic` replaces GP."
- "`analytic_required_rate` is a deployable winner."

## References

- `research/results/calibration/calibration_results.json`
- `research/results/calibration_decoupled/calibration_results.json`
- `research/results/detection/detection_results.json`
- `research/results/detection_decoupled/detection_results.json`
- `research/results/projection/projection_results.json`
- `research/results/projection_decoupled/projection_results.json`
- `.work/plans/active/2026-06-30-research-eta-model-selection/VERIFICATION.md`
