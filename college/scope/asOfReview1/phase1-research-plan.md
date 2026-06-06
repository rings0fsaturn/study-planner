---
title: Phase-1 Research Plan and Evaluation Methodology
purpose: Document the 4-stage research methodology, synthetic generator, model comparison, evaluation legs, and expected outcomes
audience: candidate, future agents
status: approved
last_updated: 2026-06-05
---

## Research architecture: Python for research, TypeScript for product

- **Python (`/research`, offline):** model training, comparison, ablations, charts for the
  thesis. This is what evaluators grade. Uses pyKT, pyBKT, scipy, scikit-learn, GPy.
- **TypeScript / Python service (product):** runs the winning models' inference. The app
  does not train; it runs learned parameters. (Decision: Python is the single source of
  truth for the algorithms — evaluated code = shipped code — served via a FastAPI
  intelligence service. See [architecture.md](./architecture.md).)

## 4-stage methodology

| Stage | Weeks | Output |
|---|---|---|
| 1. Define learner profiles | 1–2 | Archetypes with behavioural parameters from literature |
| 2. Build synthetic data generator | 3–4 | Labelled datasets with embedded ground truth |
| 3. Run algorithm comparisons | 5–6 | Per-component metric tables (which algorithm wins) |
| 4. Validate with real data | 7–8 | Check synthetic findings against N=1 real sessions |

The generator's known ground truth (planted shifts, known pace) is the key advantage:
detection accuracy is precisely measurable. The generator itself is a research contribution.

## Synthetic data generator

A Python module generating thousands of labelled sessions across learner archetypes
(e.g., Steady, Morning-Lark, Fading-Flame, Weekend-Warrior, Deadline-Sprinter,
Marathon-Runner). Each session: material, planned vs actual duration, time of day, day of
week, session index. Ground truth (true pace, regime-shift locations, honest/faker label)
is embedded. A nonlinear logit ground-truth model (time-of-day × role interactions,
duration thresholds, fatigue, deadline pressure) ensures tree/Bayesian models can beat
linear baselines — producing a genuine comparison.

## Model comparison plan (per component)

| Area | Comparison | Metric |
|---|---|---|
| Pace calibration | Hierarchical Bayesian vs SMA | Prediction error (MAE/RMSE) on held-out sessions |
| Change detection | CUSUM vs EWMA vs CSD | Detection latency vs false-alarm rate |
| Projection | GP (ARD) vs linear | CI calibration (coverage) + point error |
| Scheduling | Constraint-based vs DP vs rule-based | Schedule adherence after adjustment |
| Mastery (Pillar B) | BKT / Deep-IRT vs DKT / AKT / UKT | AUC on Eedi/POJ; cold-start AUC at few interactions |

## Evaluation methodology (3 legs — this is the Area-5 answer)

Designed so single-user data is not load-bearing:

1. **Synthetic data with known ground truth** → precise algorithm comparison.
2. **Public benchmarks** (Eedi/POJ KT) → real-data credibility.
3. **Closed-loop vs open-loop** comparison (Phase II) on schedule adherence + learning
   gain, with N=1 logged sessions as longitudinal validation.

## Expected outcomes (named metrics + directional hypotheses)

Stated as directional hypotheses; the only cited numeric range is KT-AUC. Firm numbers
land at Reviews 2/3.

| Component | Metric | Expected (directional) |
|---|---|---|
| Pace calibration | MAE/RMSE | Bayesian < SMA error, especially sparse data |
| Change detection | latency, false-alarm | Clear winner per profile (quantified) |
| Projection | 95% CI coverage, error | GP calibrated; linear over/under-confident |
| Scheduling | deadline drift, adherence | Constraint-based competitive, prerequisite-aware |
| Mastery (KT) | AUC | Competitive, **~0.70–0.82** (literature range) |
| Cold-start mastery | AUC at few interactions | Cold-start method higher in low-data |
| Verification | precision/recall of fake-session flags | High precision without over-flagging honest learners |
| Learning signal | pre/post mastery delta | Detectable gain after genuine study |

## See also

- [datasets.md](./datasets.md) — the datasets these experiments run on.
- [pykt-and-knowledge-tracing.md](./pykt-and-knowledge-tracing.md) — the KT comparison harness.
- `../../mydeliverables/1st-Review/expected-outcomes.md` — the same outcomes in the report drafts.
