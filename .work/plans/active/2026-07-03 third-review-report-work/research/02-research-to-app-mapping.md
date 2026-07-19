---
title: Research-to-App Mapping — what research/ actually shipped into the product
status: durable reference (third-review-report-work research stage 2) — CORRECTED 2026-07-03
last_updated: 2026-07-03
scope: >
  Cross-references the research/ inventory (Pillar-A comparison harness + Pillar-B
  KT-bench) against the live app architecture traced in Doc 1, to state precisely which
  research findings/algorithms are running in production, which exist only as research
  artifacts, and where the two differ even when nominally "the same" algorithm.
sources: Stage-1 app-architecture traces (this task's research/01-*.md) + Stage-2
  research/ inventory (one research-agent trace) + direct verification greps by the
  orchestrating session comparing production config values against research-tuned values +
  a 2026-07-03 correction pass after cross-referencing
  `.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md` and
  `.work/plans/active/2026-06-30-research-eta-model-selection/{PLAN,VERIFICATION}.md`,
  which the original pass missed.
---

# Research → App Mapping

## Correction notice (2026-07-03)

The original version of this document (same day, earlier pass) got two things wrong,
caught by the user pointing at two plan folders this investigation hadn't read:
`.work/plans/active/2026-06-30-material-session-decoupling/` and
`.work/plans/active/2026-06-30-research-eta-model-selection/`. Both errors came from the
same root cause: judging "was this research finding promoted?" using only
`research/comparison`'s original (frozen-regime) result files and file *content*, without
checking `git log` dates or the newer decoupled-regime re-validation that superseded them.

1. **Scheduling was not neglected — it was explicitly retired.** The original doc treated
   `dp_capacity` beating the shipped scheduler as an open, unaddressed research→app gap.
   In fact, `DECISIONS.md` D1 + §5c (2026-06-30) **retire the entire scheduling-comparison
   question by design**: the redesign drops "prescriptive day-by-day packing" (the exact
   problem `dp_capacity`/`greedy_incumbent`/etc. compete at) in favor of blank bookings with
   late material binding. There is no packing problem left for a better packing algorithm to
   solve. §5c states outright: *"Dropped: the scheduling track (constrained packer retired;
   soft-suggest ordering is a lighter, separate KT concern)."*
2. **The GP/ETA fix was partially promoted, same-day-adjacent, and the original doc missed
   it.** `packages/progress/src/projectFinish.ts` (commit `1d9270e`, **2026-07-01**, "ship
   booking ETA phases") implements a cold-start-analytic/GP-otherwise composite that matches
   — constant name, value, and branching logic — the `gp_plus_analytic` composite the
   `research-eta-model-selection` plan's **R4 phase validated one day earlier** (2026-06-30).
   This is a clean promotion, not a gap. What remains genuinely unpromoted is narrower: the
   **split-conformal interval-width correction**, a *different* fix from the composite,
   which every research snapshot through 2026-06-30 (frozen and decoupled alike) still
   names as the outstanding "coverage fix" for data-rich plans.

Both corrections are reflected in the tables below. See `01-app-architecture-and-data-flow.md`
§3.5 and §5 (finding #8) for the companion correction in that document, and
`.work/specs/issues/022-promote-validated-research-findings-to-production.md` for the
corrected issue this feeds.

## 0. One-paragraph answer

`research/comparison` (the Pillar-A offline evaluation harness) and the production Python
package `packages/py-progress` — plus, for the ETA composite specifically,
`packages/progress` (TS) — have a **one-way, partial-promotion relationship**:
`research/comparison` *imports* production's incumbent algorithms to benchmark them as
baselines, and *separately* prototypes new candidates in its own `baselines/` module. When
a candidate wins the rigour pipeline (bootstrap CIs + Holm/BH correction on a held-out
archetype split), someone **manually ports** that algorithm into production code — there is
no dependency or import from production back into `research/comparison`, and no automated
promotion step. **Two** such promotions have happened: `enriched_shrink`/`enriched_dual_prior`
calibration (Python, `packages/py-progress`), and the `gp_plus_analytic` cold-start ETA
composite (TS, `packages/progress`, promoted one day after validation). **One** research
question was explicitly retired by product decision rather than left as a gap: the
scheduling-algorithm comparison (and, as a consequence, the closed-loop-replanning
comparison, which depended on the same retired packed-slot mechanism). **One** finding
remains a genuine, still-open, currently-unaddressed gap: split-conformal interval
correction for the GP burn-up projection. `research/kt-bench` (Pillar B) has **no** promotion
path into the app at all; it is a standalone academic benchmark with zero integration points
into `apps/app/src`.

## 1. Pillar A: research/comparison ↔ production, capability by capability

| Research track (`research/comparison`) | Winning/notable finding (`research/results/`, `research/doc/`) | Shipped in production? | Evidence |
|---|---|---|---|
| **Calibration** (`runners/calibration.py`, 11 candidates) | `enriched_shrink`/`enriched_dual_prior` Holm-survive vs. `hierarchical_bayes`/`pooled_bayes` on held-out `context_pred_mae`, including in the 2026-06-30 decoupled re-run (12/12 cells, up from 11/12 frozen) (`research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`) | **Yes — clean promotion.** `packages/py-progress/src/py_progress/enriched.py`'s `EnrichedShrinkageCalibrator` has byte-identical hyperparameters (`ridge=2.0, shrink=6.0`) to the research candidate of the same name in `research/comparison/src/research_comparison/baselines/calibration.py`. `production_calibrator()` wraps it in a `DualPriorWeightedCalibrator` ensemble, provenanced to specific verification-run evidence files. Overrides the plain-Bayesian `globalMultiplier` on every live `/v1/calibration` call (Doc 1 §3.6). | Direct code diff — identical class name + hyperparameters; provenance comments in `enriched.py` cite research verification-run files |
| **Change detection** (`runners/detection.py`, 7 detectors) | Dual-arm, MAD-robust `detect_cusum_robust` (grid-tuned per regime) wins the shift-type-specific comparison in both frozen and decoupled re-runs; the decoupled re-run (2026-06-30) is **more CUSUM-favoring** than the original A4 result (drift→cusum & step→cusum, vs. A4's drift→cusum & step→page_hinkley) | **Partially — the algorithm family shipped, the tuned version didn't.** `packages/py-progress/src/py_progress/cusum.py::run_cusum` is a simpler **single-arm**, mean/std-based CUSUM using generic factors (`CUSUM_SLACK_FACTOR=0.5, CUSUM_THRESHOLD_FACTOR=4.5`) — not the dual-arm, robust-z-score, grid-tuned design that actually won the benchmark. It IS wired into the live UI: its `breakpoints` feed `detect_regime_shifts` → `promptNeeded` in every `/v1/calibration` response, which `Home.tsx` renders as `RecalibrationBanner`/`RecalibrationModal`, logged as `RecalibrationPromptResolved` on user choice — the human-in-the-loop analog of a change-triggered replan. The *concept* is live; the *specific tuned detector* isn't. | Comparison of `cusum.py` constants vs. `research/results/detection/detection_results.json`'s `cusum_tuning.selected` block; Doc 1 §1's `Home.tsx` trace |
| **GP projection — cold-start/non-crossing composite** (`runners/projection.py`, `gp_plus_analytic` candidate, added for the redesign's R4 phase) | R4 (2026-06-30, `research-eta-model-selection` plan) validated `gp_plus_analytic`: cold-start (`sessionCount < COLD_START_N=5`) → analytic fallback; GP-non-crossing/past-horizon → analytic rescue; else GP. **Beats `gp_ard` under held-out+Holm on the small/cold-start band only** (4/4 cells); loses on max; not significant on medium. Explicitly framed as "qualified... a cold-start / small-plan fallback layered on GP, NOT a replacement for GP on data-rich plans." | **Yes — clean, fast promotion.** `packages/progress/src/projectFinish.ts` (commit `1d9270e`, 2026-07-01, one day after R4) implements the identical design: same `COLD_START_N=5` constant, same cold-start→analytic / non-crossing→analytic-rescue / else-GP branching. Live in the app via `useProgress.ts` → `computeProgress` → `projectFinish`. **Not mirrored in Python** — `py_progress/progress.py::_find_projected_finish` (unchanged since 2026-06-08) has no composite/cold-start logic; low-impact only because `/v1/progress` is a dead endpoint (Doc 1 §3.1/§5). | `projectFinish.ts` code + git log; `research-eta-model-selection/VERIFICATION.md` R4 section; `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`'s "Material/session decoupling validation" section |
| **GP projection — split-conformal interval correction** (`runners/projection.py`, `forecast_conformal_finish` candidate) | Plain `gp_ard` (== production's `fitBurnUpGP`) under-covers badly (~0.19–0.49 actual vs. 0.95 nominal by band, frozen and decoupled alike); `forecast_conformal_finish` fixes this to ~0.91–0.99 coverage by band. Reaffirmed as the "coverage fix" / "data-rich-plan story" in the 2026-06-30 decoupled re-validation, distinct from and not superseded by the cold-start composite above. | **No — this specific fix was not promoted.** `grep -rn "conformal" packages/progress/ packages/py-progress/ apps/app/src/` returns nothing. Production's GP-basis interval (for any plan past the `COLD_START_N=5` threshold) is the same uncorrected interval the research measured as poorly calibrated. This is the one genuine, still-open projection gap — narrower than originally scoped, but real and current as of the latest research pass. | Repo-wide `grep -rn "conformal"` (empty); `research/results/projection*/projection_results.json`'s `conformal_calibration` blocks (both frozen and decoupled) |
| **Scheduling** (`runners/scheduling.py`, 5-6 algorithms) — **retired research question, not a gap** | `dp_capacity` won across all material mixes in the original (pre-redesign) comparison; `local_search_repair`/`topological_prereq`/`rule_based` also beat `greedy_incumbent`. **This comparison was never re-run for the decoupled/booking regime and, per explicit product decision, never will be.** `.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md` D1: "Drop the prescriptive day-by-day `Slot` assignment... The engine's job shrinks to capacity model + finish-date projection, not per-day packing." §5c: **"Dropped: the scheduling track (constrained packer retired; soft-suggest ordering is a lighter, separate KT concern)."** | **N/A — not a promotion gap.** The problem the benchmarked algorithms solved (optimally assigning specific materials to specific pre-committed calendar days under capacity/deadline constraints) no longer exists in the product: bookings are now blank (date + duration only), with material chosen at session start. `packages/roadmap-engine/src/roadmap-engine.ts`'s phase-priority role-tagging (anchor/foundation/practice per week-phase) is a deliberately lighter mechanism for a smaller, different problem (session-phase guidance, not deadline-constrained packing) — comparing it against `dp_capacity` is comparing answers to two different questions. | `DECISIONS.md` D1 + §5c (explicit, dated, reviewed decision); `research-eta-model-selection/PLAN.md` §1.1's "Transfer vs must-re-run" table, which lists scheduling as **"DROPPED (constrained packer retired; §5c) — do not run/extend"** |
| **Robustness sweep** (`runners/sweep.py`) | Detection rankings flip on 51.7% of the 5-D adversarial grid (least robust), scheduling only 5.2% (most robust) — pre-redesign result, not re-run for the decoupled regime (not listed in the redesign's transfer/re-run/drop table) | **N/A — a meta-finding about the other tracks' stability, not itself a candidate for promotion.** Reinforces why the tuned CUSUM variant was promoted only as a concept (prompt trigger), not as the exact tuned parameters. | `research/results/sweep/sweep_results.json` |
| **Closed-loop replanning** (`runners/closed_loop.py`) | Archive-only comparison of open-loop vs. CUSUM-triggered automatic replanning — **this track is currently broken, not just unshipped.** Per `research-eta-model-selection/VERIFICATION.md` P0: its own test suite (`test_closed_loop.py`) fails because `run_closed_loop_for_scenario` calls `regenerate_roadmap(RoadmapInput(materials=[]))` against `py_roadmap_engine`, which raises `ValueError`. The reviewer's explicit ruling: *"part of the retired scheduling/closed-loop area — OUT of scope (§5c drops scheduling)."* So this track shares scheduling's fate — retired alongside it, not an independent, still-live comparison sitting unpromoted. | **Not shipped as automation — a human-in-the-loop version exists instead, which is unaffected by the retirement.** The app never auto-replans; it surfaces `promptNeeded` as a banner and lets the user open `/replan` or dismiss (Doc 1 §1, `Home.tsx`). This is a deliberate, sound product design (user retains control), coincidentally also the right call given the underlying research track is currently non-functional post-redesign. | `research-eta-model-selection/VERIFICATION.md` P0 section (test failure + reviewer ruling); Doc 1 §1 (`Home.tsx` → `Replan.tsx` flow) |
| **Synthetic data generator** (`generator/`, incl. the OULAD-calibrated "reality" regime and the newer "decoupled" regime added for this redesign) | Produces `learners.jsonl`/`sidecars.jsonl` ground-truth datasets purely for offline algorithm evaluation. The `decoupled` regime (added 2026-06-30, dataset `synthetic-decoupled-9e6d48db2da8-seed0-n5400`) specifically models the new booking/partial-session/ad-hoc-day data-generating process to keep the harness comparable to the redesigned product. | **No connection to the production data pipeline at all**, by design — it's an offline evaluation tool, not a data source the app reads from or writes to. No shared code, schema, or import relationship with the app's `EventStore`/`SessionEvent` types beyond structural similarity (independently defined `SessionEvent` TypedDict). | Directory/import inspection; `research-eta-model-selection/PLAN.md` R1 / `VERIFICATION.md` R1 for the decoupled regime specifically |

## 2. Pillar B: research/kt-bench ↔ production — zero integration

`research/kt-bench` benchmarks 5 knowledge-tracing model architectures (pyBKT, DKT, AKT,
deep_irt, SAKT) on 2 real-world datasets (NIPS2020, ACcoding), gated through an 8-criterion
credibility framework (`research/doc/2026-06-14-kt-credibility-and-validation-guidelines.md`)
down to 9 reportable model×dataset cells. This is a self-contained academic benchmark,
untouched by the material/session decoupling redesign (which is Pillar-A-only in scope):

- **No shared code path** with `apps/app/src` — confirmed by Stage 1's exhaustive trace of
  every page and engine: no page, hook, event kind, or API endpoint in the shipped app
  references quizzes, assessments, questions, knowledge components, or knowledge tracing in
  any form.
- **No shared code path with `research/comparison` either** — deliberately quarantined
  (own `.venv`, own dependency versions incl. `torch`/`pykt-toolkit`), the KT-bench
  README explicitly forbids `research/comparison` from importing it. The only bridge is a
  one-way JSON artifact hand-off (`research/results/kt/*.json` → `research_comparison.kt.join`
  for LaTeX table/figure generation into the dissertation).
- **The base paper itself (`clst2024`, LLM-as-knowledge-tracer) was never implemented.**
  `research/doc/2026-06-14-clst-llm-tracer-requirements.md` is requirements-only; the
  `dkt_clst_config` registry entry is an honest relabel (`distinct_method:false,
  alias_of:"dkt"`) of what an earlier run had silently mislabeled as CLST.
- The app's study-planning feature set (calibration, roadmap, session logging) has **no
  assessment or question-answering surface whatsoever** — there is nothing in the product
  for a knowledge-tracing model to be *of*. Pillar B is dissertation-scope research that
  exists in parallel with the shipped app, not upstream of it.

**Conclusion**: if the dissertation's system-architecture chapter describes "the system" as
the deployed web app, Pillar B contributes zero components to it. If the chapter describes
"the research contribution" more broadly (both pillars, per the PRD's stated Pillar-A/Pillar-B
framing), Pillar B stands as an independent knowledge-tracing benchmark whose findings feed
the dissertation directly rather than through the product.

## 3. What this means for the "system architecture" narrative

A reviewer reading only the app's marketing description ("Bayesian-calibrated, adaptively
scheduled study planner") would reasonably assume every headline algorithm is the
literature-validated, benchmark-winning one. The honest picture, corrected as of 2026-07-03,
is more differentiated than a simple "promoted vs. not" split — some questions were answered
and shipped, one was closed by explicit design decision rather than left open, and one
narrow-but-real gap remains:

| Sub-system | Research verdict on the algorithm family | What's actually live | Honest framing |
|---|---|---|---|
| Calibration | `enriched_shrink`/dual-prior wins, reconfirmed post-redesign | `enriched_shrink`/dual-prior | **Research finding fully realized in production.** |
| Change detection | Tuned dual-arm CUSUM wins; family becomes more dominant post-redesign | Simpler single-arm CUSUM (untuned), still drives a live recalibration-prompt UI | **Family validated and the concept (prompt-on-shift) is live; the specific tuned parameters are not.** |
| GP projection — cold-start composite | `gp_plus_analytic` beats plain GP on small/cold-start plans only (qualified win) | `gp_plus_analytic`-equivalent (`projectFinish.ts`'s `COLD_START_N` design), promoted 1 day after validation | **Research finding realized in production, promptly.** |
| GP projection — interval calibration | Split-conformal needed for proper coverage on data-rich plans | Plain, uncorrected GP interval | **Known miscalibration, documented by the research itself, still not fixed in production.** |
| Scheduling | DP/local-search/topological beat the old heuristic *for a problem the product no longer has* | Lightweight phase-priority role-tagging for a smaller, different problem | **Not a gap — the underlying research question was retired by an explicit, documented product decision (D1/§5c), not left unaddressed.** |
| Closed-loop replanning | Automatic CUSUM-triggered replanning evaluated (pre-redesign); the track is currently broken post-redesign | Human-in-the-loop prompt only | **Sound, deliberate product design — and happens to be moot to compare against, since the automated-track code is currently non-functional after the redesign.** |
| Knowledge tracing (Pillar B) | 9 credible cells; AKT best on both datasets | Not integrated; no assessment surface in the app | **Independent research contribution, parallel to the product, not part of it.** |

**Net assessment for the dissertation's limitations chapter**: the single largest remaining
research→app gap is the **conformal interval correction** — narrow, well-evidenced, and
still open as of the most current (2026-06-30) research pass. It is not accompanied by a
scheduling gap (that question was closed by design) or a general projection gap (the
cold-start half of that story already shipped).

## 4. Where to point a reviewer who asks "prove it"

- Calibration promotion: diff `packages/py-progress/src/py_progress/enriched.py` against
  `research/comparison/src/research_comparison/baselines/calibration.py`'s
  `EnrichedShrinkageCalibrator`/`DualPriorWeightedCalibrator` classes — identical
  hyperparameters, and `enriched.py`'s own comments cite the specific verification-run
  evidence files.
- ETA cold-start composite promotion: diff `packages/progress/src/projectFinish.ts`
  (`git show 1d9270e`) against `research/comparison/src/research_comparison/baselines/projection.py`'s
  `forecast_gp_plus_analytic_finish` — same `COLD_START_N=5`, same branching; check
  `git log` dates (2026-07-01 vs. the 2026-06-30 R4 validation) to see the one-day gap.
- Conformal gap: `grep -rn "conformal" packages/ apps/` returns nothing; compare against
  `research/results/projection_decoupled/projection_results.json`'s `conformal_calibration`
  section (or the frozen `research/results/projection/projection_results.json`, same story).
- Scheduling retirement (not a gap): read
  `.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md` D1 and §5c, and
  `.work/plans/active/2026-06-30-research-eta-model-selection/PLAN.md` §1.1's "Transfer vs
  must-re-run" table, which states scheduling is "DROPPED... do not run/extend" in the
  planner's own words — not inferred, stated.
- Closed-loop track status: `.work/plans/active/2026-06-30-research-eta-model-selection/VERIFICATION.md`,
  the P0 section's `test_closed_loop.py` failure + reviewer ruling.
- Detection tuning gap: compare `packages/py-progress/src/py_progress/cusum.py`'s
  `CUSUM_SLACK_FACTOR`/`CUSUM_THRESHOLD_FACTOR` against
  `research/results/detection/detection_results.json`'s `cusum_tuning.selected` block —
  different parameterization, different algorithm shape (single-arm vs. dual-arm).
- Pillar B isolation: `research/kt-bench/README.md`'s explicit prohibition on
  `research/comparison` importing it, and the total absence of KT/assessment terms across
  `apps/app/src` (Stage 1 trace).
