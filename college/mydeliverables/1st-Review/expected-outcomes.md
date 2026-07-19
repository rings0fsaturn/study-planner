# Expected Outcomes & Evaluation Methodology — First Review (Phase I)

> Specificity rule: **named metrics + directional hypotheses**. The only cited numeric
> range is KT-AUC (literature-backed). Firm numbers land at Review 2/3 once experiments run.
> This section also answers the open **Area 5 (evaluation methodology)** the guide flagged.

## Evaluation design — three legs (so N=1 is not load-bearing)

1. **Synthetic data with known ground truth** — planted pace, regime shifts, and
   honest/faker labels make detection accuracy and verification efficacy *precisely*
   measurable. Enables clean algorithm comparison.
2. **Public benchmarks** — knowledge-tracing datasets (Eedi MCQ, POJ coding, via pyKT)
   give real-data credibility for the mastery models.
3. **Closed-loop vs open-loop comparison** (Phase II) — the system-level test, with the
   candidate's own logged sessions as **longitudinal N=1 validation**, not the whole proof.

## Pillar A — Closed-Loop Adaptation (offline algorithm comparison)

| Component | Metric | Compared against | Expected (directional) |
|---|---|---|---|
| Pace calibration | MAE / RMSE of predicted vs actual pace (held-out sessions) | Hierarchical Bayesian **vs** Simple Moving Average | Bayesian lower error, especially with sparse per-learner data |
| Change detection | Detection latency + false-alarm rate (planted shifts known) | CUSUM **vs** EWMA **vs** CSD | A clear latency/false-alarm winner emerges; quantified per profile |
| Progress projection | 95% CI empirical coverage + point error (MAE) | Gaussian Process **vs** linear extrapolation | GP gives calibrated intervals; linear is over/under-confident |
| Schedule generation | Deadline drift (days) + schedule adherence % after adjustment | Constraint-based **vs** rule-based **vs** DP | Constraint-based competitive and prerequisite/role aware |

**System-level (Phase II, stated as expected):** closed-loop **vs** open-loop on
schedule adherence %, deadline drift (days), and calibration convergence speed →
closed-loop improves adherence and reduces drift.

## Pillar B — Assessment-Based Verification

| Component | Metric | Compared against | Expected (directional) |
|---|---|---|---|
| Mastery model (KT) | AUC on Eedi / POJ | Published KT baselines (DKT, BKT) | Competitive AUC, **~0.70–0.82** (literature range for these datasets) |
| Cold-start mastery | AUC at few interactions | Cold-start KT **vs** standard KT | Cold-start method higher AUC in the low-data regime (the single-learner crux) |
| Verification efficacy | Precision / recall of flagging inflated or fake sessions | On synthetic honest-vs-faker data | High precision (flag fakes) without over-flagging honest learners |
| Item generation (AQG) | Item validity / answerability rate (human-checked sample) | — | Majority valid; failure modes characterised |
| Learning signal | Pre/post concept-mastery delta | — | Detectable gain after genuine study — the ground truth self-reported time lacked |

## What Review 1 commits to vs. defers

- **Commit now (Review 1):** the metrics above, the comparisons, and directional
  hypotheses; the three-leg evaluation design.
- **Defer (Review 2/3):** firm numeric results, full confusion matrices / comparison
  tables, and the closed-loop vs open-loop study (Phase II).
