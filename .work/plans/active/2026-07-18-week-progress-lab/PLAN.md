# Week Progress Lab implementation plan

**Slug:** `2026-07-18-week-progress-lab`
**Date written:** 2026-07-18
**Plan status:** Approved for implementation
**Visual source of truth:** `.work/active/week-chart-modal/mocks/baseline.html`
**Decision source:** `.work/active/week-chart-modal/mocks/DECISIONS.md`
**Verification log:** `.work/plans/active/2026-07-18-week-progress-lab/VERIFICATION.md`

## Implementation protocol

Step 0, before writing any source code, commit `PLAN.md` and `VERIFICATION.md` verbatim with the message `docs(plan): add week progress lab plan + verification`.
After each phase, fill the matching implementer section in `VERIFICATION.md` with changed files, commit SHA, commands, screenshot evidence, deviations, and acceptance-criterion results.
Update `.work/STATUS.md` when implementation begins and when each phase is verified.
Work through all four phases in order.
Keep unrelated working-tree changes unstaged.
Do not change database schemas, progress-package types, event shapes, or synchronization behavior.

## Summary

Turn the existing `/study/week` burn-up card into a quiet, keyboard-accessible Progress Lab opener while preserving its current Marginalia appearance.
The modal must fit entirely inside supported viewports without document, overlay, dialog, chart-region, or rail scrolling.
It must preserve the original planned staircase, actual trajectory, GP projection, confidence band, behind fill, reference marker, axes, and footer.
It adds fixed ranges, inspectable actual checkpoints, independent optional layers, and a Replan-backed current-week pace scenario.
Historical weeks remain inspection-only.

## Locked decisions

### D-01: Preserve the Week chart at rest

**Status:** Agreed.
The card remains visually equivalent to the current Marginalia burn-up card at rest.
The entire card becomes a semantic dialog opener with a hover and keyboard-focus elevation plus an `Open Progress Lab` cue.

### D-02: Use an always-on control rail

**Status:** Agreed.
Desktop places the chart beside an always-on rail.
Widths at or below 900px move the rail below the chart as a dense two-column deck.

### D-03: Use fixed range presets

**Status:** Agreed.
The available ranges are Full plan, 30 days, and This week.
The 30-day range begins seven days before the current reference date and ends 22 days after it, clamped to the full data domain.

### D-04: Keep all optional model layers enabled initially

**Status:** Agreed.
Planned staircase, GP projection, and confidence band open enabled and can be toggled independently.
Actual progress and Today or Week end are always visible.

### D-05: Inspect every visible actual checkpoint

**Status:** Agreed.
Every visible actual point is selectable by pointer, Enter, and Space.
The selected checkpoint shows date, cumulative actual, cumulative planned, signed gap, and a deterministic interpretation based on change since the previous checkpoint.

### D-06: Share one capacity model with Replan

**Status:** Agreed.
The modal and Replan use one extracted capacity-scenario module.
The scenario uses active roadmap study days, `weekdayHours` as the single per-study-day baseline, remaining material minutes, demonstrated throughput, and a supported pace delta.
The slider uses `0`, `15`, `30`, `45`, and `60` minutes.
At zero the current capacity finish is shown but no scenario line is drawn.

### D-07: Keep persistence in Replan

**Status:** Agreed.
The modal never writes roadmap events.
`Replan with this pace` navigates to `/replan?paceDeltaMinutes=N` without the router basename.
Replan validates the query and applies it only during one-time active-roadmap capacity hydration.
Persistence still occurs only through Replan's existing Apply action.

### D-08: Keep historical weeks inspection-only

**Status:** Agreed.
Historical mode uses Week end instead of Today.
It retains ranges, layer controls, and checkpoint inspection.
It hides the pace slider, scenario result, scenario line, and Replan action.

## Architecture overview

`Week.tsx` owns modal state, historical context, selected week bounds, active-roadmap capacity inputs, and focus restoration.
`BurnUpChart.tsx` exposes reusable pure chart helpers and a responsive plot used by the existing card and the modal.
`ProgressLabModal.tsx` owns portal rendering, range and layer state, checkpoint selection, dialog accessibility, and pace controls.
`capacityScenario.ts` becomes the single capacity calculation used by both the modal and `Replan.tsx`.
Focused Vitest coverage protects the pure helpers and component behavior, while `e2e/week-progress-lab.spec.ts` covers the real seeded flow and viewport contract.

## Files touched

| Path | Change | Phase | Purpose |
|---|---|---:|---|
| `apps/app/src/components/BurnUpChart.tsx` | modify | 1 | Reusable plot, deterministic axes, opener affordance, pure helpers |
| `apps/app/src/components/BurnUpChart.test.tsx` | modify | 1 | Range, tick, interpolation, gap, layer, and card tests |
| `apps/app/src/components/ProgressLabModal.tsx` | new | 2 | Portal dialog, controls, checkpoint inspection, pace UI |
| `apps/app/src/components/ProgressLabModal.css` | new | 2 | Viewport-fit Marginalia modal styles |
| `apps/app/src/components/ProgressLabModal.test.tsx` | new | 2 | Dialog interaction and accessibility tests |
| `apps/app/src/roadmap/replan/capacityScenario.ts` | new | 3 | Shared throughput and capacity scenario model |
| `apps/app/src/roadmap/replan/capacityScenario.test.ts` | new | 3 | Shared capacity calculation tests |
| `apps/app/src/pages/Replan.tsx` | modify | 3 | Shared model consumption and query hydration |
| `apps/app/src/pages/Replan.test.tsx` | modify | 3 | Replan pace-query smoke coverage |
| `apps/app/src/roadmap/replan/Replan.test.tsx` | modify | 3 | Query validation and finish-parity coverage |
| `apps/app/src/pages/Week.tsx` | modify | 4 | Modal integration and current versus historical inputs |
| `apps/app/src/pages/Week.test.tsx` | modify | 4 | Current and historical modal behavior |
| `e2e/week-progress-lab.spec.ts` | new | 4 | Authenticated seeded visual and interaction acceptance |
| `.work/STATUS.md` | modify | all | Implementation and verification state |
| `.work/plans/active/2026-07-18-week-progress-lab/VERIFICATION.md` | modify | all | Implementer and reviewer evidence |
| `.work/plans/active/2026-07-18-week-progress-lab/SCRATCHPAD.md` | new | all | Live execution context |

## Phase 1: Refactor the chart without changing its default appearance

**Status:** Complete - `eeaee51`
**Depends on:** none

### Codebase state assumed at start

- `BurnUpChart.tsx` renders the current card and complete Visx plot.
- `Week.tsx` renders the chart only when it has at least three actual points and at least one positive point.
- Existing empty-state behavior is covered by `BurnUpChart.test.tsx`.

### Steps

1. Split the current chart into the existing Week card wrapper and a reusable responsive plot.
2. Add pure helpers for range domains, deterministic observed-date X-axis ticks, planned step interpolation, checkpoint summaries, and layer visibility.
3. Preserve the card's default visual appearance, data gate, Y-axis upper bound, planned staircase, actual path, GP path, confidence band, behind fill, reference marker, and footer.
4. Add a semantic whole-card opener with `aria-haspopup="dialog"`, `aria-expanded`, hover and focus elevation, and the `Open Progress Lab` cue.
5. Make non-interactive SVG paths ignore pointer events.
6. Use deterministic observed-date X ticks so every visible actual checkpoint has a mark.
7. Label all visible actual dates on wide views with staggering when crowded.
8. On compact Full plan and 30-day views, label the first and last observed anchors while retaining rust minor ticks between them.
9. Label every visible This week checkpoint date.

### Tests

- Deterministic X-axis ticks and compact label reduction.
- Range clamping.
- Planned step interpolation and signed checkpoint gaps.
- Layer visibility with always-visible actual and reference layers.
- Empty-state and minimum-data behavior unchanged.

### Verification

```bash
pnpm --filter @study-tracker/app test -- BurnUpChart
pnpm --filter @study-tracker/app typecheck
```

## Phase 2: Build the viewport-fit inspection modal

**Status:** Complete - `a932df1`
**Depends on:** Phase 1

### Codebase state assumed at start

- The reusable chart plot and pure helpers from Phase 1 are available.
- The Week card exposes a semantic opener contract.

### Steps

1. Add `ProgressLabModal.tsx` and component-scoped CSS.
2. Render through a portal attached to `document.body`.
3. Implement Full plan, 30 days, and This week ranges.
4. Add three independent pressed-state controls for planned, GP projection, and confidence.
5. Keep actual progress and the reference marker permanently visible.
6. Make every visible actual point a pointer and keyboard target.
7. Clear checkpoint selection when a range change removes the selected point.
8. Add the selected ring and deterministic summary.
9. Support Close, backdrop click, Escape, focus trap, scroll lock, and opener focus restoration.
10. Respect `prefers-reduced-motion` and provide an accessible title and description.
11. Enforce the desktop, compact-width, short-height, safe-area, and no-overflow contracts from the approved mock.

### Tests

- Pointer and keyboard checkpoint activation.
- Selection clearing after a range change.
- Layer toggles and fixed actual/reference visibility.
- Escape, backdrop, focus trap, scroll lock, and focus restoration.
- Accessible dialog labelling.

### Verification

```bash
pnpm --filter @study-tracker/app test -- BurnUpChart ProgressLab
pnpm --filter @study-tracker/app typecheck
pnpm --filter @study-tracker/app lint
```

## Phase 3: Share the pace scenario with Replan

**Status:** Complete - `3998be6`
**Depends on:** Phase 2

### Codebase state assumed at start

- `Replan.tsx` contains private demonstrated-throughput and capacity-finish helpers.
- The modal can receive optional current-roadmap scenario inputs.

### Steps

1. Extract `PaceDeltaMinutes`, `CapacityScenarioInput`, `CapacityScenarioResult`, throughput calculation, study-day filtering, finish calculation, and normalized cumulative chart points into `capacityScenario.ts`.
2. Preserve Replan's current capacity assumptions.
3. Plot a separate moss dashed scenario beginning at Today's actual cumulative value and ending at the final planned cumulative value on the capacity-model finish date.
4. Default the slider to zero and support only the five locked increments.
5. Disable the scenario UI with a concise explanation when capacity inputs are unavailable.
6. Hide all scenario UI in historical mode.
7. Navigate to `/replan?paceDeltaMinutes=N` from the modal.
8. Validate Replan's query value and fall back to zero when invalid.
9. During one-time active-roadmap hydration, initialize hours per day to current hours plus the query delta converted to hours.
10. Ensure the initial Replan finish exactly matches the modal scenario finish.

### Tests

- Capacity finish calculations.
- Active study-day filtering.
- Demonstrated-throughput adjustment.
- Zero remaining work.
- Invalid capacity input.
- Replan query validation and hydration.
- Exact modal and Replan finish parity.

### Verification

```bash
pnpm --filter @study-tracker/app test -- ProgressLab Replan capacityScenario
pnpm --filter @study-tracker/app typecheck
pnpm --filter @study-tracker/app lint
```

## Phase 4: Integrate and visually verify

**Status:** Complete - `f0cc209`
**Depends on:** Phase 3

### Codebase state assumed at start

- The chart card exposes an opener contract.
- The modal supports inspection and optional scenario inputs.
- Replan consumes the shared capacity model and validated pace query.

### Steps

1. Update `Week.tsx` to own modal open state, opener focus restoration, week bounds, historical mode, and active-roadmap scenario inputs.
2. Extend `Week.test.tsx` for current and historical modal behavior.
3. Add `e2e/week-progress-lab.spec.ts` using the existing authenticated dev seeder.
4. Keep viewport changes inside the spec.
5. Capture and manually inspect 1440x900, 1024x600, and 390x844 screenshots.
6. Verify the card cue, axes, summaries, ranges, layer controls, scenario, Replan parity, historical mode, dismissal behavior, focus restoration, no-overflow contract, and absence of browser console or page errors.

### Verification

```bash
pnpm --filter @study-tracker/app test -- BurnUpChart ProgressLab Week Replan capacityScenario
pnpm --filter @study-tracker/app typecheck
pnpm --filter @study-tracker/app lint
pnpm typecheck
pnpm lint
pnpm exec playwright test -c e2e/playwright.config.ts e2e/week-progress-lab.spec.ts --project=app
```

## Assumptions and locked defaults

- The approved mock and `.work/active/week-chart-modal/mocks/DECISIONS.md` are the visual source of truth.
- All three optional chart layers open enabled.
- Pace delta starts at zero and is not persisted inside the modal.
- The 30-day range is anchored seven days before the reference date and 22 days after it.
- Historical weeks remain inspection-only.
- No progress-package types, database schema, event shape, or synchronization behavior changes.
- Existing Week fallback content remains unchanged when chart data is insufficient.

## Out of scope

- Arbitrary chart zooming or a continuous timeline scrubber.
- Persisting modal state or pace selections.
- Writing roadmap events from the modal.
- Changing GP, calibration, progress, synchronization, or event-domain contracts.
- Enabling scenarios for historical weeks.

## References

- `.work/active/week-chart-modal/mocks/baseline.html`
- `.work/active/week-chart-modal/mocks/DECISIONS.md`
- `.agents/rules/react-router-v7-basename.agents.md`
- `.agents/rules/playwright-config.agents.md`
- `.agents/rules/roadmap-engine.agents.md`
