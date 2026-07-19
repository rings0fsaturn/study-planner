# Pillar A — report claims & caveats (for the Phase 6 write-up)

> **What this is.** A durable ledger of the *honest framings* the Phase-6 report and journal
> must use for Pillar A — established during the A0–A5 rigour work and its reviews. When you
> wire the report (tracker Phase 6 / `research-tasklist.md`), the claims below are the agreed
> language; do not overstate beyond them. Source of truth for every entry: the per-phase
> **Reviewer findings** in [`plans/2026-06-14-pillar-a-rigour-VERIFICATION.md`](../../.work/plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md)
> and the stamped result JSONs under `research/results/`.
>
> Add a row as each phase closes. Keep claims tied to evidence (file/commit), not memory.

## ⚠️ Priority caveat — calibration (A2): do NOT claim a clean covariate/EB win

**Tempting overstatement to avoid:** "modelling time-of-day/day-of-week/role structure (covariate_bayes / eb_partial_pool) beats pooling."

**What the evidence actually supports (A2 `4445701` + A3 `2b8e23c`):**

- On **m_global recovery**, pooling is near-optimal; `covariate_bayes`/`eb_partial_pool` are *worse* on every band. (The hierarchy "does no work" on this target — by design, not defect.)
- On **context-aware next-session prediction** (A2/D-A7), `covariate_bayes` beat pooled on the **medium/max bands by aggregate** (e.g. max Δ−0.0115, CI excl 0) at 40 seeds — a real signal where the data is rich.
- **But under A3's rigorous protocol** (200 seeds, held-out archetypes, Holm correction, per cell), those wins **do not survive**: `covariate_bayes`/`eb_partial_pool` have **no surviving Holm wins** vs the incumbent on held-out context-prediction cells, and several are significantly *worse*. Only the oracle shows consistent surviving wins.

**Agreed framing for the report:** "Context-aware modelling helps next-session pace prediction on **data-rich, seen** archetypes, but the advantage **does not generalise to held-out archetypes under multiple-comparison correction**. We therefore report it as a qualified, non-generalising effect, not a headline win. On global-pace recovery, simple pooling is near-optimal and the hierarchy adds no value — a finding in itself." Report Holm-surviving wins only as "wins."

**Evidence:** `research/results/calibration/calibration_results.json` → `mc_correction` (`survives_holm_win`); VERIFICATION A2 + A3 reviewer findings.

## Projection (A1 + A3.7): the red→green is real and earned — state it correctly

- `gp_ard` (incumbent) **under-covers badly**: held-out 95% interval coverage ≈ 0.40 / 0.264 / 0.165 (small/medium/max) vs nominal 0.95.
- The honest **within-learner** conformal (A1) only reached 0.50/0.67/0.85 — report A1 as "candidates shipped + honest under-coverage," not as the fix.
- The fix is **across-learner split-conformal** (A3.7, D-A6): held-out coverage **0.956 / 0.991 / 0.906**, ≈ nominal **by construction** (residual quantile over train-archetype learners, no tuned constant). This is the defensible "calibrated finish-date intervals" result.
- `gp_hetero_t` improves on `gp_ard` but does not reach nominal — report as the principled-but-insufficient variant.

**Caveat to keep:** A1's earlier interval used a hand-tuned `×4.20` multiplier that was **removed** in review — do not resurrect any "tuned to 0.95" phrasing. Coverage is by construction.

**Evidence:** `research/results/projection/projection_results.json` (`scored_split="held_out"`, `conformal_calibration`); VERIFICATION A1 + A3.7 reviewer findings.

## Cross-cutting (all Pillar-A claims)

- All headline numbers are under **200 seeds (3,600 learners)**, **held-out-archetype scoring**, **bootstrap CIs on Δ**, and **Holm (primary) + BH (reported)** correction. Frozen regime: params hash `e716cd12dddc`, seed 0. State this in the methods section.
- **Report only Holm-surviving wins as "wins."** A statistically significant difference in the wrong direction is not a win (the result JSONs separate `holm_significant` from `survives_holm_win`).
- **Oracles are upper bounds, not deployable candidates** — never present an oracle win as a method win. Same for any `ruptures`/CP-SAT `upper_bound` candidates added in A4.
- The synthetic generator is **neutral / literature-anchored**; no candidate is seeded with generator truth and no hyperparameter is tuned on scoring cells (the held-out split is the guard). If A5 reality-matches the generator, report ranking-hold honestly.

## Detection (A4 `5aa4c2e`, verified)

- Report the **latency↔false-alarm Pareto frontier** (monotone), not a single operating point. Deployable winners under held-out + Holm: **drift → `cusum`**, **step → `page_hinkley`** (a new A4 candidate genuinely wins step).
- Honest mixed result among new candidates: `page_hinkley` and `csd` survive Holm vs `cusum` on some held-out cells; **`bocpd` and `adwin` are significantly *worse*** on several — do not present BOCPD/ADWIN as improvements. CUSUM's `k`/`h` were tuned on **train archetypes only** (state this; it's the no-leakage guard).
- `ruptures_pelt_binseg` is a **retrospective upper bound**, not a deployable method — never report it as a win.

## Scheduling (A4 `5aa4c2e`, verified)

- Notable finding: under held-out + Holm, **`dp_capacity`, `local_search_repair`, `topological_prereq`, and `rule_based` all beat the shipped `greedy_incumbent`** on many cells. Frame honestly: **the deployed greedy scheduler is not the strongest** on this contest; the DP/constraint and search-repair approaches are stronger. (Decide separately whether this motivates a product change — out of scope for the report's claims.)
- Prereq-order correctness is **1.0 across all material mixes** after the A4 greedy fix (chronological day ordering + role pre-order). The earlier `anchor+practice` dip is resolved.
- `cpsat_optimum` (OR-Tools) is an **optional upper bound**, skipped when ortools is absent — report it as a gold-standard bound only, never a deployable winner.

## Calibration (A4 `5aa4c2e`)

- `kalman` was added and scored under the full protocol — fold its result into the calibration story alongside the A2 caveat above (it does not change the A2 conclusion).

## Calibration (A6 `922c64e56975d639e4e22e70115a4663486c5c1f`)

- A6 regenerated a 9-archetype v2 generator (`21c2cdabfa91` frozen,
  `c545404bcacf` reality) and added the deployable `enriched_shrink` pace
  calibrator: observable fatigue, deadline/progress, and recency features with
  TRAIN-only shrinkage priors.
- Primary result: on held-out `context_pred_mae`, `enriched_shrink` has
  Holm-surviving wins versus `pooled_bayes` in **11/12 frozen cells** and
  **9/12 reality cells**, and versus `ewma` in **11/12 frozen cells** and
  **5/12 reality cells**. Report this as a qualified next-session context
  prediction win that holds in the reality-matched regime.
- **Caveat — production dual-prior variant (A6 integration, 2026-06-20).**
  Production ships a per-learner Bayesian-weighted blend of the reality + frozen
  TRAIN priors (`enriched_dual_prior`, `PRODUCTION_PRIOR_STRATEGY="dual_prior"`
  in `py_progress/enriched.py`), validated under the rigour protocol on the
  reality regime
  (`research/doc/verification-runs/2026-06-20-enriched-dualprior/`). Against
  reality-alone `enriched_shrink` it is a **net** win on `context_pred_mae` (7
  Holm-surviving wins) but **band-dependent**: it wins the max band (0.1370 vs
  0.1384) and medium band (0.1386 vs 0.1397) and **loses the small / cold-start
  band with 2 Holm-significant not-win cells** (0.1433 vs 0.1421, ≈+0.8% worse).
  On `recovery_mae` it is broadly better, including the small band (0.1028 vs
  0.1150, 11 Holm wins). **Claim discipline:** report the dual-prior as a *net*
  improvement over reality-alone with an explicit small-band point-estimate
  exception — never as a uniform win.
- Do **not** claim an archetype-membership win. The hard/soft archetype variants
  route to TRAIN-type shrinkage priors and are close on means, but direct Holm
  comparisons versus `enriched_shrink` show isolated wins plus significant
  losses: hard router frozen 3 wins / 8 significant not-wins, reality 2 wins /
  1 significant not-win; soft router frozen 3 wins / 1 significant not-win,
  reality 0 wins. The simpler `enriched_shrink` model remains the recommended
  candidate.
- Secondary `recovery_mae` remains mixed and should not be used as the headline
  A6 claim.

**Evidence:** `research/doc/verification-runs/2026-06-19-a6-final/{SUMMARY.md,evidence.json}`.

## External validity (A5 `68f4a121ed1ab6533db2f2949625f367258146d2`)

- Reality-matched regime: `synthetic-reality-3b404c903563-seed0-n3600`, with base frozen hash `e716cd12dddc` preserved. OULAD was used for **moment bounds only**: daily `studentVle.sum_click` aggregated per learner/course/day as an engagement-intensity proxy for minutes toward a roadmap. Bounds are ranges, not point fits; pre-start days are excluded.
- Ranking hold is **mixed**, not a blanket external-validity win. Projection holds (`conformal` remains best non-oracle on every band; `conformal` and `gp_hetero_t` retain Holm-surviving wins). Scheduling holds (non-greedy schedulers still beat `greedy_incumbent`; `dp_capacity` wins every material mix; prereq-order correctness remains 1.0).
- Detection only partially holds: drift remains `cusum`, but step shifts switch from A4's `page_hinkley` winner to `cusum`; no detection challenger has a Holm-surviving win on A5.
- Calibration does **not** hold for the structured covariate/EB story: `covariate_bayes` and `eb_partial_pool` are often Holm-significant in the wrong direction on A5. Simple SMA/EWMA have surviving context-prediction wins. Keep the A2/A3 calibration caveat; A5 strengthens it rather than softening it.
- A5.4 direct external validation was not run; do not imply candidates were scored directly on real OULAD learner traces. The evidence is a moment-bounded reality-matched generator rerun.

**Evidence:** `research/doc/verification-runs/2026-06-18-a5-pillar-a/{SUMMARY.md,evidence.json,oulad_moment_bounds.json}`; current `research/results/{calibration,detection,projection,scheduling}/*.json` generated on `params_version_hash=3b404c903563`.

## Material/session decoupling validation (R2-R4, 2026-06-30)

The material/session redesign changes the data-generating process from dated
slot chunks to material-throughput chunks with bookings, ad-hoc days, and
interrupted partial sessions. It does **not** justify claiming that the new DGP
improves any model by itself. Use the frozen A-series run as the comparison
anchor and frame these results as transfer/re-validation under the new event
shape.

- **Protocol parity:** the frozen anchor is
  `research/results/{calibration,detection,projection}/*_results.json` from
  `synthetic-21c2cdabfa91-seed0-n5400`. The decoupled results are in
  `research/results/{calibration_decoupled,detection_decoupled,projection_decoupled}/`
  from `synthetic-decoupled-9e6d48db2da8-seed0-n5400`. Both use 200 seeds, 9
  archetypes, 3 bands, held-out scoring with 5 train / 4 held-out archetypes,
  bootstrap delta CIs, Holm as primary correction, and BH reported.
- **Calibration:** the `planned` reference changed source from slot chunk to
  material throughput, but the signal shape is identical:
  `activeMinutes / plannedMinutes` still equals latent pace. With partial
  throughput points included, `enriched_shrink` and `enriched_dual_prior` both
  **hold** under decoupled data: context prediction improves from 11/12 frozen
  Holm-win cells to 12/12, and recovery moves to 8/12 for both candidates
  (`enriched_shrink` frozen 6/12; `enriched_dual_prior` frozen 2/12). Do not
  phrase this as "decoupling improves calibration"; it is a different DGP.
  Caveat: recovery still has a Holm-significant loss at `max|night_owl`.
- **Partial-session policy:** interrupted partial chunks stay included. The R2
  fallback to down-weight/exclude partials was not run because the
  partial-included result did not degrade the declared transfer evidence.
  This is still an external-validity caveat; R6/N=1 should sanity-check real
  partial-throughput points.
- **Detection:** state the R3 verdict against the A4/P0b baseline, not a pure
  "nothing beats CUSUM" strawman. Frozen P0b was drift -> `cusum` and step ->
  `page_hinkley`, with `csd`/`page_hinkley` Holm wins on `fading_flame` cells.
  Under the decoupled cadence, the result is **more CUSUM-favoring**: drift ->
  `cusum` and step -> `cusum`; only `fading_flame` drift cells retain
  non-CUSUM Holm wins (`page_hinkley` max/drift, `csd` medium/drift, and
  `page_hinkley` medium/drift). No step-cell non-CUSUM Holm win survives.
- **ETA / projection (#3):** `gp_plus_analytic` is **qualified**, not a
  general replacement for GP. It beats `gp_ard` under held-out + Holm on the
  small band only (4/4 small held-out cells), is significantly worse on max,
  and is not a medium-band win. `analytic_required_rate` never has a
  Holm-surviving win. The defensible claim is: a cold-start / small-plan
  fallback layered on GP is useful; `gp_ard` and conformal remain the
  data-rich-plan story, with conformal as the coverage fix.

**Evidence:** decoupled result JSONs under
`research/results/calibration_decoupled/`,
`research/results/detection_decoupled/`, and
`research/results/projection_decoupled/`; frozen anchor JSONs under
`research/results/{calibration,detection,projection}/`; verification commits
`51a5d40` (R2), `96368de` (R3), `7f97a3c` + `7d55bc1` (R4).

## Changelog

| Date | Entry | Source |
|---|---|---|
| 2026-06-18 | Created. A2 priority caveat + A1/A3.7 projection framing + cross-cutting rules recorded. | VERIFICATION A1–A3 reviewer findings; result JSONs. |
| 2026-06-18 | A4 verified (`5aa4c2e`): replaced detection/scheduling placeholder with real findings — page_hinkley/csd vs cusum (bocpd/adwin worse); all schedulers beat greedy_incumbent; prereq-order 1.0; upper-bound framing. | VERIFICATION A4 reviewer findings; result JSONs. |
| 2026-06-18 | A5 implemented (`68f4a121ed1ab6533db2f2949625f367258146d2`): added OULAD-bounded reality-matched generator and recorded mixed ranking-hold — projection/scheduling hold, detection partially holds, calibration structured-candidate story does not hold. | A5 verification-run evidence; result JSONs. |
| 2026-06-19 | A6 implemented (`922c64e56975d639e4e22e70115a4663486c5c1f`): `enriched_shrink` is the recommended context-prediction candidate; archetype hard/soft variants do not earn their complexity over enriched shrinkage. | A6 final verification-run evidence. |
| 2026-06-30 | Material/session decoupling R2-R4 verified: calibration holds with partials included, detection becomes more CUSUM-favoring than A4/P0b, and ETA #3 is qualified to small/cold-start only. | Research ETA model-selection VERIFICATION R2-R4; decoupled result JSONs. |
