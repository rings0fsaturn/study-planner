---
title: Pillar A — Rigour & Extensions (how to drive errors down)
purpose: A research-direction note for Pillar A (adaptation). Confirms the KT benchmark is irrelevant to Pillar A, then works through four levers — testing for minimal error, new candidate algorithms, tweaking the current winners, and matching the dataset to reality. Feeds the next planning session.
audience: candidate (Rohit Saji), next planning agent
status: direction note (not a build plan yet)
created: 2026-06-14 03:17 UTC
related:
  - ../../college/scope/research-tasklist.md
  - ../../handovers/2026-06-14-kt-datasets-acquired-plan-handoff.md
  - ../../plans/2026-06-13-research-tier-2-pillar-a-fanout.md
  - ../../college/scope/research-build-plan.md
  - ../../college/scope/archetype-preregistration.md
---

## Scope & current state

Pillar A is the **adaptation** pillar: four tracks — **pace calibration, change
detection, progress projection, schedule generation** — compared as a genuine
multi-candidate contest over the synthetic generator (6 archetypes × 3 length-bands
× 40 seeds = **720 learners**, frozen params hash `e716cd12dddc`, seed 0). All four
tracks plus the sweep and oracle baselines have shipped real results
(`research/results/{calibration,detection,projection,scheduling,sweep}/*.json`).

Headline results today:

| Track | Candidates (★ = shipped) | Result → conclusion |
|---|---|---|
| Pace calibration | Bayesian ★ · SMA · EWMA · pooled | Bayesian wins — err 0.033 vs EWMA 0.109, p<1e-16, d=2.2 (**ties pooled**) |
| Change detection | CUSUM ★ · EWMA-chart · CSD | Trade-off — CSD fastest (lat ≈4–5); CUSUM fewest false alarms (≈0.016) |
| Progress projection | GP ★ · linear · Kalman | GP lowest error (16.6 vs 29 d) — **but all CIs under-cover (≈0.2–0.68 vs 0.95)** |
| Schedule generation | greedy ★ · DP · rule-based | DP scales best — greedy drifts ≈30 d on complex mixes; capacity ok |

Two things stand out and drive the recommendations below: **(a) projection intervals
are badly under-covered**, and **(b) hierarchical Bayes only ties pooled Bayes** — a tell
that the hierarchical structure is doing no work as currently specified.

## 0. The KT benchmark is irrelevant to Pillar A

Pillar A and the KT bench (Pillar B, Eedi/POJ) predict different things on different
data with different metrics:

- **KT (Pillar B):** "will the learner get the *next item correct*?" — target is
  correctness, data is item-response logs, metric is AUC/ECE. A **mastery/verification**
  signal.
- **Pillar A:** "how *fast* is the learner going, did their pace *shift*, when will they
  *finish*, how to *schedule*?" — target is minutes/pace over time, data is session logs,
  metric is MAE / detection-latency / CI-coverage / deadline-drift.

No shared target, data, or metric, so a KT benchmark can neither validate nor improve
the Pillar-A contest. The only links are conceptual: the cold-start AUC curve is the
*analogue* of the calibration convergence curve, and verified mastery feeds recalibration
in the **Phase-II closed loop**. Useful framing; useless as a Pillar-A test. **Do not
spend KT effort on Pillar A.**

## 1. Testing further for minimal error

Note the asymmetry: on synthetic data the **oracle error is 0** (truth is known), so
"minimal error" is partly artificial — the real prize is **(a) calibrated uncertainty**
and **(b) a ranking that survives onto real data.**

- **Fix the one real defect first: projection interval coverage (~0.2–0.68 vs 0.95).**
  Likely mechanism: the GP uses a homoscedastic Gaussian likelihood on noise that is
  actually **multiplicative lognormal AR(1)**. Ignoring the AR(1) autocorrelation (φ)
  makes the model behave as if it has more independent observations than it does →
  over-confident → under-coverage. This is a *calibration* bug, not a point-error bug,
  and it is the highest-value fix.
- **More seeds (40 → 200+)** and report **bootstrap CIs on Δ**, not just a p-value, so the
  winner gap carries its own error bar.
- **Held-out archetypes:** tune any hyperparameters on a subset of archetypes, declare
  winners on unseen ones — removes the circularity of tuning and scoring on the same cells.
- **Multiple-comparison correction** (Holm / Benjamini–Hochberg) across the many
  band × archetype × shift cells, or some "winners" are noise.
- **Widen the sweep:** 3 points/axis (243 cells) → 5+; add *adversarial* regimes (multiple
  shifts per journey, step+drift combined, bursty missingness). Report **where the ranking
  flips**, not just "stable ~96%."
- **Per-archetype failure analysis:** report each method's worst archetype, not just the
  mean — that is where real users live.

## 2. More algorithms to enter each contest

**Calibration** (recover latent pace from sparse, noisy pace-ratios):
Kalman / state-space random-walk pace · particle filter (regime-switching) · GP
regression on pace · robust EWMA (Huber/median) · a **covariate Bayesian model that
explicitly includes time-of-day (τ) and day-of-week (ν)** (see §3).

**Change detection** (step + drift):
**BOCPD** (Bayesian online changepoint — run-length posterior) · **Page-Hinkley**
(drift specialist) · **GLR** · **ADWIN** (streaming drift) · `ruptures` PELT/BinSeg as a
*retrospective upper bound* (already a dependency).

**Progress projection** (finish date + calibrated uncertainty):
**conformal prediction** (coverage guaranteed by construction — directly fixes the
under-coverage) · **heteroscedastic / Student-t GP** · **structural time-series / BSTS**
with changepoints · **Monte-Carlo forward simulation** from the calibrated pace posterior
(carries regime risk into the finish-date distribution).

**Schedule generation** (allocate materials to a deadline under capacity):
**ILP/MILP or CP-SAT (OR-Tools)** as the *exact optimum* gold standard · **critical-path /
topological list scheduler** (prereq-heavy mixes) · **local search (simulated annealing /
tabu)** to repair greedy.

## 3. Tweaking the current winners

**Calibration (Bayesian).** It only *ties* pooled-Bayes — the hierarchical prior is doing
no work as specified. Two hypotheses to verify in the code, both high-value:
1. The candidates likely **ignore the τ/ν covariates the generator actually uses**
   (`m_global · ρ(role) · τ(time_of_day) · ν(day_of_week)`). Modelling pace as those
   multiplicative effects should recover signal the plain averages cannot.
2. **Empirical-Bayes partial pooling** should beat pooled specifically on the *small* band
   (sparse learners borrow strength) — exactly where hierarchical should win and currently
   doesn't.
Also add a **Student-t likelihood + explicit AR(1)** term for the lognormal-AR(1) tails.

**Detection (CUSUM).** Standardize the input by a **robust running scale** so one threshold
works across σ_log · **tune k/h per shift-type** · add a **Page-Hinkley arm for drift**
(CUSUM is strong on steps, weak on slow drift) · report the **latency↔false-alarm Pareto
frontier** (CUSUM + CSD ensemble) instead of one operating point · warm-up handling to cut
early false alarms.

**Projection (GP).** Heteroscedastic / Student-t likelihood **or** a conformal wrapper to
hit nominal coverage · **propagate the calibration posterior** into the forecast (don't
treat past pace as noiseless) · **burn-up mean function + changepoint kernel** so a detected
shift resets the trend · or replace curve-extrapolation with **forward simulation** to the
deadline (respects remaining work + capacity).

**Scheduling (greedy / DP).** Give greedy **one-step lookahead or a local-search polish** to
kill the ≈30-day drift on complex mixes · make both **prereq-aware (topological pre-order)**
(prereq correctness dipped below 1.0 on anchor+practice) · benchmark DP against an **ILP
optimum** to quantify the residual gap.

## 4. Expanding & matching the dataset to reality

The generator is literature-anchored but clean. To match reality and stress the ranking:

- **Continuous archetype space** instead of 6 discrete types — sample latent traits from a
  mixture; reality is a spectrum.
- **Richer regimes:** multiple shifts per journey, step+drift combos, relapse/recovery,
  exam-crunch seasonality, illness/holiday gaps.
- **Realistic missingness:** bursty dropout and return-after-hiatus, weekend clustering —
  heavier than the current Bernoulli skips.
- **Heavier-tailed, session-length-dependent noise** + a **logged-time misreporting** layer
  (people round/lie about minutes) the models don't see — tests robustness, not just fit.
- **External real time-on-task data** (the right "real" data for Pillar A — *not* KT
  correctness): **OULAD** (Open University — daily clicks + assessments + outcomes),
  **EdNet** and **Junyi** (timestamps), KDD-Cup-2015 dropout. Use them two ways:
  1. **Fit the generator's moments** (autocorrelation, shift frequency, gap distribution)
     to a real dataset — *bounds only*, to avoid circularity — then re-run the contest on
     the reality-matched generator and check the ranking holds (external validity).
  2. Run calibration/detection/projection **directly** on real engagement series as
     external validation.
  Caveat: these log clicks/interactions, not "minutes toward a roadmap," so a proxy mapping
  is needed and must be stated explicitly.
- **N=1 (Phase 5)** stays the face-validity anchor: overlay real session pace-ratio /
  duration / gap distributions on the synthetic ones.

## Priority order (most error-reduction per unit effort)

1. **Projection coverage fix** (conformal or heteroscedastic-t) — turns the one red result
   green.
2. **Add τ/ν covariates + empirical-Bayes pooling to calibration** — likely the biggest
   genuine accuracy gain and explains the Bayes-ties-pooled puzzle.
3. **More seeds + held-out archetypes + bootstrap CIs** — makes every "winner" claim
   defensible.
4. **Reality-matched generator from OULAD/EdNet moments** — the external-validity story
   that turns "works on my synthetic data" into a thesis-grade result.

## Open code questions to verify before committing to the plan

- Do the current calibrators use the τ (time-of-day) and ν (day-of-week) covariates, or do
  they pool over them? (Drives recommendation #2.)
- Does the GP projection model the AR(1) autocorrelation and use a heteroscedastic
  likelihood, or homoscedastic Gaussian? (Drives recommendation #1.)
- Where are candidate hyperparameters set, and are any tuned on the same cells used to
  declare winners? (Circularity guard for §1.)
