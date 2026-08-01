# Progress Lab pace-indicators verification

**Plan:** `.work/plans/active/2026-07-19-progress-lab-pace-indicators/PLAN.md`
**Overall status:** 🟡 Implemented and self-verified - awaiting reviewer verification
**Last updated:** 2026-07-19

> Reviewer pre-fills acceptance criteria from the plan. Implementer (Codex/Sonnet) fills the
> report section per phase; reviewer fills findings. A phase is done only at `✅ Verified`.
> **Option-X invariant, checked every phase:** `git diff` on
> `apps/app/src/roadmap/replan/capacityScenario.ts` and `apps/app/src/pages/Replan.tsx` is empty,
> and their test suites pass unmodified.

## Phase 1 - End dates: goal line, finish flags, domain, clipping

### Acceptance criteria
- [ ] `BurnUpPlot` accepts optional `deadlineISO`, `forecastFinishISO`, `scenarioFinishISO`, `totalPlannedMinutes`.
- [ ] Full-range domain includes every supplied finish date; right edge ≥ the latest finish (month/week ranges unchanged).
- [ ] Planned staircase and scenario line are clipped at the total (no point/segment beyond the finish x).
- [ ] Goal line renders at `totalPlannedMinutes` with the `PLAN COMPLETE · <total>` label and a done-zone tint above it.
- [ ] Dated finish flags render for Plan (deadline), Forecast (when present), Your pace (when a scenario is active); absent when the prop is absent.
- [ ] Dotted connector links the GP line end to the Forecast pin.
- [ ] Scenario line visibly starts at the actual endpoint and reads as a clean line; only drawn when `paceDeltaMinutes > 0`.
- [ ] Legend gains GP forecast + Your pace entries.
- [ ] New decorative SVG paths keep `pointerEvents="none"`; default Week card appearance unchanged.
- [ ] `capacityScenario.ts` / `Replan.tsx` diffs empty; their suites green.

### Implementer report

- Status: ✅ Implemented and self-verified - awaiting reviewer verification.
- Files changed: `apps/app/src/components/BurnUpChart.tsx`, `apps/app/src/components/BurnUpChart.test.tsx`, `apps/app/src/components/BurnUpChartTest.tsx`, plus this task's plan, verification log, status row, and scratchpad.
- Commit SHA: `27e6104` (`feat(progress-lab): add finish markers and goal line`).
- Commands + results: direct Vitest paths for `BurnUpChart.test.tsx`, `capacityScenario.test.ts`, and protected `Replan.test.tsx` passed 33 tests across 3 files.
  App typecheck passed.
- Deviations + why: `forecastBasis` was intentionally kept out of `BurnUpPlot` per the corrected implementation contract.
  The full-plan right-edge pad is three calendar days, matching the approved mock.
- Self-check: the full domain includes valid supplied finishes and pads only Full plan; planned and scenario lines stop at completion; goal decorations hide on invalid or missing required values; the GP connector and all three flags render at valid dates; the scenario path is linear and starts from its supplied actual anchor; both new legend entries render; protected source and test diffs are empty.

### Reviewer findings
- Status: ☐ (`✅ Verified` / `🔁 Changes requested`) · Per-criterion verdict: · Issues / required changes:

### Resolution
- (implementer fills on redo → loop until Verified)

## Phase 2 - Coordinate crosshair (variation B)

### Acceptance criteria
- [ ] Hovering anywhere on the plot shows vertical + horizontal guides.
- [ ] A date pill renders on the X axis (date under cursor) and an hours pill on the Y axis (hours at cursor Y).
- [ ] A coloured dot sits on each visible line at the hovered date; a readout box lists each series' value.
- [ ] Actual value is absent for dates after today; scenario value absent at Current pace.
- [ ] Crosshair clears on `mouseleave`; existing checkpoint keyboard selection still works.
- [ ] Overlay hit-rect uses explicit `pointerEvents:all`; series paths remain non-interactive.
- [ ] `capacityScenario.ts` / `Replan.tsx` diffs empty; their suites green.

### Implementer report

- Status: ✅ Implemented and self-verified - awaiting reviewer verification.
- Files changed: `apps/app/src/components/BurnUpChart.tsx`, `apps/app/src/components/BurnUpChart.test.tsx`, plus this task's plan, verification log, status row, and scratchpad.
- Commit SHA: `2406381` (`feat(progress-lab): add chart crosshair`).
- Commands + results: direct Vitest paths for `BurnUpChart.test.tsx`, `capacityScenario.test.ts`, and protected `Replan.test.tsx` passed 36 tests across 3 files.
  App typecheck passed.
- Deviations + why: none.
- Self-check: bounded step and linear helpers cover planned, actual, GP, and scenario values; actual is unavailable after today; the transparent hit area has `pointerEvents: all` and precedes checkpoint targets; hover renders both guides, date and hours pills, per-series dots, and an in-bounds readout; Current pace omits scenario values; mouse leave clears the crosshair; checkpoint Enter behavior remains intact; protected source and test diffs are empty.

### Reviewer findings
- Status: ☐ · Per-criterion verdict: · Issues / required changes:

### Resolution
-

## Phase 3 - Narrative three-finish panel + wiring

### Acceptance criteria
- [ ] Rail narrative shows Plan (deadline), Forecast (`projection.finishDate`), and - at +N - the pace scenario date + delta vs deadline.
- [ ] `forecastBasis==='analytic'` shows the "estimate" tag; `'gp'` does not.
- [ ] At Current pace: no scenario line; narrative reads "current trajectory → forecast" (no misleading capacity date).
- [ ] Pace slider + `Replan with this pace` link unchanged (still `/replan?paceDeltaMinutes=N`, no `/study` prefix).
- [ ] Week passes deadline and total for both views, while forecast finish and basis are withheld when `isPastWeek`.
- [ ] Historical mode hides slider + forecast/scenario narrative + scenario/forecast flags; keeps goal line, Plan flag, crosshair.
- [ ] Narrative + legend styles use design tokens (`form-design-spacing`).
- [ ] `capacityScenario.ts` / `Replan.tsx` diffs empty; their suites green.

### Implementer report

- Status: ✅ Implemented and self-verified - awaiting reviewer verification.
- Files changed: `apps/app/src/components/ProgressLabModal.tsx`, `apps/app/src/components/ProgressLabModal.css`, `apps/app/src/components/ProgressLabModal.test.tsx`, `apps/app/src/pages/Week.tsx`, `apps/app/src/pages/Week.test.tsx`, plus this task's plan, verification log, status row, and scratchpad.
- Commit SHA: `5427a14` (`feat(progress-lab): add finish narrative`).
- Commands + results: direct Vitest paths for `BurnUpChart.test.tsx`, `ProgressLabModal.test.tsx`, `Week.test.tsx`, `capacityScenario.test.ts`, and protected `Replan.test.tsx` passed 58 tests across 5 files.
  App typecheck and app lint passed.
- Deviations + why: historical mode receives deadline and total so its goal line and Plan flag remain visible; only forecast and scenario values are withheld.
  `forecastBasis` remains modal-only and is never passed to `BurnUpPlot`.
- Self-check: the rail states distinct Plan, Forecast, and Your pace outcomes; only analytic projections carry the estimate tag; Current pace is described as the current trajectory with no scenario line or flag; +N keeps unchanged capacity math and deadline comparison; the Replan link stays basename-safe; unavailable inputs are explicit; current and historical Week wiring is covered; protected source and test diffs are empty.

### Reviewer findings
- Status: ☐ · Per-criterion verdict: · Issues / required changes:

### Resolution
-

## Phase 4 - Integration, regression proof, visual verification

### Acceptance criteria
- [ ] `e2e/week-progress-lab.spec.ts` covers: goal line + Plan/Forecast flags, crosshair readout on hover, slider → scenario line + Your-pace flag + narrative date.
- [ ] `capacityScenario` + `Replan` suites pass with **no edits** to those files (diff-stat empty - recorded here).
- [ ] Screenshots at 1440×900, 1024×600, 390×844: no modal/rail/chart overflow, flags + axis labels in-bounds, no console/page errors.
- [ ] `pnpm typecheck` + `pnpm lint` (repo-wide) clean; app suites green.

### Implementer report

- Status: ✅ Implemented and self-verified - awaiting reviewer verification.
- Files changed: `e2e/week-progress-lab.spec.ts`, `apps/app/src/components/ProgressLabModal.css`, `apps/app/src/components/ProgressLabModal.tsx`, three task-local screenshots, plus this task's plan, verification log, status row, and scratchpad.
- Commit SHA: this phase commit, `test(progress-lab): verify pace indicators end to end`.
- Commands + results: the complete app suite passed 563 tests across 62 files.
  Repository typecheck passed across the roadmap engine, progress package, React app, and Astro marketing app.
  Repository lint passed across all configured workspaces.
  The seeded `week-progress-lab.spec.ts` app project passed with the managed full-app runtime healthy, including current and historical crosshair behavior, the slider transition, Replan parity, overflow checks, focus restoration, and zero console or page errors.
  A diff from documentation baseline `959ccb9` confirmed the capacity scenario implementation and tests plus both Replan test surfaces are byte-identical.
- Screenshot evidence: `screenshots/progress-lab-1440x900.png`, `screenshots/progress-lab-1024x600.png`, and `screenshots/progress-lab-390x844.png`.
  Manual original-resolution inspection confirmed no clipping, scroll overflow, crowded unreadable flags, out-of-bounds axes, rail collapse, or modal overflow.
- Deviations + why: local DNS resolved the Supabase host to a Zscaler bad-certificate endpoint.
  The spec now supports an optional `E2E_SUPABASE_IP` secure direct-host path for test-user creation and Chromium host resolution, preserving certificate validation instead of disabling TLS.
  Mobile-only rail and footer spacing was compacted with design tokens after the real screenshot exposed a compressed chart.
- Self-check: the E2E asserts the goal line, Plan and Forecast flags, current narrative, blank-plot crosshair, slider-to-scenario transition, Your pace flag, narrative finish, Replan parity, historical Plan-only mode, checkpoint and layer interactions, focus and dismissal, three viewport bounds, and clean browser errors.
  Protected source and tests remain unchanged, all three screenshots were inspected, and reviewer fields remain unclaimed.

### Reviewer findings
- Status: ☐ · Per-criterion verdict: · Issues / required changes:

### Resolution
-
