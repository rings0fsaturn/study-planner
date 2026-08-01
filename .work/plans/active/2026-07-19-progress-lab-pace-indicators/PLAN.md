# Progress Lab pace-indicators implementation plan

**Slug:** `2026-07-19-progress-lab-pace-indicators`
**Date written:** 2026-07-19
**Plan status:** Implemented and self-verified - awaiting reviewer verification
**Primary executor:** Codex (gpt-5.5); Claude Code (Sonnet) secondary
**Visual source of truth:** `.work/active/progress-lab-pace-indicators/mocks/final.html`
**Decision source:** `.work/active/progress-lab-pace-indicators/mocks/DECISIONS.md`
**Per-decision mocks:** `.work/active/progress-lab-pace-indicators/mocks/decisions/decision-02…04-*.html`
**Verification log:** `.work/plans/active/2026-07-19-progress-lab-pace-indicators/VERIFICATION.md`

## Implementation protocol (read first)

1. **Step 0, before writing any source code:** commit these planning docs verbatim -
   `docs(plan): add progress-lab pace-indicators plan + verification`. Cowork cannot commit
   (git is read-only there); this establishes the baseline so later diffs are meaningful.
2. Work the four phases **in order**; each is an independently shippable vertical slice.
3. **After each phase**, fill your section of `VERIFICATION.md` (files changed, commit SHA,
   commands run, deviations + why, self-check vs. the acceptance criteria) and expect review.
   A phase is not done until the reviewer marks it `✅ Verified`; change requests may follow.
4. Keep unrelated working-tree changes unstaged.
5. **Hard constraint (Option X):** do **not** modify `apps/app/src/roadmap/replan/capacityScenario.ts`
   or `apps/app/src/pages/Replan.tsx`, and do not change `computeCapacityScenario`'s `finishDate`
   math. This plan is **presentational** and consumes existing data. `capacityScenario.test.ts`
   and `Replan.test.tsx` must remain byte-identical and green - that is the proof the rework
   left Replan untouched (see D-07).
6. Read the cited rule before touching each area: `.claude/rules/<name>.md` (Sonnet) /
   `.agents/rules/<name>.agents.md` (Codex).

## Summary

The Week → Progress Lab modal ships today (`2026-07-18-week-progress-lab`, ✅). A reported bug:
the pace-slider draws an "awkward", near-vertical green line disconnected from the GP
projection; the line is not explainable (no legend, no hover, `pointerEvents="none"`); and the
rail shows a single "Scenario finish" that at **Current pace** is the optimistic *capacity-model*
finish, not the model's forecast - so it disagrees with reality without saying why. The lines
also run off the right edge because two finishes fall past the chart domain.

This rework, decided visually (see `DECISIONS.md`, four decisions + Option X), makes the modal
present **three distinct, dated finishes** and turns the whole plot interactive:

- **Plan** - follow your slots → the deadline.
- **GP forecast** - your recent pace → the realistic date, sourced from
  `ProgressSnapshot.projection.finishDate` (already computed; **no** new math).
- **Pace scenario** - +N min/day → the capacity finish (`computeCapacityScenario(...).finishDate`,
  **unchanged**), shown only when the slider is above Current.

Plus a coordinate crosshair (hover anywhere → date on X, hours on Y, each line's value), a goal
line with dated finish flags, an extended domain so every finish lands on-screen, and a legend
that names every line. `capacityScenario.ts` and Replan are untouched (Option X).

## Grounding (verified against the code, 2026-07-19)

| Fact | Location |
|---|---|
| Modal renders `BurnUpPlot`, passes `scenarioPoints={paceDeltaMinutes>0 ? paceScenario?.points : undefined}` | `apps/app/src/components/ProgressLabModal.tsx:263-274` |
| "Try a pace" rail: single `Scenario finish` from `computeCapacityScenario` | `ProgressLabModal.tsx:338-394` |
| Chart plot + all series, `scenario` LinePath with `curveMonotoneX`, `pointerEvents="none"` | `apps/app/src/components/BurnUpChart.tsx:522-534` |
| Domain builders `buildBurnUpDateDomain`, `allBurnUpDates`, `buildProgressLabDateDomain` | `BurnUpChart.tsx:103-146` |
| Y-domain includes scenario already | `buildBurnUpYDomainMax`, `BurnUpChart.tsx:156-174` |
| Palette `C` incl. `moss`, `rust`, `inkFaint` | `BurnUpChart.tsx:12-22` |
| `BurnUpData` shape (`planned/actual/gpCurve/today/startDate?/deadline?/deficit/dayNumber/totalDays`) | `packages/progress/src/types.ts:151-161` |
| Forecast finish already computed: `ProgressSnapshot.projection.finishDate` (+`basis`,`confidenceInterval`) | `packages/progress/src/types.ts:189-201` |
| Week already reads it (`progress.projection.finishDate`) and has `progress.totalPlannedMinutes` | `apps/app/src/pages/Week.tsx:191`, `types.ts:203` |
| Week builds `capacityScenarioInput`, passes it + `progressLabBurnUp` to the modal | `Week.tsx:117-157, 360-374` |
| **Replan reads only `.finishDate`** from `computeCapacityScenario` (never `.points`) | `apps/app/src/pages/Replan.tsx:222-233` (rendered `:495`); query at `:109,187` |
| `projectFinish` exported (GP crossing or analytic fallback) | `packages/progress/src/projectFinish.ts:64-112`, `index.ts:61-65` |

## Locked decisions

### D-01: Green line = forward pace projection, rendered cleanly (Option X math)

The scenario line stays anchored to today's actual and ends at
`computeCapacityScenario(...).finishDate` with **unchanged** finish math. Rendering changes:
start exactly at the actual endpoint, draw as a clean line (drop the `curveMonotoneX` overshoot
in favour of `curveLinear`/`curveMonotoneX` that visibly starts at the anchor), clip at the
finish, and only draw when `paceDeltaMinutes > 0` (already gated). Source: `DECISIONS.md` D-01.

### D-02: Rail shows a plain-language three-finish narrative

Replace the single "Scenario finish" block with three statements: Plan (deadline) · GP forecast
(`projection.finishDate`, tagged *estimate* when `basis==='analytic'`) · Pace scenario (+N).
Source: `DECISIONS.md` D-02 (variation B chosen).

### D-03: Coordinate crosshair on hover (variation B)

Hovering anywhere on the plot shows vertical + horizontal guides, a live **date pill on the X
axis** and **hours pill on the Y axis**, a dot on each visible line at the hovered date
(planned/actual-or-GP/scenario), and a compact readout box listing each line's value. The
hours-pill reads the cursor's Y (pointer height); the readout reads each line's actual value at
that date. Source: `DECISIONS.md` D-03.

### D-04: Clear end dates - goal line + dated finish flags

Extend the full-plan domain to the latest finish so nothing runs off the edge; clip each
trajectory where it reaches the total; draw a horizontal "Plan complete · <total>" goal line
with a faint done-zone tint above it; drop a dated pin (Plan / Forecast / Your pace) where each
trajectory lands. A faint dotted connector runs from the GP line's data end to the Forecast pin
(the GP curve may not reach the total within its own horizon). Source: `DECISIONS.md` D-04
(variation A chosen; open to adding axis date-pills from variation C later).

### D-05: Current pace shows the forecast, not the capacity number

At slider = Current, draw **no** green line and show the **GP forecast** (`projection.finishDate`)
as "your current trajectory". The +N capacity scenario appears only when the slider is raised.
This removes the misleading "Aug 5" the bug reported. Source: `DECISIONS.md` D-02 + Replan review.

### D-06: Historical weeks stay inspection-only

Historical mode (`isPastWeek`) keeps the crosshair, goal line, and Plan flag, but hides the pace
slider, the Forecast/Your-pace narrative, the scenario line, and the Forecast/Your-pace flags -
consistent with `2026-07-18-week-progress-lab` D-08.

### D-07: Option X - capacityScenario + Replan untouched (🤔 confirmed with user)

The forecast comes from `ProgressSnapshot.projection` (existing). `computeCapacityScenario`'s
`finishDate` math is **not** changed, so `Replan.tsx` and `capacityScenario.ts` need no edits and
their tests stay green. Rejected Option Y (re-anchor current-pace to demonstrated pace) because
it would change `finishDate` and ripple into Replan's projected finish + parity tests. Source:
`DECISIONS.md` "Replan-impact review".

### D-08: Relationship to `2026-07-18-projection-inconsistency`

That (pre-plan) workstream will make `ProgressSnapshot.projection` the single finish-date owner
and may change the deficit/total baseline (reserved-capacity vs material-content). This plan is
**downstream and read-only** w.r.t. those numbers: it renders whatever `projection.finishDate`,
`totalPlannedMinutes`, and the planned/deficit series contain. Do not hardcode the total or the
forecast date - read them. If projection-inconsistency lands first, this chart reflects it
automatically. No shared edits; the two can proceed in parallel.

## Architecture overview

- `BurnUpChart.tsx` gains optional finish/goal props and two new render blocks (finish
  markers + crosshair) plus pure helpers for domain-with-finishes, series interpolation, and
  hours/date formatting. No data-flow knowledge; everything arrives via props.
- `ProgressLabModal.tsx` owns the narrative panel, threads the forecast/deadline/total to the
  plot, and keeps the existing pace slider + `Replan with this pace` link.
- `Week.tsx` supplies `forecastFinishISO`/`forecastBasis` (from `progress.projection`),
  `deadlineISO`, and `totalPlannedMinutes`; gates them off for historical weeks.
- `capacityScenario.ts`, `Replan.tsx`, and `@study-tracker/progress` are **not modified**.

## Files touched

| Path | Change | Phase | Purpose |
|---|---|---:|---|
| `apps/app/src/components/BurnUpChart.tsx` | modify | 1,2 | Goal line + finish flags + domain-with-finishes + clipping (P1); crosshair + interpolation helpers (P2); new optional props |
| `apps/app/src/components/BurnUpChart.test.tsx` | modify | 1,2 | Domain-with-finishes, clipping, marker, legend, crosshair-value tests |
| `apps/app/src/components/BurnUpChartTest.tsx` | modify | 1 | Dev `/study/chart-test` harness: exercise finish props + crosshair (dev-only) |
| `apps/app/src/components/ProgressLabModal.tsx` | modify | 3 | Narrative three-finish panel; thread forecast/deadline/total; +0 gating |
| `apps/app/src/components/ProgressLabModal.css` | modify | 3 | Narrative panel + legend styles (design tokens; `form-design-spacing` rule) |
| `apps/app/src/components/ProgressLabModal.test.tsx` | modify | 3 | Narrative content, +0 vs +N, provisional wording, historical hiding |
| `apps/app/src/pages/Week.tsx` | modify | 3 | Pass `forecastFinishISO`/`forecastBasis`/`deadlineISO`/`totalPlannedMinutes`; historical gating |
| `apps/app/src/pages/Week.test.tsx` | modify | 3 | Props wiring; current vs historical |
| `e2e/week-progress-lab.spec.ts` | modify | 4 | Crosshair hover, finish flags, narrative, no-overflow at the seeded flow |
| `.work/plans/active/2026-07-19-progress-lab-pace-indicators/VERIFICATION.md` | modify | all | Implementer + reviewer evidence |
| `.work/plans/active/2026-07-19-progress-lab-pace-indicators/SCRATCHPAD.md` | new | all | Live execution context |
| `.work/STATUS.md` | modify | all | Active row state |

**Must NOT change:** `apps/app/src/roadmap/replan/capacityScenario.ts`,
`apps/app/src/roadmap/replan/capacityScenario.test.ts`, `apps/app/src/pages/Replan.tsx`,
`apps/app/src/roadmap/replan/Replan.test.tsx`, anything under `packages/`.

## Phase 1 - End dates: goal line, finish flags, domain, clipping

**Status:** 🟡 Implemented and self-verified - awaiting reviewer verification · **Depends on:** none

### Steps
1. Add optional props to `BurnUpPlot`/`BurnUpPlotInner`: `deadlineISO?`, `forecastFinishISO?`,
   `scenarioFinishISO?`, `totalPlannedMinutes?`.
2. Extend the full-range domain so it includes `deadlineISO`, `forecastFinishISO`, and
   `scenarioFinishISO` as candidate dates (thread them through `allBurnUpDates` /
   `buildBurnUpDateDomain` / `buildProgressLabDateDomain`, `BurnUpChart.tsx:103-146`), with a
   small right-edge pad. `month`/`week` ranges unchanged.
3. Clip each trajectory at its finish: planned staircase stops at the total (no flat run-off);
   scenario ends at `scenarioFinishISO`; the GP mean line stays drawn over `gpCurve` as-is.
4. Draw the goal line at `totalPlannedMinutes` labelled `PLAN COMPLETE · <hLabel>` with a faint
   moss done-zone tint above it (palette `C`).
5. Draw dated finish flags on the goal line: **Plan** (`deadlineISO`), **Forecast**
   (`forecastFinishISO`, only when present), **Your pace** (`scenarioFinishISO`, only when a
   scenario is active). Add a faint dotted connector from the GP line end to the Forecast pin.
6. Change the scenario `LinePath` so it visibly starts at the actual endpoint and reads as a
   clean line (D-01); keep the moss dash.
7. Add legend entries for **GP forecast** and **Your pace** (currently only Actual/Planned/Behind).
8. Keep all new SVG decorative paths `pointerEvents="none"`.

### Tests (`BurnUpChart.test.tsx`)
- Domain includes each supplied finish date; right edge ≥ latest finish.
- Planned/scenario clipped at the total (no point beyond the finish x).
- Goal line + each finish flag renders at the right x for given props; flags absent when props absent.
- Legend renders GP forecast + Your pace entries.

### Rules to read
`react-router-v7-basename` (no `/study` in any link), `form-design-spacing` (token spacing if CSS touched).

### Verification
```bash
pnpm --filter @study-tracker/app test -- BurnUpChart
pnpm --filter @study-tracker/app typecheck
```

## Phase 2 - Coordinate crosshair (variation B)

**Status:** 🟡 Implemented and self-verified - awaiting reviewer verification · **Depends on:** Phase 1

### Steps
1. Add a transparent overlay hit-rect over the plot area capturing `mousemove`/`mouseleave`
   (existing series have `pointerEvents="none"`, so an explicit `pointerEvents:all` overlay is
   required). Convert client coords → data via `getBoundingClientRect` + viewBox scale.
2. On hover: draw vertical + horizontal guides; a date pill on the X axis (date under cursor);
   an hours pill on the Y axis (hours at cursor Y).
3. Add pure interpolators for planned (step), actual (only ≤ today → null after), GP mean,
   and scenario (only when active). Draw a coloured dot on each visible line at the hovered
   date and a readout box listing each series' value (`hLabel`).
4. Hide the crosshair on `mouseleave`; keep it keyboard-agnostic (checkpoint keyboard
   selection from the shipped modal is unchanged).
5. Note (non-blocking): touch/pointer parity is out of scope - mouse hover only.

### Tests
- Given a cursor position (or a direct helper call), the readout lists the correct planned /
  actual-or-GP / scenario values for that date.
- Actual value is absent for dates after today; scenario absent at Current pace.
- Guides/pills appear on hover and clear on leave.

### Verification
```bash
pnpm --filter @study-tracker/app test -- BurnUpChart
pnpm --filter @study-tracker/app typecheck
```

## Phase 3 - Narrative three-finish panel + wiring

**Status:** 🟡 Implemented and self-verified - awaiting reviewer verification · **Depends on:** Phase 1 (plot accepts finish props)

### Steps
1. In `Week.tsx`, pass to `ProgressLabModal`: `deadlineISO`
   (`progressLabBurnUp.deadline ?? activeRoadmap.deadline`) and `totalPlannedMinutes =
   progress.totalPlannedMinutes` for current and historical views.
   Pass `forecastFinishISO = progress.projection.finishDate` and `forecastBasis =
   progress.projection.basis` for the current week only.
2. In `ProgressLabModal.tsx`, replace the single `Scenario finish` block (`:363-379`) with the
   narrative panel: Plan (deadline) · Forecast (`forecastFinishISO`, append "· estimate" when
   `forecastBasis==='analytic'`) · Pace scenario line driven by the slider. Reuse
   `scenarioDifferenceLabel`/`differenceInCalendarDays` for the "N days early/late vs deadline".
3. Keep the pace slider and `Replan with this pace` link exactly as-is (`:347-392`).
4. At `paceDeltaMinutes === 0`: no scenario line (already gated at `:272`), and the Forecast
   sentence names the projection as the current trajectory (D-05).
5. Thread `deadlineISO`/`forecastFinishISO`/`scenarioFinishISO`(= `paceScenario?.finishDate`
   when `>0`)/`totalPlannedMinutes` into `BurnUpPlot` (Phase 1 props).
6. Historical mode hides the pace slider + Forecast/Your-pace narrative + scenario flags (D-06).
7. Legend styles + narrative styles use design tokens (`form-design-spacing` rule).

### Tests (`ProgressLabModal.test.tsx`, `Week.test.tsx`)
- Narrative shows the deadline, the forecast date, and - at +N - the scenario date + delta.
- `basis==='analytic'` renders the "estimate" tag; `'gp'` does not.
- At Current pace: no scenario line prop; forecast wording shown.
- Historical: no slider, no forecast/scenario; Plan flag + crosshair remain.
- Week passes deadline and total for both views, with forecast finish and basis withheld when `isPastWeek`.

### Verification
```bash
pnpm --filter @study-tracker/app test -- BurnUpChart ProgressLab Week
pnpm --filter @study-tracker/app typecheck
pnpm --filter @study-tracker/app lint
```

## Phase 4 - Integration, regression proof, visual verification

**Status:** 🟡 Implemented and self-verified - awaiting reviewer verification · **Depends on:** Phase 3

### Steps
1. Extend `e2e/week-progress-lab.spec.ts` (authenticated seeded flow): open the modal, assert
   the goal line + Plan/Forecast flags, hover the plot and assert the crosshair readout, raise
   the slider and assert the scenario line + Your-pace flag + narrative date. Follow
   `playwright-config` (top-level `webServer`, always `-c`) and `playwright-full-app-lifecycle`.
2. **Regression proof (the Option-X guarantee):** run `capacityScenario` + `Replan` suites and
   confirm they pass **without edits** to those files:
   `pnpm --filter @study-tracker/app test -- capacityScenario Replan`. Record in VERIFICATION
   that `capacityScenario.ts`/`Replan.tsx` diffs are empty.
3. Capture and manually inspect screenshots at 1440×900, 1024×600, 390×844: no modal/rail/chart
   overflow, all finish flags + axis labels in-bounds, no console/page errors.

### Verification
```bash
pnpm --filter @study-tracker/app test -- BurnUpChart ProgressLab Week capacityScenario Replan
pnpm --filter @study-tracker/app typecheck && pnpm --filter @study-tracker/app lint
pnpm typecheck && pnpm lint
pnpm exec playwright test -c e2e/playwright.config.ts e2e/week-progress-lab.spec.ts --project=app
git diff --stat apps/app/src/roadmap/replan/capacityScenario.ts apps/app/src/pages/Replan.tsx   # expect: empty
```

## Open questions / assumptions

- **OQ-01:** When `progression-inconsistency` lands and changes the deficit/total baseline, the
  goal-line total and "behind" figure shift automatically (read from the snapshot). Assumed
  acceptable - flag if the two need explicit sequencing. `🤔 Assumed (unconfirmed)`.
- **OQ-02:** Forecast pin sits at `forecastFinishISO` even though the drawn GP curve may end
  earlier; the dotted connector conveys the projection. Assumed acceptable (mock-approved).
- **OQ-03:** Touch/pointer crosshair parity deferred to a follow-up (mouse hover only here).

## Out of scope

- Any change to `computeCapacityScenario` finish math, `capacityScenario.ts`, or `Replan.tsx`.
- Changing GP/projection/deficit math (owned by `2026-07-18-projection-inconsistency`).
- Persisting modal/pace state; writing roadmap events from the modal.
- Touch-gesture crosshair; arbitrary zoom / timeline scrubber.

## References

- Mocks: `.work/active/progress-lab-pace-indicators/mocks/{final.html,DECISIONS.md,decisions/*}`
- Shipped modal plan: `.work/plans/active/2026-07-18-week-progress-lab/PLAN.md` (D-06/D-07)
- Related (read-only): `.work/plans/active/2026-07-18-projection-inconsistency/`
- Rules: `.claude/rules/{react-router-v7-basename,form-design-spacing,playwright-config,playwright-full-app-lifecycle}.md` (+ `.agents` mirrors)
