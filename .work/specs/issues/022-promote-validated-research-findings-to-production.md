---
title: Promote the split-conformal GP-interval correction into production
type: HITL
blocked_by: []
covers_user_stories: []
---

## Parent

PRD: `PRD-study-tracker-web.md` · Research: `research/results/projection/projection_results.json`,
`research/results/projection_decoupled/projection_results.json`,
`research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md` · Found in:
`.work/plans/active/2026-07-03 third-review-report-work/research/02-research-to-app-mapping.md`
§1, §3 and `01-app-architecture-and-data-flow.md` §5 finding #8 (architecture/research
audit, 2026-07-03; **corrected 2026-07-03** after cross-referencing
`.work/plans/active/2026-06-30-material-session-decoupling/` and
`.work/plans/active/2026-06-30-research-eta-model-selection/` — see "Correction history"
below).

## Correction history (read this first)

This issue originally (same day) claimed **two** unpromoted research findings: a better
scheduling algorithm, and a GP-interval fix. Both halves of that original claim were wrong
or overstated, caught by a reviewer pointing at two plan folders this investigation hadn't
read:

- **The scheduling claim was withdrawn entirely.** `.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md`
  D1 + §5c show the scheduling-algorithm comparison (`dp_capacity` vs. the shipped heuristic)
  was **explicitly retired by product decision** on 2026-06-30, not left as an open gap — the
  redesign eliminated the "pack materials into pre-committed dated slots" problem those
  algorithms solved. There is nothing to promote and nothing to decide here; this issue no
  longer covers scheduling. See `.work/plans/active/2026-07-03 third-review-report-work/research/02-research-to-app-mapping.md`
  §1 for the full explanation, in case anyone re-derives this claim independently in the future.
- **The GP-interval claim was narrowed.** What was originally described as "the uncorrected
  GP version shipped; the fix did not" is only half true. `packages/progress/src/projectFinish.ts`
  (commit `1d9270e`, 2026-07-01) **already implements** a validated cold-start/non-crossing
  composite (`COLD_START_N=5` → analytic fallback, else GP) — a direct, fast promotion of the
  `gp_plus_analytic` candidate the `research-eta-model-selection` plan's R4 phase validated
  one day earlier (2026-06-30). That part is done. What remains unpromoted, and is the actual
  subject of this issue, is narrower: the **split-conformal interval-width correction**, a
  different fix addressing a different failure mode (interval coverage on data-rich plans,
  not point-estimate robustness on cold-start plans).

## What's wrong

`research/comparison/src/research_comparison/baselines/projection.py::forecast_conformal_finish`
computes a GP burn-up forecast the same way production does
(`py_progress.fit_burn_up_gp`/`packages/progress/src/gp.ts::fitBurnUpGP` — the research
harness literally imports and benchmarks the production function), but widens the
prediction interval using across-learner split-conformal residual quantiles.

`research/results/projection/projection_results.json` (frozen regime) and
`research/results/projection_decoupled/projection_results.json` (the 2026-06-30 re-run,
post-redesign) both show the same story: plain `gp_ard` under-covers badly — actual 95%
interval coverage ranges roughly 0.13–0.49 by band, well short of the nominal 0.95 — while
`forecast_conformal_finish` reaches ~0.91–0.99 coverage by band. `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`'s
most current entry (the "Material/session decoupling validation" section, added 2026-06-30)
reaffirms conformal as "the coverage fix" for data-rich plans, explicitly distinguishing it
from the cold-start composite (which addresses a different regime and has already shipped).

**Production has not adopted this fix.** `grep -rn "conformal" packages/progress/ packages/py-progress/ apps/app/src/`
returns nothing. `apps/app/src/progress/useProgress.ts` → `computeProgress` →
`fitBurnUpGP`/`projectFinish` (`packages/progress/src/projectFinish.ts`) uses the plain,
uncorrected GP interval for any plan past the `COLD_START_N=5` threshold — i.e., for the
large majority of active users, not just the cold-start ones the recent composite fix
addresses. The app's displayed finish-date confidence interval is therefore narrower and
more confident-looking than the data actually supports, in roughly 50–85% of cases
depending on plan size/band.

## Why this needs a human decision (HITL)

This is a real, well-evidenced, still-current gap — but promoting it is real engineering
work with a product-visible effect (a **wider**, more honest, less reassuring-looking
confidence interval), and the calibration methodology itself needs a decision: the
research's split-conformal fit uses **across-learner** residual quantiles from a held-out
training-archetype split on synthetic data. Production has no equivalent "training
archetype" population to calibrate against — real users aren't grouped into the synthetic
generator's 9 archetypes. So this isn't a pure port; someone needs to decide what population
of residuals a production conformal calibration would draw from (e.g. residuals pooled
across all users to date, recalibrated periodically) before it can be implemented, which is
a design call, not just an engineering task.

## What to build (once approved)

Port the split-conformal correction concept — not necessarily the exact synthetic-archetype
calibration mechanism — into `packages/progress/src/projectFinish.ts` (TS, live) and, for
parity, `packages/py-progress/src/py_progress/progress.py` (Python; currently unused per
issue #021, but `CLAUDE.md` asks the two stay behaviorally aligned). Concretely:

1. Decide the production calibration population for conformal residuals (candidates: all
   completed roadmaps to date across all users, refreshed periodically; or a fixed
   held-out slice of historical data analogous to the research's held-out archetypes).
2. Implement conformal interval widening in `projectFinish`'s `basis: 'gp'` branch only
   (the analytic/cold-start branch is unaffected — that's the already-promoted composite).
3. Extend the TS/Python fixture-parity harness (`scripts/fixture-export/progress-cases.ts` +
   `packages/py-progress/tests/test_fixtures.py`) to cover the corrected interval, following
   the *genuine*-parity pattern (see issue #020 for what a broken parity claim looks like —
   don't repeat that mistake here).

## Acceptance criteria

- [ ] A decision is recorded on the production conformal-calibration population (see "What
      to build" step 1) before implementation starts.
- [ ] `projectFinish`'s `confidenceInterval` reflects the conformal-corrected width when
      `basis === 'gp'`; the cold-start `basis === 'analytic'` branch is unchanged.
- [ ] The TS/Python fixture-parity harness is extended to cover the corrected interval with
      genuine (not fixture-doctored) parity.
- [ ] `.work/STATUS.md`'s Pillar-A entries are updated to reflect that this specific finding
      has been (or has been decided not to be) promoted.
- [ ] `pnpm --filter @study-tracker/progress test`, `pnpm --filter @study-tracker/app test`,
      and `uv run pytest packages/py-progress` all pass.

## Notes

**Severity: Low-medium, but high-value if addressed.** Not a crash or invalid-output bug —
the shipped interval is a valid (if overconfident) interval — but it's a case where the
dissertation's own research already quantified a concrete miscalibration and named the fix,
which makes *not* promoting it harder to defend in the report's "current limitations"
framing than simply not having researched the question. Recommend resolving this issue (or
explicitly declining, with reasoning recorded) before the 3rd-review report's limitations
chapter is finalized.

Also worth a lightweight follow-up, not blocking this issue: `packages/py-progress/src/py_progress/progress.py`'s
`_find_projected_finish` has not been updated with the `gp_plus_analytic`-equivalent
cold-start composite that TS's `projectFinish.ts` already has (TS commit `1d9270e`,
2026-07-01; Python unchanged since 2026-06-08) — a new TS-ahead-of-Python divergence,
currently low-impact only because `/v1/progress` has zero live callers (issue #021). If
`/v1/progress` is ever revived, this divergence would need to be closed too.
