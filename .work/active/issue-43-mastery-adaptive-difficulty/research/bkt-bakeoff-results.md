# #43 P1 — BKT parameter bake-off (2026-09-20)

## Question

Which fixed BKT default parameters should the production stateless mastery
projection use? Evidence-driven per #14 ("nothing pinned by fiat"), bounded
offline, before any engine or route work.

## Method

`research/bkt_bakeoff.py` (this folder), run with
`uv run --package py-progress python <path>`.

1. **Prior evidence (not re-run):** the KT credibility tracker
   (`research/doc/2026-06-14-kt-credibility-tracker.md`) records that
   EM-fitted pyBKT calibrates poorly on the public folds (nips2020:
   degenerate zero-mass predictions, 90.6% exact zeros; accoding: ECE ~0.272
   with a documented accepted limitation). A fitted-EM production path is
   therefore rejected; fixed defaults are chosen here instead.
2. **Synthetic ground truth:** 2,000 learners per regime, two true-parameter
   regimes:
   - `quick_mastery` (p_init .30, learn .30, slip .05, guess .05): pos-rate 0.687
   - `slow_noisy` (p_init .15, learn .10, slip .15, guess .20): pos-rate 0.455
   Sequence lengths 1-12 (product-shaped: short assessments, retries create
   fresh observations).
3. **Grid:** 3 x 3 x 3 x 3 = 81 candidate sets over
   p_init {.15,.25,.35} x learn {.05,.10,.20} x slip {.05,.10,.20} x
   guess {.05,.10,.20}. Each candidate's forward-filtered P(correct) is
   scored on the same regime-generated sequences by 10-bin ECE and AUC.
4. **Decision rule:** best mean ECE among candidates with mean AUC >= 0.60.

## Result

| Rank | p_init | learn | slip | guess | mean ECE | mean AUC | q ECE | s ECE |
|---|---|---|---|---|---|---|---|---|
| 1 | .15 | .10 | .05 | .20 | **0.0571** | 0.7845 | 0.0789 | 0.0354 |
| 2 | .25 | .20 | .05 | .10 | 0.0623 | 0.7862 | 0.0318 | 0.0928 |
| 3 | .15 | .10 | .10 | .20 | 0.0623 | 0.7866 | 0.1034 | 0.0213 |
| 4 | .25 | .10 | .05 | .20 | 0.0646 | 0.7826 | 0.0774 | 0.0518 |

Winner: **p_init=0.15, p_learn=0.1, p_slip=0.05, p_guess=0.2**.

The winner is chosen over #2 (which fits `quick_mastery` slightly better but
sacrifices `slow_noisy` badly, q .032 / s .093) because its per-regime ECE is
balanced and it is the most conservative set: low slip means a mistake
strongly signals not-mastered, low learn means mastery needs sustained
correct answers. Top-8 ECE band is narrow (0.057-0.073), so the choice is
robust, not a knife-edge.

## Real-data sanity (dev account, 35 (material, skill) sequences from 39 graded attempts)

- n=15 all-correct ("Exam structure", "Professional skills"): mastery 1.000, uncertainty 0.000 - saturated, correct.
- n=1 single correct: mastery 0.510, uncertainty 1.000 - honest cold-ish start, no mastery claim.
- n>=2 all-incorrect: mastery 0.107, uncertainty 0.490 - fairly certain not mastered, correct.
- n=5 with 1 correct ("APM"): mastery 0.426, uncertainty 0.984 - still uncertain, correct.
- No degenerate (0/1 except saturation), monotone movement, cold start neutral-uncertain.

## Pinned constants

```python
BktParams(p_init=0.15, p_learn=0.1, p_slip=0.05, p_guess=0.2)
MODEL_VERSION = "bkt-v1"
```

Lives in `packages/py-progress/src/py_progress/mastery.py` as
`DEFAULT_PARAMS` / `MODEL_VERSION`. A future bake-off (the #48 harness owns
the full estimator comparison) ships a new `MODEL_VERSION`, never a silent
param change.