# How to use this plan

> **You are the implementing agent.** This document is your runbook for one cohesive change to this codebase. It was written collaboratively by Claude and a human after a planning discussion, and it is the source of truth for this work. Read this preamble in full before doing anything else.

## What you're holding

A phase-by-phase implementation plan. Each phase is a **vertical slice** — an end-to-end working increment that leaves the codebase in a working state. Phases are designed so any one of them can be implemented by a fresh agent in a new context window, with only this document and the codebase as input.

## Your job

1. **Read the document header in full first.** TL;DR, Context, Decisions log, Architecture overview, and Files-touched index. These give you the *why* behind every step. The Decisions log especially — those decisions were made deliberately and explain choices that may otherwise look arbitrary or wrong. Reference IDs (D-NN) appear inside phase steps so you can look up rationale.

2. **Find your starting phase.** Scan the phase list. Pick the first phase whose status is `☐ Not started` AND whose `Depends on:` phases are all `✅ Complete`. Implement that phase only. **Do not skip ahead. Do not implement multiple phases in one go unless the human explicitly asks.**

3. **Run the prereq verification.** Each phase has a "Verification (run BEFORE starting)" block. Run those commands. **If any fail, STOP** — the codebase isn't in the state this phase expects. Surface to the human: "Phase N's prereqs failed: `<command>` returned `<result>`. Want me to investigate or hand back?"

4. **Follow the steps in order.** Code blocks in steps are the actual code, not pseudocode or sketches. Apply them as written.

5. **If reality doesn't match the step — STOP.** If the plan says "modify line 47 of `auth.py`" and line 47 is something different, do not improvise. Surface the discrepancy: "Plan expected `<X>` at `auth.py:47`, found `<Y>`. Possible causes: plan is stale, file was edited since planning, plan was wrong. How should I proceed?"

6. **Run the tests and post-verification.** Each phase specifies what tests to add or update and the bash command to run. All must pass before the phase is considered done.

7. **Update status and commit.** When the phase is complete:
   - Edit this document: change the phase's `Status:` line to `✅ Complete — <commit-sha-here>`.
   - `git add` the code changes AND this plan file.
   - Commit them together. Suggested message: `Phase N: <phase title>` (with longer body referencing the plan file).
   - The status update and the code change live in the same commit so the doc and the code never drift.

## What you must NOT do

- **Do not skip phases.** Order matters; later phases assume earlier ones completed.
- **Do not modify the Decisions log, the Operating manual preamble, the TL;DR, the Architecture overview, the Files-touched index, the Open questions, the Out-of-scope list, or the References.** Those are immutable above-the-phases content. If you discover a decision is wrong, surface to the human — don't silently revise.
- **Do not re-plan or re-architect.** If the plan seems wrong, that's a signal to stop and surface, not to improvise.
- **Do not implement multiple phases without surfacing for human review** between them, unless the user explicitly asked for batch execution upfront.

## If you get stuck

- Update the phase's `Status:` to `🛑 Blocked: <one-line reason>`.
- Fill in the phase's `Notes (filled in during implementation)` block with what you tried, what's blocking, and what you'd want to know to unblock.
- Hand back to the human.

## Status vocabulary

- `☐ Not started`
- `🟡 In progress`
- `🛑 Blocked: <reason>`
- `✅ Complete — <commit-sha>`

## When status markers and reality drift

The status markers are a fast read, but they are not the source of truth. The phase's `Verification (DONE)` commands are the truth — if you suspect a marker is wrong (someone forgot to update, branches diverged, partial commits, etc.), run the verification commands for the phases marked complete. Trust the commands over the markers, and surface the drift to the human so the markers can be corrected.

---

# Research tier — Part 2: Pillar-A fan-out + closed-loop (Phases 3, 7)

**Slug:** `research-tier-2-pillar-a-fanout`
**Date written:** 2026-06-13
**Author:** Claude + Rohit Saji
**Plan status:** Draft
**Upstream:** [`../../handovers/2026-06-13-research-tier.md`](../../handovers/2026-06-13-research-tier.md) · index: [`2026-06-13-research-tier.md`](2026-06-13-research-tier.md)

> **This is plan 2 of 4.** It covers tracker Phases 3 (fan-out) and 7 (closed-loop, **built but revealed in Phase II**). **Prerequisite: [Part 1](2026-06-13-research-tier-1-foundation.md) Phase 2 (the tracer bullet) must be `✅ Complete`** — this plan reuses its metric/aggregator/writer/plot spine. Sibling plans: [Part 3 — KT bench](2026-06-13-research-tier-3-kt-bench.md) · [Part 4 — Validation & outputs](2026-06-13-research-tier-4-validation-outputs.md).

## TL;DR

With the calibration tracer bullet shipped (Part 1), fan the comparison harness out across the three remaining Pillar-A tracks — **change detection** (CUSUM vs EWMA control-chart vs CSD), **target-date projection** (GP-ARD vs linear vs Kalman), and **roadmap scheduling** (`py_roadmap_engine` greedy vs DP vs rule-based) — each reusing Part 1's runner→metrics→paired-test→writer→plot spine. Then add the **oracle upper-bound baselines** (pre-reg §9) and the **sensitivity sweep** over the §8 grid with a robustness heatmap. Finally, build the **closed-loop machinery** (Phase 7): a `--closed-loop` flag feeding calibration multipliers back into roadmap regeneration, plus a CUSUM→replan trigger and a closed-vs-open comparison — **built now, archived, and deliberately NOT shown in any Phase-I review** (decision #19). All work stays in the clean `uv` env and imports `py-progress` / `py-roadmap-engine` as peer candidates.

## Context & background

Part 1 established the spine: a seeded generator with a ground-truth sidecar, and one track (calibration) running generate → prequential comparison → paired stats → stamped results → convergence PDF + winner table. This plan reuses that exact spine for the other three Pillar-A tracks and the cross-cutting sweep, then layers on the closed loop.

Two principles govern this plan:

1. **Genuine, neutral comparison (decisions #3, #6, #11).** The generator plants **both abrupt steps and gradual drifts**, each labelled, and detection is scored **per shift-type** — steps-only would let CUSUM win by construction. Oracle baselines (pre-reg §9) confirm each task is *discriminable* before candidate results are read.
2. **Don't spend the novelty early (decision #19).** The closed loop is the headline Phase-II contribution. Build it now to de-risk, run it for our own completeness, but Phase-I reviews present **open-loop only**. Phase 7 artifacts go to an archive directory, never into `report/generated/`.

**Support docs (read before implementing):**

- [`college/scope/research-build-plan.md`](../../../college/scope/research-build-plan.md) — §5 metrics, §6 candidate rosters, §7 generator spec (shift types), §8 repo layout.
- [`college/scope/archetype-preregistration.md`](../../../college/scope/archetype-preregistration.md) — §5 shift schedule, §8 sweep grid, §9 oracle baselines.
- [`college/scope/research-decisions-and-findings.md`](../../../college/scope/research-decisions-and-findings.md) — decisions #3, #6, #11, #12, #14, #19 + verified API facts.
- [`2026-06-13-research-tier-1-foundation.md`](2026-06-13-research-tier-1-foundation.md) — the spine this plan reuses (runner/metrics/paired/aggregate/writers/plots modules).

## Decisions log

Mirrors the frozen decisions #1–19 (frozen 2026-06-13). The subset governing Phases 3 & 7:

### D-08: Detection scored per shift-type; generator plants steps **and** drifts

**Status:** ✅ Agreed (master #11)

**Context:** A neutral detection comparison must not be rigged for the incumbent.

**Decision:** The generator plants both abrupt **steps** and gradual **drifts**, each labelled `{type, onset}` in the sidecar (built in Part 1 / Phase 1). Detection latency-vs-false-alarm is reported **split by shift-type**, plus a ROC across thresholds.

**Rationale:** CUSUM is built for abrupt steps; a steps-only generator would hand it the win. Drifts test it where CSD-style indicators may do better.

**Alternatives considered:**
- Abrupt steps only → rejected: rigs the comparison for CUSUM.

**Reversibility:** hard — the shift schedule is frozen in the pre-reg.

### D-09: Scheduling judged on inputs only — no learner execution

**Status:** ✅ Agreed (master #12)

**Context:** The scheduling track compares plan generators, not learner outcomes.

**Decision:** The scheduling runner feeds each candidate the same `(materials, capacity, deadline)` and scores the *generated plan* (deadline drift, capacity-violation rate, prereq-order correctness, gen time). No learner simulation runs through the scheduler in Phase I. `plannedMinutes` in the calibration/projection datasets comes from the **neutral capacity planner** (Part 1), never the production scheduler.

**Rationale:** Calibration/projection must not inherit a scheduler's bias; scheduling is a plan-quality comparison.

**Reversibility:** moderate.

### D-10: Oracle upper-bound baseline per track

**Status:** ✅ Agreed (master #14; pre-reg §9)

**Context:** Confirm a task is discriminable before reading candidate results.

**Decision:** Add a calibration oracle (knows true per-bucket `r*`), a detection oracle (knows planted onsets → latency 0, FA 0), and a projection oracle (uses noise-free `r*`). If a track's oracle can't separate from the field, the SNR is mis-set — fix the pre-reg §2/§5 *ranges* (recorded in §10), never the candidate-favouring values.

**Rationale:** Turns "is the task even solvable?" into an explicit, reported frontier.

**Reversibility:** easy (oracles are read-only baselines).

### D-11: Sensitivity sweep reports ranking stability, not re-tuned winners

**Status:** ✅ Agreed (master #14; pre-reg §8)

**Context:** Defend the frozen parameters against "you cherry-picked."

**Decision:** After the frozen-default run, sweep `σ_log`, step magnitude, drift total, manual fraction, AR(1) `φ` over the §8 grid; report whether the per-track **ranking** holds. A ranking that flips is reported honestly and localised to the regime where it flips. Parameters are never tuned toward a winner.

**Reversibility:** easy.

### D-12: Closed loop built now, archived, revealed in Phase II

**Status:** ✅ Agreed (master #19)

**Context:** The verified closed loop is the headline Phase-II novelty.

**Decision:** Build the `--closed-loop` flag (calibration → roadmap regen), the CUSUM→replan trigger, and the closed-vs-open comparison. Run and **archive** them (`research/results/closed_loop/`), but do **not** emit them into `report/generated/` or present them in any Phase-I review.

**Rationale:** De-risk the hard part early without spending the novelty.

**Alternatives considered:**
- Report closed-vs-open in Phase I → rejected: spends the Phase-II headline.

**Reversibility:** easy (it's gated behind a flag and an archive dir).

## Architecture overview

Each track is a thin runner over the shared spine from Part 1 (`metrics/`, `writers/`, `plots/`, `manifest`). New modules slot beside the calibration ones:

```
research/comparison/src/research_comparison/
  runners/    detection.py  projection.py  scheduling.py  sweep.py  closed_loop.py   (NEW)
  baselines/  detection.py  projection.py  scheduling.py                            (NEW)
  metrics/    detection.py  projection.py  scheduling.py                            (NEW; reuse paired.py, aggregate.py)
  oracles/    calibration.py detection.py projection.py                             (NEW dir, P3.12)
  plots/      detection_latency.py  projection_reliability.py  robustness_heatmap.py (NEW)
research/results/
  detection/  projection/  scheduling/  sweep/   ... stamped JSON
  closed_loop/   ARCHIVE ONLY — never wired into report/generated/ (D-12)
report/generated/   detection_*.{pdf,tex}  projection_*.{pdf,tex}  scheduling_*.tex  robustness_heatmap.pdf
```

Candidate rosters (build-plan §6), all called directly (D-01 from Part 1):

| Track | Incumbent (py-progress / py-roadmap-engine) | Baselines (research-only) | Primary metric |
|---|---|---|---|
| Detection | `run_cusum` / `detect_regime_shifts` (CUSUM) | EWMA control-chart, CSD indicators, *(opt)* BOCPD | latency vs false-alarm, per shift-type |
| Projection | `gp_regression` / `fit_burn_up_gp` (GP-ARD) | linear extrapolation, Kalman forecast | 95% CI coverage + sharpness + finish-date error |
| Scheduling | `generate_roadmap` (greedy/constraint) | DP (Islam), rule-based | deadline drift · capacity-violation · prereq order · gen time |

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `research/comparison/src/research_comparison/runners/detection.py` | new | 3a | Change-detection runner over the pace-ratio series |
| `research/comparison/src/research_comparison/baselines/detection.py` | new | 3a | EWMA control-chart, CSD indicators |
| `research/comparison/src/research_comparison/metrics/detection.py` | new | 3a | Latency vs false-alarm per shift-type; ROC |
| `research/comparison/src/research_comparison/plots/detection_latency.py` | new | 3a | Per-shift-type latency/FA figure → PDF |
| `research/comparison/tests/test_detection_track.py` | new | 3a | Runner, baselines, per-type metric, ROC |
| `research/comparison/src/research_comparison/runners/projection.py` | new | 3b | Prequential burn-up forecast to finish date |
| `research/comparison/src/research_comparison/baselines/projection.py` | new | 3b | Linear extrapolation, Kalman forecast |
| `research/comparison/src/research_comparison/metrics/projection.py` | new | 3b | CI coverage, sharpness, finish-date error |
| `research/comparison/src/research_comparison/plots/projection_reliability.py` | new | 3b | Nominal vs empirical coverage plot → PDF |
| `research/comparison/tests/test_projection_track.py` | new | 3b | Runner, baselines, coverage metric |
| `research/comparison/src/research_comparison/runners/scheduling.py` | new | 3c | Feed (materials, capacity, deadline); no learner exec |
| `research/comparison/src/research_comparison/baselines/scheduling.py` | new | 3c | DP scheduler, rule-based scheduler |
| `research/comparison/src/research_comparison/metrics/scheduling.py` | new | 3c | Deadline drift, capacity-violation, prereq order, gen time |
| `research/comparison/tests/test_scheduling_track.py` | new | 3c | Candidates, metrics by material-mix |
| `research/comparison/src/research_comparison/oracles/{calibration,detection,projection}.py` | new | 3d | Oracle upper-bound baselines (pre-reg §9) |
| `research/comparison/src/research_comparison/runners/sweep.py` | new | 3d | Sensitivity-sweep runner over §8 grid |
| `research/comparison/src/research_comparison/plots/robustness_heatmap.py` | new | 3d | Ranking-stability heatmap → PDF |
| `research/comparison/tests/test_oracles_and_sweep.py` | new | 3d | Oracle separation, sweep grid coverage, ranking stability |
| `research/comparison/src/research_comparison/runners/closed_loop.py` | new | 7 | `--closed-loop` calibration→regen + CUSUM→replan trigger |
| `research/comparison/src/research_comparison/metrics/closed_loop.py` | new | 7 | Adherence + finish-date drift, closed vs open |
| `research/comparison/tests/test_closed_loop.py` | new | 7 | Flag runs; archive-only; not in report/generated |
| `Makefile` | modify | 3a–3d, 7 | Add `compare-detection/projection/scheduling`, `sweep`, `closed-loop` targets |

## Phases

### Phase 3a: Change-detection track

**Status:** ✅ Complete — de1d79db4a1316bb68e6d232ab52f81ae279839e
**Depends on:** Part 1 Phase 2 (the spine)
**Estimated scope:** ~4 files, ~400 lines

Covers tracker tasks **P3.1–P3.4**. Implements D-01, D-08.

#### Codebase state assumed at start

- Part 1 Phase 2 `✅ Complete`: `metrics/paired.py`, `metrics/aggregate.py`, `writers/results.py`, `writers/tables.py`, `plots/` exist and work; the generator writes a ground-truth sidecar with labelled `Shift`s (`{onset_index, type ∈ step|drift, pre_mean, post_mean}`).
- `py_progress` exposes `run_cusum(pace_ratios, reference_mean, std) -> CUSUMResult(breakpoints,...)` and `detect_regime_shifts(sessions, exceptional_ids: set, posterior_mean, resolutions) -> RegimeShiftResult(breakpoints, promptNeeded, ...)` (verified signatures).

#### Verification (run BEFORE starting)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison pytest research/comparison/tests/test_calibration_track.py -q   # Part 1 spine green
uv run --package research-comparison python -c "from py_progress import run_cusum, detect_regime_shifts; print('ok')"
uv run --package research-comparison python -c "from research_comparison.metrics import paired, aggregate; print('spine ok')"
```

#### Steps

1. **`runners/detection.py` (P3.1):** extract the active-subsequence pace-ratio series from a generated learner and stream it through each detection candidate, returning detected breakpoint indices. Incumbent path:

   ```python
   from py_progress import run_cusum
   def detect_cusum(pace_ratios, reference_mean, std):
       return run_cusum(pace_ratios, reference_mean, std).breakpoints
   ```

2. **`baselines/detection.py` (P3.2):** EWMA control-chart (flag when the EWMA statistic exceeds `±L·σ_ewma`) and CSD indicators (rising lag-1 autocorrelation / variance — Saqr-style critical-slowing-down). Each returns detected breakpoint indices for the same series. (Incumbent CUSUM lives in the runner via `py_progress`.)

3. **`metrics/detection.py` (P3.3):** match detected breakpoints to planted `Shift` onsets → **detection latency** (sessions from onset to first detection after it) at a fixed **false-alarm** budget; **split by shift-type** (step vs drift); sweep detection thresholds to produce a **ROC** (true-detection rate vs false-alarm rate). Reuse `metrics/paired.py` for per-seed Δ across candidates.

4. **`plots/detection_latency.py` + writer (P3.4):** booktabs detection table → `report/generated/detection_winners.tex`; per-shift-type latency-vs-false-alarm figure → `report/generated/detection_latency.pdf` (vector). Stamp provenance. Add `compare-detection` + extend `figs` in the Makefile.

#### Tests

- Add `research/comparison/tests/test_detection_track.py`:
  - On a learner with a planted step at known onset, CUSUM detects it; latency ≥ 0 and finite.
  - On a learner with a planted drift, CSD/EWMA produce a detection; metric records it under `type == "drift"`.
  - Latency/FA are reported **separately** for step vs drift (assert both keys present).
  - ROC points are monotone-ish and bounded in `[0,1]×[0,1]`.
- Run: `uv run --package research-comparison pytest research/comparison/tests/test_detection_track.py -q`

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison pytest research/comparison/tests/test_detection_track.py -q   # pass
make dataset compare-detection figs
test -s college/mydeliverables/1st-Review/report/generated/detection_latency.pdf && echo "fig ok"
test -s college/mydeliverables/1st-Review/report/generated/detection_winners.tex && echo "table ok"
grep -l _provenance research/results/detection/*.json | head -1
```

#### Rollback

`git rm` the Phase-3a files + `report/generated/detection_*`; revert the Makefile diff.

#### Notes (filled in during implementation)

Implemented with scoped staging because the worktree already contained unrelated project-instruction and generated-file changes. Verification passed with `uv run --package research-comparison pytest research/comparison/tests/test_detection_track.py -q` and the plan's `make dataset compare-detection figs` gate; detection report artifacts were committed, while ignored runtime JSON remains under `research/results/detection/`.

---

### Phase 3b: Target-date projection track

**Status:** ✅ Complete — ca55cc4e3b9896b2464071ffeaf8da2e586b5c34
**Depends on:** Part 1 Phase 2 (the spine)
**Estimated scope:** ~4 files, ~400 lines

Covers tracker tasks **P3.5–P3.8**. Implements D-01.

#### Codebase state assumed at start

- Part 1 Phase 2 spine present (as Phase 3a).
- Generator sidecar carries the **true finish date** (date the noise-free cumulative reaches total material minutes — build-plan §7).
- `py_progress` exposes `gp_regression(train_x, train_y, test_x) -> {"mean":[...], "variance":[...]}`, `fit_burn_up_gp(actual_points, start_date, end_date, today) -> list[GPPoint(date, mean, lower, upper)]`, and `run_kalman_on_phase(...)` (verified).

#### Verification (run BEFORE starting)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -c "from py_progress import gp_regression, fit_burn_up_gp, run_kalman_on_phase; print('ok')"
uv run --package research-comparison pytest research/comparison/tests/test_calibration_track.py -q   # spine green
```

#### Steps

1. **`runners/projection.py` (P3.5):** prequential burn-up forecast — at each `t`, build cumulative-minutes points from `sessions[:t]` and forecast the finish date with each candidate. Incumbent path uses `fit_burn_up_gp(...)`; read the returned `GPPoint.{mean,lower,upper}` to find where the mean curve crosses total minutes and the CI band around it.

2. **`baselines/projection.py` (P3.6):** linear extrapolation (least-squares slope on cumulative minutes → crossing date, with a residual-based CI) and Kalman forecast (via `run_kalman_on_phase` or a local constant-velocity Kalman) → forecast date + interval.

3. **`metrics/projection.py` (P3.7):** **95% CI coverage** (does the predicted finish-date interval contain the true finish date, averaged over seeds), **interval sharpness** (mean interval width), **finish-date point error** (|predicted − true| days). Reuse `paired.py`/`aggregate.py`.

4. **`plots/projection_reliability.py` + writer (P3.8):** CI-reliability plot (nominal vs empirical coverage) → `report/generated/projection_reliability.pdf`; error/sharpness booktabs table → `report/generated/projection_winners.tex`. Add `compare-projection`; extend `figs`.

#### Tests

- Add `research/comparison/tests/test_projection_track.py`:
  - On a low-noise learner, the GP forecast's finish-date error is small and the 95% interval contains truth.
  - Linear baseline produces an over/under-confident interval (coverage materially ≠ 0.95) — sanity that the metric discriminates.
  - Sharpness is reported and positive; coverage ∈ [0,1].
- Run: `uv run --package research-comparison pytest research/comparison/tests/test_projection_track.py -q`

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison pytest research/comparison/tests/test_projection_track.py -q   # pass
make dataset compare-projection figs
test -s college/mydeliverables/1st-Review/report/generated/projection_reliability.pdf && echo "fig ok"
test -s college/mydeliverables/1st-Review/report/generated/projection_winners.tex && echo "table ok"
```

#### Rollback

`git rm` Phase-3b files + `report/generated/projection_*`; revert Makefile diff.

#### Notes (filled in during implementation)

Implemented as direct forecast adapters over `fit_burn_up_gp`, linear extrapolation, and `run_kalman_on_phase`, with finish-date point/interval metrics aggregated per learner. Verification passed with `uv run --package research-comparison pytest research/comparison/tests/test_projection_track.py -q` and the plan's `make dataset compare-projection figs` gate; projection report artifacts were committed, while ignored runtime JSON remains under `research/results/projection/`.

---

### Phase 3c: Roadmap-scheduling track (open-loop)

**Status:** ✅ Complete — 27e348351d7f25e65a25433d934c4adf544c7cc6
**Depends on:** Part 1 Phase 2 (the spine)
**Estimated scope:** ~4 files, ~450 lines

Covers tracker tasks **P3.9–P3.11**. Implements D-01, D-09.

#### Codebase state assumed at start

- Part 1 Phase 2 spine present.
- `py_roadmap_engine` exposes `generate_roadmap(input_data: RoadmapInput | dict, config=None) -> RoadmapOutput(weeks, warnings, capacityCheck)`; types `Material(id, title, totalMinutes, role, additionOrder)`, `RoadmapInput(materials, weeks, startDate, selectedStudyDays, weekdayHours, weekendHours)`, `Slot(weekIndex, dayOfWeek, date, capacityMinutes, role, candidateMaterialIds, plannedMinutes, sessionTitle)` (verified).
- The generator's scenario layer (Part 1) can emit `(materials, capacity, deadline)` tuples per learner.

#### Verification (run BEFORE starting)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -c "from py_roadmap_engine import generate_roadmap, Material, RoadmapInput; print('ok')"
```

#### Steps

1. **`runners/scheduling.py` (P3.9):** for each learner scenario, build a `RoadmapInput` and run each scheduling candidate to produce a plan — **no learner execution** (D-09). Incumbent path:

   ```python
   from py_roadmap_engine import generate_roadmap, RoadmapInput, Material
   def schedule_greedy(materials, capacity, deadline_weeks, start_date, study_days, wd_hours, we_hours):
       return generate_roadmap(RoadmapInput(
           materials=materials, weeks=deadline_weeks, startDate=start_date,
           selectedStudyDays=study_days, weekdayHours=wd_hours, weekendHours=we_hours))
   ```

2. **`baselines/scheduling.py` (P3.10):** a DP scheduler (Islam-style: minimise deadline drift subject to capacity, prereq order) and a rule-based scheduler (fixed heuristic ordering anchor→foundation→practice). Each returns a plan in a shape comparable to `RoadmapOutput` (or an adapter exposing slots + capacity per week).

3. **`metrics/scheduling.py` (P3.11):** **deadline drift** (planned finish vs deadline), **capacity-violation rate** (slots over `capacityMinutes`), **prereq-order correctness** (anchor before practice etc.), **gen time** (wall-clock). Report **by material-mix** — here material-mix becomes a reporting column (build-plan §4). Reuse `paired.py`/`aggregate.py`.

4. **Writer:** scheduling metrics booktabs table (candidate × material-mix) → `report/generated/scheduling_metrics.tex`. Add `compare-scheduling`.

#### Tests

- Add `research/comparison/tests/test_scheduling_track.py`:
  - `generate_roadmap` runs on a 2-material scenario and returns weeks/warnings/capacityCheck.
  - capacity-violation metric is 0 when capacity ≥ total material minutes; > 0 when deliberately under-capacity.
  - prereq-order metric flags a plan that places practice before its anchor.
  - gen time recorded and positive; results reported per material-mix.
- Run: `uv run --package research-comparison pytest research/comparison/tests/test_scheduling_track.py -q`

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison pytest research/comparison/tests/test_scheduling_track.py -q   # pass
make compare-scheduling figs
test -s college/mydeliverables/1st-Review/report/generated/scheduling_metrics.tex && echo "table ok"
```

#### Rollback

`git rm` Phase-3c files + `report/generated/scheduling_metrics.tex`; revert Makefile diff.

#### Notes (filled in during implementation)

Implemented the open-loop scheduler comparison with the incumbent `generate_roadmap`, a capacity-respecting DP-style baseline, and a fixed rule-based baseline. Current Part 1 datasets do not persist explicit `(materials, capacity, deadline)` scenario tuples, so Phase 3c derives neutral scheduler inputs from each learner's session roles, planned minutes, observed study days, and `true_finish_date`; schedulers still receive only input tuples and no learner execution. Verification passed with `uv run --package research-comparison pytest research/comparison/tests/test_scheduling_track.py -q` and the plan's `make compare-scheduling figs` gate.

---

### Phase 3d: Oracle baselines + sensitivity sweep + robustness heatmap

**Status:** ✅ Complete — bd6d8813f041823ce43960f89a89d327e9b3d5d4
**Depends on:** Phase 3a, Phase 3b, Phase 3c
**Estimated scope:** ~5 files, ~450 lines

Covers tracker tasks **P3.12–P3.13**. Implements D-10, D-11.

#### Codebase state assumed at start

- Phases 3a–3c `✅ Complete`: detection, projection, scheduling runners + metrics exist and emit stamped results.
- `params.py` exposes `SWEEP_GRID` (pre-reg §8).

#### Verification (run BEFORE starting)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison pytest research/comparison/tests/test_detection_track.py research/comparison/tests/test_projection_track.py research/comparison/tests/test_scheduling_track.py -q   # all green
uv run --package research-comparison python -c "from research_comparison.params import SWEEP_GRID; print(sorted(SWEEP_GRID))"
```

#### Steps

1. **`oracles/{calibration,detection,projection}.py` (P3.12):** oracle upper-bound baselines (pre-reg §9). Calibration oracle returns the true per-bucket `r*` mean from the sidecar; detection oracle returns the planted onsets (latency 0, FA 0); projection oracle forecasts from noise-free `r*`. These are read-only candidates registered alongside the real ones.

2. **`runners/sweep.py` (P3.13):** iterate the §8 grid (`σ_log ∈ {0.12,0.18,0.25}`, step magnitude `{0.10,0.15,0.22}`, drift total `{0.12,0.20,0.30}`, manual fraction `{0.05,0.15,0.25}`, AR(1) `φ ∈ {0,0.30,0.50}`), regenerate datasets per grid point, rerun each track, and record the **winner ranking** per cell. Implements D-11 — never tune toward a winner; report stability.

3. **`plots/robustness_heatmap.py`:** ranking-stability heatmap (track × swept-parameter → "ranking held / flipped, where") → `report/generated/robustness_heatmap.pdf`.

4. **Makefile:** add `sweep` target; extend `figs`.

#### Tests

- Add `research/comparison/tests/test_oracles_and_sweep.py`:
  - Each oracle **separates** from the candidate field on its track (oracle error ≤ best candidate error) — the discriminability check (D-10). If it does not, the test fails loudly (signals SNR mis-set per pre-reg §9).
  - Sweep runner visits every grid point (count = product of grid sizes) and records a ranking per point.
  - On a tiny 2-point sweep fixture, a stable ranking is reported as "held".
- Run: `uv run --package research-comparison pytest research/comparison/tests/test_oracles_and_sweep.py -q`

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison pytest research/comparison/tests/test_oracles_and_sweep.py -q   # pass
make sweep figs
test -s college/mydeliverables/1st-Review/report/generated/robustness_heatmap.pdf && echo "heatmap ok"
ls research/results/sweep/*.json | head -1
```

> At this point **Phase 3's DoD holds**: all four Pillar-A tracks emit stamped results, tables, and figures; sweep + oracle baselines run. This is Milestone 2 and the R2-presentable set (review mapping: Phases 0–3 → R2).

#### Rollback

`git rm` Phase-3d files + `report/generated/robustness_heatmap.pdf`; revert Makefile diff.

#### Notes (filled in during implementation)

Registered oracle upper-bound candidates in the calibration, detection, and projection outputs, added the full §8 grid enumerator, and emitted a robustness heatmap from stamped sweep results. The sweep now regenerates per-grid-cell step/drift learner fixtures using generator override hooks, reruns detection/projection/scheduling in memory, and records held/flipped rankings from those cell results. Also removed `gen_time_ms` from scheduling winner scoring because it made tied scheduling rows nondeterministic; generation time remains recorded as a metric. Verification passed with `uv run --package research-comparison pytest research/comparison/tests/test_oracles_and_sweep.py -q`, the plan's `make sweep figs` gate, and a post-change focused suite covering detection/projection/scheduling/oracles.

---

### Phase 7: Closed-loop machinery (built, **revealed in Phase II**)

**Status:** ✅ Complete — 66f3e9ad4f46d3ae8da124ea3d7606ea6a6013ce
**Depends on:** Phase 3a, Phase 3c *(needs calibration spine from Part 1 + scheduling from 3c)*
**Estimated scope:** ~3 files, ~300 lines

Covers tracker tasks **P7.1–P7.3**. Implements D-12. **The artifacts of this phase MUST NOT enter `report/generated/` or any Phase-I review** — they go to `research/results/closed_loop/` (archive).

#### Codebase state assumed at start

- Part 1 calibration spine + Phase 3c scheduling runner present.
- `py_progress.compute_calibration` (multipliers) and `py_roadmap_engine.regenerate_roadmap` are importable.

#### Verification (run BEFORE starting)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -c "from py_progress import compute_calibration; from py_roadmap_engine import regenerate_roadmap; print('ok')"
uv run --package research-comparison pytest research/comparison/tests/test_scheduling_track.py -q   # 3c green
```

#### Steps

1. **`runners/closed_loop.py` (P7.1, P7.2):** a `--closed-loop` flag that, within the sim, feeds calibration multipliers back into roadmap regeneration as the learner's pace is re-estimated, and wires the CUSUM regime-shift breakpoint to a **replan trigger** (regenerate when a shift is detected). Open-loop path leaves the original plan fixed.

2. **`metrics/closed_loop.py` (P7.3):** closed-vs-open comparison on **adherence** and **finish-date drift**. Write results to `research/results/closed_loop/*.json` (stamped) — **archive only**.

3. **Makefile:** add a `closed-loop` target that writes to the archive dir. Do **not** add anything to `figs` (which feeds `report/generated/`).

#### Tests

- Add `research/comparison/tests/test_closed_loop.py`:
  - `--closed-loop` run completes and regenerates the plan at least once when a shift is detected.
  - open-loop run leaves the plan unchanged.
  - closed-vs-open metric produces adherence + finish-date-drift numbers for both modes.
  - **Guard test:** assert no file under `college/mydeliverables/1st-Review/report/generated/` matches `*closed*` / `*loop*` (D-12 — the novelty must not leak into Phase-I outputs).
- Run: `uv run --package research-comparison pytest research/comparison/tests/test_closed_loop.py -q`

#### Verification (DONE)

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison pytest research/comparison/tests/test_closed_loop.py -q   # pass
make closed-loop
ls research/results/closed_loop/*.json | head -1                                              # archived, stamped
! ls college/mydeliverables/1st-Review/report/generated/*closed* 2>/dev/null && echo "novelty not leaked (good)"
```

#### Rollback

`git rm` Phase-7 files; remove the `closed-loop` Makefile target. `research/results/closed_loop/` is gitignored.

#### Notes (filled in during implementation)

Implemented as an archive-only runner: open-loop keeps the initial roadmap fixed, while closed-loop detects CUSUM breakpoints, computes calibration, scales remaining roadmap input, and calls `regenerate_roadmap`. The `closed-loop` Makefile target writes only to `research/results/closed_loop/` and is intentionally excluded from `figs`. Verification passed with `uv run --package research-comparison pytest research/comparison/tests/test_closed_loop.py -q`, `make closed-loop`, archived JSON existence, and the no-leak guard for `report/generated`.

---

## Open questions

### OQ-03: Optional Bayesian online changepoint (BOCPD) detection candidate

**Why deferred:** Build-plan §6 lists BOCPD as optional for the detection roster. The three core candidates (CUSUM, EWMA control-chart, CSD) are mandatory; BOCPD can be added if time permits without changing the harness.
**Triggers needing resolution:** If a reviewer wants a Bayesian detection comparator, or if CSD underperforms and a stronger drift detector is wanted.
**Owner / resolution path:** Candidate; add as a fourth `baselines/detection.py` candidate — no spine change.

### OQ-04: DP scheduler fidelity to Islam (2024)

**Why deferred:** The DP scheduling baseline should follow Islam's formulation; the exact cost function / constraints may need tuning to be a fair comparator to the greedy incumbent.
**Triggers needing resolution:** Before the scheduling table is presented at R3.
**Owner / resolution path:** Candidate, cross-checking against the Islam paper in the literature survey.

## Out of scope (this plan)

- **Calibration track** — Part 1 / Phase 2 (already shipped); this plan reuses its spine.
- **Report `\input{}` wiring + provenance footnotes in `main.tex`** — Phase 6, [Part 4](2026-06-13-research-tier-4-validation-outputs.md). This plan only **emits** `.pdf`/`.tex` into `report/generated/`.
- **KT bench** — Phase 4, [Part 3](2026-06-13-research-tier-3-kt-bench.md).
- **N=1 validation** — Phase 5, [Part 4](2026-06-13-research-tier-4-validation-outputs.md).
- **Presenting the closed loop in Phase I** — explicitly prohibited (D-12); built and archived only.
- **Any change to `py-progress` / `py-roadmap-engine`** — imported, never modified (D-01).

## References

- [`college/scope/research-build-plan.md`](../../../college/scope/research-build-plan.md) — §5 metrics, §6 rosters, §7 generator, §8 layout.
- [`college/scope/archetype-preregistration.md`](../../../college/scope/archetype-preregistration.md) — §5 shifts, §8 sweep grid, §9 oracles.
- [`college/scope/research-decisions-and-findings.md`](../../../college/scope/research-decisions-and-findings.md) — decisions #3, #6, #11, #12, #14, #19.
- [`2026-06-13-research-tier-1-foundation.md`](2026-06-13-research-tier-1-foundation.md) — the spine modules reused here.
- [`packages/py-progress/src/py_progress/cusum.py`](../../../packages/py-progress/src/py_progress/cusum.py) · [`gp.py`](../../../packages/py-progress/src/py_progress/gp.py) · [`kalman.py`](../../../packages/py-progress/src/py_progress/kalman.py) — detection/projection incumbents.
- [`packages/py-roadmap-engine/src/py_roadmap_engine/__init__.py`](../../../packages/py-roadmap-engine/src/py_roadmap_engine/__init__.py) — scheduling incumbent + types.
