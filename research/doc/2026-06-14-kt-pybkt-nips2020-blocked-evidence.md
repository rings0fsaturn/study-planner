---
title: KT pyBKT nips2020 blocked evidence
purpose: Record the current scratch-run evidence for keeping pyBKT x nips2020 blocked and excluded from reportable KT results.
question: Does the current pyBKT formulation produce credible nips2020 predictions?
status: complete
author: Rohit Saji
last_updated: 2026-06-14
related:
  - ./2026-06-14-kt-credibility-tracker.md
  - ./2026-06-14-kt-credibility-and-validation-guidelines.md
  - ./2026-06-14-kt-next-tests-runbook.md
---

## Question

This note answers whether `pybkt x nips2020` should be fixed immediately or
kept blocked for the current KT credibility pass.

The credibility tracker already recorded a blocked call from earlier audit
work, but the active canonical directory no longer had
`research/results/kt/nips2020__pybkt__fold*__kfull.json` files. T4 required
fresh in-tree evidence, so the cell was regenerated into an ignored scratch
directory and summarized here.

## TL;DR

Keep `pybkt x nips2020` blocked and excluded from the reportable allow-list.

The current scratch run reproduces the same degenerate signature:
full-sequence mean AUC is `0.508687`, fold std is `0.000419`, mean ECE is
`0.484780`, and `1,018,278 / 1,123,383` full-sequence scores are exactly zero
(`90.6439%`). Cold-start AUC is below or near chance for every k tested.

This is not an unseen-skill or missing-artifact issue in this pass. The run
uses the shared public NIPS folds and the 57-skill sidecar already audited in
the tracker. The failure is the trained pyBKT output under the current
formulation.

## Methodology

The evidence run was intentionally written to scratch, not to canonical
`research/results/kt`, so the reportable artifacts were not changed.

```bash
uv run --package research-comparison python -m research_comparison.kt.pybkt_runner \
  --dataset nips2020 \
  --results-dir research/kt-bench/.work/nips-pybkt-blocked/results \
  2>&1 | tee research/kt-bench/.work/logs/nips-pybkt-blocked.log
```

The runner loaded:

| Field | Value |
|---|---:|
| Sequence rows | 1,123,383 |
| Learners | 3,935 |
| Skills | 57 |
| Scratch result files | 30 |
| Scratch results dir | `research/kt-bench/.work/nips-pybkt-blocked/results` |
| Scratch log | `research/kt-bench/.work/logs/nips-pybkt-blocked.log` |

The summary below was computed from the scratch JSON outputs.

## Findings

### Full-sequence AUC is flat at chance

| Fold | AUC | n_predictions |
|---:|---:|---:|
| 0 | 0.508107 | 224,859 |
| 1 | 0.509161 | 229,821 |
| 2 | 0.508402 | 218,590 |
| 3 | 0.508599 | 222,389 |
| 4 | 0.509163 | 227,724 |

Mean AUC is `0.508687`; population std is `0.000419`.

This matches the guideline's degenerate-flatness signature: large prediction
sets, AUC pinned near `0.51`, and near-zero fold variance.

### Exact-zero predictions dominate the score mass

| Fold | Zero scores | Nonzero scores | Zero rate |
|---:|---:|---:|---:|
| 0 | 203,900 | 20,959 | 0.906790 |
| 1 | 208,416 | 21,405 | 0.906862 |
| 2 | 197,945 | 20,645 | 0.905554 |
| 3 | 201,430 | 20,959 | 0.905755 |
| 4 | 206,587 | 21,137 | 0.907182 |

Across all folds, `1,018,278` of `1,123,383` full-sequence scores are exactly
zero. The total zero-score rate is `0.906439`.

### Calibration is also degenerate

| Fold | ECE |
|---:|---:|
| 0 | 0.481953 |
| 1 | 0.482526 |
| 2 | 0.486583 |
| 3 | 0.488587 |
| 4 | 0.484252 |

Mean ECE is `0.484780`, well above the guideline's `>0.25` investigation
threshold.

### Cold-start curves fail the chance floor

| k | Fold AUCs | Mean AUC |
|---:|---|---:|
| 3 | .475089/.475429/.463563/.459564/.466512 | 0.468031 |
| 5 | .475381/.478541/.463791/.467760/.467423 | 0.470579 |
| 10 | .502772/.505713/.495431/.499163/.496374 | 0.499891 |
| 20 | .505263/.506180/.503510/.505523/.507154 | 0.505526 |

The k=3 and k=5 curves are below chance for every fold. k=10 averages
slightly below chance. This fails the G6 cold-start sanity gate.

## Recommendation

Document and keep `pybkt x nips2020` blocked for this KT pass.

Do not add this cell to `reportable_allowlist`. Do not report the AUC as a
credible BKT result. The honest status is:

- G4 fail: full-sequence AUC is flat at chance.
- G5 fail: ECE is approximately `0.485`.
- G6 fail: cold-start k=3/k=5 are below chance.
- G8 pass for the current audit: the active sidecar uses 57 numeric skills with
  no compound underscore keys.

A future fix attempt should be its own slice. It should inspect the pyBKT
formulation and prediction path, including binary correctness encoding,
`forgets=False`, `num_fits=1`, per-skill versus multi-skill fitting, and why
`predict` emits exact zeros for most NIPS predictions.

## References

- [Credibility tracker](./2026-06-14-kt-credibility-tracker.md)
- [Credibility and validation guidelines](./2026-06-14-kt-credibility-and-validation-guidelines.md)
- [Next-tests runbook](./2026-06-14-kt-next-tests-runbook.md)
