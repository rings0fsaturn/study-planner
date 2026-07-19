---
title: Research Tier Build Plan (/research)
purpose: Single source of truth for the offline Python research tier — the synthetic data generator, the genuine multi-candidate algorithm comparison, the knowledge-tracing benchmark, validation, and how results become the report/journal. Captures the grill-session decisions made 2026-06-13.
audience: candidate (Rohit Saji), future agents building or reporting on the research tier
status: approved (grill session 2026-06-13)
last_updated: 2026-06-13
related:
  - ./asOfReview1/phase1-research-plan.md
  - ./asOfReview1/pillars-and-algorithms.md
  - ./asOfReview1/datasets.md
  - ./asOfReview1/pykt-and-knowledge-tracing.md
  - ./asOfReview1/architecture.md
---

## What this document is

The `/research` tier is the offline Python layer that evaluators grade: it generates
synthetic learners with known ground truth, runs a **genuine** multi-candidate comparison
for every Pillar-A component, benchmarks knowledge-tracing models on real public data, and
auto-emits the tables and figures for the report and journal. This plan records every
design decision from the 2026-06-13 grill session, in dependency order.

**Guiding principle (set by the candidate):** this is a genuine comparison, not a
demonstration that the incumbent engines win. The incumbents in `packages/py-progress` are
*peer candidates*; the winner is whatever the data says, and the winner is what Phase II
deploys. Rigour is the deliverable — implementation difficulty is not a reason to simplify.

## 1 · Scope and staging

- **Build the full pipeline now**, including the closed-loop machinery. The R2/R3 split is
  a **presentation** boundary (what is shown at each review), not a build boundary. Finish
  the generator and comparison pipeline as early as possible to save time later.
- Phase-I reviews still **present open-loop only**; the closed-loop (calibration → regen →
  adherence) comparison is built and may be run for our own completeness but is **revealed
  in Phase II**, where it is the headline novelty. Do not spend the novelty early.

## 2 · Architecture — `/research` relative to `py-progress`

- `/research` **imports `py-progress` as one peer candidate** (single source of truth;
  evaluated code = shipped code). `py-progress` is pure importable functions (`run_cusum`,
  `detect_regime_shifts`, `gp_regression`, `fit_burn_up_gp`, `compute_hierarchical_model`,
  `compute_calibration`); the FastAPI service is only a thin HTTP wrapper, so the harness
  calls the engines **directly, no HTTP**.
- **Baselines live only in `/research`** (SMA, EWMA, CSD, linear, DP, rule-based) — never
  shipped.
- The generator emits **`SessionEvent`-shaped records** (`date, source, plannedMinutes,
  activeMinutes, duration, materialRole, startedAt, sessionId`) so output flows into the
  engines with zero glue. The GP candidate is `py-progress`'s own hand-rolled GP (do **not**
  add GPy); pull in scipy/sklearn/ruptures only for baselines that don't already exist.

## 3 · Evaluation methodology (single-learner)

The research models **one learner's experience**, compared **across N archetypes**. There
is no population to train on and no held-out-learner split.

- **Build:** every model runs **online/streaming** over one learner's own session sequence
  (fit `1..t`, update as sessions arrive) — which is also the production behaviour.
- **Two test protocols:**
  - **Latent-parameter recovery** — score the estimate against the planted ground-truth
    sidecar (calibration pace error; detection latency/false-alarm vs planted shifts).
  - **Prequential (rolling next-step)** — at each `t`, predict `t+1` from `1..t`, score
    against reality (projection CI coverage + point error). Needs no labels.
- **Monte Carlo simulation study.** Defence against circularity: (1) all candidates see the
  **same** stream; (2) the generator's ground-truth process is **mis-specified relative to
  every candidate** (see §8) so no model recovers its own assumptions.
- **K Monte Carlo replications per archetype (~40)**, paired tests on identical seeds. This
  is **required for genuineness** — a single seed letting noise pick a winner is exactly the
  non-genuine outcome we reject.

## 4 · Data design

- **Three journey-length bands** (sessions per learner), because cold-start behaviour — the
  project crux — changes across scale:

  | Band | Sessions | Weeks | Materials / volume | Planted shifts |
  |---|---|---|---|---|
  | Small | ~8–20 | 2–4 | 1 material, 5–15 h | 0–1 |
  | Medium | ~35–70 | 8–12 | 2–3 materials, 25–60 h | 1–2 |
  | Max | ~90–160 | 16–24 | 3–5 materials, 80–200 h | 2–3 |

- **Realism is the constraint:** more sessions per learner is *less* genuine. Power comes
  from replication (seeds × archetypes), **not** from inflating one learner's history.
- **Material types drive session duration + chunking** (mapped to `anchor/foundation/practice`):
  video playlist (anchor, 20–50 min/session), textbook (foundation, 40–90 min), problem
  sets/past papers (practice, 30–75 min, heavy tail), flashcards/review (practice, 10–20
  min). A realistic learner is a mix.
- **Factoring of the result tables:**
  - **Length band = primary stratum (columns).**
  - **Archetype = secondary stratum (rows).**
  - **Material mix = sampled *inside* each learner** for duration realism — **not** a
    reporting axis — *except* the scheduling track, where material mix becomes a column.
  - Avoid the full factorial (3 × 6 × 4 × 40 = 2,880-cell matrix); the headline grid is
    **3 × 6 (length × archetype)** per (metric, candidate).

### Reading the grid → model comparison

A single cell = one race: all candidates ran the same ~40 seeded learners; the winner is
decided by a **paired test (Δ + p-value + effect size)**. Read **across columns** for the
data-volume / cold-start story (the winner can *flip* as data grows — that flip is a genuine
finding). Read **down rows** for robustness across archetypes. The examiner-facing
"model comparison" deliverable is the **collapsed winner-per-(track × length-band) table**.

**Deployment rule:** ship the **cold-start (small/medium-band) winner** — a self-directed
learner spends almost their whole journey near cold-start. The Max-band result is reported
as an honest caveat, not a contradiction.

## 5 · Metrics (thesis-aligned)

Point accuracy (MAE/AUC) is table stakes; the thesis lives on *calibrated uncertainty*,
*operational* behaviour, and *honest verification*. Headline metrics per aim:

| Project aim | Headline metric | Supporting |
|---|---|---|
| Learn true pace from few sessions | convergence curve (error vs #sessions) + posterior coverage | MAE/RMSE |
| Detect behavioural shifts | detection latency at a fixed false-alarm budget | missed-detection, ROC |
| Project completion w/ calibrated uncertainty | 95% CI coverage + interval sharpness | finish-date point error |
| Regenerate schedule | deadline adherence + plan churn under regen | capacity-violation, prereq order, gen time |
| Verify genuine learning | cold-start AUC + mastery calibration (ECE) | overall AUC |

## 6 · Candidate rosters (genuine, lit-grounded)

Focused field — incumbent + 2–3 alternatives per track, each citable to the survey. The two
base papers (**Islam 2024**, **CLST 2024**) are an **extension narrative**, not a
same-metric head-to-head.

| Track | Candidates | Primary metric |
|---|---|---|
| Pace calibration | Hierarchical Bayesian [Chen] · pooled Bayesian (ablation) · SMA · EWMA | recovery MAE + prequential, stratified by data volume |
| Change detection | CUSUM · EWMA control-chart · Critical-Slowing-Down [Saqr] · *(opt)* Bayesian online changepoint | latency vs false-alarm, per shift-type |
| Target-date projection | GP-ARD [Pérez-Suay, = py-progress GP] · linear · Kalman forecast | CI coverage + finish-date error |
| Roadmap / scheduling (open-loop) | greedy prereq-aware [Fabregar] · DP [Islam] · rule-based | deadline drift · capacity-violation · prereq order · gen time |
| Assessment / mastery (real data) | pyBKT · DKT · AKT · Deep-IRT · SAKT · cold-start [CLST] | full-seq AUC + cold-start AUC + ECE |

## 7 · The synthetic generator (Pillar A) — specification

Pace semantics are taken from the **code, not the OpenAPI prose**: the engines model
`pace_ratio = activeMinutes / plannedMinutes` *literally* (`bayesian.py` L89, `cusum.py`
L84). The OpenAPI "0.8 = 25% longer" wording is loose; ground truth is defined in
`active/planned` units, not inverted.

**Generative model (per session `t`):**

```
latent (noise-free) pace:
  r*[t] = m_global × ρ(role) × τ(time_of_day, day_of_week)
          × g_regime(t) × φ_fatigue(t) × δ_deadline(t)

emitted:
  plannedMinutes[t] = capacity-planner slot minutes (by material type)
  activeMinutes[t]  = plannedMinutes[t] × r*[t] × ε[t]

engines see active/planned = r*[t]·ε[t]   ✓ matches the code
```

- **Noise `ε`:** lognormal, multiplicative, mean 1, with **AR(1) autocorrelation** on the
  latent pace (good days cluster); per-archetype `σ`. (Override to Student-t/iid if desired.)
- **Regime shifts:** **both abrupt steps and gradual drifts**, each labelled
  `{type, onset}` in the sidecar; detection metrics reported **per shift-type**. (This is the
  neutrality crux: steps-only would let CUSUM win by construction.)
- **Scenario layer:** each learner carries materials (roles + `totalMinutes`), a deadline,
  capacity (weekday/weekend hours + study days), and a planned slot schedule.
  - `plannedMinutes` comes from a **neutral lightweight capacity planner**, *not* the
    production scheduler, so calibration/projection don't inherit a scheduler's bias. The
    scheduling track judges scheduler candidates on the same (materials, capacity, deadline)
    inputs — no learner execution.
  - **Adherence model:** skip / partial / `manual` (no-pace) sessions with archetype-
    dependent attempt probability → realistic gaps and irregular spacing.
- **Neutrality is structural:** `ε` heavy-tailed (not Gaussian) and `φ_fatigue`/`δ_deadline`
  nonlinear, so neither the Bayesian/GP nor the linear baselines are gifted the truth.
- **Archetypes are parameter presets:** Steady (flat, low σ) · Morning-Lark (strong
  `τ(morning)`) · Fading-Flame (slow downward `g_regime` drift) · Weekend-Warrior
  (`τ(weekend)`) · Deadline-Sprinter (nonlinear `δ_deadline` ramp) · Marathon (long, few
  abrupt steps).
- **Ground-truth sidecar (what metrics score against):** `m_global`, true role multipliers,
  true context multipliers, regime schedule (onset, type, pre/post mean), noise-free `r*[t]`,
  true finish date, `is_faker` (carried but unused in Pillar A — populated for the Phase-II
  Pillar-B cheating-detection overlay).
- **Projection ground truth:** the calendar date when the **noise-free** cumulative (`r*`
  without `ε`, accounting for skips) reaches total material minutes.
- **Parameter provenance:** **literature-anchored + pre-registered + sensitivity-swept.**
  Anchor each parameter to a citation where one exists (Chen for pace variance, Saqr for
  shift/CSD, Pérez-Suay for GP); pre-register the ranges in the methods doc *before* running
  comparisons; sweep noise `σ` and shift magnitude over a grid and report whether the ranking
  holds (robustness is itself a finding). Include an **oracle upper-bound baseline** per track
  to confirm the task is discriminable before reading candidate results.
- **Reproducibility:** seeded RNG + a manifest JSON (archetype mix, N, seed, generator
  version); each dataset is a versioned, citable contribution.

## 8 · Repo layout and tooling

Current world is clean: a `uv` workspace, Python ≥3.12, `py-progress` depends only on numpy,
no conda, no torch. Decision: **two environments, artifact boundary.**

```
research/
  comparison/        ← uv workspace member; imports py-progress (single source of truth)
    generator/       synthetic learners + ground-truth sidecar
    baselines/       SMA, EWMA, CSD, linear, DP, rule-based, pyBKT
    metrics/  runners/  plots/
  kt-bench/          ← ISOLATED env (own pinned torch+pyKT venv; NOT a workspace member)
                       runs pyKT's native CLI on Eedi/POJ → writes results/kt/*.json
  datasets/          generated synthetic, versioned by manifest
  results/           metric tables + figures (report artifacts)
```

- Pillar-A comparison + pyBKT live in the **uv workspace member** that imports `py-progress`.
- **pyKT is quarantined** (PyTorch/wandb/conda-oriented, run as CLI not library); the seam is
  `results/kt/*.json`, which the main harness **reads** — never imports pyKT. A broken torch
  install can never break the Pillar-A pipeline.
- **Reproducibility entrypoint:** a `Makefile`/`uv run` chain — `make dataset` (generate from
  seed+manifest) → `make compare` (Pillar-A tracks → `results/`) → `make kt` (documented
  two-step into the isolated env) → `make figs` (tables + plots). Every result file is
  stamped with **generator version + seed + manifest hash**. `kt-bench/` has its own README +
  pinned requirements, kept out of `uv.lock`.

## 9 · Knowledge-tracing track (Pillar B, real data)

- **Scope boundary:** Phase-I KT runs on **public benchmarks with their native KC tags**
  (Eedi `nips2020` MCQ + POJ coding) to establish baselines. Concept-level KT over
  *LLM-generated* items in a single-learner setting needs data that doesn't exist yet — that
  is **Phase II**, not evaluated now.
- **Two evaluations on identical splits:**
  - **Full-sequence 5-fold AUC** — literature comparability anchor.
  - **Cold-start AUC curve** (AUC vs first-`k` interactions, `k ∈ {3,5,10,20}`) — the
    **headline**, the parallel to the Pillar-A convergence curve.
- **Shared splits are the linchpin:** pyKT's preprocessed folds are the single source of
  truth; **pyBKT consumes the identical folds** the deep models use, so BKT-vs-deep is fair
  across the two environments. Result files keyed by `{dataset, model, fold, k}`.
- **Mastery calibration (reliability diagram + ECE)** reported alongside AUC — the mastery
  estimate is a *verification signal*, so trustworthiness of the number matters as much as
  discrimination. Deployable pick leans interpretable (BKT / Deep-IRT) on cold-start AUC +
  calibration; CLST stays the extension-narrative base paper.

## 10 · N=1 real-data validation (Stage 4)

No real data exists yet; start logging now. By R3 expect ~15–25 of the candidate's own
sessions — small, but a genuine cold-start case. **Three honest, non-load-bearing uses:**

1. **Generator face-validity** — overlay real pace-ratio / duration / gap distributions on
   the synthetic ones; report resemblance qualitatively.
2. **End-to-end pipeline case study** — run own sessions through the exact harness; show
   sensible calibration / detection / projection. Feasibility, not a benchmark.
3. **Inform the sensitivity-sweep *bounds*** (descriptive stats only).

**Prohibited:** any "real data shows model X beats Y" claim. **Circularity guard:** real data
sets *sweep bounds*, but generator parameters stay literature-grounded and pre-registered —
never tuned to fit (and then "validated" on) the same sessions.

## 11 · Outputs — report and journal wiring

- **Fully auto-generated.** `make figs` reads `results/*.json` → `report/generated/*.tex`
  (booktabs tables) + `report/generated/*.pdf` (matplotlib → **vector PDF**); `main.tex`
  `\input{}`s them. Every artifact carries the provenance stamp in a caption footnote.
- **Artifact inventory:** calibration convergence curve + winner table; detection
  latency-vs-false-alarm curve (per shift-type) + table; projection CI-reliability plot +
  error/sharpness table; scheduling metrics table (per candidate × material-mix); KT
  cold-start AUC curve + reliability diagram + full-seq AUC table + ECE; generator
  face-validity overlay; sensitivity-sweep robustness heatmap.
- **Journal draft reuses the identical generated artifacts** (IMRAD = condensed report);
  target venue (LAK / EDM / IEEE TLT class) noted but kept venue-agnostic for now.
- Re-running the study refreshes report and journal with one command; numbers cannot drift
  between the two.

## 12 · Open items / next steps

- ✅ **Pre-register the archetype parameter table** — done:
  [`archetype-preregistration.md`](./archetype-preregistration.md) (frozen 2026-06-13; exact
  `m_global`, role/ToD multipliers, shift magnitudes, per-archetype `σ_log`, adherence
  probabilities, sensitivity grid, oracle baselines).
- ✅ **Build sequencing / master tracker** — done:
  [`research-tasklist.md`](./research-tasklist.md) (8 phases, atomic checkbox tasks,
  tracer-bullet ordering, per-phase DoD).
- **Target journal venue** specifics.
- Start **logging real sessions now** so the N=1 case study and face-validity overlay are
  real by R3.

## See also

- [`asOfReview1/phase1-research-plan.md`](./asOfReview1/phase1-research-plan.md) — the 4-stage methodology this plan implements.
- [`asOfReview1/pillars-and-algorithms.md`](./asOfReview1/pillars-and-algorithms.md) — pillar components and base papers.
- [`asOfReview1/pykt-and-knowledge-tracing.md`](./asOfReview1/pykt-and-knowledge-tracing.md) — pyKT harness and the cold-start adaptation.
