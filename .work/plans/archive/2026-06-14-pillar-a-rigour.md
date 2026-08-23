# How to use this plan

> **You are the implementing agent.** This document is your runbook for one cohesive change to this codebase. It was written collaboratively by Claude and a human after a planning discussion, and it is the source of truth for this work. Read this preamble in full before doing anything else.

## What you're holding

A phase-by-phase implementation plan. Each phase is a **vertical slice** — an end-to-end working increment that leaves the codebase in a working state. Phases are designed so any one of them can be implemented by a fresh agent in a new context window, with only this document and the codebase as input.

## Your job

1. **Read the document header in full first.** TL;DR, Context, Decisions log, Architecture overview, and Files-touched index. The Decisions log especially — reference IDs (D-NN) appear inside phase steps so you can look up rationale.

2. **Find your starting phase.** Scan the phase list. Pick the first phase whose status is `☐ Not started` AND whose `Depends on:` phases are all `✅ Complete`. Implement that phase only. **Do not skip ahead.**

3. **Run the prereq verification.** Each phase has a "Verification (run BEFORE starting)" block. **If any fail, STOP** and surface to the human.

4. **Follow the steps in order.** Code blocks are the actual code, not pseudocode.

5. **If reality doesn't match the step — STOP.** Surface the discrepancy; do not improvise.

6. **Run the tests and post-verification.** All must pass before the phase is done.

7. **Update status and commit.** Change the phase's `Status:` line to `✅ Complete — <commit-sha>`, `git add` the code + this plan file, and commit together.

## What you must NOT do

- **Do not skip phases.** Order matters.
- **Do not modify the Decisions log, Operating manual preamble, TL;DR, Architecture overview, Files-touched index, Open questions, Out-of-scope list, or References.** If a decision is wrong, surface to the human.
- **Do not re-plan or re-architect.** Surface, don't improvise.
- **Do not tune candidate hyperparameters on the same archetype cells used to declare winners** (the circularity guard, D-A4) — this is the cardinal sin this plan exists partly to remove.
- **Do not route KT-bench effort here.** The KT benchmark is irrelevant to Pillar A (different target/data/metric — see Context §0). The KT real-data work is a *separate* plan ([`2026-06-14-kt-realdata-integration.md`](2026-06-14-kt-realdata-integration.md)).

## If you get stuck

- Set the phase `Status:` to `🛑 Blocked: <reason>`, fill the `Notes` block, hand back.

## Status vocabulary

`☐ Not started` · `🟡 In progress` · `🛑 Blocked: <reason>` · `✅ Complete — <commit-sha>`

## When status markers and reality drift

The phase's `Verification (DONE)` commands are the truth, not the markers. Run them if you suspect drift; surface it.

---

# Research tier — Part 2b: Pillar-A rigour & extensions (drive the errors down)

**Slug:** `pillar-a-rigour`
**Date written:** 2026-06-14
**Author:** Claude + Rohit Saji
**Plan status:** Draft
**Upstream:** [`research/doc/2026-06-14-pillar-a-rigour-and-extensions.md`](../../../research/doc/2026-06-14-pillar-a-rigour-and-extensions.md) · [`../../handovers/archive/2026-06-14-kt-datasets-acquired-plan-handoff.md`](../../handovers/archive/2026-06-14-kt-datasets-acquired-plan-handoff.md) (Workstream B) · extends [`2026-06-13-research-tier-2-pillar-a-fanout.md`](2026-06-13-research-tier-2-pillar-a-fanout.md)

> **This plan hardens Pillar A.** All four tracks (calibration / detection / projection / scheduling) plus the sweep and oracle baselines have shipped genuine 720-learner results. Two defects and several rigour gaps remain. This plan fixes them in priority order — most error-reduction (and most defensibility) per unit effort first. Tracker tasks are `PA+.1–PA+.8`.

## TL;DR

Four levers, priority-ordered. **(A0)** Lock the open-code-question findings (already verified during planning, below) and add the rigour scaffolding — a seed-count knob, a bootstrap-CI-on-Δ util, a held-out-archetype split, and a Holm/BH multiple-comparison util. **(A1, PA+.1)** Fix the one red result: projection CIs under-cover badly (GP-ARD coverage **0.20 / 0.32 / 0.44** across bands vs nominal **0.95**) because the GP uses a **homoscedastic** Gaussian likelihood and **ignores the lognormal-AR(1)** noise the generator actually emits — add a split-conformal projection wrapper (coverage guaranteed by construction) plus a heteroscedastic/Student-t + AR(1) GP variant. **(A2, PA+.2)** Calibration's "hierarchical_bayes" candidate **ties pooled_bayes exactly** (paired Δ ≈ 1e-17, p ≈ 0.4–0.7) because it collapses `compute_hierarchical_model(...)` down to `.globalPosterior.mean` — discarding the role/time-of-day structure the function computes, and day-of-week isn't modelled anywhere; add a covariate Bayesian candidate using τ (time-of-day) + ν (day-of-week) and empirical-Bayes partial pooling, and show it beats pooled on the *small* band. **(A3, PA+.3)** 200+ seeds, bootstrap CIs on Δ, held-out archetypes, multiple-comparison correction. **(A4, PA+.4–.6)** New candidates per track + winner tweaks + a wider/adversarial sweep. **(A5, PA+.7)** Reality-match the generator to OULAD/EdNet *moments* (bounds only) and re-check the ranking holds — the external-validity story.

## Context & background

Pillar A is the **adaptation** pillar over a synthetic generator: 6 archetypes (`deadline_sprinter, fading_flame, marathon_runner, morning_lark, steady, weekend_warrior`) × 3 length-bands (`small, medium, max`) × 40 seeds = **720 learners**, frozen params hash `e716cd12dddc`, seed 0. The harness lives in the clean `uv` workspace (`research/comparison`) and imports `py-progress` / `py-roadmap-engine` as peer candidates; results are stamped JSON under `research/results/{calibration,detection,projection,scheduling,sweep}/`.

**Headline results today (verified from the result JSON, 2026-06-14):**

| Track | Candidates (★ = incumbent) | Result → conclusion |
|---|---|---|
| Pace calibration | hierarchical_bayes ★ · sma · ewma · pooled_bayes · oracle | Bayes beats EWMA (Δ +0.076/+0.065/+0.033 by band, d 2.2/2.4/1.2, p≤4.5e-9) but **ties pooled exactly** (Δ ≈ ±1e-17, p ≈ 0.42–0.67) |
| Change detection | cusum ★ · ewma_control_chart · csd · oracle | Trade-off: CUSUM lowest false-alarm (0.0155 drift / 0.0196 step) but highest latency (12.9 / 10.3); CSD fastest (latency 4.3 / 4.8) but more false alarms (0.049 / 0.061) |
| Progress projection | gp_ard ★ · linear · kalman · oracle | GP lowest MAE on long bands (16.6 d vs kalman 29.3 on `max`) **but all CIs under-cover: GP 0.20 / 0.32 / 0.44 vs nominal 0.95** |
| Schedule generation | greedy_incumbent ★ · dp_capacity · rule_based · oracle | Close; greedy wins anchor mix (drift 2.55 d); **prereq-order correctness dipped < 1.0 on some mixes** (doc) |

Two things drive this plan: **(a) projection intervals are badly under-covered** (the one red result on slide 4), and **(b) hierarchical Bayes only ties pooled** — a tell that the hierarchy is doing no work *as wired*. Both are now confirmed in code (Decisions D-A1, D-A2).

### §0 — The KT benchmark is irrelevant to Pillar A (do not cross the streams)

KT (Pillar B) predicts "will the learner get the *next item correct*?" — target correctness, data item-response logs, metric AUC/ECE. Pillar A predicts pace/shift/finish-date/schedule — target minutes-over-time, data session logs, metric MAE / detection-latency / CI-coverage / deadline-drift. No shared target, data, or metric. The only links are conceptual (cold-start AUC curve ↔ calibration convergence curve; verified mastery feeds recalibration in the Phase-II closed loop). **Spend zero KT effort on Pillar A.**

### Open code questions — RESOLVED during planning (these were PA+.8; they gate A1/A2)

The direction note asked three questions "to verify before committing." All three are answered from the code, with evidence:

1. **Does the GP model AR(1) / heteroscedasticity? → No.** `packages/py-progress/src/py_progress/gp.py:129-138`: `signal_variance = residual_variance` from a single global linear fit; `noise_variance = GP_NOISE_RATIO * signal_variance` added to the **whole** kernel diagonal — a homoscedastic Gaussian likelihood. There is no AR(1) term and no per-point (heteroscedastic) noise. Extrapolation just multiplies the std by a flat `GP_EXTRAPOLATION_CI_INFLATION = 1.5` (`config.py`, `gp.py:197`). The generator emits **multiplicative lognormal AR(1)** noise (`generator/noise.py: apply_lognormal_ar1`, `AR1_PHI = 0.30`). Mismatch → over-confidence → under-coverage. **Confirms D-A1 / A1.**

2. **Do the calibrators use τ (time-of-day) / ν (day-of-week)? → No.** The contest candidate `IncumbentCalibration` returns `compute_hierarchical_model(sessions, set()).globalPosterior.mean` (`baselines/calibration.py:46,49`) — it **throws away** the `roleMultipliers` and role×time-of-day `insights` that `compute_hierarchical_model` actually computes (`py_progress/bayesian.py:102-172`). Day-of-week (ν) is modelled **nowhere** (`infer_time_of_day` exists; there is no `infer_day_of_week`). The generator's truth is `m_global · ρ(role) · τ(time_of_day) · weekend(day_of_week)` (`generator/pace.py:18`). Because the candidate collapses to the pooled global mean, it is *mathematically* the pooled estimator → it ties `pooled_bayes` exactly. **Confirms D-A2 / A2 and explains the puzzle.**

3. **Are any hyperparameters tuned on the same cells used to declare winners? → Not currently (so no active circularity), but nothing is tuned at all.** Candidate knobs are fixed constants: `SMACalibrator.window = 8`, `EWMACalibrator.alpha = 0.35` (`baselines/calibration.py`), `GP_LENGTH_SCALE = 7.0`, `GP_NOISE_RATIO = 0.20`, `GP_EXTRAPOLATION_CI_INFLATION = 1.5` (`config.py`); detection CUSUM k/h likewise fixed. So there is no leakage today — but the moment A1/A2/A4 introduce tunable candidates, the held-out-archetype split (A3) must gate them. **Confirms the circularity guard in D-A4.**

**Support docs (read before implementing):**

- [`research/doc/2026-06-14-pillar-a-rigour-and-extensions.md`](../../../research/doc/2026-06-14-pillar-a-rigour-and-extensions.md) — the direction note (four levers, candidate algorithms, priority order).
- [`2026-06-13-research-tier-2-pillar-a-fanout.md`](2026-06-13-research-tier-2-pillar-a-fanout.md) — the spine these tracks reuse (runners/metrics/paired/aggregate/writers/plots/oracles) and decisions D-08–D-12.
- [`college/scope/archetype-preregistration.md`](../../../college/scope/archetype-preregistration.md) — §2 SNR ranges, §5 shift schedule, §8 sweep grid, §9 oracles, §10 the place to record range changes (never candidate-favouring values).

## Decisions log

Plan-local decisions, prefixed `D-A` to avoid clashing with the master decision IDs.

### D-A1: Projection coverage fix = split-conformal wrapper (primary) + heteroscedastic-t/AR(1) GP (secondary)

**Status:** ✅ Agreed (PA+.1)

**Context:** Verified above — the GP likelihood is homoscedastic and ignores AR(1); coverage is 0.20/0.32/0.44 vs 0.95.

**Decision:** Add two projection candidates: **(a) `conformal`** — a split-conformal wrapper around the existing burn-up point forecast that calibrates interval width on a held-out residual quantile, giving finite-sample coverage **by construction** (model-agnostic, robust to the lognormal-AR(1) tails); **(b) `gp_hetero_t`** — a GP variant with a Student-t / heteroscedastic likelihood and an explicit AR(1) term on residuals. The existing `gp_ard` stays in the contest as the under-covered incumbent so the fix is visible. Coverage target ≈ nominal 0.95 within Monte-Carlo error; **do not** sacrifice more sharpness than necessary (report both coverage and sharpness, as the track already does).

**Rationale:** Conformal is the surest route to the headline "red→green"; the GP-t variant is the principled story for *why* it was under-covering.

**Reversibility:** easy (candidates are additive; `py-progress` `gp_regression` is untouched unless the GP-t variant lands there behind a flag).

### D-A2: Calibration gains a τ/ν-covariate Bayesian + empirical-Bayes partial-pooling candidate; the incumbent stops discarding structure

**Status:** ✅ Agreed (PA+.2)

**Context:** Verified above — the incumbent collapses to the global mean and ties pooled; τ is computed-but-unused, ν is unmodelled.

**Decision:** Add a `covariate_bayes` candidate that models pace as the generator's own multiplicative form `m_global · ρ(role) · τ(time_of_day) · ν(day_of_week)` and an `eb_partial_pool` candidate (empirical-Bayes shrinkage of per-role/context means toward the global, with the shrinkage weight estimated from between- vs within-group variance). Both reuse the role/context machinery already in `compute_hierarchical_model`. Add `infer_day_of_week` to `py-progress` (weekend vs weekday at minimum, matching the generator's `weekend_multiplier`). **Success criterion:** `eb_partial_pool` (and/or `covariate_bayes`) **beats** `pooled_bayes` on the *small* band with a bootstrap-CI on Δ that excludes 0 — the place sparse learners should benefit from borrowing strength, and exactly where the current hierarchy fails to.

**Rationale:** Recovers the signal the plain pooled average cannot, and resolves the "hierarchy does no work" puzzle honestly.

**Reversibility:** easy (additive candidates; `infer_day_of_week` is a new pure helper).

### D-A3: Statistical rigour — 200+ seeds, bootstrap CIs on Δ, held-out archetypes, multiple-comparison correction

**Status:** ✅ Agreed (PA+.3)

**Context:** Today: 40 seeds, p-values only, all archetypes used for both tuning and scoring, no correction across the many band×archetype×shift cells.

**Decision:** Make the seed count a runner parameter (default bumped to **200**; keep seed-0 frozen params hash `e716cd12dddc`). Report **bootstrap CIs on Δ-vs-incumbent** (not just p), add a **held-out-archetype** protocol (tune any hyperparameters on a declared subset of archetypes, score on the unseen ones), and apply **Holm / Benjamini–Hochberg** correction across all reported cells. Record which archetypes are train vs held-out in provenance.

**Rationale:** Turns every "winner" claim into a defensible, multiplicity-corrected, externally-tuned result.

**Reversibility:** easy (seed count + flags); note the dataset_id changes if the generator regime changes, so re-run all tracks together.

### D-A4: New candidates and winner tweaks are additive; tuning is gated by the held-out split (circularity guard)

**Status:** ✅ Agreed (PA+.4, PA+.5, PA+.6)

**Context:** The direction note lists many new candidates and winner tweaks; some are tunable.

**Decision:** New candidates (calibration: Kalman/particle; detection: BOCPD, Page-Hinkley, ADWIN, `ruptures` PELT as a *retrospective upper bound*; projection: BSTS, Monte-Carlo forward-sim — conformal/GP-t already in A1; scheduling: ILP/CP-SAT via OR-Tools as the exact optimum, local-search greedy repair, topological prereq scheduler) and winner tweaks (CUSUM robust running-scale + per-shift-type k/h + Page-Hinkley drift arm + Pareto frontier; greedy one-step lookahead + prereq-aware topological pre-order) are **additive** — they never replace a shipped candidate, and **any hyperparameter is tuned only on the held-out-train archetypes (D-A3)**. `ruptures` and the CP-SAT optimum are framed as *upper bounds*, not deployable candidates. Widen the sweep to 5+ points/axis and add adversarial regimes (multi-shift, step+drift, bursty missingness); report flip cells + per-archetype worst case, not just the mean.

**Rationale:** Grows the contest without rigging it and keeps the comparison neutral (decisions #3/#6/#11 from Part 2).

**Reversibility:** easy (candidates are additive); OR-Tools is a new optional clean-env dependency (record in `pyproject`).

### D-A5: Reality-match the generator to real *engagement* data via moments only (bounds), not by fitting

**Status:** ✅ Agreed (PA+.7)

**Context:** The generator is literature-anchored but clean; external validity needs real time-on-task data — **not KT correctness** (§0).

**Decision:** Enrich the generator (continuous archetype space, richer regimes, bursty dropout/return, heavy tails, a logged-time-misreporting layer the models don't see) and fit its **moments** (autocorrelation φ, shift frequency, gap distribution) to **OULAD / EdNet / Junyi** *engagement* series as **bounds/ranges only** (avoid circularity — never fit then score on the same fit), then re-run the contest on the reality-matched generator and check the ranking holds. Optionally run calibration/detection/projection **directly** on real engagement series as external validation, with the proxy mapping (clicks/interactions → "minutes toward a roadmap") stated explicitly. N=1 (Phase 5) stays the face-validity anchor.

**Rationale:** Turns "works on my synthetic data" into a thesis-grade external-validity claim.

**Reversibility:** moderate (a new generator regime changes `dataset_id`; keep the frozen `e716cd12dddc` regime alongside for comparability).

### D-A6: A1 ships the candidates + honest coverage; the ≈0.95 coverage *achievement* moves to A3 (across-learner conformal)

**Status:** ✅ Agreed 2026-06-17 (amendment; supersedes the A1 coverage target in the original DoD)

**Context:** A1 shipped `conformal` + `gp_hetero_t` and removed an earlier tuned multiplier. With the fudge gone, the **honest** coverage of split-conformal calibrated on *within-learner rolling residuals* is `0.50 / 0.67 / 0.85` (max/medium/small) — still below nominal 0.95 (`gp_hetero_t` `0.32/0.45/0.56`). Reviewed at `0912297` (VERIFICATION re-review). Root cause: within-learner rolling residuals are **not exchangeable** with the far-horizon finish-date extrapolation residual, so the split-conformal coverage guarantee does not apply to the finish-date interval.

**Decision:** A1's definition of done is the two candidates (registered, `gp_ard` retained), the flag-gated `gp_hetero_t` (default `gp_regression` unchanged), and **honestly-reported** coverage + sharpness + the reliability figure. The **≈0.95 coverage achievement is deferred to A3**, implemented as **across-learner split-conformal**: hold out a set of learners per length-band (reuse A3's held-out-archetype / multi-seed population), take one finish-date residual per held-out learner, and use that quantile for a new learner — which gives marginal coverage ≈0.95 *by construction* on exchangeable units. The degenerate A1 coverage test (asserts `1.0` on a noise-free fixture) is replaced by A3's noisy-fixture coverage test (≈0.95 within MC error).

**Rationale:** The genuine coverage fix needs the across-learner calibration population that A3 builds; forcing it into standalone A1 would either re-introduce tuning or duplicate A3's infrastructure. Deferring keeps both phases honest and unblocks A2.

**Reversibility:** easy (additive in A3; A1's shipped candidates are untouched).

### D-A7: A2 is re-scored on context-aware next-session prediction, not m_global recovery (the fair test of the hierarchy)

**Status:** ✅ Agreed 2026-06-17 (amendment; supersedes the A2 success criterion in D-A2 and the original DoD)

**Context:** A2 shipped leakage-free `covariate_bayes` / `eb_partial_pool` (redo `c601725`), but on the honest run **no candidate beats pooling on any band** (covariate Δ +0.019/+0.037/+0.047 small/medium/max; EB +0.006/+0.0075/+0.0077). Reviewing the harness explains why: the only scored candidate interface is `fit_global(sessions) -> float`, and the prequential metric feeds that single **context-blind** number against `r_star[t]`, the **context-specific** noise-free pace (`runners/calibration.py:189-204`, `metrics/prequential.py`, targets = `truth["r_star"]` at `runners/calibration.py:156-157`). So `covariate_bayes` computes role/time/day multipliers and is then forced to discard them — the exact sin (collapse-to-global) that D-A2 set out to fix, now imposed by the harness on every candidate. On "recover `m_global`," pooling is near-optimal (generator multipliers centre near 1.0), so the covariate model only adds estimation variance → the honest null is expected, not a defect.

**Decision:** Re-scope A2's success criterion to **context-aware next-session prediction** — the question the hierarchy is actually for, and the one the product needs (predicting next-session pace for finish-date projection):

1. Add `predict_next(history, next_context) -> float` to the `CalibrationCandidate` interface. Context-blind candidates (`pooled_bayes`/`sma`/`ewma`) default to their global estimate; `covariate_bayes`/`eb_partial_pool` return `ĝlobal · ρ̂(role) · τ̂(time_of_day) · ν̂(day_of_week)` for the **upcoming session's known context**.
2. Add a **context-aware prequential prediction-error** metric: for each upcoming session `t`, score `predict_next(sessions[:t], context_of(t))` against `r_star[t]`. Report it **alongside** the existing `m_global`-recovery metric — do not drop recovery.
3. **Revised success criterion:** `covariate_bayes` and/or `eb_partial_pool` **beats `pooled_bayes` on context-aware next-session prediction** with a bootstrap CI on Δ excluding 0 (small-band emphasis for EB); the `m_global`-recovery comparison is reported honestly (pooling competitive there). If neither beats pooling even on the prediction metric, the null is robust — document it and move on.

**Why this is principled, not goalpost-moving:** the upcoming session's context (material role, day, time) is legitimately known at prediction time; the multipliers are estimated from the learner's **own past** sessions (the generator-truth leak removed in `c601725` stays removed); pooling receives the same information and simply cannot use it — a fair reflection of its modelling limit. Keeping the recovery metric reported (pooling wins) means the null is contextualised, not hidden.

**Reversibility:** easy (additive interface method + additional metric column; `ridge` strength still tuned only on held-out archetypes in A3, never on scoring cells).

## Architecture overview

All work stays in the clean `uv` env and reuses the Part 2 spine (`runners/`, `metrics/`, `baselines/`, `oracles/`, `plots/`, `writers/`, `paired.py`, `aggregate.py`). New code slots beside the existing track modules; `py-progress` gains two pure helpers.

```
research/comparison/src/research_comparison/
  baselines/
    projection.py     MODIFY (A1): + forecast_conformal_finish, + forecast_gp_hetero_t_finish
    calibration.py    MODIFY (A2): + CovariateBayesCalibrator, + EBPartialPoolCalibrator (+ Kalman A4)
    detection.py      MODIFY (A4): + BOCPD, PageHinkley, ADWIN, ruptures-PELT (upper bound)
    scheduling.py     MODIFY (A4): + CPSAT optimum (OR-Tools), local-search repair, topo scheduler
  metrics/
    rigour.py         NEW (A0/A3): bootstrap CI on Δ, Holm/BH correction, held-out split helpers
  runners/            MODIFY: --seeds (default 200), --held-out-archetypes, emit bootstrap CIs
  plots/
    projection_reliability.py  MODIFY (A1): show conformal vs gp_ard coverage curves
    robustness_heatmap.py      MODIFY (A4/A6): wider/adversarial sweep cells + flip map
  generator/          MODIFY (A5): continuous archetypes, richer regimes, misreporting layer (new regime id)
packages/py-progress/src/py_progress/
  bayesian.py         MODIFY (A2): + infer_day_of_week; expose covariate/EB helpers
  gp.py               MODIFY (A1, behind a flag): + AR(1) residual term + heteroscedastic/Student-t option
research/results/{calibration,detection,projection,scheduling,sweep}/   re-run, re-stamped
college/.../report/generated/   projection_reliability.pdf, calibration_winners.tex, robustness_heatmap.pdf  regenerated
```

Candidate rosters after this plan (★ = shipped incumbent, ✚ = added here):

| Track | Incumbent | Added (this plan) | Primary metric |
|---|---|---|---|
| Calibration | hierarchical_bayes ★ | ✚ covariate_bayes, eb_partial_pool, kalman | recovery MAE; **CI on Δ** |
| Detection | cusum ★ | ✚ bocpd, page_hinkley, adwin, ruptures(UB) | latency↔false-alarm Pareto, per shift-type |
| Projection | gp_ard ★ | ✚ conformal, gp_hetero_t, bsts, mc_forward_sim | **95% CI coverage** + sharpness + finish-date error |
| Scheduling | greedy_incumbent ★ | ✚ cpsat(optimum), local_search, topo | deadline-drift, capacity-violation, prereq-order, gen-time |

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `research/comparison/src/research_comparison/metrics/rigour.py` | new | A0/A3 | Bootstrap-CI-on-Δ, Holm/BH, held-out-archetype split |
| `research/comparison/tests/test_rigour.py` | new | A0/A3 | Unit-test the rigour utilities on fixtures |
| `research/comparison/src/research_comparison/baselines/projection.py` | modify | A1 | `forecast_conformal_finish`, `forecast_gp_hetero_t_finish` |
| `packages/py-progress/src/py_progress/gp.py` | modify | A1 | AR(1) residual term + heteroscedastic/Student-t option (flagged) |
| `research/comparison/src/research_comparison/plots/projection_reliability.py` | modify | A1 | conformal vs gp_ard coverage |
| `research/comparison/src/research_comparison/baselines/calibration.py` | modify | A2 | covariate-Bayes + EB-partial-pool candidates |
| `packages/py-progress/src/py_progress/bayesian.py` | modify | A2 | `infer_day_of_week`; covariate/EB helpers |
| `research/comparison/src/research_comparison/runners/*.py` | modify | A3 | `--seeds 200`, `--held-out-archetypes`, emit bootstrap CIs |
| `research/comparison/src/research_comparison/baselines/{detection,scheduling}.py` | modify | A4 | new candidates + winner tweaks |
| `research/comparison/pyproject.toml` | modify | A4 | add `ortools` (CP-SAT) dependency |
| `research/comparison/src/research_comparison/runners/sweep.py` + `plots/robustness_heatmap.py` | modify | A4 | wider/adversarial sweep + flip map |
| `research/comparison/src/research_comparison/generator/*.py` | modify | A5 | reality-matched regime (new `dataset_id`) |
| `research/results/{calibration,detection,projection,scheduling,sweep}/*.json` | regen | A1–A5 | re-stamped real results |
| `college/.../report/generated/*` | regen | A1–A5 | updated figures/tables |
| `college/scope/research-tasklist.md` | modify | each | tick `PA+.N` as completed |

## Phases

### Phase A0: Lock findings + rigour scaffolding

**Status:** ✅ Complete — e1c6455
**Depends on:** Part 2 (Phases 3 & 7) `✅ Complete`
**Estimated scope:** 1 new module (~150 lines) + tests; no track re-run yet

Covers PA+.8 (record the verified findings) and front-loads the PA+.3 utilities so A1/A2/A4 can use them. Pure, fast, CI-runnable.

#### Codebase state assumed at start

- `research/results/{calibration,detection,projection,scheduling,sweep}/*.json` exist (Part 2 shipped).
- `metrics/paired.py` and `metrics/aggregate.py` exist (the spine).

#### Verification (run BEFORE starting)

```bash
export PATH="$HOME/.local/bin:$PATH"
ls research/results/projection/projection_results.json research/results/calibration/calibration_results.json
uv run --package research-comparison python -c "import research_comparison.metrics.paired; print('spine ok')"
```

#### Steps

1. **`metrics/rigour.py` (PA+.3 utilities).** Pure functions, numpy-only:
   - `bootstrap_delta_ci(deltas, *, n_boot=10000, alpha=0.05, seed=0) -> (lo, hi, point)` — percentile bootstrap CI on a paired Δ array.
   - `holm_bonferroni(pvalues) -> list[bool]` and `benjamini_hochberg(pvalues, q=0.05) -> list[bool]` — reject masks across the many band×archetype×shift cells.
   - `heldout_archetype_split(archetypes, *, train, seed=0) -> (train_set, test_set)` — declares a frozen train/test archetype partition (default: tune on `{steady, marathon_runner, morning_lark}`, score on `{deadline_sprinter, fading_flame, weekend_warrior}` — recorded, not chosen by performance).
2. **Record the resolved open-code-question findings** as a short docstring/`README` note in `metrics/rigour.py` (or a `research/doc/` appendix) pointing at the exact file:line evidence from Context §"Open code questions". This closes PA+.8 with code-grounded answers.
3. **Tests** `test_rigour.py`: bootstrap CI brackets a known mean; Holm/BH match hand-computed reject sets on a small p-vector; the held-out split is deterministic and disjoint.

#### Tests

```bash
uv run --package research-comparison pytest research/comparison/tests/test_rigour.py -q
```

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison pytest research/comparison/tests/test_rigour.py -q     # pass
uv run --package research-comparison python -c "from research_comparison.metrics.rigour import bootstrap_delta_ci, holm_bonferroni, heldout_archetype_split; print('rigour ok')"
```

#### Rollback

`git rm research/comparison/src/research_comparison/metrics/rigour.py research/comparison/tests/test_rigour.py`.

#### Notes (filled in during implementation)

Added the pure A0 rigour utility module and focused tests only; no track runners or result artifacts were changed. The PA+.8 open-code-question evidence is recorded in the `metrics/rigour.py` module docstring with current file:line references. Verification passed with the A0 focused pytest command and import check; `uv` commands required sandbox escalation only because the local uv cache lives under `/Users/rsaji/.cache/uv`.

---

### Phase A1: Projection coverage fix — the one red result → green (PA+.1)

**Status:** ✅ Complete — `0912297`
**Depends on:** Phase A0
**Estimated scope:** `baselines/projection.py` (+2 candidates) + optional `py-progress/gp.py` flag + re-run projection track + reliability figure

The headline fix. GP-ARD coverage today: **0.20 (max) / 0.32 (medium) / 0.44 (small)** vs nominal **0.95**; MAE 16.6 d on `max`. Root cause (D-A1, verified): homoscedastic Gaussian likelihood ignoring lognormal-AR(1) noise.

#### Codebase state assumed at start

- Phase A0 `✅ Complete`: `metrics/rigour.py` available.
- `baselines/projection.py` has `forecast_gp_finish` (calls `py_progress.fit_burn_up_gp`), `forecast_linear_finish`, `forecast_kalman_finish`; the projection runner scores coverage/sharpness/MAE per band.

#### Verification (run BEFORE starting)

```bash
export PATH="$HOME/.local/bin:$PATH"
python3 -c "import json;d=json.load(open('research/results/projection/projection_results.json'));print({b:round(v['candidates']['gp_ard']['coverage'],3) for b,v in d['winner_by_band'].items()})"
# expect ~ {'max':0.2,'medium':0.322,'small':0.44}
```

#### Steps

1. **`forecast_conformal_finish` (D-A1a).** Split-conformal wrapper: from the observed burn-up points, hold out the last `m` points as a calibration set, compute the point forecast's absolute residual quantile at level `1-α`, and inflate the finish-date interval to that quantile → finite-sample ≈0.95 coverage by construction. Model-agnostic (wraps the existing point path). Return the same dict shape (`candidate, predicted_finish_date, interval_low, interval_high, sharpness_days`) so the runner/metrics need no change.
2. **`forecast_gp_hetero_t_finish` (D-A1b).** A GP variant with (i) a per-point (heteroscedastic) noise scaled by local session-length/volatility and (ii) an explicit AR(1) residual term (φ estimated from residual autocorrelation), with a Student-t predictive for heavier tails. Implement behind a flag in `py-progress/gp.py` (`gp_regression(..., likelihood="student_t", ar1=True)`) so the shipped `gp_regression` default is untouched, and call it from the new forecaster.
3. **Register both** in the projection candidate list; keep `gp_ard` so the before/after is visible.
4. **Re-run the projection track** (frozen params hash, seed 0; seed count bump deferred to A3) and **regenerate `projection_reliability.pdf`** showing conformal/gp_hetero_t coverage near the 0.95 line vs gp_ard below it.

#### Tests

- `test_projection_track.py` — extend: conformal coverage on the synthetic projection rows is ≥ 0.90 (within MC error of 0.95) on at least the `medium`+`max` bands where gp_ard was worst; sharpness reported (not absurdly inflated). Hand-check the conformal quantile math on a fixture.

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -m research_comparison.runners.projection   # re-run track
python3 -c "import json;d=json.load(open('research/results/projection/projection_results.json'));print({b:round(v['candidates'].get('conformal',{}).get('coverage',float('nan')),3) for b,v in d['winner_by_band'].items()})"   # ~0.9-0.97
uv run --package research-comparison pytest research/comparison/tests/test_projection_track.py -q
test -s college/mydeliverables/1st-Review/report/generated/projection_reliability.pdf && echo "reliability fig regenerated"
```

#### Rollback

`git checkout research/comparison/src/research_comparison/baselines/projection.py packages/py-progress/src/py_progress/gp.py research/results/projection college/mydeliverables/1st-Review/report/generated/projection_reliability.pdf`.

#### Notes (filled in during implementation)

Added `conformal` and `gp_hetero_t` projection candidates while retaining `gp_ard`. The `gp_hetero_t` variant is flag-gated through `gp_regression(..., likelihood="student_t", ar1=True)` / `fit_burn_up_gp(..., likelihood="student_t", ar1=True)`; the default Gaussian/no-AR path is covered by a regression test and the existing py-progress fixture suite. After A1 review, removed the invalid tuned `4.20` conformal width multiplier and replaced it with a residual-phi AR(1) variance inflation. Re-ran the frozen projection track and regenerated `projection_reliability.pdf`; honest conformal coverage is max/medium/small `0.501/0.669/0.849`, with interval sharpness `29.4/19.3/7.7` days, so the remaining under-coverage is reported rather than tuned away.

---

### Phase A2: Calibration covariates + empirical-Bayes pooling (PA+.2)

**Status:** ✅ Complete — `4445701`
**Depends on:** Phase A0 (A1 not required)
**Estimated scope:** `baselines/calibration.py` (+2 candidates) + `py-progress/bayesian.py` helper + re-run calibration track

Resolve the "hierarchical_bayes ties pooled_bayes exactly" puzzle (Δ ≈ ±1e-17, p ≈ 0.42–0.67). Root cause (D-A2, verified): the incumbent collapses to `globalPosterior.mean`, discarding the role/time structure; ν is unmodelled.

#### Codebase state assumed at start

- Phase A0 `✅ Complete`.
- `baselines/calibration.py` exposes `IncumbentCalibration` (→ `compute_hierarchical_model(...).globalPosterior.mean`), `SMACalibrator`, `EWMACalibrator`, `PooledBayesianCalibrator`, `calibration_candidates()`.
- `py-progress/bayesian.py` has `infer_time_of_day` and `compute_hierarchical_model` (which already computes role multipliers + role×time-of-day insights).

#### Verification (run BEFORE starting)

```bash
export PATH="$HOME/.local/bin:$PATH"
python3 -c "import json;d=json.load(open('research/results/calibration/calibration_results.json'));print({b:{'pooled':round(v['pooled_bayes']['delta'],3),'p':round(v['pooled_bayes']['p_value'],3)} for b,v in d['paired_vs_incumbent'].items()})"
# expect Δ ~ 0 and p ~ 0.42-0.67 (the tie)
```

#### Steps

1. **`infer_day_of_week` in `py-progress/bayesian.py` (D-A2).** Pure helper mirroring `infer_time_of_day` — returns at least `weekend`/`weekday` (matching the generator's `weekend_multiplier`), ideally the day name. No change to existing call sites.
2. **`CovariateBayesCalibrator` (D-A2).** Models pace multiplicatively as `m_global · ρ̂(role) · τ̂(time_of_day) · ν̂(day_of_week)`, estimating each effect from its bucket (reusing the role/context grouping already in `compute_hierarchical_model`) with Bayesian shrinkage toward 1.0. `fit_global` returns the implied current-context multiplier; `fit_interval` propagates the per-effect posterior variances.
3. **`EBPartialPoolCalibrator` (D-A2).** Empirical-Bayes shrinkage of per-role/context means toward the global mean, with the shrinkage weight `= τ²/(τ²+σ²/n)` where between-group variance τ² and within-group σ² are estimated from the data (James–Stein style). This is the candidate expected to beat pooled on sparse (small-band) learners.
4. **Register both** in `calibration_candidates()`; keep the incumbent as-is so the comparison is honest.
5. **Re-run the calibration track** and report **bootstrap CIs on Δ** (A0 util) per band. *(Steps 1–5 shipped at `c601725`, leakage-free; the m_global-recovery success criterion in D-A2 is superseded by D-A7 below.)*

> **⚠️ Re-scope — REQUIRED for the current redo (D-A7).** Steps 1–5 are done and verified leakage-free, but on the m_global-recovery metric no candidate beats pooling — because the harness only scores the context-blind `fit_global`. Implement the fair, context-aware test:
>
> 6. **`predict_next(history, next_context) -> float` on the `CalibrationCandidate` interface.** Context-blind candidates (`pooled_bayes`/`sma`/`ewma`) default to their global estimate; `covariate_bayes`/`eb_partial_pool` return `ĝlobal · ρ̂(role) · τ̂(time_of_day) · ν̂(day_of_week)` for the **upcoming session's known context** (role/day/time of session `t`), with all multipliers estimated from `history` (the learner's own past sessions) only.
> 7. **Context-aware prequential metric.** For each upcoming session `t`, score `predict_next(active_sessions[:t], context_of(active_sessions[t]))` against `r_star[t]` (already the target in `metrics/prequential.py` / `runners/calibration.py`). Add it as a new per-row field (e.g. `context_pred_mae`) and a `paired_vs_incumbent` block; **keep** the existing `recovery_mae`/`prequential_mae` (pooling competitive there — report honestly).
> 8. **Revised success criterion (D-A7):** `covariate_bayes` and/or `eb_partial_pool` **beats `pooled_bayes` on context-aware next-session prediction** with a bootstrap CI on Δ excluding 0 (small-band emphasis for EB). If neither beats pooling even here, record the robust null as the finding.
>
> **No-leakage / no-gaming guards (carried):** never import the generator's `ROLE_RHO`/`TAU_GENERIC` into `baselines/`; multipliers come only from the learner's own past sessions; the upcoming context is observable (the schedule), so using it is not leakage; `ridge` stays neutral/fixed here and is tuned only on held-out archetypes in A3.

#### Tests

- `test_calibration_track.py` — extend: on a synthetic small-band fixture with planted role/time structure, `covariate_bayes` recovers the per-bucket multipliers within tolerance and `eb_partial_pool`'s recovery MAE < `pooled_bayes`'s. Assert `infer_day_of_week` is deterministic for known timestamps. **(D-A7)** add: `predict_next` applies the correct multipliers for a given upcoming context; on a fixture with planted context structure, `covariate_bayes`/`eb_partial_pool` context-prediction error < `pooled_bayes`'s.

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -m research_comparison.runners.calibration   # re-run track
python3 -c "import json;d=json.load(open('research/results/calibration/calibration_results.json'));print('candidates in small band:', list(d['winner_per_band']['small']['candidates']))"
python3 -c "import json;d=json.load(open('research/results/calibration/calibration_results.json'));print({b:{c:round(d['paired_vs_incumbent'][b].get(c,{}).get('context_pred_mae_delta',float('nan')),5) for c in ('covariate_bayes','eb_partial_pool')} for b in ('small','medium','max')})"
uv run --package research-comparison pytest research/comparison/tests/test_calibration_track.py -q
```

#### Rollback

`git checkout research/comparison/src/research_comparison/baselines/calibration.py research/comparison/src/research_comparison/metrics/aggregate.py research/comparison/src/research_comparison/metrics/prequential.py research/comparison/src/research_comparison/runners/calibration.py research/comparison/tests/test_calibration_track.py research/results/calibration`.

#### Notes (filled in during implementation)

Added `infer_day_of_week`, `covariate_bayes`, and `eb_partial_pool` while keeping the original `hierarchical_bayes` incumbent unchanged. The first A2 implementation centered `covariate_bayes` on generator constants and was rejected for leakage. The redo removes `ROLE_RHO`/`TAU_GENERIC` from the baseline, centers every role/time/day coefficient at neutral no-effect in log-space, and adds a sparse-context regression test proving unsupported effects shrink to `1.0`. Re-ran the calibration track and regenerated the gitignored `research/results/calibration/calibration_results.json`; after leakage removal, A2 is an honest null on the frozen run: small-band `covariate_bayes` Δ-vs-incumbent is `+0.019186` with CI `[+0.013594, +0.024713]`, and `eb_partial_pool` is `+0.005990` with CI `[+0.003874, +0.008064]`. Both are worse than the incumbent/pooled tie, so the original D-A2 success criterion is not met without privileged generator information.

D-A7 redo adds `predict_next(history, next_context)` and a context-aware prequential metric (`context_pred_mae`) while retaining `recovery_mae` / `prequential_mae`. The context-aware result is mixed and reported as such: small-band prediction remains worse than pooled (`covariate_bayes` Δ `+0.009776`, CI `[+0.005207, +0.014124]`; `eb_partial_pool` Δ `+0.012204`, CI `[+0.007630, +0.016565]`), but `covariate_bayes` beats pooled on medium (Δ `-0.005486`, CI `[-0.010476, -0.000615]`) and max (Δ `-0.011514`, CI `[-0.014586, -0.008257]`), while `eb_partial_pool` beats pooled on max (Δ `-0.008540`, CI `[-0.011906, -0.005069]`) and is inconclusive on medium. Recovery remains worse everywhere, which preserves the D-A7 contrast: context helps richer next-session prediction but not global recovery, and sparse small-band prediction remains an honest negative.

---

### Phase A3: Statistical rigour — seeds, bootstrap CIs, held-out archetypes, MC correction (PA+.3)

**Status:** ✅ Complete — 2b8e23cfda2919c97aad14c1261761e2908621e1
**Depends on:** Phases A1, A2 (so the new candidates are scored under the rigorous protocol)
**Estimated scope:** runner flags + writer/paired wiring across all four tracks + full re-run

Make every "winner" claim defensible. Today: 40 seeds, p-only, all-archetype tuning, no correction.

#### Codebase state assumed at start

- A0 `rigour.py` available; A1/A2 candidates registered.
- Runners (`runners/{calibration,detection,projection,scheduling}.py`) read a seed/seed-count and the archetype mix from `params`/provenance.

#### Verification (run BEFORE starting)

```bash
export PATH="$HOME/.local/bin:$PATH"
python3 -c "import json;print('seeds today:', json.load(open('research/results/calibration/calibration_results.json'))['_provenance']['n_learners'])"   # 720 = 6x3x40
uv run --package research-comparison python -c "from research_comparison.metrics.rigour import bootstrap_delta_ci; print('rigour present')"
```

#### Steps

1. **`--seeds` knob (default 200).** Thread a seed-count through each runner; keep seed 0 + params hash `e716cd12dddc` frozen. Document that bumping seeds increases `n_learners` (6 × 3 × seeds) and changes nothing about the regime.
2. **Bootstrap CIs on Δ.** In each track's `paired_vs_incumbent` (or equivalent), add `delta_ci_low/high` from `bootstrap_delta_ci` alongside the existing `delta`/`p_value`/`effect_size`.
3. **Held-out archetypes.** Use `heldout_archetype_split` (A0): any tunable candidate (A1 conformal `m`, GP-t hyperparams; A2 shrinkage; A4 detection k/h) is fitted on the train archetypes only and scored on the held-out set. Record the partition in `_provenance`.
4. **Multiple-comparison correction.** Apply Holm (primary) + BH (reported) across all band×archetype×shift comparison cells; mark which "wins" survive correction.
5. **Across-learner conformal projection coverage (D-A6, carried from A1).** Add a `conformal` calibration that uses the **across-learner** finish-date residuals from the held-out set (per length-band) — not within-learner rolling residuals — so coverage is marginal-≈0.95 *by construction*. Replace the degenerate A1 coverage test (which asserts `1.0` on a noise-free fixture) with a **noisy-fixture** test asserting coverage ≈0.95 within MC error on `medium`+`max`, and report coverage **and** sharpness. Target: lift the honest `0.50/0.67` (max/medium) toward nominal 0.95; `gp_ard` retained as the under-covered incumbent for contrast.
6. **Regenerate** the winner tables/figures with CIs and corrected significance flags, including the updated `projection_reliability.pdf`.

#### Tests

- Extend each track test to assert the result JSON now carries `delta_ci_low/high` and a `mc_correction` block, and that the held-out partition is present and disjoint in provenance.

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -m research_comparison.runners.calibration --seeds 200
uv run --package research-comparison python -m research_comparison.runners.detection --seeds 200
uv run --package research-comparison python -m research_comparison.runners.projection --seeds 200
uv run --package research-comparison python -m research_comparison.runners.scheduling --seeds 200
python3 -c "import json;d=json.load(open('research/results/calibration/calibration_results.json'));b=d['paired_vs_incumbent']['small']['ewma'];assert 'delta_ci_low' in b, 'missing bootstrap CI';print('CIs present')"
uv run --package research-comparison pytest research/comparison/tests -q
```

#### Rollback

`git checkout research/comparison/src/research_comparison/runners research/results`.

#### Notes (filled in during implementation)

A3 ran on `synthetic-e716cd12dddc-seed0-n3600` (6 archetypes x 3 bands x
200 seeds) with seed 0 and params hash `e716cd12dddc` unchanged. The reported
winner summaries, paired deltas, and MC corrections are computed on the
held-out archetypes (`deadline_sprinter`, `fading_flame`, `weekend_warrior`);
train rows remain in the raw `rows` arrays for audit. The across-learner
conformal projection interval uses one max finish-date residual per train
learner per band; held-out coverage is 0.991 medium and 0.906 max, with
`gp_ard` retained as the under-covered incumbent. The full 200-seed projection
run exposed a Kalman overflow on an early negative trend; the fix falls back to
the learner's observed cumulative minutes-per-day when the Kalman slope is
non-positive, and a regression test covers the failing fixture.

---

### Phase A4: New candidates per track + winner tweaks + wider/adversarial sweep (PA+.4–.6)

**Status:** ✅ Complete — 5aa4c2e0544aaba2fae1b5c65bd6560bd2729342
**Depends on:** Phase A3 (everything new is scored under the rigorous protocol + held-out tuning)
**Estimated scope:** `baselines/{calibration,detection,scheduling}.py` + sweep runner + heatmap + `ortools` dep

Grow the contests neutrally (D-A4). Additive only; tuning gated by the held-out split.

#### Steps

1. **Calibration:** add `kalman` (state-space random-walk pace) and optionally `particle` (regime-switching) candidates.
2. **Detection:** add `bocpd` (run-length posterior), `page_hinkley` (drift specialist), `adwin` (streaming drift), and `ruptures` PELT/BinSeg as a **retrospective upper bound** (already a dependency). Tweak the CUSUM winner: robust running-scale standardisation (one threshold across σ_log), per-shift-type k/h, a Page-Hinkley drift arm, and report the **latency↔false-alarm Pareto frontier** (CUSUM+CSD ensemble) instead of one operating point. (Today CUSUM: FA 0.0155/0.0196, latency 12.9/10.3; CSD: latency 4.3/4.8, FA 0.049/0.061 — the frontier makes the trade-off explicit.)
3. **Scheduling:** add a **CP-SAT / ILP exact optimum** (OR-Tools — new clean-env dep) as the gold-standard upper bound, a **topological prereq scheduler**, and **local-search (SA/tabu) greedy repair**. Tweak greedy: one-step lookahead + prereq-aware topological pre-order (the doc notes prereq-order correctness dipped < 1.0 on some mixes; today it's 1.0 on the anchor mix — confirm which mix dips and target it).
4. **Sweep (PA+.6):** widen to 5+ points/axis (today 3, e.g. `ar1_phi ∈ {0,0.3,0.5}`, `sigma_log ∈ {0.12,0.18,0.25}`) and add adversarial regimes (multi-shift per journey, step+drift combined, bursty missingness). Report **where the ranking flips** (today the sweep already records detection flip cells) and **per-archetype worst case**, not just the mean. Regenerate `robustness_heatmap.pdf`.

#### Tests

- Per-track tests: each new candidate returns the track's result dict shape and runs without error on a fixture; `ruptures`/CP-SAT are labelled `upper_bound` and excluded from the deployable-winner selection; the Pareto frontier output is monotone.

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -c "import ortools; print('ortools ok')"
uv run --package research-comparison python -m research_comparison.runners.detection --seeds 200
uv run --package research-comparison python -m research_comparison.runners.scheduling --seeds 200
uv run --package research-comparison python -m research_comparison.runners.sweep
uv run --package research-comparison pytest research/comparison/tests -q
test -s college/mydeliverables/1st-Review/report/generated/robustness_heatmap.pdf && echo "heatmap regenerated"
```

#### Rollback

`git checkout research/comparison/src/research_comparison/{baselines,runners,plots} research/comparison/pyproject.toml research/results`.

#### Notes (filled in during implementation)

A4 implementation completed against frozen regime `e716cd12dddc` and the A3
held-out split. Calibration added `kalman`; detection added `bocpd`,
`page_hinkley`, `adwin`, and `ruptures_pelt_binseg` (`candidate_kind:
upper_bound`) while CUSUM now uses robust running-scale z scores, train-only
grid-selected per-shift k/h, and a Page-Hinkley drift arm. Scheduling added
`topological_prereq` and `local_search_repair`; `cpsat_optimum` is implemented
as an OR-Tools optional upper bound and is gracefully skipped in this
environment because `ortools` is not installed. The previously dipping
`anchor+practice` mix was traced to non-chronological selected-day allocation;
normalising allocation chronology and role order brings all deployable
material-mix prereq summaries back to 1.0. Sweep now uses five points per axis,
adds multi-shift, step+drift, and bursty-missingness adversarial regimes,
records `flip_cells` and `per_archetype_worst_case`, and regenerated
`robustness_heatmap.pdf`.

Verification run: `calibration --seeds 200`, `detection --seeds 200`,
`scheduling --seeds 200`, full default `sweep` (3,128 points / 9,384 rows),
`python -m research_comparison.plots.robustness_heatmap`, Ruff on touched
Python files, and `pytest research/comparison/tests -q` (`78 passed`).

---

### Phase A5: Reality-matched generator + external validity (PA+.7)

**Status:** ✅ Complete — 68f4a121ed1ab6533db2f2949625f367258146d2
**Depends on:** Phase A4 (the full, rigorous contest exists to re-run on the new regime)
**Estimated scope:** generator enrichment (new `dataset_id`) + moments-fit script + re-run + external-validity note

The external-validity story. **Engagement** data (OULAD/EdNet/Junyi time-on-task), **not** KT correctness (§0).

#### Steps

1. **Enrich the generator (D-A5):** continuous archetype space (sample latent traits from a mixture instead of 6 discrete types), richer regimes (multiple shifts, relapse/recovery, exam-crunch seasonality, illness/holiday gaps), bursty missingness (dropout + return-after-hiatus, weekend clustering), heavier-tailed session-length-dependent noise, and a **logged-time-misreporting** layer the models don't see (tests robustness, not fit). Gate behind a new `dataset_id` / params hash; keep the frozen `e716cd12dddc` regime alongside for comparability.
2. **Fit moments to real engagement data (bounds only).** A script that derives autocorrelation φ, shift frequency, and gap-distribution **ranges** from OULAD (daily clicks + assessments) / EdNet / Junyi (timestamps), feeds them as generator parameter *bounds* (never point-fits then scores on the same fit — circularity guard), and records the source + mapping. State the proxy mapping (clicks/interactions → "minutes toward a roadmap") explicitly.
3. **Re-run the full contest** on the reality-matched generator under the A3 rigour protocol; **check the per-track ranking holds**; report where it doesn't (honest external-validity result).
4. **(Optional) Direct external validation:** run calibration/detection/projection on real engagement series with the stated proxy mapping. N=1 (Phase 5) remains the face-validity overlay.

#### Tests

- Generator tests: the new regime produces the planted richer structure (multi-shift labels in the sidecar, bursty-gap distribution, misreporting layer present but hidden from candidate inputs); the frozen regime is unchanged (hash `e716cd12dddc` still reproduces).

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison pytest research/comparison/tests/test_generator.py -q
# re-run contest on the reality-matched regime and confirm the ranking summary is emitted
uv run --package research-comparison python -m research_comparison.runners.sweep
python3 -c "print('external-validity ranking-hold check: inspect sweep stability + per-track winners on new dataset_id')"
```

#### Rollback

`git checkout research/comparison/src/research_comparison/generator research/results`; the frozen-regime artifacts are preserved by design.

#### Notes (filled in during implementation)

A5 adds a separate `reality_matched` generator regime; the default frozen
regime remains byte-stable (`generate_learner("steady", "medium", 42)` SHA-256
`62addf4b4d019c505d0781a37736b020bea58931730272c2791e540c5c1bbce1`).
OULAD moment bounds were derived by streaming `studentVle.csv` (10,655,280
rows) and aggregating a deterministic 1,701-series sample; pre-start days are
excluded and the proxy mapping is recorded as daily `sum_click` engagement
intensity -> minutes toward a roadmap. Bounds are used as ranges only, producing
reality params hash `3b404c903563` and dataset
`synthetic-reality-3b404c903563-seed0-n3600`.

The reality regime samples continuous traits around the named archetype
components, adds relapse/recovery and exam-crunch annotations, plants an
illness/holiday hiatus plus weekend clustering, uses heavy-tailed
session-length-dependent AR(1) noise, and records the logged-time
misreporting layer only in the sidecar. The A3 protocol was rerun on the new
dataset for calibration, detection, projection, and scheduling; the default
sweep verification command was also rerun. Ranking hold is mixed: projection
holds (`conformal` best non-oracle on all bands; `conformal`/`gp_hetero_t` keep
Holm-surviving wins), scheduling holds (non-greedy schedulers still beat
`greedy_incumbent`; `dp_capacity` wins every material mix), detection only
partially holds (drift remains `cusum`, step switches from A4 `page_hinkley` to
`cusum`), and calibration does not hold for the structured covariate/EB
candidates (they are often Holm-significant in the wrong direction; SMA/EWMA
have surviving context-prediction wins). A5.4 direct external validation was
not run because it is optional; this phase uses OULAD for moment bounds only.
Committed evidence lives under
`research/doc/verification-runs/2026-06-18-a5-pillar-a/`.

---

## Definition of done (whole plan)

- **A1 (amended by D-A6):** `conformal` + `gp_hetero_t` shipped and registered (`gp_ard` retained); `gp_hetero_t` flag-gated with the default `gp_regression` path unchanged; coverage + sharpness **honestly reported** with no tuned constants; `projection_reliability.pdf` regenerated. *The ≈0.95 coverage achievement itself is deferred to A3 (across-learner conformal).* Honest A1 coverage: conformal 0.50/0.67/0.85, gp_hetero_t 0.32/0.45/0.56 vs gp_ard 0.20/0.32/0.44.
- **A2 (amended by D-A7):** `infer_day_of_week` shipped; leakage-free `covariate_bayes` + `eb_partial_pool` registered (incumbent untouched); a context-aware `predict_next(history, next_context)` path added; context-aware next-session prediction **beats `pooled_bayes` on medium/max for `covariate_bayes` and max for `eb_partial_pool`** with bootstrap CIs excluding 0, while the sparse small band remains an honest negative and `m_global`-recovery is worse everywhere. The "ties pooled" puzzle resolved + documented: the hierarchy does no work on global recovery, helps richer context-aware prediction, and still does not solve sparse small-band prediction.
- **A3:** all tracks run at ≥200 seeds with bootstrap CIs on Δ, a recorded held-out-archetype partition, and Holm/BH-corrected significance flags; **plus (D-A6) across-learner conformal projection coverage ≈0.95 by construction**, with a noisy-fixture coverage test replacing A1's degenerate one.
- **A4:** each track has the new candidates (with `ruptures`/CP-SAT labelled upper bounds); CUSUM Pareto frontier reported; scheduling prereq-order correctness back to 1.0 on the dipping mix; sweep widened + adversarial regimes + flip map + per-archetype worst case.
- **A5:** a reality-matched generator regime (new `dataset_id`) fitted to OULAD/EdNet/Junyi *moments* as bounds; the contest re-run and the ranking-hold reported; frozen `e716cd12dddc` regime preserved.
- `PA+.1–PA+.8` ticked in `college/scope/research-tasklist.md`; the open-code-question findings recorded with file:line evidence.

## Open questions

### OQ-A1: conformal calibration-set size on short (small-band) sequences

**Why deferred:** Split-conformal needs a held-out calibration slice; small-band learners have few points (`n_active` as low as ~17), so the residual quantile may be noisy.
**Trigger:** A1 small-band coverage check.
**Resolution path:** Use leave-one-out / jackknife+ conformal for short sequences; report coverage separately per band.

### OQ-A2: does gp_hetero_t belong in `py-progress` or stay research-only?

**Why deferred:** `py-progress` is the production package; a Student-t/AR(1) GP may be more than production needs.
**Trigger:** A1 implementation.
**Resolution path:** Implement behind a flag in `gp.py` (default unchanged); if it never ships to product, keep the forecaster in `baselines/projection.py` only and leave `gp.py` alone.

### OQ-A3: OR-Tools as a clean-env dependency

**Why deferred:** CP-SAT (`ortools`) is a sizable wheel; it's only an upper-bound baseline.
**Trigger:** A4.
**Resolution path:** Add as an optional extra (`[project.optional-dependencies] research-extras`); skip the CP-SAT candidate gracefully if unavailable, so CI without it still passes.

### OQ-A4: which real engagement dataset for the moments fit

**Why deferred:** OULAD (clicks), EdNet/Junyi (timestamps) differ in granularity and licensing; the proxy mapping differs per source.
**Trigger:** A5.
**Resolution path:** Start with OULAD (open, daily-aggregated, has outcomes); document the proxy mapping; add EdNet/Junyi if the OULAD moments are too coarse.

**✅ RESOLVED 2026-06-17 → OULAD (primary); EdNet/Junyi optional.**

Selection criteria (priority-ordered; committed *before* extracting moments, to avoid cherry-picking the dataset that gives the most convenient bounds — same discipline as the no-leakage guard):

1. **Construct match (gating):** must be a longitudinal **engagement / time-on-task** series per learner (→ a "clicks/interactions → minutes toward a roadmap" proxy), **not** KT correctness (§0). 2. **Carries A5.2's moments:** inter-session gap distribution, enough points/learner for lag-1 autocorrelation φ, and observable shifts (ramp/decay, dropout/return). 3. **Granularity matches the generator** (session/day). 4. **Proxy-mapping clarity** (defensible one-line mapping). 5. **License** (publishable + reproducible). 6. **Access friction / reproducibility** (login-free, re-fetchable, modest size). 7. **Corroboration** (secondary — >1 platform), noting these are **bounds only** and N=1 (Phase 5) is the real face-validity anchor, so one clean source suffices.

**Decision:** **OULAD** wins on 1–6 — `studentVle.csv` is per-student **daily click counts** (`date` = days since start, `sum_click`), daily granularity matching the generator, clean **CC-BY 4.0**, login-free; `studentRegistration.csv` `date_unregistration` gives the dropout signal. EdNet (CC BY-NC, ~131M rows) and Junyi (weak license, Kaggle login) are **held as optional corroboration** — add only if OULAD moments are too coarse (per the resolution path). **Acquired and in place at `research/datasets/oulad/`** (full 7-table OULAD; `studentVle.csv` = 10,655,280 rows). Fit moments as **bounds/ranges only** from the pre-committed source, and report them regardless of how convenient they turn out.

## Out of scope (this plan)

- **The KT bench / Pillar B** — separate plan ([`2026-06-14-kt-realdata-integration.md`](2026-06-14-kt-realdata-integration.md)); irrelevant to Pillar A (§0).
- **The closed loop (Phase 7)** — built and archived (decision #19); not revealed in Phase I. This plan does not surface closed-vs-open.
- **Changing the frozen `e716cd12dddc` regime's parameters toward any winner** — forbidden (decision #11 / pre-reg §10); range changes are recorded, never candidate-favouring values.
- **Production deployment of any new candidate** — this is an offline research contest.

## References

- [`research/doc/2026-06-14-pillar-a-rigour-and-extensions.md`](../../../research/doc/2026-06-14-pillar-a-rigour-and-extensions.md) — the direction note (levers, candidates, priority).
- [`2026-06-13-research-tier-2-pillar-a-fanout.md`](2026-06-13-research-tier-2-pillar-a-fanout.md) — the spine + decisions D-08–D-12.
- Evidence for the resolved open code questions: `packages/py-progress/src/py_progress/gp.py:109-208` (homoscedastic, no AR(1)), `research/comparison/src/research_comparison/baselines/calibration.py:41-124` (incumbent collapses to global mean), `packages/py-progress/src/py_progress/bayesian.py:39-179` (role/time computed but unused by the candidate; no day-of-week), `research/comparison/src/research_comparison/generator/{pace.py,noise.py}` + `params.py` (truth = `m_global·ρ·τ·ν` with lognormal-AR(1), `AR1_PHI=0.30`).
- Result evidence: `research/results/{projection,calibration,detection,scheduling,sweep}/*.json` (coverage 0.20/0.32/0.44; pooled tie Δ≈1e-17; CUSUM/CSD trade-off; sweep flip cells).
- [`college/scope/archetype-preregistration.md`](../../../college/scope/archetype-preregistration.md) — §2/§5/§8/§9/§10.
