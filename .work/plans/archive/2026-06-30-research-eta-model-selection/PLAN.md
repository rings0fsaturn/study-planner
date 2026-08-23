---
title: "Research — re-validate Pillar A & benchmark/select the ETA model for the material/session redesign"
slug: research-eta-model-selection
status: ready-for-execution
owner_planner: Cowork (Opus) — planner/reviewer
executor: Codex / Sonnet coding agent
created: 2026-06-30
workstream: "[RESEARCH] / [PILLAR-A]"
charter: ".work/handovers/2026-06-30-research-eta-model-selection.md" (§2 R1–R6)
design_source_of_truth: ".work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md" (D8, D8a, D9, D9a, D10, §5c)
harness_root: "research/comparison/"
---

# Research plan — ETA model selection + Pillar-A re-validation for the material/session redesign

> **One-line goal.** Extend the existing offline research harness (`research/comparison/`) so it
> models the *new* data-generating process (session bookings + interrupted/partial chunks + ad-hoc
> days), then **(a) re-confirm** that calibration/detection results transfer and **(b) benchmark and
> select** the finish-date/ETA model — the headline result that decides whether the proposed `#3` ETA
> composite (DECISIONS §5c) may be claimed at all.

This plan is **self-contained inside `research/`** and must not depend on any `apps/`-`packages/` UI
change. It runs in parallel with the product UI work.

---

## 0. OPERATING MANUAL — read before touching anything

### 0.1 Roles & write boundaries
- You (the executor) **implement**; a separate reviewer marks each phase ✅ in `VERIFICATION.md`.
- **A phase is not "done" until the reviewer has signed its `VERIFICATION.md` section.** Self-marking
  ☐→🟡 (implemented, awaiting review) is fine; only the reviewer flips 🟡→✅.
- Allowed to modify: everything under `research/` (code + datasets + results), the new
  pre-registration doc under `college/scope/`, and these planning docs. Do **not** touch
  `apps/ packages/ e2e/ services/` — this is an offline research workstream.

### 0.2 Git / sandbox rule (CRITICAL)
- The planning host (Cowork) **cannot run mutating git** — it bricks the sandbox. **You (Codex)** own all
  commits.
- **Step 0, before any code:** commit these two planning docs verbatim
  (`git add .work/plans/active/2026-06-30-research-eta-model-selection/ && git commit`). Then proceed.
- After each phase: commit the phase's code + results, record the **commit SHA** + files-changed +
  any deviation in your `VERIFICATION.md` section, and hand to the reviewer.
- Work on the current branch `project/phase-1` unless told otherwise; do **not** push without being asked.

### 0.3 No-fabrication rule
- Every file/symbol anchor below was **read and verified against the live code on 2026-06-30** (see
  §3). If reality differs when you get there, **fix the plan, log the discrepancy in the Decisions log,
  and tell the reviewer** — do not trust this doc over the source.
- **Report results faithfully.** If a "transfer" result *degrades* on the new data, that is a finding —
  record the real numbers, apply the pre-declared fallback (R2), and do not massage scoring to
  manufacture a win. Only **Holm-surviving** improvements count as "wins" (claims-ledger rule).

### 0.4 Run environment (verified)
- Harness is a `uv` workspace package `research-comparison` (`research/comparison/pyproject.toml`,
  deps: `numpy scipy scikit-learn ruptures statsmodels pandas matplotlib pyBKT`; imports the workspace
  `py-progress` + `py-roadmap-engine`). `uv` 0.11.19 is installed at `~/.local/bin/uv`.
- **Run from the repo root** via the `Makefile` (each target is `uv run --package research-comparison
  python -m research_comparison.<module>`):
  ```bash
  make dataset            # → research_comparison.generator.generate
  make compare            # calibration track
  make compare-detection  # detection track
  make compare-projection # projection track  ← R4 headline
  make sweep              # robustness grid
  ```
- Every runner also accepts flags directly:
  `python -m research_comparison.runners.projection --dataset-dir <path> --out-dir <path> --seeds <N> --quiet`.
  **You will use `--dataset-dir` to point the runners at the NEW dataset** (see D-01).
- Tests live in `research/comparison/tests/` (`test_generator.py`, `test_projection_track.py`,
  `test_calibration_track.py`, `test_detection_track.py`, `test_rigour.py`, …). Run a single file with
  `uv run --package research-comparison pytest research/comparison/tests/test_generator.py -q`.
  **If the sandbox cannot run the harness** (arm64 dep/build block — see STATUS gotchas), still **write**
  every test, run what you can, and record exactly what ran vs what was authored-only in `VERIFICATION.md`
  (mirrors the project's E2E "write-don't-run" policy).

### 0.5 Plan format
- Phases are **independent vertical slices**: P0 → R1 → (R2 ∥ R3 ∥ R4) → R5 → R6. R2/R3/R4 all depend
  only on R1's dataset and can be done in any order / parallel.
- Markers: `☐` not started · `🟡` implemented, awaiting review · `✅` reviewer-verified.

---

## 1. WHY THIS EXISTS (context — compressed; full design in DECISIONS.md)

The app is moving from a **dated-slot** model to a **decoupled material/session** model. Per the locked
decisions:
- **D8 (locked):** the intelligence layer calibrates **throughput** = `actualMinutes ÷ estimated material
  minutes consumed`. The A-series generator already models exactly this (`plannedMinutes` = a material
  chunk; `activeMinutes = planned × latentPace` → `active/planned = pace`). So calibration **should
  transfer** — but must be **re-confirmed**, not assumed.
- **D8a (locked):** **interrupted / partial-chunk** sessions are included as throughput points. The
  current generator emits **full-chunk sessions only** — this is a *new* event type.
- **D9 / D9a (locked):** a **session-booking** model — blank bookings (date + estimated duration,
  capacity only, no material packing), one material per booking (soft-suggested), `bookingId`
  attribution, plus **ad-hoc any-day** sessions off the planned study-days. New cadence vs the old
  generator (which emits ~1 slot/weekday, 2/weekend, gated by `attempt_probability`).
- **#3 / §5c (PROPOSED — NOT locked; this is what you're proving):** the **ETA composite** —
  **GP** extrapolation of the material-done curve for finish-date + CI, plus an **analytic**
  `remaining × throughputFactor ÷ effectiveDailyMinutes` for the dial recommendation; cold-start →
  analytic fallback; reference line linear-to-deadline vs capacity-shaped. **The dissertation may not
  claim this until R4 backs it.**

**Core invariant to preserve:** the redesign changes the **data-generating process** (session arrival +
new event types), **not** the **latent pace signal**. Keep the validated latent-pace core
(`pace.py`/`latent_base`, the `r_star` ground truth) intact and **add** new layers on top, each with its
own ground truth, so the D8 "transfer" argument stays valid and results stay comparable to the A-series.

### 1.1 Transfer vs must-re-run (state this honestly in the write-up)
| Result | Status under the redesign | Where proven |
|---|---|---|
| Calibration `enriched_shrink` / `dual_prior` win (m_global + context-pred) | **TRANSFERS — re-confirm** on new data | R2 |
| Change-detection CUSUM **robust-null** (latency / false-alarm) | **MUST RE-RUN** (noisier, irregular cadence) | R3 |
| GP projection coverage + **the new ETA composite** | **MUST RE-RUN / NEW** (never benchmarked) | R4 |
| Scheduling track | **DROPPED** (constrained packer retired; §5c) — do not run/extend | — |

---

## 2. DECISIONS LOG (planner choices + open calls with recommendations)

> These are decisions THIS plan makes so the executor isn't guessing. Each is either **locked by the
> planner** (implement as written) or **OPEN** (implement the recommended option; flag in `VERIFICATION.md`
> if you deviate). Append new decisions here as you make them.

### D-01 — New datasets get a distinct namespace; DO NOT change `PARAMS_VERSION_HASH` (LOCKED)
**Problem found in code:** the dataset id is `synthetic-{PARAMS_VERSION_HASH}-seed{N}-n{count}` where
`PARAMS_VERSION_HASH = sha256(college/scope/archetype-preregistration.md)[:12]` (`params.py:66-67`,
currently resolves to **`21c2cdabfa91`**). `runners/rigour.py:dataset_for_seed_count()` auto-resolves the
frozen dataset by that exact id, and **`runners/calibration.py:49-50` hard-codes two reference dataset
ids** (`FROZEN_REFERENCE_DATASET_ID = "synthetic-21c2cdabfa91-seed0-n5400"`,
`REALITY_REFERENCE_DATASET_ID = "synthetic-reality-c545404bcacf-seed0-n5400"`) used to fit the dual-prior.
**If you edit the prereg file, `PARAMS_VERSION_HASH` changes, the A-series datasets become unreachable,
and the dual-prior references break.** Forbidden.

**Decision:** add a **new generator regime** mirroring the existing `frozen` / `reality` pattern
(`generate.py` already threads `generator_regime` and `REALITY_REGIME`). Call it
**`DECOUPLED_REGIME = "decoupled"`**. New dataset id → **`synthetic-decoupled-<hash>-seed0-n<count>`**,
coexisting with `synthetic-21c2cdabfa91-*` (frozen) and `synthetic-reality-*`. Nothing is overwritten.
- Bump `GENERATOR_VERSION` `0.1.0 → 0.2.0` (`manifest.py:8`) so the manifest stamp distinguishes lineages.
- Give the new layer its **own frozen params + hash**: write a new pre-registration doc
  `college/scope/decoupled-session-preregistration.md` (frozen numbers for the new fields — see R1) and
  derive `DECOUPLED_PARAMS_HASH = sha256(that file)[:12]`, exactly mirroring `PARAMS_VERSION_HASH`. The id
  hash should combine base + decoupled (e.g. `sha256(f"{PARAMS_VERSION_HASH}:{DECOUPLED_PARAMS_HASH}")[:12]`)
  so provenance is unambiguous.
- Point every runner at the new data with `--dataset-dir research/datasets/<new-id>` (runners already
  accept it; you do **not** need to touch the hard-coded reference ids, which keep pointing at A-series).

### D-02 — Partial-chunk throughput: keep `active/planned == pace` by construction (LOCKED)
The whole transfer argument (D8) rests on `activeMinutes/plannedMinutes == latent pace ratio`. The harness
reads that ratio directly in **three** places (no abstraction layer):
`runners/calibration.py:_active_visible_sessions` (`active/planned`),
`runners/detection.py:_active_series_with_indices` (`active/planned`),
`baselines/projection.py:_duration_minutes`/`cumulative_points` (uses `activeMinutes`).

**Decision — model an interrupted session as a *smaller chunk*, not a new ratio:** for a partial event,
set `plannedMinutes = consumedEstimate = position_fraction × chunk_minutes` and
`activeMinutes = consumedEstimate × ratio`, so **`active/planned == ratio` still holds** and **all three
readers work unchanged**. Add bookkeeping fields (`resolution: "complete"|"interrupted"`,
`materialPosition: float` = cumulative fraction of the material done, `bookingId`, `isAdHoc`) that the
*generator* and *ground truth* use but the existing throughput readers ignore. This realizes D8a's "same
ratio definition" with **zero change** to the calibration/detection math — the cleanest transfer story.
- **Alternative (only if R2 degrades):** down-weight or exclude partials (see R2 fallback). If you ever
  need a *separate* denominator, that becomes a reader change in all three sites — avoid unless forced.

### D-03 — `r_star` stays 1:1 with emitted events; every event has `duration > 0` (LOCKED)
`runners/projection.py:_target_minutes_from_truth` zips `sessions` (filtered to `duration>0`) against
`truth["r_star"]`, and `runners/calibration.py:_active_sessions_with_targets` zips with `strict=True`.
**Invariant:** the new generator must emit **one `r_star` entry per emitted event** (partials + ad-hoc
included) and **every event must have `duration>0`**, or the zips misalign / raise. Add a generator test
asserting `len(r_star) == len(sessions)` and `all(duration>0)` for the decoupled regime (R1 DoD).

### D-04 — Two new projection candidates + cold-start composite (LOCKED shape; thresholds OPEN)
Register `analytic_required_rate` and `gp_plus_analytic` in `baselines/projection.py` +
`runners/projection.py:projection_candidates()` (§ R4). They are scored automatically by the existing
machinery against `gp_ard` (the projection incumbent, `runners/rigour.py:INCUMBENTS["projection"]`).
- **OPEN:** cold-start threshold `COLD_START_N` (recommend **5** — the smallest non-trivial point in
  `default_t_grid`'s base `[5,8,13,…]`) and the analytic interval recipe (recommend residual-std of recent
  daily rate; see R4). Implement the recommendation; the benchmark itself will tell us if it's right.

### D-05 — Rigour parity target = match the *current* A-series projection run (LOCKED)
Parity means **same protocol**, not a guessed number. Before R5, read the provenance of the existing
`research/results/projection/projection_results.json` (`_provenance`, `scored_split`, `seeds`, `bands`) and
reproduce **that** config on the new data: default **200 seeds × 9 archetypes × 3 bands = 5400 learners**,
held-out-archetype scoring, Holm (primary) + BH (reported), bootstrap Δ-CIs. (Note: the claims ledger also
references an older `e716cd12dddc`/n3600 lineage — D-05 means "match what the A-series projection result
on disk actually used," and record it.)

### D-06 — Adherence (dial mis-estimation) field is GENERATED but its own benchmark is OUT of core scope (LOCKED)
R1 adds `plannedSessionMinutes` (the dial choice) + its ground-truth mis-estimation model so the signal
*exists* in the data. But §5c's headline (R2–R4) is **throughput / ETA**, not session-length adherence
(which drives the *recommended length* UX, not the finish-date). So: generate the field + ground truth and
a face-validity dump; **do not** build a full adherence-model contest in this plan. File a follow-up if a
dedicated adherence benchmark is wanted later. (Note: the existing `generator/adherence.py` is about
*attempt probability* — whether a session occurs — which is unrelated to dial mis-estimation; don't
conflate.)

### D-07 — OPEN calls to surface, not silently resolve
- **R2 partial inclusion vs down-weight** if the win degrades (pre-declare the rule in R2; pick on
  evidence).
- **Booking-cadence parameters** (study-days/week, ad-hoc rate, partial-interruption rate) — recommended
  values in R1; freeze them in the new pre-reg doc and justify briefly.
- **Reference-line eval** (linear vs capacity-shaped) is a lower-priority R4 sub-task; if time-boxed out,
  log it as deferred rather than dropping silently.

---

## 3. GROUND-TRUTH MAP (verified against live code 2026-06-30)

All paths under `research/comparison/src/research_comparison/`. ✅ = personally read & confirmed.

**Generator** (`generator/`)
- ✅ `types.py` — `SessionEvent` TypedDict `{date, source("active"|"manual"), plannedMinutes, activeMinutes,
  duration, materialRole, startedAt, sessionId}` (`total=False`); `GroundTruth` dataclass `{m_global,
  role_multipliers, context_multipliers, regime_schedule, r_star, true_finish_date, is_faker, clip_rate}`.
- ✅ `generate.py` — `generate_dataset(archetype_mix, bands, seeds, out_dir, progress, generator_regime,
  moment_bounds)` dispatches on `generator_regime ∈ {FROZEN_REGIME="frozen", REALITY_REGIME}`;
  `generate_learner(...)` (frozen) and `generate_reality_matched_learner(...)` (reality) are the two
  existing builders. `_event_for_slot` sets `plannedMinutes`/`activeMinutes = planned × ratio` (lines
  119-142); `_true_finish_date` = cumulative `planned_minutes × latent` vs `sum(material.total_minutes)`
  (lines 105-116); `export_face_validity` dumps pace_ratio/duration/gaps (lines 503-528).
- ✅ `capacity.py` — `PlannedSlot{date, day_of_week, planned_minutes, material_role, material_type,
  material_id, time_of_day, started_at, same_day_count}`; `build_capacity_plan(materials, slots_needed,
  rng, start_date)` lays 1 slot/weekday, 2/weekend; `planned_minutes = sample_chunk_minutes(type)`.
- ✅ `materials.py` — `Material{material_id, material_type, role, total_minutes}`;
  `sample_material_mix(band, rng)`; `sample_chunk_minutes(type, rng)` (playlist 20-50, textbook 40-90,
  practice ~lognormal(45), flashcards 10-20).
- ✅ `adherence.py` — `attempt_probability(...)` (session-occurs gating; NOT dial adherence),
  `choose_source(rng, manual_fraction)`. `pace.py` — `latent_base(m_global, role, tod, dow, config)`.
  `regimes.py` / `reality.py` — shift schedule + reality-matched config.

**Evaluators** (`metrics/`)
- ✅ `projection.py` — `projection_metrics(forecasts, true_finish_date)` → `{coverage,
  mean_sharpness_days, mean_abs_error_days}`; forecast dict must have `predicted_finish_date,
  interval_low, interval_high`; `winner_by_band(rows)`.
- ✅ `rigour.py` — `holm_bonferroni(pvalues, alpha=0.05)`, `benjamini_hochberg`, `bootstrap_delta_ci`,
  `heldout_archetype_split`, `DEFAULT_HELDOUT_TRAIN_ARCHETYPES = {steady, morning_lark, marathon_runner,
  crammer, steady_improver}` (5 train / 4 held-out).
- (Not re-read, trust handover) `prequential.py`, `detection.py`, `aggregate.py`, `coverage.py`,
  `recovery.py`, `paired.py` — confirm signatures if you touch them.

**Runners / registries** (`runners/`)
- ✅ `projection.py` — `projection_candidates(conformal_width_days)` returns `gp_ard, linear, conformal,
  gp_hetero_t, kalman` (lines **42-82**) — **register new candidates here**;
  `run_projection_for_learner(...)` builds forecasts over `default_t_grid` (base `[5,8,13,21,34,55,89,n]`),
  scores via `projection_metrics`, `comparison_score = MAE_days + |0.95−coverage|×10 + sharpness×0.01`;
  `run_projection_track(...)` pairs vs `gp_ard` via `paired_by_group(metric="comparison_score",
  baseline_candidate="gp_ard")` + `mc_correction_block`. Forecast signature:
  `(sessions, total_minutes, start_date, horizon_end_date) -> dict`.
- ✅ `baselines/projection.py` — `forecast_gp_finish`, `forecast_linear_finish`,
  `forecast_conformal_finish`, `forecast_gp_hetero_t_finish`, `forecast_kalman_finish`,
  `cumulative_points` (uses `_duration_minutes` = `activeMinutes` for active else `duration`),
  `_date_to_index`/`_index_to_date`, `conformal_abs_residual_quantile`. **Add new forecasters here.**
- ✅ `calibration.py` — reference dataset ids at lines **49-50**; `calibration_candidates()` registered in
  `baselines/calibration.py:927` (incl. `EnrichedShrinkageCalibrator`, `DualPriorWeightedCalibrator`);
  reads throughput as `active/planned` in `_active_visible_sessions`.
- ✅ `detection.py` — `detection_candidates(...)` registers 7 detectors (`cusum` incumbent +
  `ewma_control_chart, csd, bocpd, page_hinkley, adwin, ruptures_pelt_binseg`); reads `active/planned` in
  `_active_series_with_indices`; pairs vs `cusum`.
- ✅ `rigour.py` — `DEFAULT_SEED_COUNT = 200`; `INCUMBENTS = {calibration: hierarchical_bayes, detection:
  cusum, projection: gp_ard, scheduling: greedy_incumbent}`; `resolve_dataset_dir`,
  `dataset_for_seed_count`, `paired_by_group`, `mc_correction_block`, `annotate_archetype_split`,
  `reporting_rows` (held-out scoring).
- ✅ `manifest.py` — `GENERATOR_VERSION = "0.1.0"`, `Manifest{seed, generator_version, params_version_hash,
  archetype_mix, n_learners, …}`. `writers/results.py` — `write_stamped_json`, `manifest_from_dataset`.
- ✅ `params.py` — `PARAMS_VERSION_HASH = sha256(archetype-preregistration.md)[:12]`; `BANDS`,
  `ARCHETYPES` (9), `MANUAL_FRACTION=0.15`, `CLIP_LOW/HIGH`, `AR1_PHI`, `SWEEP_GRID`.

**Run entrypoints** — root `Makefile` (`dataset|compare|compare-detection|compare-projection|sweep`);
results → `research/results/{calibration,detection,projection}/*.json`, stamped by `writers/results.py`.
Datasets on disk: `synthetic-21c2cdabfa91-seed0-n5400` (frozen A-series),
`synthetic-e716cd12dddc-seed0-n{3600,720}` (older frozen lineage),
`synthetic-reality-{c545404bcacf-n5400, 3b404c903563-n3600}`.

**Algorithms under test** — `packages/py-progress/src/py_progress/` (`bayesian, cusum, gp, kalman,
enriched, trend, progress`) imported by the baselines. **Read-only** for this workstream.

---

## 4. PHASES (vertical slices)

Dependency graph: **P0 → R1 → (R2 ∥ R3 ∥ R4) → R5 → R6**. Scheduling track is OUT.

---

### ☐ P0 — Baseline, environment, commit-the-plan
**Goal:** lock provenance and a green baseline before changing anything.
1. Commit these planning docs (§0.2 Step 0).
2. Confirm the harness runs: `uv run --package research-comparison pytest research/comparison/tests -q`
   (or the subset that runs in-sandbox). Record pass/fail counts + any arm64/dep block in `VERIFICATION.md`.
3. Record the **current A-series projection provenance** for the D-05 parity target: read
   `research/results/projection/projection_results.json` → `_provenance` + `scored_split` + `dataset_id`;
   note `seeds`, `bands`, `n_learners`. (This is the number R5 must match.)
4. Snapshot the existing frozen calibration/detection/projection headline numbers (winner-by-band, Holm
   survivors) into `VERIFICATION.md` so R2/R3/R4 deltas are measured against a recorded baseline.

**Acceptance:** plan committed (SHA logged); baseline test status + A-series provenance + headline
numbers recorded in `VERIFICATION.md`.

---

### ☐ R1 — Extend the generator: `decoupled` regime (bookings + partials + ad-hoc + dial)
**Goal:** a new dataset that models the redesign's data-generating process, with explicit ground truth
for every new signal, **coexisting** with the A-series (D-01) and preserving the latent-pace core.

**Files (verified):**
- `generator/types.py` — extend `SessionEvent` (new optional fields) + `GroundTruth` (new truth fields).
- `generator/generate.py` — add `DECOUPLED_REGIME`, `generate_decoupled_learner(...)`, dispatch in
  `generate_dataset(...)`; extend `export_face_validity` for the new fields.
- `generator/capacity.py` (or a new `generator/booking.py`) — booking cadence + ad-hoc + interruption.
- `manifest.py` — `GENERATOR_VERSION = "0.2.0"`.
- `params.py` (or new `params_decoupled.py`) — new frozen constants + `DECOUPLED_PARAMS_HASH`.
- `college/scope/decoupled-session-preregistration.md` — **NEW** frozen-params doc (you author it).
- `research/comparison/tests/test_generator.py` — new decoupled-regime tests.

**New `SessionEvent` fields** (keep existing ones; all optional, `total=False`):
| field | type | meaning |
|---|---|---|
| `plannedSessionMinutes` | float | the **dial** choice (D2/D6) — the user's intended session length |
| `resolution` | "complete" \| "interrupted" | D4/D8a outcome |
| `materialPosition` | float [0,1] | cumulative fraction of the material completed after this session |
| `bookingId` | str | D9a attribution key (ad-hoc sessions get an auto-created booking id) |
| `isAdHoc` | bool | session on a non-study (unbooked) day |

**New `GroundTruth` fields** (additive):
| field | meaning |
|---|---|
| `study_days` | the planned weekly study-day set (cadence ground truth) |
| `adherence_bias` | the learner's dial mis-estimation factor (D6 adherence truth; mean of `active/plannedSessionMinutes`) |
| `interruption_rate` | fraction of sessions interrupted (partial) |
| `adhoc_rate` | fraction of sessions on non-study days |

**Generation rules (freeze the numbers in the new pre-reg doc; recommended defaults):**
1. **Latent pace core — UNCHANGED.** Keep `latent_base` / regime / fatigue / deadline / trend exactly as
   in `generate_learner`. The per-event `ratio` (latent pace) is computed identically. **This is what
   makes D8 transfer.** Do **not** re-tune `m_global`, `ROLE_RHO`, `TAU`, regimes.
2. **Bookings + cadence (D9).** Sample a weekly **study-day set** per learner (e.g. 3–6 days/week). Lay
   bookings on study days; emit sessions from bookings; carry `bookingId`. Keep the deadline/horizon
   sidecar (`planned_horizon`) as today.
3. **Ad-hoc days (D5/D9).** With `adhoc_rate` (recommend ~0.10–0.20) emit sessions on **non**-study days;
   set `isAdHoc=true`, auto-create a `bookingId`. This is the irregular-cadence stressor for R3.
4. **Interrupted / partial chunks (D4/D8a) — via D-02.** With `interruption_rate` (recommend ~0.15–0.25):
   draw `position_fraction ∈ (0,1)`, set `plannedMinutes = position_fraction × chunk`,
   `activeMinutes = plannedMinutes × ratio`, `resolution="interrupted"`, advance `materialPosition` by the
   partial; the **material stays open** to resume (D4) → the next session on that material continues from
   `materialPosition`. Complete sessions: `resolution="complete"`, full chunk, `active/planned == ratio`.
   **Result: `active/planned == ratio` for every active event (partial or full) — D-02.**
5. **Dial / adherence (D6, generated-only per D-06).** Set `plannedSessionMinutes` = the *intended* length,
   then `activeMinutes`/duration is the realized session; model mis-estimation with `adherence_bias`
   (e.g. lognormal around 1.0). Record `adherence_bias` in ground truth + dump
   `plannedSessionMinutes/active` ratio in face-validity. (No contest built — D-06.)
6. **Invariants (D-03):** one `r_star` entry per emitted event; every event `duration>0`;
   `_true_finish_date` still = cumulative material consumed at latent pace (materials all completed by the
   true finish). Manual sessions behave as today.
7. **Provenance (D-01):** dataset id `synthetic-decoupled-<hash>-seed0-n<count>`; `generator_version
   "0.2.0"`; manifest stamps `params_version_hash` (base) + new `decoupled_params_hash`.

**How to run:**
```bash
uv run --package research-comparison python -m research_comparison.generator.generate \
  --regime decoupled --seeds 200 --out-dir research/datasets
# add --regime decoupled to the generate CLI argparse (currently choices=[frozen,reality])
```
Smoke first with `--seeds 4`; then the full 200.

**Acceptance (R1 DoD):**
- New dataset dir `synthetic-decoupled-*-seed0-n5400` exists; A-series + reality datasets **untouched**
  (verify by listing `research/datasets/` before/after).
- New pre-reg doc committed; `DECOUPLED_PARAMS_HASH` derives from it; `GENERATOR_VERSION == 0.2.0` in the
  manifest.
- Tests assert: `len(r_star)==len(sessions)`; `all(duration>0)`; for every active event
  `abs(active/planned − r_star_i) < 1e-6` (D-02 invariant holds for partials too); partial events have
  `resolution=="interrupted"` and `0<plannedMinutes<chunk`; ad-hoc sessions land off study-days;
  `face_validity.json` includes the new distributions.
- `PARAMS_VERSION_HASH` and the hard-coded reference ids in `calibration.py:49-50` are **unchanged**.

---

### ☐ R2 — Calibration regression (TRANSFER — re-confirm)
**Goal:** confirm the `enriched_shrink` / `dual_prior` win **survives Holm + held-out** on the decoupled
data **with partial-chunk throughput points included**.

**Files:** none required if D-02 holds (the calibration runner reads `active/planned` and is data-driven).
Only touch code if you hit the fallback below.

**Run:**
```bash
make compare ARGS=...   # or:
uv run --package research-comparison python -m research_comparison.runners.calibration \
  --dataset-dir research/datasets/synthetic-decoupled-<hash>-seed0-n5400 \
  --out-dir research/results/calibration_decoupled --seeds 200 --quiet
```
(Use a **separate `--out-dir`** so you don't clobber the A-series `research/results/calibration/`.)

**Compare against the P0 baseline:** read `mc_correction` → `survives_holm_win` for
`enriched_shrink`/`dual_prior` vs `hierarchical_bayes` on held-out cells; compare winner-per-band.

**Pre-declared fallback (D-07) if the win degrades because of partials:** re-run with partials
**down-weighted or excluded** from calibration only (smallest change: filter `resolution=="interrupted"`
in a calibration-local view, or weight by `position_fraction`). Report **both** runs; recommend the
inclusion policy that preserves the win without leakage, and write the rationale into the claims-ledger
note (R5).

**Acceptance (R2 DoD):** decoupled calibration results written (separate out-dir); held-out + Holm verdict
for `enriched_shrink`/`dual_prior` recorded vs the P0 baseline; if degraded, the fallback run + chosen
policy + justification are recorded. **Honest reporting:** Holm-surviving wins only.

---

### ☐ R3 — Detection regression (MUST RE-RUN)
**Goal:** confirm the **CUSUM robust-null** still holds (no deployable detector beats `cusum` under
held-out + Holm) once partials + ad-hoc irregular arrivals add noise — or document the change.

**Files:** none required (the detector reads `active/planned`, data-driven). Touch only if you change the
series construction.

**Run:**
```bash
uv run --package research-comparison python -m research_comparison.runners.detection \
  --dataset-dir research/datasets/synthetic-decoupled-<hash>-seed0-n5400 \
  --out-dir research/results/detection_decoupled --seeds 200 --quiet
```

**Note on the active axis:** `_active_series_with_indices` builds the pace series from `active` events with
`planned>0`; `_shifts_on_active_axis` maps regime onsets onto that axis. With ad-hoc/partials interleaved,
confirm the shift-onset mapping still lands sensibly (add a focused test if the series ordering changed).

**Acceptance (R3 DoD):** decoupled detection results written (separate out-dir);
`paired_vs_incumbent` / `mc_correction` vs `cusum` recorded; verdict stated as **robust-null holds** or
**changed** (which detector, which shift_type/band, Holm-surviving) vs the A4 result. CUSUM tuning stays
**train-archetypes-only** (no leakage).

---

### ☐ R4 — ETA benchmark (HEADLINE — proves/selects the #3 design)
**Goal:** register the new projection candidates, score them against `GroundTruth.true_finish_date`
(coverage / MAE-days / sharpness), paired-Holm vs the `gp_ard` incumbent, and evaluate the cold-start
fallback + reference-line question. **This is the result that gates whether #3 may be claimed.**

**Files:**
- `baselines/projection.py` — add `forecast_analytic_required_rate(...)` and
  `forecast_gp_plus_analytic(...)` (same signature + return shape as the existing forecasters).
- `runners/projection.py` — add two `ProjectionCandidate`s to `projection_candidates()` (lines 42-82).
- `research/comparison/tests/test_projection_track.py` — tests for the new forecasters (shape, monotonic
  sanity, cold-start switch).

**Candidate 1 — `analytic_required_rate`** (the "B" leg / D6 required-rate, as a finish projection):
> Currency note: the harness target `total_minutes` from `_target_minutes_from_truth` is in **cumulative
> actual-minutes** (the burn-up y-axis = cumulative `activeMinutes`). So the D6 formula
> `remaining_material × throughputFactor ÷ effectiveDailyMinutes` reduces, in this currency, to
> `remaining_actual ÷ effectiveDailyMinutes` (the throughput factor is already folded into the
> actual-minutes target). **Do not double-count `tf`.**
```text
points          = cumulative_points(sessions)            # cumulative actual minutes
consumed_actual = points[-1].minutes
elapsed_days    = index(last_date) - index(first_date) + 1
effective_daily = consumed_actual / max(elapsed_days, 1)
remaining       = max(0, total_minutes - consumed_actual)
days_left       = remaining / max(effective_daily, 1e-6)
predicted_finish_date = last_date + round(days_left)
# interval (recommended): residual-std of recent per-day increments → width_days;
#   e.g. width = 1.96 * std(recent_daily_increments)/effective_daily * sqrt(days_left/elapsed_days)
#   floor at 1 day. Report coverage honestly — nominal is NOT required, comparison is the point.
return {candidate, predicted_finish_date, interval_low, interval_high, sharpness_days}
```

**Candidate 2 — `gp_plus_analytic`** (the composite, with cold-start fallback, D-04):
```text
if len(sessions) < COLD_START_N (recommend 5):
    return analytic_required_rate(...)                    # cold-start → analytic
g = forecast_gp_finish(sessions, total_minutes, start, end)
if g.predicted_finish_date >= horizon_end_date:          # GP failed to cross within horizon
    return analytic_required_rate(...)                    # analytic rescue
return g                                                  # GP point + GP CI otherwise
```
(Keep it transparent and testable; the composite's value-add is robustness at cold-start / non-crossing,
exactly where `gp_ard` is weakest — see the claims ledger: `gp_ard` under-covers badly.)

**Run:**
```bash
uv run --package research-comparison python -m research_comparison.runners.projection \
  --dataset-dir research/datasets/synthetic-decoupled-<hash>-seed0-n5400 \
  --out-dir research/results/projection_decoupled --seeds 200 --quiet
```
Scoring is automatic: `winner_by_band`, `paired_vs_incumbent` (vs `gp_ard`), `mc_correction`
(Holm + BH). The two new candidates appear in `rows`/`forecasts`/`paired_*` with no further wiring.

**Sub-tasks:**
- **R4a — Cold-start fallback eval.** Probe the smallest histories (extend `default_t_grid` base to
  include `3`, or add a dedicated cold-start probe) and report composite vs `gp_ard` at small `t`
  specifically — this is where the fallback should help. Write a `cold_start_eval` block into the payload.
- **R4b — Reference-line eval (lower priority, D-07).** Compare **linear-to-deadline** vs
  **capacity-shaped** ideal reference against the ground-truth cumulative curve (which better tracks
  `r_star`-driven progress). Emit a `reference_line_eval` block. If time-boxed out, log as **deferred**.

**Acceptance (R4 DoD):**
- Both candidates registered and scored on the full decoupled dataset (separate out-dir).
- Recorded for each band: coverage, MAE-days, sharpness for `gp_ard`, `analytic_required_rate`,
  `gp_plus_analytic`; **paired-Holm vs `gp_ard`** with `survives_holm_win` flags.
- A clear **verdict**: does `gp_plus_analytic` (and/or `analytic_required_rate`) **beat `gp_ard` under
  held-out + Holm**? On which bands? This is the sentence the dissertation cites.
- R4a cold-start result recorded; R4b done or explicitly deferred.
- Oracles remain upper bounds (never reported as method wins).

---

### ☐ R5 — Rigour parity + claims-ledger update
**Goal:** make the new results dissertation-grade and directly comparable to the A-series, and write the
honest framing.

1. **Parity check (D-05):** confirm R2/R3/R4 ran at the **same protocol** as the A-series projection
   result recorded in P0 (200 seeds / 9 archetypes / 3 bands / held-out / Holm primary + BH reported /
   bootstrap Δ-CIs). Record the formula + provenance hashes in each result JSON (they already stamp via
   `attach_rigour_provenance`).
2. **Claims-ledger entry:** append a section to
   `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`:
   - calibration's `planned` reference **changed source** (slot chunk → material throughput) but the
     **signal shape is identical** (D8) — state transfer vs re-confirmed (R2 numbers).
   - partial-chunk throughput points **included** (D8a) — external-validity caveat + the R2 policy chosen.
   - detection robust-null **re-run** verdict (R3).
   - the ETA verdict (R4) stated **only** to the strength the Holm result supports; if it does not
     survive, say so plainly and keep #3 as 🟡.
3. **Comparability table:** a short results doc under `research/doc/` summarizing frozen vs decoupled
   headline numbers per track.

**Acceptance (R5 DoD):** parity recorded; claims-ledger updated with evidence (file/commit) per entry;
comparability doc written; #3 status updated (locked-claimable vs still-🟡) in DECISIONS.md change log.

---

### ☐ R6 — Circularity guard: N=1 real-data validation (Research Phase 5)
**Goal:** synthetic scoring is model-dependent and the *new* event types (partials, ad-hoc) are where
external validity is weakest — sanity-check them on real logged sessions before claiming.

**Context:** maps to `college/scope/research-tasklist.md` **Phase 5 · N=1 real-data validation** (P5.x,
currently ☐ not started). Real captured evidence tooling exists at
`research/comparison/scripts/capture_evidence.py`.

**Tasks:**
- Take the available N=1 real logged sessions (the candidate's own data / captured evidence). Compute the
  **throughput ratio on partial sessions** and compare its distribution to the synthetic partial
  distribution (face-validity overlay) — does `active/(position×chunk)` look in-family?
- Run the **ETA candidates** on the real burn-up curve; report finish-date error vs the realized finish
  **descriptively** (N=1 — no significance, no algorithm-superiority claim; this is a circularity guard,
  per P5.6's "explicit non-claims").
- Derive **descriptive** bounds only (no parameter tuning — circularity guard, P5.5).

**Acceptance (R6 DoD):** an N=1 overlay + ETA-on-real write-up stub under `research/doc/` (or
`college/...`) with **explicit non-claims**; partial-throughput in-family (or flagged); no synthetic
parameter was tuned to real data. Checks the relevant P5 boxes in `research-tasklist.md`.

---

## 5. DEFINITION OF DONE (whole plan)
- [ ] P0 baseline + A-series provenance recorded; plan committed (Step 0).
- [ ] R1 decoupled dataset coexists with A-series (nothing overwritten); new fields + ground truth +
      pre-reg doc + tests; D-02/D-03 invariants asserted.
- [ ] R2 calibration transfer re-confirmed (or fallback applied + justified) — Holm-surviving only.
- [ ] R3 detection robust-null re-run verdict recorded.
- [ ] R4 two new ETA candidates registered + scored; **explicit Holm verdict vs `gp_ard`**; cold-start
      eval done; reference-line done-or-deferred.
- [ ] R5 rigour parity confirmed; claims-ledger + comparability doc updated; #3 status flipped per evidence.
- [ ] R6 N=1 guard write-up with explicit non-claims.
- [ ] Scheduling track confirmed **not run / not extended**.
- [ ] Every phase has a reviewer-✅ section in `VERIFICATION.md` with commit SHA + files changed +
      deviations.

## 6. OPEN QUESTIONS / ASSUMPTIONS (do not silently resolve — log resolutions in VERIFICATION.md)
- **OQ-1 (R2):** include vs down-weight partial-chunk throughput points if the win degrades — decide on
  evidence; record both runs.
- **OQ-2 (R1):** exact frozen cadence params (study-days/week, `adhoc_rate`, `interruption_rate`,
  `adherence_bias` distribution) — recommended ranges given; freeze + justify in the pre-reg doc.
- **OQ-3 (R4):** `COLD_START_N` and the analytic interval recipe — implement the recommendation; the
  benchmark validates it.
- **OQ-4 (D-05):** the exact A-series parity config (n5400 vs the ledger's n3600/`e716cd12dddc`) — resolve
  by reading the on-disk A-series projection provenance in P0 and matching it.
- **Assumption:** harness may not fully run in-sandbox (arm64/dep block per STATUS). Mitigation: write all
  code + tests; run what you can; record run-vs-authored-only honestly.
```
