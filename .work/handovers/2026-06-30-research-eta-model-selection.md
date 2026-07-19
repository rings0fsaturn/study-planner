# Handover — Research plan: re-validate & select models for the new material/session design

**For:** a fresh Opus planning session (study-planner-web planner/reviewer role).
**Your output:** an **implementation plan** (not code) that a coding agent (Codex/Sonnet) will execute
to **extend the research harness, re-validate the transferring results, and benchmark/select the best
model(s) for the new design** — above all the **finish-date / ETA projection**.
**Runs in parallel** with the product UI work, so the plan must be self-contained inside `research/`
and must not depend on any app/UI change.

---

## 0. Your role & hard constraints (read before planning)

- You are the **planner/reviewer**, not the implementer. Produce a plan; do **not** modify code. Per the
  project's mandatory rules, everything under `apps/ packages/ e2e/ services/ scripts/ tests/` and
  **`research/`** code is **read-only to you** — you describe changes, the implementer makes them.
- **Write only** in the allow-list: `plans/**` (here `.work/plans/**`), `.work/**`, docs. Output the plan to
  **`.work/plans/active/2026-06-30-research-eta-model-selection/PLAN.md`** with a companion
  **`VERIFICATION.md`** (acceptance criteria pre-filled per phase).
- **Cowork cannot run mutating git** (it bricks the sandbox). So your `PLAN.md` preamble must instruct the
  implementer: *"Step 0, before any code: commit these planning docs verbatim."* and *"after each phase,
  fill your section of VERIFICATION.md; a phase isn't done until the reviewer marks it ✅ Verified."*
- **No fabrication.** The file/function anchors in §3 came from a sub-agent sweep — **verify each against
  the actual code** (Read/Grep) before your plan relies on it. If something doesn't match, fix the plan and
  log it; don't trust this doc over the source.
- Follow the `write-implementation-plan` format used by recent files in `.work/plans/` (operating-manual
  preamble, Decisions log `D-01…`, phases as vertical slices with `☐/🟡/✅` markers).

---

## 1. Why this work exists (the design that's changing)

The app is being refactored from a **dated-slot** model to a **decoupled material/session** model.
**You must read the decision log first** — it is the source of truth for the design:

> **`.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md`** (read fully; §5c is your
> direct charter).

Compressed, the decisions that matter for research:
- **D8 (locked):** the intelligence layer calibrates **throughput** = `actual minutes ÷ estimated material
  minutes consumed`. We verified the existing synthetic generator already models this signal
  (`planned_minutes` = a material chunk; `active = planned × pace`), so the **calibration signal is
  unchanged** — calibration validation should **transfer**, but must be **re-confirmed**, not assumed.
- **D8a (locked):** **interrupted / partial-chunk** sessions are included in calibration as throughput
  points (the generator currently emits **full-chunk sessions only** — this is a new event type).
- **D9/D9a (locked):** a **session-booking** model. The engine lays out blank bookings (date + estimated
  duration, capacity-only — **no material packing**). One material per booking, soft-suggested. Sessions
  carry a `bookingId`. New event types vs the old generator: **user-chosen session length (dial)**,
  **ad-hoc any-day** sessions.
- **#3 / §5c (PROPOSED, NOT LOCKED — this is what you're proving):** the ETA composite — **GP**
  extrapolation of the material-done curve for the finish-date + CI, plus an **analytic**
  `remaining × throughputFactor ÷ effectiveDailyMinutes` for the dial recommendation; verdict = projected
  finish vs deadline; reference line linear-to-deadline (vs capacity-shaped); cold-start → analytic
  fallback. **The dissertation may not claim this until a benchmark backs it.**

**Core principle to preserve:** the refactor changes the **data-generating process** (session arrival +
new event types), **not** the **latent pace signal**. Keep the generator's validated latent-pace core
intact and **add** the new layers on top, each with its own ground truth — so the D8 "transfer" argument
stays valid and the new results stay comparable to the A-series.

---

## 2. Your charter — turn §5c R1–R6 into an executable plan

Produce a phased plan covering:

- **R1 — Extend the synthetic generator.** Add, each with explicit ground truth: (a) a
  `plannedSessionMinutes` field = the user's dial choice, **separate** from the material chunk, with a model
  of how users mis-estimate their own session length (this is the *adherence* signal, distinct from
  throughput); (b) **interrupted / partial-chunk** sessions (consume a fraction of a chunk; `resolution`
  flag; partial material position → a throughput point); (c) **booking cadence + ad-hoc any-day** sessions
  (some sessions off the planned study-days). **Bump `generator_version` / params hash** so new datasets
  are stamped and coexist with the frozen A-series datasets (never overwrite).
- **R2 — Calibration regression.** Re-run the calibration track on the new data; confirm the
  `enriched_shrink` / `dual_prior` win **survives Holm + held-out** with partial-chunk throughput points
  included. If it degrades, the plan should specify the fallback (e.g. down-weight or exclude partials).
- **R3 — Detection regression.** Re-score the existing detector set under the new (noisier, irregular)
  cadence; confirm the **CUSUM robust-null** still holds (or document the change).
- **R4 — ETA benchmark (headline).** Register **new projection candidates** — `analytic_required_rate`
  and the **`gp+analytic` composite** — alongside the existing `gp_ard / linear / conformal / kalman`, and
  score them against `GroundTruth.true_finish_date` (coverage, MAE-days, sharpness) with paired-Holm vs the
  GP incumbent. Also evaluate the **cold-start fallback** and **linear vs capacity-shaped** reference line.
  **This is what proves / selects the #3 design.**
- **R5 — Rigour parity.** Same 200 seeds, 9 archetypes, 3 bands, Holm correction, train/held-out split as
  the A-series, so results are dissertation-grade and directly comparable.
- **R6 — Circularity guard.** Plan a step to validate the partial-chunk throughput + the ETA on **real
  N=1 logged sessions** (Research Phase 5 in `college/scope/research-tasklist.md`), since synthetic scoring
  is model-dependent and the new event types are where external validity is weakest.

The plan should make **R1 → (R2, R3, R4) → R5 → R6** independently-executable slices, and call out which
results **transfer vs must-re-run** so the dissertation claims stay honest.

---

## 3. Ground-truth map of the existing harness (VERIFY before relying)

All under `research/comparison/` (a reusable harness — extend it, don't rebuild). **Confirm each anchor.**

**Generator** — `src/research_comparison/generator/`
- `types.py` — `SessionEvent` `{date, source, plannedMinutes, activeMinutes, duration, materialRole,
  startedAt, sessionId}`; `GroundTruth` `{m_global, role_multipliers, context_multipliers,
  regime_schedule, r_star, true_finish_date, is_faker, clip_rate}`.
- `generate.py` — `generate_dataset(...)`, `generate_learner(archetype, band, seed)`; `PlannedSlot.planned_minutes
  = sample_chunk_minutes(material_type)`; `_event_for_slot` sets `plannedMinutes`/`activeMinutes = planned × ratio`;
  `_true_finish_date` = cumulative `planned_minutes × latent` vs `sum(material.total_minutes)`.
- `pace.py` `latent_base = m_global × role_rho × tau × weekend`; `materials.py` `sample_chunk_minutes`,
  `sample_material_mix`; `reality.py` reality-matched config (`synthetic-reality-*` datasets).

**Evaluators** — `src/research_comparison/metrics/`
- `prequential.py` — calibration MAE (`prequential_absolute_errors`) + `context_prediction_absolute_errors`
  vs `GroundTruth.m_global`.
- `detection.py` — `score_detections` (mean_latency, missed, false_alarm_rate); `winner_by_shift_type`
  vs `GroundTruth.regime_schedule`.
- `projection.py` — `projection_metrics(forecasts, true_finish_date)` → coverage, mean_abs_error_days,
  mean_sharpness_days. **Forecast dict shape:** `{predicted_finish_date, interval_low, interval_high}`.
- `scheduling.py` — (the retired track; **deprioritize/skip** per §5c).
- `rigour.py` — `holm_bonferroni(pvalues, alpha=0.05)`, held-out split (`DEFAULT_HELDOUT_TRAIN_ARCHETYPES`).

**Runners / registries** — `src/research_comparison/runners/`
- `projection.py:~42-82` `projection_candidates()` (incumbent `gp_ard`, + `linear/conformal/gp_hetero_t/
  kalman`); `run_projection_for_learner(...)`; `_target_minutes_from_truth`; Fibonacci `default_t_grid`.
- `calibration.py` candidate list (frozen + reality reference dataset IDs ~line 49-50);
  `baselines/calibration.py:~927-940` registers the 11 calibrators (incl. `EnrichedShrinkageCalibrator`,
  `DualPriorWeightedCalibrator`).
- `detection.py:~95-128` registers 7 detectors (`baselines/detection.py` `detect_cusum_robust`, etc.).
- `rigour.py` `DEFAULT_SEED_COUNT = 200`, `mc_correction_block`; `sweep.py` robustness grid.
- `baselines/projection.py` `forecast_gp_finish` (calls `py_progress.fit_burn_up_gp`),
  `forecast_linear_finish`, `forecast_conformal_finish`, `forecast_kalman_finish`. **← register your new
  candidates here + in `projection_candidates()`.**

**Run entrypoints** — root `Makefile`: `make dataset | compare | compare-detection | compare-projection |
compare-scheduling | sweep`. Results → `research/results/{calibration,detection,projection,scheduling,sweep}/*.json`,
stamped via `writers/results.py` + `manifest.py` (`generator_version`, `params_version_hash`, archetype/band/seed).
Datasets on disk: `research/datasets/synthetic-*` and `synthetic-reality-*`.

**Algorithms under test** — `packages/py-progress/src/py_progress/` (`bayesian.py, cusum.py, gp.py, kalman.py,
enriched.py, trend.py, progress.py`). The product TS mirrors live in `packages/progress/src/`.

**Confirm the run environment** (how `research/comparison/` is packaged/installed and how `make` invokes it;
note the repo's `.venv` python3.14 is for the *literature* scripts, not necessarily this harness).

---

## 4. Also read (context, not charter)

- `.work/STATUS.md` — project index; A-series rows (A0–A6), change-detection robust-null, research Phases.
- `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md` — the **claims ledger** (what may / may not
  be claimed; add the D8 "planned reference changed source" note here when relevant).
- `research/doc/2026-06-20-change-detection-literature-survey.md` — the robust-null verdict context.
- `college/scope/research-tasklist.md` — Phases 0–7; **Phase 5 = N=1 real-data validation** (your R6).

---

## 5. Definition of done for YOUR plan

- [ ] `PLAN.md` + `VERIFICATION.md` written to `.work/plans/active/2026-06-30-research-eta-model-selection/`.
- [ ] Phased into independent vertical slices mapping to R1→(R2,R3,R4)→R5→R6; scheduling track explicitly out.
- [ ] Every file/symbol the plan touches is **verified** against the real `research/comparison/` code
      (no anchor trusted from §3 alone); discrepancies fixed + logged in the Decisions log.
- [ ] R1 specifies the new generator fields + their **ground truth** and the `generator_version` bump
      (datasets coexist; A-series provenance preserved).
- [ ] R4 specifies the **new projection candidates**, where they register, and the **exact scoring**
      (coverage / MAE-days / sharpness vs `true_finish_date`, paired-Holm vs `gp_ard`).
- [ ] The plan states explicitly which results **transfer (re-confirm)** vs **must re-run**, tying back to D8.
- [ ] Preamble carries the "Step 0: commit docs" + "reviewed against VERIFICATION.md" instructions.
- [ ] Open questions / assumptions logged, none silently resolved (e.g. how to model user session-length
      mis-estimation; partial-chunk inclusion vs down-weighting if R2 degrades).
