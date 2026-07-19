# Handover / design brief → new session: Pillar-A CUSTOM algorithms (pace calibration + change detection)

**Date:** 2026-06-18 · **From:** Cowork planning/review agent · **For:** a fresh session (design + implement + test)
**Scope:** build **custom** algorithms for the two Pillar-A tracks whose contest results were unsatisfactory — **pace calibration** and **change detection**. Projection (across-learner conformal) and scheduling (`dp_capacity`) already have robust winners → **out of scope here.**

> **Why this exists:** the A0–A5 rigour pass (plan: `../plans/active/2026-06-14-pillar-a-rigour.md`, verified in `…-VERIFICATION.md`) showed calibration is an **honest null** (added structure doesn't beat pooling/EWMA under held-out + Holm) and detection is a **trade-off with no dominant method**. This session designs algorithms that target *those specific failure modes*, then implements + tests them under the **same rigour protocol**. This is net-new work — treat it as a new sub-plan (working name "A6 — custom calibration & detection").

## How to start (read these first, in order)

1. **This brief** (failure modes + options + constraints + eval bar).
2. **Conclusions + caveats:** `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md` (the honest per-track story).
3. **Evidence (grounding numbers):** `research/doc/verification-runs/2026-06-18-a3-a4-pillar-a/evidence.json` (frozen-regime, held-out + Holm) and `…/2026-06-18-a5-pillar-a/evidence.json` (reality-regime ranking-hold).
4. **The rigour protocol you must score under:** `research/comparison/src/research_comparison/runners/rigour.py` (200-seed dataset, held-out archetypes, bootstrap CIs, Holm/BH). **Reuse it — do not reinvent.**
5. **The plan's decisions log** (D-A1…D-A7) and OQ-A1…OQ-A4 in `../plans/active/2026-06-14-pillar-a-rigour.md` — the design rationale and the no-gaming history.

## The generator truth (what's actually learnable — your lever)

A learner's emitted pace ratio is (see `research/comparison/src/research_comparison/generator/`):

```
pace = m_global · ρ(role) · τ(time_of_day) · ν(day_of_week)        # pace.py
       · regime_multiplier(t)                                       # regimes.py / reality.py (step/drift/relapse…)
       · φ_fatigue(same_day_count)                                  # effects.py: 1 + k·(same_day_count−1)
       · δ_deadline(progress)                                       # effects.py: progress-dependent ramp (sprinter)
       · lognormal-AR(1) noise (φ≈0.30)                             # noise.py
```

**The current calibration candidates model ONLY `ρ/τ/ν`** (`baselines/calibration.py`: features `[intercept, anchor, practice, morning, evening, weekend]`). They **ignore** `φ_fatigue` (same-day session count — *observable*), `δ_deadline` (progress through the plan — *observable*), recency/time-trend, and the AR(1) structure. **That missing, observable, genuinely-predictive signal is the most promising honest lever** — not more clever priors on the same features.

## Failure mode 1 — pace calibration (honest null today)

**What's wrong:** on global-rate recovery, pooling is near-optimal (nothing deployable beats it). On context-aware next-session prediction (the D-A7 `context_pred_mae` metric), the structured candidates (`covariate_bayes`, `eb_partial_pool`, `kalman`) **do not survive Holm on held-out archetypes** — they overfit per-context multipliers from sparse data, so the variance cost exceeds the signal. Only simple `ewma` posts an occasional surviving win. On the reality regime: `does_not_hold_for_structured_context_candidates`.

**So a custom calibrator must** (a) exploit the **missing observable signal** (fatigue, deadline-proximity, recency), and (b) **borrow strength from the population** so sparse/unseen learners don't overfit, and (c) ideally **adapt online** to regime shifts.

### Options (ranked; each tagged with the failure mode it targets)

1. **Feature-enriched calibrator (recommended first — targets the missing-signal lever).** Same regularized form as `covariate_bayes`, but add observable features: `same_day_count` (fatigue), `progress = index/total` (deadline ramp, esp. for sprinters), `recency`/time-trend, plus `ρ/τ/ν`. Regularize; **λ tuned on held-out-TRAIN archetypes only**. Highest chance of a *genuine* win because it adds real predictive signal the baselines lack. Low/medium effort.
2. **Proper multilevel partial-pooling Bayes with a POPULATION prior fit across train learners (targets sparse-learner overfitting).** Unlike the current EB (which shrinks toward the *learner's own* mean), shrink per-learner context effects toward a **population** estimate learned on train archetypes. Sparse learners fall back to population effects; data-rich learners adapt individually. Principled fix for the held-out failure. Medium effort.
3. **Online state-space / Kalman with context covariates (targets drift + uncertainty).** Latent pace = slow random walk + fixed context multipliers, updated online → tracks regime drift and yields calibrated intervals. Medium effort.
4. **Changepoint-aware calibrator (couples to detection).** Reset/down-weight history at detected shifts → robust pace estimate across regimes. Pairs naturally with the detection work below. Medium effort.
5. **Hybrid:** population-prior partial pooling for context multipliers + Kalman for the global rate + the enriched features. Highest ceiling, highest effort.

**Recommended first build:** **#1 (feature-enriched)** + **#2 (population-prior multilevel)** — together they hit both levers (missing signal + sparse overfitting).

## Failure mode 2 — change detection (trade-off, no dominant method)

**What's wrong:** CUSUM (incumbent) = lowest false-alarm / highest latency; CSD = fastest / noisiest. Challengers (`bocpd`, `adwin`, `page_hinkley`) win only on specific frozen-regime cells and **don't generalize** (reality: `partial_hold_drift_only`; no challenger Holm-surviving win). It's a Pareto frontier, not a winner. Note the detectors already self-normalize (`robust_running_z_scores` via MAD) — good — but most still assume iid, while the generator emits **lognormal-AR(1)** noise.

**So a custom detector must** produce an operating point that **dominates** the CUSUM↔CSD frontier (lower latency at equal-or-lower false-alarm) and **generalizes**.

### Options (ranked; each tagged)

1. **Two-stage / ensemble detector (recommended first — targets the Pareto trade-off directly).** Fast-sensitive arm (CSD) **proposes** a candidate shift; clean arm (CUSUM/Page-Hinkley) **confirms** within a short window → keep CSD's latency, cut its false alarms. Designed to dominate the frontier rather than sit on it. Low/medium effort.
2. **AR(1)-whitening front-end (targets the mis-specified noise model).** Pre-whiten the pace-ratio series for the estimated AR(1) (φ̂ from the learner's own residuals) before any detector → restores the iid assumption the detectors rely on → fewer false alarms. Cheap, composable with #1. Low effort.
3. **GLR (generalized likelihood ratio) / matched detector with explicit step AND drift hypotheses (targets near-optimal detection of known shapes).** Near-optimal for the generator's known step/drift forms; fuse the two arms. Medium effort.
4. **Properly-specified BOCPD** (hazard rate tuned on train archetypes + lognormal-AR(1) observation model) — the A4 BOCPD lost likely due to a mismatched Gaussian-iid model. Medium effort.
5. **Deliverable framing:** report the **Pareto frontier + a fused operating point**; success = the fused point dominates the existing frontier, Holm-surviving, on held-out.

**Recommended first build:** **#1 (two-stage ensemble)** layered on **#2 (AR(1)-whitening)** — cheapest path to a dominating operating point.

## Harness integration (where custom candidates slot in)

- **Calibration:** add a `CalibrationCandidate` to `research/comparison/src/research_comparison/baselines/calibration.py` exposing `fit_global(sessions)->float`, `predict_next(history, next_context)->float`, `fit_interval(sessions)->tuple|None`; register in `calibration_candidates()`. Scored on `context_pred_mae` (primary, D-A7) + `recovery_mae` via `runners/calibration.py`.
- **Detection:** add a `detect_<name>(pace_ratios, …)->list[int]` (detection indices) to `baselines/detection.py`; register in the detection runner's candidate list. Scored on latency / false-alarm / per-shift-type + the Pareto frontier via `runners/detection.py` + `metrics/detection.py`.
- **Scoring:** reuse `runners/rigour.py` — every new candidate must carry `delta_ci`, held-out scoring (`scored_split="held_out"`), and appear in the `mc_correction` block. Re-run at `--seeds 200`; also re-run on the reality regime (`--dataset-dir research/datasets/synthetic-reality-3b404c903563-seed0-n3600`) for the generalization check.

## HARD constraints (the bar — A1, A2, A4 each needed a redo over a version of this)

- **No leakage.** Never import generator truth into `baselines/` (`ROLE_RHO`, `TAU_GENERIC`, `m_global`, `r_star`, regime/shift schedules). Estimate everything from the **observed** series. `predict_next` uses history + the **observable** next-context only (role/day/time/progress/same-day-count) — never the target pace or `r_star[t]`. Detectors see the pace-ratio series only, never sidecar shift labels.
- **No tuning on scoring cells.** Any hyperparameter (regularization λ, ensemble window, GLR thresholds, hazard rate) is tuned **only on held-out-TRAIN archetypes** — follow the A4 pattern (`cusum_tuning.method = "grid_search_train_archetypes_only"`, recorded in provenance).
- **No magic constants** dialed to hit a target metric (A1's `4.20`). Everything data-derived or principled.
- **Additive.** Keep all shipped candidates in the contest; the custom ones are added, not swapped.
- **Report only Holm-surviving wins on held-out as wins.** An honest "no improvement" is a legitimate result.

## Definition of success (and an honest expectation)

- **Calibration:** custom candidate beats `pooled_bayes`/`ewma` on `context_pred_mae` with a **bootstrap-CI-on-Δ excluding 0 and a Holm-surviving win on held-out** archetypes, and ideally **holds on the reality regime**.
- **Detection:** custom detector yields an operating point that **dominates the CUSUM/CSD Pareto frontier** (lower latency at ≤ false-alarm), Holm-surviving on held-out, holding on reality.
- **Honest expectation:** the A3/A5 results suggest the simple baselines are near-optimal for what's learnable on *unseen* learners. The **feature-enriched calibrator (fatigue/deadline)** is the most likely genuine win because it adds real signal the baselines lack; the **two-stage detector** is the most likely frontier-dominating detector. If a candidate doesn't beat the baseline under the protocol, **report the honest null** — do not tune/leak to manufacture a win (that's the failure this whole plan exists to prevent).

## Recommended process (order)

1. **Pressure-test the design** (`grill-me`) — converge on which 1–2 candidates per track to build and their exact feature/observation models. *(Cowork)*
2. **Write a plan + VERIFICATION** for the chosen candidates (use `.agents/skills/write-implementation-plan/`; output `../plans/active/2026-06-18-pillar-a-custom-calibration-detection/PLAN.md` + `VERIFICATION.md` with per-candidate acceptance criteria). *(Cowork)*
3. **Implement** as additive candidates + tests; tune hyperparams on held-out-train only. *(Codex)*
4. **Score** under the A3 protocol (200 seeds, held-out, Holm) + reality-regime check; capture JUnit + an evidence.json (as in A3/A4). *(Codex)*
5. **Review** the diff + grounded numbers against VERIFICATION; honest-null is an acceptable close. *(Cowork)*

> Note the division of labour: Cowork **designs, plans, and reviews**; Codex/Sonnet **implement and test**. Code/tests are never written by the planning side.

## Reference paths (everything you need)

- Plan + checklist: `../plans/active/2026-06-14-pillar-a-rigour.md`, `../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md`
- Conclusions/caveats: `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`
- Evidence: `research/doc/verification-runs/2026-06-18-a3-a4-pillar-a/evidence.json`, `…/2026-06-18-a5-pillar-a/evidence.json`
- Candidates: `research/comparison/src/research_comparison/baselines/{calibration,detection}.py`
- Runners + rigour: `research/comparison/src/research_comparison/runners/{calibration,detection,rigour}.py`
- Metrics: `research/comparison/src/research_comparison/metrics/{prequential,detection,paired,rigour}.py`
- Generator truth (read-only reference, never import into baselines): `research/comparison/src/research_comparison/generator/{pace,effects,noise,regimes,reality}.py`
- Datasets: frozen `research/datasets/synthetic-e716cd12dddc-seed0-n3600`, reality `research/datasets/synthetic-reality-3b404c903563-seed0-n3600`
- Tests to mirror: `research/comparison/tests/test_{calibration,detection}_track.py`
- Commands: `export PATH="$HOME/.local/bin:$PATH"` then `uv run --package research-comparison python -m research_comparison.runners.{calibration,detection} --seeds 200` and `uv run --package research-comparison pytest research/comparison/tests -q`
