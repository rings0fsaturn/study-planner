# A5 Reality-Matched Generator Verification Summary

Dataset: `synthetic-reality-3b404c903563-seed0-n3600` (`params_version_hash=3b404c903563`, base `e716cd12dddc`), 3,600 learners under the A3 held-out protocol.

OULAD bounds: sampled 1701 learner/course series from 10655280 `studentVle.csv` rows; proxy mapping is `daily sum_click -> engagement intensity -> minutes toward a roadmap`. Bounds are in `oulad_moment_bounds.json` (`moment_bounds_hash=3513c739b9ed`); the generated regime params hash is `3b404c903563`.

Ranking-hold result:

- Calibration: does not hold for the structured covariate/EB candidates; on A5 they are often Holm-significant in the wrong direction. Simple SMA/EWMA have surviving context-prediction wins.
- Detection: partial hold only. Drift still favors `cusum`, but step shifts switch from the A4 `page_hinkley` winner to `cusum`; no challenger has a Holm-surviving win on A5.
- Projection: holds. `conformal` is the best non-oracle by score on all bands, and `conformal` plus `gp_hetero_t` retain Holm-surviving wins.
- Scheduling: holds. Non-greedy schedulers still beat `greedy_incumbent`; `dp_capacity` wins every material mix and prereq-order correctness stays 1.0.

A5.4 direct external validation was not run; the phase uses OULAD for moment bounds only, as planned.
