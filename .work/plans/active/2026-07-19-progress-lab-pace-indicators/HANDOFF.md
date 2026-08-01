# Handoff - Progress Lab pace indicators → Codex

**Date:** 2026-07-19 · **From:** Cowork (planning/review) · **To:** Codex (gpt-5.5), Sonnet secondary
**Plan:** [`PLAN.md`](./PLAN.md) · **Log:** [`VERIFICATION.md`](./VERIFICATION.md)

## What this is

Rework the Week → Progress Lab modal so it presents **three dated finishes** (Plan deadline ·
GP forecast · Pace scenario), turns the plot fully interactive (coordinate crosshair), and gives
every trajectory a **clear on-chart end date** (goal line + dated flags, extended domain). Fixes
the reported bug: awkward/disconnected green line, un-ending lines, and the misleading
"Scenario finish" at Current pace.

Designed visually with `grill-me-with-mocks` - four decisions, all resolved. The build target is
the combined mock.

## Your entry point

1. **Step 0 - commit the planning docs first** (Cowork can't commit):
   `git add .work/plans/active/2026-07-19-progress-lab-pace-indicators .work/active/progress-lab-pace-indicators .work/STATUS.md && git commit -m "docs(plan): add progress-lab pace-indicators plan + verification"`
2. Open the visual source of truth and flip the slider / hover the chart:
   `.work/active/progress-lab-pace-indicators/mocks/final.html`
3. Work `PLAN.md` phases 1→4 in order; fill `VERIFICATION.md` after each; expect review before moving on.

## The one hard rule (Option X)

**Do not touch `apps/app/src/roadmap/replan/capacityScenario.ts` or `apps/app/src/pages/Replan.tsx`,
and do not change `computeCapacityScenario`'s `finishDate` math.** The forecast comes from the
existing `ProgressSnapshot.projection.finishDate`; the +N scenario keeps its current finish math.
`capacityScenario.test.ts` and `Replan.test.tsx` must stay byte-identical and green - that's the
proof Replan is untouched (verified every phase via an empty `git diff`).

## Where things live (verified 2026-07-19)

- Chart: `apps/app/src/components/BurnUpChart.tsx` - series at `:482-546`, scenario line `:522-534`, domain helpers `:103-146`, palette `:12-22`.
- Modal: `apps/app/src/components/ProgressLabModal.tsx` - "Try a pace" block `:338-394`, `scenarioPoints` gating `:272`.
- Week wiring: `apps/app/src/pages/Week.tsx` - `capacityScenarioInput` `:127-157`, `progress.projection.finishDate` `:191`, modal render `:360-374`.
- Forecast data (already computed): `ProgressSnapshot.projection` - `packages/progress/src/types.ts:189-201`; `projection.basis` distinguishes GP vs analytic.
- `BurnUpData` shape: `packages/progress/src/types.ts:151-161` (`deadline?`, `startDate?`, `gpCurve`).

## Decisions (full log: `mocks/DECISIONS.md`)

- **D-01** green = clean forward projection (Option X: finish math unchanged).
- **D-02** rail = plain-language narrative of the three finishes.
- **D-03** crosshair = coordinate guides + per-line values + readout (variation B).
- **D-04** end dates = goal line + dated finish flags; domain extended; lines clipped (variation A).
- **D-05** Current pace = forecast (no green line at 0).
- **D-07** Option X (capacityScenario/Replan untouched) - user-confirmed.
- **D-08** downstream of `2026-07-18-projection-inconsistency`; read the projection/total, don't hardcode.

## Rules to read before you touch each area

`.claude/rules/react-router-v7-basename.md` (no `/study` in the Replan link),
`.claude/rules/form-design-spacing.md` (rail/narrative token spacing),
`.claude/rules/playwright-config.md` + `.claude/rules/playwright-full-app-lifecycle.md` (E2E).
(Codex mirrors: `.agents/rules/<name>.agents.md`.)

## Definition of done

All four phases `✅ Verified` in `VERIFICATION.md`; `capacityScenario.ts` + `Replan.tsx` diffs
empty with their suites green; repo typecheck + lint clean; the seeded E2E passes; screenshots at
the three viewports show no overflow and no console errors; `.work/STATUS.md` row updated.
