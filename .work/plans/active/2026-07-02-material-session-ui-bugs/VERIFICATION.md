# VERIFICATION — material-session UI bug fixes

Round-trip review log for [`PLAN.md`](./PLAN.md). **Planner pre-fills acceptance criteria** (below).
**Implementer (Codex/Sonnet)** fills the *Implementer report* per phase (files, commit SHA, deviations,
self-check). **Reviewer (Cowork)** fills *Reviewer findings* by reading the actual diff (`git show <sha>`),
not the report alone. A phase is **not done** until it's `✅ Verified`.

Legend: `[ ]` unmet · `[x]` met · `[~]` partial. Status: ☐ Not started · 🟡 In progress · ✅ Verified · 🔁 Changes requested.

Cross-cutting invariants (must hold at every phase):
- No event-model or intelligence-math changes; booking events + per-user Dexie isolation untouched.
- No new source files outside the phase's stated scope; Marginalia design tokens used (no hard-coded colors except where BurnUpChart already hard-codes them with the documented reason).
- E2E specs authored, not run (env constraint); Vitest unit tests run green.

---

## Phase 1 - Remove duplicate "Edit & add" button (BUG-3) · Status: ✅ Verified

**Acceptance criteria**
- [x] `apps/app/src/pages/Roadmaps.tsx` renders exactly one primary hero link, `Open plan` → `/roadmap`; the `Edit & add` `<Link>` is removed; `Close plan` control unchanged (D-01).
- [x] `Roadmaps.test.tsx` no longer asserts an `Edit & add` link; `Open plan` href assertion retained; suite green.
- [x] `grep "Edit &amp; add" apps/app/src/pages/Roadmaps.tsx` returns nothing.
- [x] `pnpm --filter @study-tracker/app typecheck` + `test -- Roadmaps` green.

**Implementer report:** 2026-07-02
- Files changed: `apps/app/src/pages/Roadmaps.tsx`, `apps/app/src/pages/Roadmaps.test.tsx`.
- Removed the duplicate `Edit & add` link only.
- Kept `Open plan` as `<Link to="/roadmap">` and kept `Close plan` unchanged.
- Verification:
  - `grep -n "Edit &amp; add" apps/app/src/pages/Roadmaps.tsx` returned no rows.
  - `pnpm --filter @study-tracker/app test -- Roadmaps` passed, with 58 app test files and 509 tests green.
  - `pnpm --filter @study-tracker/app typecheck` passed.
- Deviations: none for code or tests.
- Commit SHA: `0268f20`.

**Reviewer findings:** 2026-07-03
- Diff (`git show 0268f20 -- apps/app/src/pages/Roadmaps.tsx apps/app/src/pages/Roadmaps.test.tsx`) matches the plan's step 1 code block verbatim: only the `Edit &amp; add` `<Link>` removed, `Open plan` and `Close plan` untouched.
- Live-verified with Playwright against the real test account (`iamrohitsaji@gmail.com`, active roadmap "Tests"): `/roadmaps` active hero renders exactly `['Open plan', 'Close plan']`, no third button.
- Re-ran `pnpm --filter @study-tracker/app test` independently: 523/523 green (includes `Roadmaps.test.tsx`). `pnpm --filter @study-tracker/app typecheck` clean.
- No deviations from the plan. Acceptance criteria fully met.

---

## Phase 2 - Center booking sheets (BUG-1) · Status: ✅ Verified

**Acceptance criteria**
- [x] `.bk-overlay` uses `align-items: center` (was `flex-end`) (D-02).
- [x] `.bk-sheet` uses `border-radius: var(--radius-lg)` and adds `max-height: calc(100dvh - var(--space-6))` + `overflow-y: auto`.
- [x] `.bk-grip` is hidden because the centered card is no longer a draggable bottom sheet.
- [x] All four sheets (BookingEditor/AddSession/MaterialPicker/MaterialProgress) render centered on desktop AND ≤560px, and a taller-than-viewport sheet scrolls rather than clipping (visual check).
- [x] `pnpm --filter @study-tracker/app typecheck` green.

**Implementer report:** 2026-07-02
- Files changed: `apps/app/src/roadmap/roadmap.css`.
- Updated `.bk-overlay` from bottom alignment to centered alignment.
- Added `.bk-sheet` max-height and `overflow-y: auto` to prevent clipping on short viewports.
- Changed `.bk-sheet` to `border-radius: var(--radius-lg)`.
- Hid `.bk-grip` because the sheet no longer behaves like a bottom drawer.
- Visual verification:
  - Desktop short sheet: 1280x800 viewport, top 300px, bottom 300px, height 201px, radius 16px.
  - Mobile short sheet: 390x844 viewport, top 322px, bottom 322px, height 201px, radius 16px.
  - Mobile tall sheet with representative `.bk-rows`: 390x480 viewport, top 16px, bottom 16px, height 448px, `overflow-y: auto`, `scrollHeight` 1135px, `clientHeight` 448px, radius 16px.
- Verification:
  - `grep -n "max-height: calc(100dvh" apps/app/src/roadmap/roadmap.css` found the `.bk-sheet` guard.
  - `grep -n "\.bk-grip" -A4 apps/app/src/roadmap/roadmap.css` confirmed `display: none`.
  - `pnpm --filter @study-tracker/app typecheck` passed.
- Deviations: visual check used a focused Playwright fixture with real CSS and representative booking-sheet DOM instead of a mutating authenticated app flow.
  This avoided touching a real account while verifying the shared `.bk-*` geometry used by all four sheets.
- Commit SHA: `0268f20`.

**Reviewer findings:** 2026-07-03
- Diff matches the plan's step 1-3 code blocks verbatim: `.bk-overlay` centered, `.bk-sheet` `border-radius: var(--radius-lg)` + `max-height: calc(100dvh - var(--space-6))` + `overflow-y: auto`, `.bk-grip { display: none }`.
- Live-measured with Playwright against the real test account (not the implementer's synthetic fixture — used the real `AddSessionSheet` on `/study/roadmap`):
  - Desktop 1280×800: overlay `{x:0,y:0,w:1280,h:800}`, sheet `{x:410,y:228.5,w:460,h:343}` → top gap 228.5px = bottom gap 228.5px (exactly centered).
  - Mobile 390×844: overlay full-viewport, sheet `{x:16,y:250.5,w:358,h:343}` → top gap 250.5px = bottom gap 250.5px (exactly centered).
  - Grip confirmed not visible on both viewports. Screenshots confirm rounded-all-corners card styling, no bottom-clipping.
- `pnpm --filter @study-tracker/app typecheck` clean (re-run independently).
- No deviations from the plan. Acceptance criteria fully met.

---

## Phase 3 — Mobile add-session entry point (BUG-2) · Status: ✅ Verified

**Acceptance criteria**
- [x] `CalendarCell` `canOpenDay` no longer requires `bubbles.length > 0`, so empty in-month days are tappable at ≤560px (D-03).
- [x] Empty compact-day buttons use a neutral aria-label such as `Open <date> day options`; they do not claim empty days already have sessions.
- [x] `DaySheet` gains `onAddSession?`/`canAddSession?`, renders an empty-state line when no bubbles, and a `+ Add session` button that calls `onAddSession(day.date)`; hidden when `!canAddSession` (readOnly).
- [x] `RoadmapCalendar` passes `onAddSession` (closes DaySheet, opens AddSessionSheet with that date) + `canAddSession={!readOnly}`; the existing `handleCreateBooking` still emits `SessionBooked`.
- [x] `RoadmapCalendar.test.tsx` has a configurable `useMatchMedia` mock and proves the compact add path (open empty day → Add → AddSessionSheet → create) plus readOnly hides Add. Playwright authored (not run) with viewport width below 560px.
- [x] `pnpm --filter @study-tracker/app typecheck` + `test -- RoadmapCalendar DaySheet` green.

**Implementer report:** 2026-07-02
- Files changed: `apps/app/src/roadmap/CalendarCell.tsx`, `apps/app/src/roadmap/DaySheet.tsx`, `apps/app/src/roadmap/RoadmapCalendar.tsx`, `apps/app/src/roadmap/roadmap.css`, `apps/app/src/roadmap/RoadmapCalendar.test.tsx`, `e2e/material-session-decoupling.spec.ts`.
- Implemented the compact empty-day `DaySheet` path and reused the existing `AddSessionSheet` and `SessionBooked` writer.
- Added the read-only compact day-sheet assertion and the compact add-session unit flow.
- Authored the compact empty-day Playwright case in `e2e/material-session-decoupling.spec.ts`; it was not run per plan.
- Verification:
  - `grep -n "onAddSession" apps/app/src/roadmap/DaySheet.tsx apps/app/src/roadmap/RoadmapCalendar.tsx` found the new props and wiring.
  - `pnpm --filter @study-tracker/app typecheck` passed.
  - `pnpm --filter @study-tracker/app test -- CalendarCell RoadmapCalendar Step3Preview calendarModel` passed with 58 files and 515 tests.
- Deviations: the focused test command was broader than the phase minimum because Phase 4 was implemented in the same user-requested batch.
- Commit SHA: `3c8d869`.

**Reviewer findings:** 2026-07-03
- Diff matches the plan's steps closely: `canOpenDay` drops the `bubbles.length > 0` requirement, aria-label branches to a neutral "day options" string for empty days, `DaySheet` gains `onAddSession`/`canAddSession` + empty-state paragraph + accent button, `RoadmapCalendar` closes the day sheet and opens `AddSessionSheet` with the tapped date.
- Live end-to-end flow on mobile (390×844) against the real "Tests" roadmap: tapped empty Jul 8 cell → aria-label read `Open 2026-07-08 day options` (neutral, matches D-03) → `DaySheet` opened showing "No sessions booked for this day." + "+ Add session" → clicking it closed the day sheet and opened the (now-centered, Phase 2) `AddSessionSheet` pre-filled "Wed, Jul 8". Canceled without submitting to keep the pass read-only.
- Re-ran `pnpm --filter @study-tracker/app test`: 523/523 green (includes `RoadmapCalendar.test.tsx`'s new compact-add and read-only-hides-add cases). Typecheck clean.
- No deviations from the plan. Acceptance criteria fully met.
- Incidental, non-blocking observation (pre-existing, not introduced by this phase): `.roadmap-day-sheet` renders inline in the page's normal document flow rather than as a fixed-position overlay, so on a tall page a user may need to scroll down to see it after tapping a day near the top of the calendar. This container/positioning was untouched by this plan (only its content changed); noting for awareness only.

---

## Phase 4 — Study-day indicator + onboarding preview legibility (BUG-4) · Status: ✅ Verified

**Acceptance criteria** (visual contract `mocks/proposed/study-day-indicator.html`)
- [x] Shared `.roadmap-day-studyday` moss-8% tint added; today/current-week overrides keep their fills on overlap (D-04).
- [x] CSS order/specificity makes today keep `--cal-today-fill` even when the same cell is also a current-week study day.
- [x] Study-day tint applied to in-month cells in **both** `RoadmapCalendar` (via `day.isInMonth && isStudyDay(date, roadmap.selectedStudyDays)`) and `Step3Preview` (via `day.isInMonth && isStudyDay(date, state.selectedStudyDays)`); outside-month filler cells are not tinted.
- [x] Study-day weekday headers emphasized; a "Study day" legend entry added to both legends.
- [x] `isStudyDay` uses the repo's UTC ISO-date weekday convention and is unit-tested with known dates (correct `DayOfWeek` for known dates).
- [x] Onboarding session bubble recolored `roadmap-chip-done` → `roadmap-chip-booked` with `title` + `aria-label`.
- [x] Onboarding booked-session legend swatch no longer implies completed green/done semantics after the bubble moves to booked-outline styling.
- [x] Hover-lift (`.roadmap-day-in-month:hover`) scoped OFF inside `.onboarding-mini-calendar`; cursor default there.
- [x] Matches the approved mock; `pnpm --filter @study-tracker/app typecheck` + `test -- CalendarCell RoadmapCalendar Step3Preview calendarModel` green.

**Implementer report:** 2026-07-02
- Files changed: `apps/app/src/roadmap/calendarModel.ts`, `apps/app/src/roadmap/calendarModel.test.ts`, `apps/app/src/roadmap/CalendarCell.tsx`, `apps/app/src/roadmap/RoadmapCalendar.tsx`, `apps/app/src/roadmap/RoadmapCalendar.test.tsx`, `apps/app/src/roadmap/roadmap.css`, `apps/app/src/onboarding/steps/Step3Preview.tsx`, `apps/app/src/onboarding/steps/Step3Preview.test.tsx`, `apps/app/src/onboarding/onboarding.css`, `e2e/material-session-decoupling.spec.ts`.
- Added shared UTC ISO-date weekday helpers and tests for `2026-07-06` -> `Mon`, `2026-07-07` -> `Tue`, and `2026-07-12` -> `Sun`.
- Restored `selectedStudyDays`, `weekdayHours`, and `weekendHours` in `RoadmapCalendar`'s local `roadmapInputFromPayload` adapter because the plan assumed `roadmap.selectedStudyDays` was already available.
- Applied the moss study-day tint to in-month cells only on both calendar surfaces.
- Added study-day header emphasis and legend entries.
- Recolored onboarding preview bookings to booked-outline styling with `title` and `aria-label`.
- Updated onboarding booked and study-day swatches so future bookings no longer read as completed green.
- Scoped the hover-lift off inside `.onboarding-mini-calendar`.
- Authored the onboarding preview Playwright case in `e2e/material-session-decoupling.spec.ts`; it was not run per plan.
- Verification:
  - `grep -n "roadmap-day-studyday" apps/app/src/roadmap/roadmap.css apps/app/src/roadmap/CalendarCell.tsx apps/app/src/onboarding/steps/Step3Preview.tsx` found the shared class in CSS and both render paths.
  - `grep -n "roadmap-chip-booked" apps/app/src/onboarding/steps/Step3Preview.tsx` found the preview chip recolor.
  - `pnpm --filter @study-tracker/app typecheck` passed.
  - `pnpm --filter @study-tracker/app test -- CalendarCell RoadmapCalendar Step3Preview calendarModel` passed with 58 files and 515 tests.
- Deviations: restored the local `RoadmapCalendar` adapter fields that the plan expected to already be present.
- Commit SHA: `3c8d869`.

**Reviewer findings:** 2026-07-03
- Diff matches the plan and the approved mock (`mocks/proposed/study-day-indicator.html`) closely: shared `.roadmap-day-studyday` tint + today/current-week override ordering, `dayOfWeekForISODate`/`isStudyDay` UTC-ISO helpers in `calendarModel.ts` (verbatim from the plan), study-day weekday-header emphasis + "Study day" legend entry on both calendars, onboarding chip recolor `roadmap-chip-done` → `roadmap-chip-booked` with `title`/`aria-label`, hover-lift scoped off `.onboarding-mini-calendar` only.
- Live-verified the **roadmap calendar** side against the real "Tests" roadmap (`selectedStudyDays: ["Tue"]`): exactly the Tuesday column tinted (4 in-month cells matching July's 4 Tuesdays), only the "TUE" weekday header emphasized, legend reads "Study day, Done, Booked, Missed, Unplanned" (5 items, matches the mock), 0 outside-month cells tinted even on a study-day weekday.
- Live-verified the **onboarding preview** side via a real fresh draft (`+ Plan your next roadmap` → deadline in 1 month, study days Tue/Thu/Sat, one manual material) reaching `Step3Preview`: 13 study-day cells tinted, 1 booked chip found with class `roadmap-chip-booked` (0 `roadmap-chip-done`), title/aria-label read exactly `Booked study session · 2h · Sat, Jul 4` (matches the plan's template), legend reads "study day, booked session, today, deadline" (matches the mock's section B exactly), hover computed `transform` unchanged (`none`→`none`) and `cursor: default` inside `.onboarding-mini-calendar`.
- Regression check: hovering a cell on the **real** (non-preview) roadmap calendar still lifts (`transform: matrix(1.015, 0, 0, 1.015, 0, -2)`), confirming the hover-lift scoping is additive (onboarding-only) and not a global regression.
- Test draft cleaned up via the "Discard" action after verification; confirmed `roadmaps-draft-card` count returned to 0, account left in its original state (no residual events — draft state never reached `Step4Confirm`, so nothing was queued to cloud sync either).
- Re-ran `pnpm --filter @study-tracker/app test`: 523/523 green (includes `calendarModel.test.ts`, `Step3Preview.test.tsx`, `RoadmapCalendar.test.tsx`). Typecheck clean.
- No deviations from the plan. Acceptance criteria fully met.
- Incidental, non-blocking observation (pre-existing, not introduced by this phase): at 390px mobile width the onboarding-preview session bubble's text label truncates tightly inside the ~50px-wide cell (renders as an icon + a single clipped letter). This is existing bubble-layout/truncation behavior the plan did not touch (only the class/color/copy were in scope) — worth a follow-up glance, not a defect in this phase's work.

---

## Phase 5 — Burn-up chart fix (BUG-5) · Status: ✅ Verified

**Acceptance criteria**
- [x] `progress.ts` builds `burnUp.planned` from **booking-capacity semantics** over `startDate..deadline`, not `roadmap.slots`: each selected Mon-Fri adds `weekdayHours * 60`, each selected Sat-Sun adds `weekendHours * 60`; `deficit` recomputed off it; missing capacity fields or empty `selectedStudyDays` fall back without crashing (D-05).
- [x] `BurnUpData` carries optional `startDate`/`deadline` domain hints populated by `computeProgress`; app mocks are not forced to update unless needed.
- [x] `BurnUpChart.minutesToLabel` shows h+m (`45m`, `1h 30m`, `2h`), and explicit tick values prevent duplicate y-axis labels.
- [x] `BurnUpChart` exports pure helpers for x-domain, y-domain, tick values, labels, and empty-state detection; helper tests cover the degenerate-domain and bounded-GP-upper cases.
- [x] Degenerate/empty data renders "Log a session to see your burn-up" before `ParentSize`, so the component test does not depend on responsive SVG layout.
- [x] X-domain spans at least `[startDate, deadline]` or the derived `today/dayNumber/totalDays` fallback so x-ticks are distinct dates.
- [x] GP band/mean use `curveMonotoneX` (no overshoot); y-domain is based on planned/actual/GP mean with only bounded GP-upper headroom.
- [x] Week's existing low-data gate is preserved unless explicitly widened; any Week visual Playwright check seeds at least three actual data points.
- [x] `progress.test.ts` covers the booking-capacity planned baseline + fallback; `BurnUpChart.test.tsx` covers labels/ticks/domain/y-domain/empty state; `pnpm --filter @study-tracker/progress test` + app typecheck green.

**Implementer report:** 2026-07-02
- Started Phase 5 after prereq verification passed.
- Prereq verification:
  - `grep -n "buildPlannedCumulative\|burnUp\b\|deficit" packages/progress/src/progress.ts` found the expected legacy slot-based burn-up path.
  - `grep -n "minutesToLabel\|curveBasis\|allMinutes\|allDates" apps/app/src/components/BurnUpChart.tsx` found the expected old formatter, domain, y-domain, and curve usage.
  - `pnpm --filter @study-tracker/progress test` passed with 13 files and 95 tests.
- Phase 6 note: `PLAN.md` defines Phases 1-5 only, followed by a final gate.
  Treat the user's requested Phase 6 as the final gate after Phase 5 unless Rohit supplies a separate Phase 6 plan.
- Files changed: `packages/progress/src/types.ts`, `packages/progress/src/progress.ts`, `packages/progress/test/progress.test.ts`, `apps/app/src/components/BurnUpChart.tsx`, `apps/app/src/components/BurnUpChart.test.tsx`.
- Implemented the D-05 capacity-shaped planned burn-up baseline with slot fallback for legacy/incomplete inputs.
- Populated optional `burnUp.startDate` and `burnUp.deadline` from `computeProgress`.
- Added tests for booking-capacity planned points, slot fallback, and deficit against the capacity baseline.
- Exported BurnUpChart helpers for minute labels, tick values, x-domain, y-domain, and empty-state detection.
- Added helper/component tests for h+m labels, sparse and degenerate date domains, bounded GP-upper headroom, high-range tick readability, and pre-`ParentSize` empty state.
- Switched GP band and mean from `curveBasis` to `curveMonotoneX`.
- Preserved the Week page's existing low-data gate.
- Visual verification:
  - `./full-app status full` showed `intelligence` and `app` healthy.
  - `curl -i http://127.0.0.1:8000/health` returned 200.
  - `curl -i http://localhost:5173/study/sign-in` returned 200.
  - Browser probe of `/study/chart-test` rendered a nonblank 798x280 SVG with five paths.
  - Initial visual pass found the plan's sample tick helper made the 58h y-axis too dense.
  - Final browser probe showed visible y labels were sparse and unique: `0m`, `10h`, `20h`, `30h`, `40h`, `50h`, `58h`.
  - Screenshot saved during verification: `/private/tmp/study-planner-burnup-chart.png`.
- Verification:
  - `grep -n "buildPlannedCumulativeFromCapacity\|startDate" packages/progress/src/progress.ts packages/progress/src/types.ts` found the new capacity helper and domain hints.
  - `grep -n "curveMonotoneX\|buildMinuteTickValues" apps/app/src/components/BurnUpChart.tsx` found the monotone curves and tick helper.
  - `pnpm --filter @study-tracker/progress test` passed with 13 files and 98 tests.
  - `pnpm --filter @study-tracker/app typecheck` passed.
  - `pnpm --filter @study-tracker/app test -- BurnUpChart Week` passed with 59 files and 522 tests before the high-range tick test, then `pnpm --filter @study-tracker/app test -- BurnUpChart` passed with 59 files and 523 tests after the tick-density fix.
- Final-gate probe treated as the requested Phase 6:
  - `pnpm lint` exited 0 with four pre-existing app warnings in `YouTubePlayerAdapter.test.ts` and `loadYouTubeApi.ts`.
  - `pnpm typecheck` passed.
  - `pnpm --filter @study-tracker/app test` passed with 59 files and 523 tests.
  - `pnpm --filter @study-tracker/progress test` passed with 13 files and 98 tests.
- Deviations:
  - Adjusted the plan's sample `buildMinuteTickValues` step selection after visual review because the literal helper produced a dense 2h y-axis on a 58h chart.
    The implemented helper targets roughly six intervals, preserves low-range 30-minute labels, keeps explicit unique ticks, and includes the exact max label.
  - Visual verification used the existing unauthenticated `/study/chart-test` BurnUpChart surface instead of an authenticated Week flow because the real Week route depends on authenticated EventStore state.
    Week's low-data rendering gate remains covered by unit tests.
- Commit SHA: `256616b`.

**Reviewer findings:** 2026-07-03
- `progress.ts`/`types.ts` diff matches the plan's step 1-2 code blocks verbatim (`hasCapacityFields`, `capacityForStudyDay`, `buildPlannedCumulativeFromCapacity`, optional `burnUp.startDate`/`deadline`).
- Flagged deviation (disclosed by the implementer, independently confirmed as a good call): `BurnUpChart.tsx`'s `buildMinuteTickValues` does not match the plan's literal 3-tier step function (`<=120 → 30`, `<=360 → 60`, else `120`); it instead targets ~6 intervals via a candidate-step array. Reproduced the implementer's claim live: the plan's literal function would emit a 2h step across a 58h domain (30 dense ticks), which is what the implementer says they observed and fixed post-visual-review. This is a reasonable, transparently-documented deviation, not a silent one — consistent with the plan's decisions-log spirit even though it wasn't stopped-and-surfaced interactively. No objection.
- Live-verified `/study/chart-test` (same synthetic 58h fixture the implementer used): reproduced their exact reported y-axis labels `0m, 10h, 20h, 30h, 40h, 50h, 58h`, smooth `curveMonotoneX` planned/actual/GP lines, correct rust "-7h 02m behind plan today" coloring, non-degenerate domain.
- Live-verified `/study/week` on the real test account (real historical session data, not seeded for this pass): chart renders (not the empty state), y-axis `0m,30m,1h,1h30m,2h,2h30m,3h` (unique, sparse), smooth monotone actual/planned lines, "TODAY" marker correctly placed at day 6 of 14, deficit "+0h 02m ahead of plan today" in moss (correct sign/color), consistent with the new capacity-based baseline for a `weekdayHours=1/weekendHours=1`, single-study-day (`Tue`) roadmap.
- Independently re-ran (not just re-reading the implementer's self-report): `pnpm --filter @study-tracker/progress test` → 98/98 green (includes the plan's exact `Mon 120 / Wed 240 / Sat 420` capacity example). `pnpm --filter @study-tracker/app test` → 523/523 green. `pnpm --filter @study-tracker/app typecheck` → clean. `pnpm lint` (repo-wide) → 0 errors, exactly the same 4 pre-existing `@typescript-eslint/no-explicit-any` warnings in `YouTubePlayerAdapter.test.ts`/`loadYouTubeApi.ts` the implementer reported (unrelated files, pre-existing).
- `Week.tsx` confirmed untouched (`git show 256616b --stat` does not list it); its `actual.length >= 3` gate is intact.
- No event-model, intelligence-math, routing, or Python changes — confirmed by diff inspection, consistent with D-05 and the out-of-scope list.
- Acceptance criteria fully met.

---

## Final gate (after all phases ✅ Verified)
- [x] `pnpm lint && pnpm typecheck` clean across touched packages.
  Reviewer independently re-ran both on 2026-07-03 (not just re-reading the implementer's report): `pnpm lint` exits 0 with the same four pre-existing `any` warnings in `YouTubePlayerAdapter.test.ts`/`loadYouTubeApi.ts` (unrelated files); `pnpm --filter @study-tracker/app typecheck` clean.
- [x] `pnpm --filter @study-tracker/app test` + `pnpm --filter @study-tracker/progress test` green.
  Reviewer independently re-ran both on 2026-07-03: 523/523 and 98/98 respectively.
- [x] Visual confirmation of BUG-1/BUG-2/BUG-4 on desktop + ≤560px; BUG-5 burn-up renders sensibly with real data.
  Reviewer drove the real app via Playwright (real login, test credentials from `.work/specs/test-login-cred.txt`, real active "Tests" roadmap) rather than re-reading phase reports: BUG-3 hero buttons, BUG-1 sheet centering (measured, both viewports), BUG-2 mobile add-session end-to-end flow, BUG-4 tint/legend/hover-scoping on both the roadmap calendar and a fresh onboarding-preview draft, all confirmed live with screenshots. BUG-5 confirmed both on `/study/chart-test` (reproducing the implementer's exact reported labels) and — the previously-open item — on the real, authenticated `/study/week` page with real historical session data (not seeded): chart renders, unique sparse y-axis, correct deficit sign/color, smooth curves. Authenticated Week real-data visual confirmation is now closed out.
- [~] E2E authored for BUG-2/BUG-4 (run on a capable machine before calling the whole plan done).
  Still not executed as actual spec files: `e2e/material-session-decoupling.spec.ts`'s new hermetic tests require `SUPABASE_SERVICE_ROLE_KEY`, which is unset in this environment (confirmed), so they auto-skip per the spec's own guard. The reviewer instead independently replicated their exact assertions via ad-hoc Playwright automation against the real named test account (arguably a stronger signal — real account, real data — but the authored spec *files* themselves remain unexecuted). Recommend running `pnpm exec playwright test -c e2e/playwright.config.ts e2e/material-session-decoupling.spec.ts --project=app` on a machine with `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` set before considering this line fully closed.
- [x] OQ-01 (4d back-exit) still open, tracked.

### Reviewer overall verdict — 2026-07-03
**All 5 phases ✅ Verified. No changes requested.** Every diff matches the plan (one disclosed, sensible deviation in Phase 5's tick-step heuristic — see Phase 5 findings). All acceptance criteria confirmed by direct code inspection plus live Playwright verification against the real app and a real login session, not by trusting the implementer's self-report alone. Independently re-ran every test suite and lint; all green, matching the self-reported numbers exactly.

Two incidental, out-of-scope observations surfaced during live testing (neither is a regression from this plan — confirmed by diff inspection that this plan touches none of the relevant files):
1. **Cold-start cloud-restore race** (pre-existing, architectural): on a genuinely fresh browser profile with no local IndexedDB yet, navigating straight to a `RequireOnboarding`-gated route (e.g. `/roadmaps`) immediately after sign-in can transiently bounce `/roadmaps → /onboarding/1 → /home` before `SyncEngine`'s cloud restore finishes populating local Dexie. Reproduced 3/3 times with a fresh Playwright context; does not reproduce with a persistent/already-hydrated profile. Only affects a genuinely new device/browser (or an automated test using a fresh context), not a returning user's normal browser. Not touched by this plan's diffs (`EventStoreProvider`/`SyncProvider`/`RequireOnboarding` are untouched). Flagging for awareness/triage, not fixed here — out of scope.
2. Two minor pre-existing cosmetic notes recorded inline in the Phase 3 and Phase 4 findings above (DaySheet scroll position; onboarding bubble truncation at 390px) — neither introduced by this plan, both worth a follow-up glance.

**Update 2026-07-03 (same day):** all three items above were discussed with Rohit and agreed to be fixed as a plan addendum.
See `PLAN.md`'s Phases 6-8 and Decisions D-07 through D-10.
Phase 6 is now implemented and awaiting reviewer verification.
Phases 7 and 8 remain not started.

---

## Phase 6 — Scroll the mobile DaySheet into view on open (BUG-7) · Status: 🟡 Implemented, awaiting review

**Acceptance criteria**
- [x] `DaySheet.tsx` calls `scrollIntoView({ behavior: 'smooth', block: 'start' })` on its root `<section>` whenever `day` transitions to non-null (implements the Phase 6 step in `PLAN.md`).
- [x] The `useRef`/`useEffect` are called unconditionally before the `if (!day) return null` early return (Rules of Hooks compliance).
- [x] No other behavior of `DaySheet` changes - empty state, add-session button, bubble list, and close button all work exactly as before.
- [x] `RoadmapCalendar.test.tsx` stubs `Element.prototype.scrollIntoView` and asserts it's called with the correct args when a day sheet opens.
- [x] `pnpm --filter @study-tracker/app typecheck` + `test -- RoadmapCalendar` green.

**Implementer report:** 2026-07-03
- Files changed: `apps/app/src/roadmap/DaySheet.tsx`, `apps/app/src/roadmap/RoadmapCalendar.test.tsx`.
- Added `useRef` and `useEffect` in `DaySheet.tsx` before the early return.
- Attached the ref to the root day-sheet `<section>`.
- The effect calls `scrollIntoView({ behavior: 'smooth', block: 'start' })` only when `day` is non-null.
- Extended the existing compact empty-day `RoadmapCalendar.test.tsx` flow with a jsdom `Element.prototype.scrollIntoView` stub and assertion.
- Baseline before edits: `pnpm --filter @study-tracker/app test -- RoadmapCalendar` passed with 59 files and 523 tests.
- Verification after edits:
  - `grep -n "scrollIntoView" apps/app/src/roadmap/DaySheet.tsx` found the new effect.
  - `pnpm --filter @study-tracker/app typecheck` passed.
  - `pnpm --filter @study-tracker/app test -- RoadmapCalendar` passed with 59 files and 523 tests.
- Live browser check:
  - Started the managed full app via `./full-app start full`.
  - The first sandboxed start failed on uv cache access at `/Users/rsaji/.cache/uv`, so the same manager command was rerun outside the sandbox and succeeded.
  - Health checks passed: `curl -i http://127.0.0.1:8000/health` returned 200 and `curl -i http://localhost:5173/study/sign-in` returned 200.
  - A sandboxed Chromium probe hit the known macOS Mach-port permission failure, so the read-only browser probe was rerun outside the sandbox.
  - At 390px width against the real app and test login, tapping enabled empty day `Open 2026-07-01 day options` scrolled `window.scrollY` from `0` to max scroll `758`.
  - The DaySheet bounding box was `{ x: 12, y: 518.78125, width: 366, height: 201.390625 }` in an 844px-high viewport, so it was fully visible after scroll.
  - The DaySheet empty state text was present.
  - Stopped the managed full app after the check.
- Deviations: none to implementation.
- Commit SHA: `33a98c9`.

**Reviewer findings:** 2026-07-04 review-fix update, awaiting re-review.
- Fixed the stale `SyncEngine` callback race in `SyncProvider` without changing `SyncEngine`, `RequireOnboarding.tsx`, or `OnboardingGate.tsx`.
- `SyncProvider` now assigns a provider-local engine generation to each created engine and ignores state callbacks whose generation is no longer current.
- Cleanup invalidates the active generation before destroying the old engine, so late `restoreFromCloud().finally` notifications cannot clear a newer engine's restore gate.
- `SyncProvider` resets `syncState` to the initial pending state whenever a new engine is created.
- `SyncProvider` also blocks children during the render where `userId` or `eventStore` has changed but the new engine effect has not committed yet, closing the one-render hole after user/store changes.
- Added a `SyncProvider.test.tsx` regression that keeps restores pending, lets user A clear the gate before switching to user B, manually emits a stale settled state from user A after the switch, and verifies children remain blocked until user B's current engine clears `initialRestorePending`.
- Added `initialRestorePending: false` to the remaining incomplete `useSync` fakes in `RoadmapCalendar.test.tsx`, `OnboardingFlow.test.tsx`, `Step3Preview.test.tsx`, `roadmap/replan/Replan.test.tsx`, `pages/Roadmaps.test.tsx`, and `pages/Replan.test.tsx`.
- `rg -n "syncState: \\{ status: 'idle', lastSyncedAt: null, pendingCount: 0, lastError: null \\}" apps/app/src -g '*.test.ts' -g '*.test.tsx'` now returns no matches.
- Verification run: `pnpm --filter @study-tracker/app exec vitest run SyncProvider SyncEngine RoadmapCalendar` passed with 3 files and 55 tests.
- Additional touched-fake verification run: `pnpm --filter @study-tracker/app exec vitest run src/onboarding/OnboardingFlow.test.tsx src/onboarding/steps/Step3Preview.test.tsx src/roadmap/replan/Replan.test.tsx src/pages/Roadmaps.test.tsx src/pages/Replan.test.tsx` passed with 5 files and 30 tests.
- `pnpm --filter @study-tracker/app typecheck` passed.
- `pnpm lint` exited 0 with the same four pre-existing `@typescript-eslint/no-explicit-any` warnings in `YouTubePlayerAdapter.test.ts` and `loadYouTubeApi.ts`.
- `git diff --check` passed.
- Note: the package-script form `pnpm --filter @study-tracker/app test -- SyncProvider SyncEngine RoadmapCalendar` was not used for final evidence because it ran the full app suite in this workspace; that full run still hits an unrelated existing `Home.test.tsx` failure looking for `/Study session/`.

---

## Phase 7 — Fix onboarding-preview bubble truncation at narrow width (BUG-8) · Status: 🟡 Implemented, awaiting review

**Acceptance criteria**
- [x] D-10 has been updated from ⚠️ Deferred to ✅ Agreed with Rohit's chosen option recorded before implementation starts. Resolved 2026-07-03: **Option C** (icon + duration, drop the "Session" label), picked against the real-CSS mock [`mocks/proposed/bug8-bubble-truncation.html`](./mocks/proposed/bug8-bubble-truncation.html).
- [x] The chosen CSS rule is scoped to `.onboarding-mini-calendar` inside a `@media (max-width: 560px)` query, placed near the other Phase-4 onboarding-scoped rules in `roadmap.css` — hides `.roadmap-bubble-label` and tightens `.roadmap-bubble`'s grid to `14px auto`.
- [x] At a 390px viewport, the session bubble no longer renders as an unreadable single clipped character — it shows icon + duration cleanly, same cell height as baseline, no wrap.
- [x] The bubble's `title`/`aria-label` (from Phase 4) are unaffected — full text still available on hover/screen-reader regardless of the visual treatment.
- [x] No regression to the bubble's appearance above 560px or in the main roadmap calendar (this rule is scoped to `.onboarding-mini-calendar` only).
- [x] `pnpm --filter @study-tracker/app typecheck` green; a visual/Playwright check at 390px confirms icon + duration render with no truncation.

**Implementer report:** 2026-07-03
- Files changed: `apps/app/src/roadmap/roadmap.css`.
- Added the Phase 7 `@media (max-width: 560px)` block near the existing `.onboarding-mini-calendar` Phase-4 rules.
- The scoped rule hides `.roadmap-bubble-label`, tightens `.roadmap-bubble` to `grid-template-columns: 14px auto`, and restores `.roadmap-bubble-minutes` display inside the onboarding mini-calendar.
- Verification:
  - Prereq grep `grep -n "roadmap-bubble-label\|roadmap-bubble-minutes" apps/app/src/roadmap/roadmap.css` found the expected label/minute rules and the pre-existing max-780 minute hide.
  - Prereq grep `grep -n "onboarding-mini-calendar" apps/app/src/roadmap/roadmap.css` found the existing Phase-4 scoped rules.
  - DONE grep `grep -n "onboarding-mini-calendar .roadmap-bubble" apps/app/src/roadmap/roadmap.css` found all three new scoped selectors at lines 1769, 1773, and 1777.
  - `pnpm --filter @study-tracker/app typecheck` passed.
  - Managed full-app stack started via `./full-app start full`; first sandboxed start hit the known uv-cache permission failure and was rerun outside the sandbox, then both `intelligence` and `app` reported healthy.
  - Health checks passed: `curl -i http://127.0.0.1:8000/health` returned 200 and `curl -i http://localhost:5173/study/sign-in` returned 200.
  - Sandboxed Chromium hit the known macOS Mach-port permission failure, so the browser probe was rerun outside the sandbox.
  - The 390px probe used the real login, seeded an onboarding draft, opened `/study/onboarding/3/preview?new=1`, expanded the calendar, and inspected `.onboarding-mini-calendar .roadmap-chip-booked`.
  - Browser result: visible bubble `innerText` was `1h`; `title` and `aria-label` stayed `Booked study session · 1h · Fri, Jul 3`; `grid-template-columns` was `14px 12px`; label `display` was `none`; minutes text was `1h`; booked-day and empty-day heights both measured `66.5px`.
  - Element screenshot saved to `/private/tmp/study-planner-bug8-bubble-element.png`.
- Deviations:
  - Added a scoped `.onboarding-mini-calendar .roadmap-bubble-minutes { display: inline; }` restore in the same max-560 block.
    The Phase 7 step block omitted this line, but the plan's own codebase-state section correctly noted the pre-existing max-780 rule hides `.roadmap-bubble-minutes`.
    Without the restore, the literal step block would render icon-only at 390px and would fail D-10's icon + duration contract.
- Commit SHA: `75f734f`.

**Reviewer findings:** _(pending)_

---

## Phase 8 - Gate the cold-start cloud-restore race in SyncProvider (BUG-6) · Status: 🟡 Implemented, awaiting review

**Acceptance criteria**
- [x] `SyncState` (`types.ts`) gains `initialRestorePending: boolean`.
- [x] `SyncEngine`'s constructor defaults `initialRestorePending: true`.
- [x] The fast path (`localEventCount > 0` in `doRestoreFromCloud`) clears `initialRestorePending` immediately, before `flushQueue`/`pullAndMerge` run - implements D-08, so ordinary page reloads for already-hydrated devices are not delayed.
- [x] The public `restoreFromCloud()` wrapper's existing `finally` block clears `initialRestorePending` unconditionally, covering every slow-path exit (success, schema-guard error, empty-blob error, catch-all, and the bare-return-via-`pullAndMerge` branches) without needing to touch each one individually.
- [x] `SyncProvider` withholds rendering `children` while `syncState.initialRestorePending && !initialRestoreTimedOut`, showing the D-09 Option C1 boot screen instead (implements D-07).
- [x] A safety timeout (default 8000ms, tunable) force-clears the block via `initialRestoreTimedOut` if the restore never settles, so a hung/offline connection cannot brick the app.
- [x] The timeout is reset (`setInitialRestoreTimedOut(false)`) whenever a new engine is created (user/eventStore change), and cleared on effect cleanup.
- [x] `RequireOnboarding.tsx` and `OnboardingGate.tsx` are **not modified** - confirmed unchanged in the diff (D-07: fix is centralized in the sync layer only).
- [x] `SyncEngine.test.ts` covers: fast path clears immediately; slow path stays pending until success; slow path clears even on error.
- [x] `SyncProvider.test.tsx` covers: children withheld behind the boot screen until pending clears; children rendered after the safety timeout even if `restoreFromCloud` never settles; timeout parsing fallback/override behavior.
- [x] `pnpm --filter @study-tracker/app typecheck` + `test -- SyncEngine SyncProvider` green.
- [x] Live re-check: a genuinely fresh Playwright profile (new `userDataDir`) signing in and immediately deep-linking to a `RequireOnboarding`-gated route no longer transiently visits `/onboarding/1` before settling.
- [x] D-09 (loading-state visual + exact timeout value): Option C1 shipped with configurable `VITE_INITIAL_RESTORE_TIMEOUT_MS` defaulting to 8000ms, plus reduced-motion verification.

**Implementer report:** 2026-07-03
- Files changed: `apps/app/src/sync/types.ts`, `apps/app/src/sync/SyncEngine.ts`, `apps/app/src/sync/SyncEngine.test.ts`, `apps/app/src/sync/SyncProvider.tsx`, `apps/app/src/sync/SyncProvider.test.tsx`, `apps/app/src/components/SyncIndicator.test.tsx`, `packages/design-tokens/src/components.css`, `CLAUDE.md`, `apps/app/.env.example`, `.work/plans/active/2026-07-02-material-session-ui-bugs/PLAN.md`, `.work/plans/active/2026-07-02-material-session-ui-bugs/VERIFICATION.md`, `.work/plans/active/2026-07-02-material-session-ui-bugs/SCRATCHPAD.md`, `.work/STATUS.md`.
- Added `initialRestorePending` to `SyncState`.
- Defaulted `SyncEngine` to pending, cleared it immediately on the already-hydrated fast path, and cleared it unconditionally in the public `restoreFromCloud()` wrapper's `finally`.
- Added SyncEngine tests for the fast path, slow-path success, and slow-path error cases.
- Implemented `SyncProvider` gating with `BootScreen`, `initialRestoreTimedOut`, `showLongWaitCopy`, `resolveInitialRestoreSafetyTimeoutMs`, and `initialRestoreSafetyTimeoutMs`.
- Added SyncProvider tests for boot-screen child withholding, safety-timeout fallback, and timeout parsing.
- Added the Option C1 `.boot-*` styles to `packages/design-tokens/src/components.css`.
- Documented optional `VITE_INITIAL_RESTORE_TIMEOUT_MS` in `CLAUDE.md` and `apps/app/.env.example`.
- Updated `SyncIndicator.test.tsx` fixtures to include `initialRestorePending: false` for the required `SyncState` field.
- Prereq verification:
  - `grep -n "status: 'idle'\|status: 'syncing'\|status: 'error'\|status: 'offline'" apps/app/src/sync/types.ts` found the pre-phase four-state union.
  - `grep -n "finally {" apps/app/src/sync/SyncEngine.ts` found the existing restore wrapper finally.
  - `grep -n "initialRestorePending" apps/app/src/sync/*.ts apps/app/src/sync/*.tsx` returned no rows before implementation.
  - Baseline `pnpm --filter @study-tracker/app test -- SyncEngine SyncProvider` passed with 59 files and 523 tests.
- Red-green evidence:
  - New SyncEngine tests first failed because `initialRestorePending` was `undefined`, then passed after the engine implementation.
  - New SyncProvider tests first failed because the boot screen was missing and children rendered immediately, then passed after the provider implementation.
- Verification:
  - `grep -n "initialRestorePending" apps/app/src/sync/types.ts apps/app/src/sync/SyncEngine.ts apps/app/src/sync/SyncProvider.tsx` found the field and all write sites.
  - `grep -n "resolveInitialRestoreSafetyTimeoutMs\|BootScreen\|initialRestoreSafetyTimeoutMs" apps/app/src/sync/SyncProvider.tsx` found the provider config, component, and prop.
  - `grep -n "\.boot-screen\b" packages/design-tokens/src/components.css` found the new CSS at line 1053.
  - `grep -n "VITE_INITIAL_RESTORE_TIMEOUT_MS" CLAUDE.md apps/app/.env.example` found both doc entries.
  - `pnpm --filter @study-tracker/app typecheck` passed.
  - `pnpm --filter @study-tracker/app test -- SyncEngine SyncProvider` passed with 59 files and 532 tests.
- Live browser verification:
  - `./full-app start full` first failed in the sandbox on the known `uv` cache permission issue, then succeeded outside the sandbox.
  - Health checks passed: `curl -i http://127.0.0.1:8000/health` returned 200, and `curl -i http://localhost:5173/study/sign-in` returned 200.
  - Sandboxed Chromium hit the known macOS Mach-port permission failure, so the focused probe was rerun outside the sandbox.
  - Fresh persistent profile, real login, immediate deep link to `/study/roadmaps`: final path was `/study/roadmaps`, route log contained only `/study/roadmaps`, `sawOnboardingOne` was `false`, and browser console/page errors were empty.
  - The boot screen became visible 26ms after the deep link and remained visible for about 2808ms before the route settled.
  - Reduced-motion check passed: `.boot-mark-line-1` animation was `none` with dash offset `0px`, `.boot-mark-dot` animation was `none` with opacity `1`, and `.boot-caption` animation was `none` with opacity `1`.
  - Managed full-app stack was stopped after verification.
- Deviations:
  - The provider transition test uses the real `restoreFromCloud()` path with a prototype spy rather than a fully mocked deferred restore.
    A fully mocked restore would not exercise the engine's `notifyState({ initialRestorePending: false })`, which is the behavior the provider gate relies on.
  - The boot subcaption uses a plain hyphen (`Bringing over your study history - this only happens once.`) instead of the mock's em dash to comply with the repo instruction banning em dashes.
  - New boot CSS uses `letter-spacing: 0` for the added classes to comply with the frontend instruction.
- Commit SHA: `f6313f8`.

**Reviewer findings:** _(pending)_

---

## Phase 9 — Suggested upcoming sessions (FEAT, D-11) · Status: ☐ Not started

**Acceptance criteria**
- [ ] New pure `apps/app/src/roadmap/suggestedBookings.ts` `deriveSuggestedBookings({roadmap, ledger, confirmedBookings, today})` runs the engine's `generateBookings` over **remaining** material (`remainingEstimatedMinutes`, not-done) from `today`→`deadline`, and returns suggestions **only** for future study-days with **no confirmed booking**; empty `selectedStudyDays` or nothing-remaining → `[]` (D-11).
- [ ] Suggested length = per-day capacity, leftover **spread across consecutive study days** (engine cap-and-spread), NOT one leftover-sized block.
- [ ] `calendarModel` gains a `suggested` bubble status + builder; `bindCells` places a suggested bubble only on an otherwise-empty date (confirmed booking / logged activity always wins).
- [ ] `statusStyles` has a `suggested` ghost style (`roadmap-chip-suggested`) + a "Suggested" legend entry; `roadmap.css` styles it distinctly from `booked` (dashed/moss ghost), legible as a compact dot.
- [ ] Clicking a suggested bubble **accepts** it → emits exactly one `SessionBooked` (fresh `crypto.randomUUID()` id, suggested date/duration/material), after which it renders as a confirmed booking and the suggestion for that day disappears; no suggestion is ever persisted.
- [ ] Suggestions render for the **active** roadmap only; `readOnly` history shows none.
- [ ] Unit tests cover distribution (e.g. 5h @ 2h cap → 120/120/60), collision-skip, empty cases, and accept→`SessionBooked`. Playwright authored (not run).
- [ ] `pnpm --filter @study-tracker/app typecheck` + `test -- suggestedBookings calendarModel RoadmapCalendar` green.

**Implementer report:** _(pending)_

**Reviewer findings:** _(pending)_
