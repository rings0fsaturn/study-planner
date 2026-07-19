---
title: Research Tier — Master Build Tracker
purpose: The phase-by-phase, small-task checklist for building the /research tier. This is the master tracker — check items off as they ship. Sequenced as a tracer bullet (one track end-to-end before fanning out).
audience: candidate (Rohit Saji), future agents
status: active tracker
last_updated: 2026-06-14
related:
  - ./research-build-plan.md
  - ./archetype-preregistration.md
  - ../../handovers/2026-06-13-research-tier-status-and-blockers.md
  - ../../handovers/2026-06-14-kt-datasets-acquired-plan-handoff.md
  - ../../research/doc/2026-06-14-kt-credibility-tracker.md
  - ../../research/doc/2026-06-14-pillar-a-rigour-and-extensions.md
---

> **2026-06-14 reconciliation.** This tracker had drifted: Phases 3 and 7 shipped
> (commit SHAs in [`plans/2026-06-13-research-tier-*.md`](../../.work/plans/active/2026-06-13-research-tier.md);
> status snapshot in [`handovers/2026-06-13-research-tier-status-and-blockers.md`](../../.work/handovers/2026-06-13-research-tier-status-and-blockers.md))
> but were still shown unstarted. Boxes below are now reconciled to that state. **Phase 4
> now runs on real public data and its credibility audit is resolved for this pass:**
> 9 pyKT cells are reportable (5 NIPS + 4 ACcoding), `sakt × accoding` and
> `pybkt × accoding` are not credible with recorded evidence, and `pybkt × nips2020`
> is blocked with recorded evidence. Source of truth for KT claims is
> [`research/doc/2026-06-14-kt-credibility-tracker.md`](../../research/doc/2026-06-14-kt-credibility-tracker.md),
> not these high-level phase markers.

## How to use this tracker

- Tasks are atomic and checkbox-tracked: `- [ ]` open, `- [x]` done.
- Each **phase** has a Goal, what it Depends on, and a Definition of Done (DoD). Don't start
  a phase until its dependency's DoD is met.
- **Tracer-bullet rule:** Phases 0→2 build *one* track (calibration) end-to-end —
  generate → compare → figure. Do **not** start Phase 3 (fan-out) until Phase 2's DoD holds.
- Authoritative design = [`research-build-plan.md`](./research-build-plan.md); frozen numbers
  = [`archetype-preregistration.md`](./archetype-preregistration.md).

**Review mapping (presentation gate, not build gate):** Phases 0–3 → R2 intermediate
results; Phases 4–6 → R3 full comparison + demo + journal draft; Phase 7 built but revealed
in Phase II.

---

## Phase 0 · Scaffolding & environment

**Goal:** `/research` skeleton exists, the clean env imports `py-progress`, and a stamped
empty pipeline runs. **Depends on:** nothing. **DoD:** `make dataset compare figs` runs on
a stub and produces a stamped placeholder artifact; `import py_progress` works from
`research/comparison`.

- [x] P0.1 Create `research/` tree: `comparison/{generator,baselines,metrics,runners,plots}`, `datasets/`, `results/`, `kt-bench/`.
- [x] P0.2 Add `research/comparison/pyproject.toml`; register `research/comparison` as a `uv` workspace member in root `pyproject.toml`.
- [x] P0.3 Add clean-env deps: `numpy, scipy, scikit-learn, ruptures, statsmodels, pandas, matplotlib, pyBKT`.
- [x] P0.4 Add `py-progress` + `py-roadmap-engine` as workspace-source deps of `comparison`; verify `import py_progress` and `import py_roadmap_engine`.
- [x] P0.5 Provenance util: `manifest.py` — seed, generator version, params-file hash; `stamp(result)` helper writing the stamp into every output.
- [x] P0.6 `Makefile` with `dataset / compare / kt / figs / all` targets (stubs that no-op + stamp).
- [x] P0.7 `.gitignore` for `datasets/`, `results/`, `kt-bench/.venv`; keep manifests tracked.
- [x] P0.8 Align `ruff` config; add `pytest` testpaths for `research/comparison/tests`.
- [x] P0.9 Load frozen params: `params.py` reads `archetype-preregistration` values from one config module (single source); expose version hash.

## Phase 1 · Synthetic generator

**Goal:** generate one learner = `list[SessionEvent]` + `GroundTruth` sidecar, then batches,
reproducibly from seed+manifest. **Depends on:** P0 DoD. **DoD:** `make dataset` emits a
versioned dataset + manifest; oracle recovers planted truth within tolerance; same seed →
identical bytes; clip rate <2%.

- [x] P1.1 `types.py`: `SessionEvent` (emit shape) + `GroundTruth` sidecar (m_global, role/context multipliers, regime schedule, noise-free `r*[t]`, true finish date, `is_faker`).
- [x] P1.2 Material model: playlist/textbook/practice/flashcards → role, `totalMinutes`, chunk-duration distribution.
- [x] P1.3 Capacity planner: weekday/weekend hours → per-slot `plannedMinutes` across study days (neutral, not a scheduler).
- [x] P1.4 Latent base pace: `m_global · ρ(role) · τ(time_of_day) · ν(day_of_week)` from frozen params.
- [x] P1.5 Regime module: abrupt **step** generator (magnitude, onset) — labelled in sidecar.
- [x] P1.6 Regime module: gradual **drift** generator (total, window) — labelled in sidecar.
- [x] P1.7 Onset sampler: interior 20–80%, ≥4 sessions from edges; per-band shift counts (§5 pre-reg).
- [x] P1.8 `φ_fatigue` (same-day session count) + `δ_deadline` (Sprinter ramp) effects.
- [x] P1.9 Noise: lognormal AR(1) (`σ_log`, `φ`) ; multiply; clip `r*·ε` to [0.55, 1.60]; log clip rate.
- [x] P1.10 Adherence: per-archetype attempt probability, manual fraction, skips → real gaps.
- [x] P1.11 Six archetype presets wired to frozen params (Steady, Morning-Lark, Fading-Flame, Weekend-Warrior, Deadline-Sprinter, Marathon).
- [x] P1.12 `generate_learner(archetype, band, seed)` → (`SessionEvent[]`, `GroundTruth`).
- [x] P1.13 `generate_dataset(...)` → N learners × archetype × band × K seeds; write dataset + manifest (stamped).
- [x] P1.14 Tests: schema/shape, determinism by seed, oracle recovers planted `r*` means, shift labels correct, clip rate <2%.
- [x] P1.15 Face-validity export hook: dump pace-ratio/duration/gap distributions for later overlay (Phase 5).

## Phase 2 · Metrics spine + calibration track (THE TRACER BULLET)

**Goal:** one track fully end-to-end — generate → calibration comparison → paired stats →
generated figure+table. **Depends on:** P1 DoD. **DoD:** `make compare` (calibration) +
`make figs` produce a stamped convergence-curve PDF and a winner table from real runs.

- [x] P2.1 Prequential runner: stream `sessions[:t]` through `py_progress.compute_calibration` for increasing `t`.
- [x] P2.2 Baseline calibrators in `baselines/`: SMA, EWMA, pooled (non-hierarchical) Bayesian.
- [x] P2.3 Metric: recovery MAE/RMSE vs sidecar true multipliers (global + per-role).
- [x] P2.4 Metric: prequential next-session pace error.
- [x] P2.5 Metric: posterior credible-interval coverage.
- [x] P2.6 Paired-test util: per-seed paired diff across candidates → Δ, p-value, effect size.
- [x] P2.7 Aggregator: per (length-band × archetype) cell → μ±σ; collapse to winner-per-band table.
- [x] P2.8 Results writer: `results/calibration/*.json`, stamped + keyed by `{band, archetype, candidate, seed}`.
- [x] P2.9 Plot: convergence curve (error vs #sessions, candidates) → vector PDF.
- [x] P2.10 Table: `report/generated/calibration_winners.tex` (booktabs).
- [x] P2.11 **Smoke test:** `make dataset compare figs` from clean state yields the PDF + table. Tracer bullet complete.

## Phase 3 · Fan out remaining Pillar-A tracks

**Goal:** change-detection, projection, scheduling tracks + sensitivity sweep + oracles.
**Depends on:** P2 DoD (reuse its metric/aggregator/writer/plot spine). **DoD:** all four
Pillar-A tracks emit stamped results, tables, and figures; sweep + oracle baselines run.

- [x] P3.1 Change-detection runner over the pace-ratio series (active subsequence).
- [x] P3.2 Detection baselines: EWMA control-chart, CSD indicators; incumbent = `py_progress.detect_regime_shifts` (CUSUM).
- [x] P3.3 Metric: detection latency vs false-alarm, **split by shift-type** (step vs drift); ROC across thresholds.
- [x] P3.4 Detection table + per-shift-type latency/FA figure.
- [x] P3.5 Projection runner (prequential burn-up forecast to finish date).
- [x] P3.6 Projection baselines: linear extrapolation, Kalman forecast; incumbent = `py_progress` GP.
- [x] P3.7 Metric: 95% CI coverage + interval sharpness + finish-date point error.
- [x] P3.8 Projection CI-reliability plot (nominal vs empirical coverage).
- [x] P3.9 Scheduling runner: feed (materials, capacity, deadline) — no learner execution.
- [x] P3.10 Scheduling candidates: `py_roadmap_engine` (greedy/constraint), DP (Islam), rule-based.
- [x] P3.11 Metric: deadline drift, capacity-violation rate, prereq-order correctness, gen time; report by material-mix.
- [x] P3.12 Oracle baselines (calibration/detection/projection) per pre-reg §9.
- [x] P3.13 Sensitivity-sweep runner over pre-reg §8 grid; robustness heatmap of ranking stability.

> ✅ **Phase 3 done & genuine** — all four Pillar-A tracks + sweep + oracles emit stamped
> results over the 720-learner Monte-Carlo run (params hash `e716cd12dddc`, seed 0). See
> `research/results/{detection,projection,scheduling,sweep}/*.json`.

## Phase 4 · Knowledge-tracing bench (Pillar B, isolated env)

**Goal:** full-seq + cold-start AUC + calibration on Eedi/POJ, shared splits across envs.
**Depends on:** P0 (results schema). Runs independently of P1–P3. **DoD:** `make kt`
produces `results/kt/*.json` (full-seq AUC, cold-start curve, ECE) for pyBKT + ≥3 deep
models on both datasets; pyBKT used identical folds.

> ✅ **Dataset status (updated 2026-06-14): real public data wired, cells resolved.**
> The pipeline (P4.1-P4.9) runs end-to-end on public raw data with provenance
> `folds_raw_source: public_raw`. The credibility tracker allows reporting the
> 9 G1-G8-green pyKT cells and records why the remaining cells are excluded.
> The datasets used are:
> - **Eedi / NeurIPS-2020 Tasks 3&4** (the `nips2020` MCQ modality) — `research/datasets/NeurIPS 2020.zip`
>   → `data/train_data/train_task_3_4.csv` (1.38M interactions, exact pyKT `NIPS34` format)
>   + `data/metadata/{question,subject,student,answer}_metadata*.csv`.
> - **ACcoding** (substitute for the dead **POJ** coding log) — `research/datasets/acoding/ACcoding.zip`
>   (MySQL dumps: `submissions.sql` ≈4.05M rows, `problems.sql`, `tags.sql`/`problem_tags.sql`
>   = 100 KP tags). Maps to `poj_log.csv` (`creator_id`→User, `problem_id`→Problem, `AC`→correct);
>   **caveat:** no submit-time column → use the auto-increment `id` as chronological order.
>
> The integration/re-run is tracked in
> [`plans/2026-06-14-kt-realdata-integration.md`](../../.work/plans/active/2026-06-14-kt-realdata-integration.md).

- [x] P4.1 `kt-bench/` isolated venv: pinned torch + `pykt-toolkit` + wandb; `README` + `requirements.txt` (kept out of `uv.lock`).
- [x] P4.2 pyKT preprocess: `nips2020` (Eedi) + `accoding`; **export fold indices** as the shared-split source of truth.
- [x] P4.3 Train deep models (5-fold): DKT, AKT, Deep-IRT, SAKT → full-seq AUC. **Credibility note:** NIPS `dkt`, `akt`, `deep_irt`, and `sakt` are full-depth and G7-verified; ACcoding `dkt`, `akt`, and `deep_irt` are full-depth, G7-verified, and stable across learner subsamples. `sakt × accoding` is excluded as a genuine G6 cold-start failure.
- [x] P4.4 Add cold-start method (CLST family) candidate. **Credibility note:** historical `clst` was relabeled to `dkt_clst_config`; true distinct CLST is deferred to a later research plan.
- [x] P4.5 Cold-start harness: truncate to first `k ∈ {3,5,10,20}` interactions → cold-start AUC curve.
- [x] P4.6 pyBKT (clean env) on the **exported pyKT folds** → AUC (comparable to deep models). **Credibility note:** `pybkt × nips2020` is blocked by flat near-chance AUC, high ECE, and zero-mass predictions; `pybkt × accoding` is excluded because G5 ECE remains high after reproducibility and subsample-stability checks.
- [x] P4.7 Mastery calibration: reliability diagram + ECE for each model. **Credibility note:** generated report artifacts now include the 9-cell credible pyKT allow-list only.
- [x] P4.8 Result schema `results/kt/*.json` keyed `{dataset, model, fold, k}`; stamped.
- [x] P4.9 Join + tables: full-seq AUC, cold-start AUC curve, ECE; generated `.tex` + figures from the credible allow-list.

> ✅ **Reportable KT artifact status.** Joined report artifacts run in `reportable_allowlist`
> mode and cite 9 credible pyKT cells:
> NIPS `dkt` (`AUC=0.7426`, `ECE=0.0374`), `akt` (`AUC=0.7629`, `ECE=0.0359`),
> `deep_irt` (`AUC=0.7341`, `ECE=0.0382`), `sakt` (`AUC=0.7154`, `ECE=0.0355`),
> and `dkt_clst_config` (`AUC=0.7429`, `ECE=0.0370`; relabeled DKT-backed config,
> not distinct CLST); plus ACcoding `dkt` (`AUC=0.7122`, `ECE=0.0547`),
> `akt` (`AUC=0.7183`, `ECE=0.0494`), `deep_irt` (`AUC=0.6344`, `ECE=0.0422`),
> and `dkt_clst_config` (`AUC=0.7115`, `ECE=0.0546`; relabeled DKT-backed config).
> Allow-list provenance is `public_raw` with `gaps=[]` and `result_count=270`.
> Excluded cells are recorded in the tracker as blocked or not credible with evidence.

## Phase 5 · N=1 real-data validation

**Goal:** generator face-validity + end-to-end feasibility case study, no performance claims.
**Depends on:** P1 (face-validity export), P2/P3 (harness). **DoD:** real-vs-synthetic
overlay figure + a case-study run through the harness, with explicit non-claim notes.

- [ ] P5.1 Start logging own study sessions now (collection task — ongoing).
- [ ] P5.2 Export own sessions from the app event store → `SessionEvent[]`.
- [ ] P5.3 Face-validity overlay: real vs synthetic pace-ratio/duration/gap distributions → figure.
- [ ] P5.4 Run own sessions through the calibration/detection/projection harness → qualitative case study.
- [ ] P5.5 Derive sweep-bound descriptive stats from real data (bounds only — no parameter tuning; circularity guard).
- [ ] P5.6 Write-up stub with explicit non-claims (no algorithm-superiority from N=1).

## Phase 6 · Outputs — report & journal wiring

**Goal:** results auto-generate every report/journal artifact; one command refreshes both.
**Depends on:** P2–P5 results. **DoD:** clean clone → `make all` → `report/generated/*`
populated → `main.tex` compiles with 0 undefined refs; numbers identical in report & journal.

- [ ] P6.1 `make figs`: `results/*.json` → `report/generated/*.pdf` (matplotlib → vector) + `*.tex` (booktabs).
- [ ] P6.2 Provenance stamp (version + seed + manifest hash) in every caption footnote.
- [ ] P6.3 `\input{}` generated tables/figures into `main.tex` sections (replace the placeholder figure).
- [ ] P6.4 Full artifact inventory wired (build-plan §11): calibration, detection, projection, scheduling, KT, face-validity, robustness heatmap.
- [ ] P6.5 Journal-draft skeleton (IMRAD) reusing identical generated artifacts; venue-agnostic.
- [ ] P6.6 Reproducibility gate: clean clone → `make all` → report compiles; CI/script check.

## Phase 7 · Closed-loop machinery (built, revealed in Phase II)

**Goal:** the loop exists and can be evaluated, but Phase-I reviews present open-loop only.
**Depends on:** P2/P3. **DoD:** `--closed-loop` flag runs calibration→regen feedback; a
closed-vs-open comparison runs for our completeness (not in the Phase-I report).

- [x] P7.1 `--closed-loop` flag: feed calibration multipliers back into roadmap regen within the sim.
- [x] P7.2 CUSUM regime-shift → replan-trigger wiring in the harness.
- [x] P7.3 Closed-vs-open comparison on adherence + finish-date drift (run, archive — do not put in Phase-I report).

> ✅ **Phase 7 built and archived** — deliberately **not** shown in Phase I; it is the
> headline novelty held for Phase II.

## Phase 3+ · Pillar-A rigour & extensions (NEXT SESSION)

**Goal:** drive Pillar-A errors down and harden the comparison so the synthetic-data
result becomes thesis-grade. **Depends on:** Phase 3 DoD (met). Full rationale, candidate
algorithms, and priority order in
[`research/doc/2026-06-14-pillar-a-rigour-and-extensions.md`](../../research/doc/2026-06-14-pillar-a-rigour-and-extensions.md).
Priority order is #1→#4 (most error-reduction per unit effort first).

- [x] PA+.1 **(#1) Projection coverage fix** — heteroscedastic / Student-t GP or a conformal-prediction wrapper → CI coverage ≈ nominal 0.95 (today ~0.2–0.68; likely caused by homoscedastic-Gaussian likelihood ignoring the lognormal-AR(1) noise).
- [x] PA+.2 **(#2) Calibration covariates + pooling** — add τ (time-of-day) + ν (day-of-week) effects and empirical-Bayes partial pooling; verify hierarchical Bayes finally beats pooled on the *small* band (today they tie).
- [x] PA+.3 **(#3) Statistical rigour** — 200+ seeds, bootstrap CIs on Δ, held-out archetypes (tune on some, score on unseen), multiple-comparison correction (Holm/BH).
- [x] PA+.4 New candidates per track — calibration: Kalman / particle; detection: BOCPD · Page-Hinkley · ADWIN · `ruptures` (upper bound); projection: conformal · BSTS · Monte-Carlo forward-sim; scheduling: ILP/CP-SAT optimum · local-search greedy repair · topological prereq scheduler.
- [x] PA+.5 Tweak winners — CUSUM: robust running-scale standardisation + per-shift-type k/h + drift arm + Pareto frontier; scheduling: greedy one-step lookahead + prereq-aware ordering (prereq correctness dipped <1.0 on anchor+practice).
- [x] PA+.6 Widen sweep (5+ pts/axis) + adversarial regimes (multi-shift, step+drift, bursty missingness); report flip cells and per-archetype worst case, not just the mean.
- [x] PA+.7 **(#4) Dataset-to-reality** — enrich generator (continuous archetype space, richer regimes, bursty dropout/return, heavy tails, logged-time misreporting); fit moments to OULAD / EdNet / Junyi and re-check the ranking holds (external validity); N=1 overlay (Phase 5).
- [x] PA+.8 Verify open code questions first — do calibrators use τ/ν? does the GP model AR(1)/heteroscedasticity? are any hyperparameters tuned on the same cells used to declare winners? (Drives PA+.1/PA+.2 and the circularity guard.)

> Note: the **KT benchmark is irrelevant to Pillar A** — different target/data/metric (see
> the doc's §0). Don't route KT effort here.

## Progress snapshot

| Phase | Title | Status |
|---|---|---|
| 0 | Scaffolding & environment | ✅ complete |
| 1 | Synthetic generator | ✅ complete |
| 2 | Metrics spine + calibration (tracer bullet) | ✅ complete |
| 3 | Fan out Pillar-A tracks | ✅ complete (genuine — per handover 2026-06-13) |
| 4 | KT bench (Pillar B) | ✅ complete (real public data; 9 credible reportable cells; excluded cells documented) |
| 5 | N=1 validation | ☐ not started |
| 6 | Outputs — report & journal | ☐ not started |
| 7 | Closed-loop (built, held for Phase II) | ✅ complete (built + archived; revealed in Phase II) |

**Tally:** 6 of 8 phases fully complete (0–4, 7) · Phases 5–6 not started.

## See also

- [`research-build-plan.md`](./research-build-plan.md) — design rationale for every phase.
- [`archetype-preregistration.md`](./archetype-preregistration.md) — frozen generator params (Phases 1, 3).
