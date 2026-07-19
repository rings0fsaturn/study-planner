# Handover → Codex (new session): Phase A4 — new candidates + winner tweaks + wider/adversarial sweep (PA+.4–.6)

**Date:** 2026-06-18 · **From:** Cowork planning/review agent · **For:** a fresh Codex (gpt-5.5) session
**Plan:** [`../plans/active/2026-06-14-pillar-a-rigour.md`](../plans/active/2026-06-14-pillar-a-rigour.md) · **Checklist (your scorecard):** [`../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md`](../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md) → criteria **A4.1–A4.6**

> You are the **implementing** agent. The plan is the source of truth; this is your entry point and the rules of engagement. Read the plan's operating-manual preamble, then Phase A4, then the VERIFICATION A4 criteria. Don't re-plan — if reality contradicts a step, set the phase `🛑 Blocked: <reason>` and hand back.

## Orientation (this repo's workflow)

- Two environments, hard split: the **clean `uv` workspace `research/comparison`** (all your work) imports `py-progress`/`py-roadmap-engine` as peer candidates; the isolated `research/kt-bench` is **off-limits**.
- Plan-driven and reviewed: you implement, fill your section of `VERIFICATION.md`, commit, and a reviewer checks the diff against the criteria. **A phase is not done until the reviewer marks it `✅ Verified`.**
- Phases A0, A1, A2, A3 are `✅ Verified`. **A3 built the rigour protocol you must score everything under** (200 seeds, held-out archetypes, bootstrap CIs, Holm/BH correction) — it lives in `research/comparison/src/research_comparison/runners/rigour.py`. **Reuse it.**

## Step 0 — before any code: commit the pending review docs

A reviewer's A3 verdict is sitting uncommitted in the working tree. Baseline it first:

```bash
git status                       # expect modified: ../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md (+ research/doc note)
git add ../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md
git commit -m "docs(review): A3 verified; record Pillar-A report caveats"
```

(If `git status` shows nothing, it was already committed — proceed.) Do **not** stage `.codex/**`.

## What A4 is

Grow each track's contest **neutrally and additively**, tweak the incumbents **without rigging**, and widen the sweep to adversarial regimes — all scored under A3's rigour protocol. This is the largest remaining phase.

### Current rosters (today, pre-A4) — grounded from the result JSONs

- **calibration:** `hierarchical_bayes`(incumbent), `covariate_bayes`, `eb_partial_pool`, `sma`, `ewma`, `pooled_bayes`, `oracle_calibration`
- **detection:** `cusum`(incumbent), `ewma_control_chart`, `csd`, `oracle_detection`
- **projection:** `gp_ard`(incumbent), `conformal`, `gp_hetero_t`, `kalman`, `linear`, `oracle_projection` *(projection is done — A4 adds nothing here)*
- **scheduling:** `greedy_incumbent`(incumbent), `dp_capacity`, `rule_based`
- **sweep grid today:** 3 points/axis on `ar1_phi {0,0.3,0.5}`, `drift_total`, `manual_fraction`, `sigma_log`, `step_mag`
- `ortools` is **not** in `research/comparison/pyproject.toml` yet.

### Acceptance criteria (full text in VERIFICATION.md — this is the checklist)

- **A4.1 Calibration:** add `kalman` (state-space random-walk pace); optionally `particle` (regime-switching). Register alongside the existing candidates; don't touch the incumbent.
- **A4.2 Detection:** add `bocpd`, `page_hinkley`, `adwin`; add `ruptures` PELT/BinSeg **labelled `upper_bound`** (retrospective — excluded from deployable-winner selection). Tweak CUSUM: robust running-scale standardisation + per-shift-type `k`/`h` + a Page-Hinkley drift arm. Report the **latency↔false-alarm Pareto frontier** (must be monotone) instead of one operating point.
- **A4.3 Scheduling:** add CP-SAT/ILP exact optimum (OR-Tools) **labelled `upper_bound`**; add a topological prereq scheduler and a local-search (SA/tabu) repair; tweak greedy with one-step lookahead + prereq-aware topological pre-order. Get **prereq-order correctness back to 1.0** on the mix where it dipped (confirm which mix dips first).
- **A4.4 Sweep:** widen to **5+ points/axis** + adversarial regimes (multi-shift per journey, step+drift combined, bursty missingness). Report **flip cells** and **per-archetype worst case**, not just the mean. Regenerate `robustness_heatmap.pdf`.
- **A4.5 OR-Tools:** record `ortools` in `pyproject.toml` as an **optional** extra; `import ortools` works **OR** the CP-SAT candidate is **gracefully skipped** so CI without it still passes (OQ-A3). Don't make it a hard dependency.
- **A4.6 Tests:** each new candidate returns its track's result-dict shape and runs on a fixture; upper-bound candidates are excluded from deployable-winner selection; the Pareto frontier output is monotone.

## Suggested order

1. Calibration `kalman` (smallest). 2. Detection candidates + CUSUM tweaks + Pareto frontier. 3. Scheduling candidates + greedy tweak + prereq-order fix + OR-Tools optional. 4. Sweep widening + adversarial regimes + heatmap. 5. Full re-run at `--seeds 200` under the A3 protocol + regenerate artifacts. 6. Tests. Each track is independent; do them in any order, but score all under A3's protocol.

## What to FOLLOW

- **Score everything under A3's rigour protocol.** Reuse `runners/rigour.py` (seed-count dataset, held-out labelling, `paired_metric_result` bootstrap CIs, `mc_correction_block`). New candidates' results must carry `delta_ci`, held-out scoring, and Holm/BH like the existing ones.
- **Report only Holm-surviving wins as wins.** The `mc_correction` block already separates `holm_significant` from `survives_holm_win` — a significant difference in the wrong direction is not a win.
- **Additive only.** New candidates never replace a shipped one; keep all incumbents and prior candidates in the contest.
- **Upper bounds are not winners.** `ruptures` (detection) and CP-SAT (scheduling) are labelled `upper_bound` and excluded from deployable-winner selection — they bound the achievable, they don't compete for the win.
- **Frozen regime:** params hash `e716cd12dddc`, seed 0; preserve each track's result-JSON shape (add fields, don't rename). Commit discipline: on completion set Phase A4 `Status: ✅ Complete — <sha>`, fill the A4 Resolution block (files, SHA, new candidates per track, ortools handling, prereq-order fix, per-criterion self-check, deviations + why), commit code + plan + verification together.

## What to AVOID (read twice — this is where the last phases needed redos)

- **The winner "tweaks" are the trap.** Tweaking CUSUM (`k`/`h`) and greedy (lookahead/order) means touching shipped incumbents. **Any tweaked hyperparameter is tuned ONLY on the held-out TRAIN archetypes (A3's split), never on the cells you report.** Do not hand-pick `k`/`h` (or any constant) to make CUSUM win on the scored cells — that is exactly the failure that sent A1 (`×4.20`) and A2 (generator-truth prior) back. The number must be *earned*.
- **Never seed a candidate with generator truth.** Do not import `params.py` `ROLE_RHO`/`TAU_GENERIC`/`m_global`/`r_star` (or shift schedules) into `baselines/`. Detectors/schedulers estimate from the observable series only.
- **No magic constants** to hit a target metric. Pareto frontiers and operating points come from the data, not from dialed-in numbers.
- **OR-Tools must degrade gracefully** — never let an `ortools` import failure break the suite; skip the CP-SAT candidate and note it.
- **Don't peek at the future / labels:** detection runs on the observed pace-ratio series; a deployable detector cannot use the sidecar shift labels or `r_star`. (Upper bounds may use full retrospective data — that's why they're labelled `upper_bound`.)
- **Don't touch `research/kt-bench`, the closed loop, or `.codex/**`.** Don't run the known-blocked E2E/build setup.

## Runtime heads-up

200 seeds = **3,600 learners/track**, now with **more candidates** and a **wider sweep** (5+ pts × 5 axes + adversarial regimes is a large grid). This is the heaviest run yet. **Smoke-test at a low seed count and a reduced grid first** to confirm wiring, then do the full run once.

## Commands

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -c "import ortools; print('ortools ok')" || echo "ortools absent — CP-SAT must skip gracefully"
uv run --package research-comparison python -m research_comparison.runners.calibration --seeds 200
uv run --package research-comparison python -m research_comparison.runners.detection   --seeds 200
uv run --package research-comparison python -m research_comparison.runners.scheduling  --seeds 200
uv run --package research-comparison python -m research_comparison.runners.sweep
uv run --package research-comparison pytest research/comparison/tests -q
```

## What the reviewer will verify (so you can self-check first)

1. **No tuning on scoring cells / no leakage** — any tweaked hyperparameter fit on held-out TRAIN archetypes only; no generator constants in `baselines/`; no magic constants; detectors don't use sidecar labels.
2. **Additive + upper bounds correct** — incumbents and prior candidates retained; `ruptures`/CP-SAT labelled `upper_bound` and excluded from deployable-winner selection.
3. **Scored under A3 protocol** — new candidates carry `delta_ci`, held-out scoring, Holm/BH; wins reported are Holm-surviving.
4. **A4-specifics** — detection Pareto frontier monotone + per-shift-type; scheduling prereq-order back to 1.0 on the dipping mix; sweep widened (5+ pts/axis) + adversarial regimes + flip cells + per-archetype worst case; `robustness_heatmap.pdf` regenerated and changed.
5. **OR-Tools optional** — suite passes with and without `ortools`.
6. **Tests** non-vacuous and green; numbers ground-checked against the working-tree result JSONs.

## Report back

Fill the A4 Resolution block in `VERIFICATION.md` (SHA, files, new candidates per track, ortools handling, prereq-order fix, per-criterion self-check A4.1–A4.6, deviations + why). Then it's ready for review. If a new candidate or a CUSUM/greedy tweak does **not** beat the incumbent under correction, **report that honestly** — an honest "no improvement" is a finding, not a failure (the report ledger `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md` already expects this discipline).

## Files likely in play

`research/comparison/src/research_comparison/baselines/{detection,scheduling,calibration}.py` · `…/runners/{detection,scheduling,calibration,sweep}.py` + `…/runners/rigour.py` (reuse) · `…/plots/{detection_latency,robustness_heatmap}.py` · `research/comparison/pyproject.toml` (ortools optional) · `research/comparison/tests/*` · `college/mydeliverables/1st-Review/report/generated/*` · `../plans/active/2026-06-14-pillar-a-rigour.md` + `…-VERIFICATION.md` (status + A4 Resolution).
