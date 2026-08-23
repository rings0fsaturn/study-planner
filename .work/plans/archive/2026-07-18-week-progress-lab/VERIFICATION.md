# Week Progress Lab verification

**Plan:** `.work/plans/active/2026-07-18-week-progress-lab/PLAN.md`
**Overall status:** Complete - all four phases verified
**Last updated:** 2026-07-18

## Phase 1 - Chart refactor and deterministic axes

### Acceptance criteria

- [x] The default Week card remains visually equivalent to the existing burn-up card.
- [x] Existing empty-state and minimum-data behavior remains unchanged.
- [x] The entire meaningful-data card is a semantic dialog opener with the quiet hover and focus cue.
- [x] The plot is reusable by both the card and modal.
- [x] Every visible actual point has an aligned X-axis tick.
- [x] Wide views label visible actual dates with deterministic staggering when needed.
- [x] Compact long-range views retain first and last labels plus intermediate minor ticks.
- [x] This week labels every visible checkpoint date.
- [x] The complete cumulative-hours Y axis retains its computed upper bound.
- [x] Non-interactive SVG paths do not intercept pointer events.
- [x] Pure helpers cover domains, ticks, interpolation, gaps, summaries, and layer visibility.

### Implementer report

- Status: Verified
- Files changed: `apps/app/src/components/BurnUpChart.tsx`, `apps/app/src/components/BurnUpChart.test.tsx`
- Commit SHA: `eeaee51`
- Commands and results: Initial `pnpm --filter @study-tracker/app test -- BurnUpChart` baseline passed 535 tests.
  The RED run `pnpm --filter @study-tracker/app exec vitest run src/components/BurnUpChart.test.tsx` failed 5 of 13 tests on the absent interfaces.
  The final focused run passed 13 of 13 tests.
  `pnpm --filter @study-tracker/app typecheck` passed.
- Screenshot evidence: `screenshots/phase1-default-card.png` captured from the live `/study/chart-test` route at 980x760.
  Automated geometry inspection reported zero label collisions, zero console or page errors, and no body overflow.
- Deviations and reason: None.
- Self-check: The exported `BurnUpPlot` is responsive and the existing `BurnUpChart` card retains its header, 280px plot, footer, empty state, palette, and complete computed Y range.

### Reviewer findings

- Status: Verified
- Criterion verdicts: All Phase 1 criteria pass by focused tests, app typecheck, live browser geometry, and manual screenshot inspection.
- Issues and required changes: None.

### Resolution

- Phase 1 accepted for the next dependent phase.

## Phase 2 - Viewport-fit inspection modal

### Acceptance criteria

- [x] The modal renders through a `document.body` portal with an accessible title and description.
- [x] Full plan, 30 days, and This week ranges use the locked domains.
- [x] Planned, GP projection, and confidence controls are independent pressed-state controls.
- [x] Actual progress and the reference marker cannot be disabled.
- [x] Visible checkpoints work with pointer, Enter, and Space.
- [x] Selection adds a ring and a deterministic date, actual, plan, signed-gap, and interpretation summary.
- [x] Selection clears when a new range excludes the selected point.
- [x] Close, backdrop, Escape, focus trap, scroll lock, and opener focus restoration work.
- [x] Reduced-motion preferences are respected.
- [x] Desktop, compact-width, and short-height layouts fit without document, overlay, dialog, chart-region, or rail scrolling.

### Implementer report

- Status: Verified
- Files changed: `apps/app/src/components/ProgressLabModal.tsx`, `apps/app/src/components/ProgressLabModal.css`, `apps/app/src/components/ProgressLabModal.test.tsx`
- Commit SHA: `a932df1`
- Commands and results: The initial focused run failed because `ProgressLabModal.tsx` did not exist.
  The final focused run passed 18 of 18 BurnUpChart and ProgressLab tests.
  `pnpm --filter @study-tracker/app typecheck` passed.
  `pnpm --filter @study-tracker/app lint` exited zero with the same four pre-existing YouTube adapter warnings.
- Screenshot evidence: `screenshots/phase2-desktop.png`, `screenshots/phase2-short.png`, and `screenshots/phase2-phone.png` were captured from a live Vite portal mount at 1440x900, 1024x600, and 390x844.
  Automated geometry reported zero overflow for the document, overlay, shell, body, chart stage, and rail at every viewport.
  Browser console and page errors were zero.
- Deviations and reason: The portal was mounted directly through Vite for Phase 2 visual isolation because Week integration is intentionally deferred to Phase 4.
- Self-check: The UI follows the approved Marginalia mock, keeps the desktop rail visible, moves controls below the chart at compact widths, and compresses safely for short heights.

### Reviewer findings

- Status: Verified
- Criterion verdicts: All Phase 2 criteria pass by focused tests, typecheck, lint, three live screenshots, automated overflow geometry, and manual visual inspection.
- Issues and required changes: None.

### Resolution

- Phase 2 accepted for the next dependent phase.

## Phase 3 - Shared capacity scenario and Replan hydration

### Acceptance criteria

- [x] The demonstrated-throughput and capacity-finish logic is shared from `capacityScenario.ts`.
- [x] The shared model uses active roadmap study days, `weekdayHours`, remaining material minutes, demonstrated throughput, and the selected pace delta.
- [x] The result includes finish date and normalized cumulative chart points.
- [x] Zero pace shows current capacity finish without a moss scenario line.
- [x] Supported deltas are exactly `0`, `15`, `30`, `45`, and `60`.
- [x] The moss scenario begins at Today's actual cumulative value and reaches final planned cumulative value on the shared finish date.
- [x] Missing capacity inputs disable the scenario UI without breaking chart inspection.
- [x] Historical mode hides every scenario affordance.
- [x] The modal navigates to `/replan?paceDeltaMinutes=N` without `/study`.
- [x] Invalid Replan query values fall back to zero.
- [x] One-time Replan hydration adds the query delta to the current per-study-day hours.
- [x] The initial Replan finish exactly matches the modal scenario finish.
- [x] The modal writes no roadmap events.

### Implementer report

- Status: Verified
- Files changed: `BurnUpChart.tsx`, `ProgressLabModal.tsx`, `ProgressLabModal.css`, `ProgressLabModal.test.tsx`, `Replan.tsx`, `Replan.test.tsx`, `capacityScenario.ts`, and `capacityScenario.test.ts`.
- Commit SHA: `3998be6`
- Commands and results: 36 focused tests passed across the chart, modal, Replan, and capacity model; app typecheck passed; app lint exited 0 with four pre-existing YouTube adapter warnings.
- Screenshot evidence: Deferred to the real Week route in Phase 4 after the isolated Chromium harness exposed a Vite module-mount limitation.
- Deviations and reason: The planned visual evidence is consolidated into Phase 4 so it exercises the real route and current roadmap inputs.
- Self-check: All Phase 3 criteria pass through focused tests and shared-helper parity assertions.

### Reviewer findings

- Status: Verified
- Criterion verdicts: All Phase 3 criteria pass.
- Issues and required changes: None.

### Resolution

- Phase 3 accepted for Week integration.

## Phase 4 - Week integration and visual acceptance

### Acceptance criteria

- [x] `Week.tsx` owns modal state, opener focus restoration, week bounds, historical mode, and active-roadmap scenario inputs.
- [x] Current-week component tests cover modal inspection and scenario behavior.
- [x] Historical component tests cover Week end and inspection-only behavior.
- [x] The focused E2E spec uses the existing authenticated dev seeder.
- [x] 1440x900 desktop screenshot is manually inspected.
- [x] 1024x600 short-viewport screenshot is manually inspected.
- [x] 390x844 phone screenshot is manually inspected.
- [x] Complete X and Y axes are readable at all required viewports.
- [x] Pace scenario and Replan prefill finish are identical.
- [x] Escape and backdrop dismissal restore focus to the opener.
- [x] Document, overlay, dialog, chart region, and control rail have no overflow.
- [x] The browser reports no console or page errors.
- [x] All focused, app-wide, and repo-wide verification commands pass.

### Implementer report

- Status: Verified
- Files changed: `Week.tsx`, `Week.test.tsx`, `BurnUpChart.tsx`, `ProgressLabModal.tsx`, `ProgressLabModal.css`, `ProgressLabModal.test.tsx`, `e2e/week-progress-lab.spec.ts`, `loadYouTubeApi.ts`, and `YouTubePlayerAdapter.test.ts`.
- Commit SHA: `f0cc209`
- Commands and results: The requested app test command passed all 555 tests in 62 files; app and repository typechecks passed; app and repository lint passed with zero warnings; the focused authenticated Playwright spec passed.
- Screenshot evidence: `screenshots/final-desktop.png`, `screenshots/final-short.png`, and `screenshots/final-phone.png`.
- Deviations and reason: The E2E historical check uses seed Week 2 because seed Week 1 contains only one eligible checkpoint and correctly retains the existing minimum-data fallback.
- Self-check: All Phase 4 criteria pass by component tests, the seeded current and historical E2E flow, automated overflow and SVG-label bounds, Replan finish parity, and manual screenshot inspection.

### Reviewer findings

- Status: Verified
- Criterion verdicts: All Phase 4 criteria pass.
- Issues and required changes: None.

### Resolution

- Phase 4 and the complete plan are accepted.

## Running log

- 2026-07-18: Canonical plan and prefilled verification artifact created from the approved Week Progress Lab plan.
- 2026-07-18: Phase 1 completed with reusable chart helpers, deterministic observed-date axes, whole-card opener semantics, focused tests, clean typecheck, and a collision-free live card screenshot.
- 2026-07-18: Phase 2 completed with the body portal, fixed ranges, optional layers, keyboard and pointer checkpoint summaries, focus and dismissal behavior, scroll lock, responsive CSS, 18 focused passing tests, and zero-overflow browser evidence at all required viewports.
- 2026-07-18: Phase 3 completed in `3998be6` with a shared capacity model, validated pace increments, current-week scenario controls, historical suppression, Replan query hydration, and exact finish parity.
- 2026-07-18: Phase 4 completed in `f0cc209` with Week integration, current and historical component coverage, seeded E2E acceptance, three manually inspected screenshots, zero-overflow geometry, full-axis label bounds, focus restoration, Replan parity, 555 passing app tests, and clean repository checks.
- Complete: all four phases are verified.
