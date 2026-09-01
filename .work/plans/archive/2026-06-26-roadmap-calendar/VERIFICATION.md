# Verification — roadmap-calendar

Round-trip log between implementer (Codex/Sonnet) and reviewer (Cowork). One section per phase.
Per phase: implementer fills **Implementer report**; reviewer fills **Reviewer findings** after diffing the reported commit SHA against the acceptance criteria. A phase is done only at `✅ Verified`.

**Plan:** [`PLAN.md`](PLAN.md) · **Step 0 reminder:** commit the planning docs verbatim before any code, and commit each phase's status flip together with its code.

---

## Phase 1 — Pure per-slot status derivation (`packages/progress`)

### Acceptance criteria
- [ ] `deriveSlotStatuses(roadmap, sessions, today)` exists in `packages/progress/src/deriveSlotStatuses.ts`, exported from `index.ts`.
- [ ] Match rule is `session.date === slot.date && slot.candidateMaterialIds.includes(session.materialId)`; each session attributes to at most one slot.
- [ ] `done` = ≥1 attributed (with summed `loggedMinutes`); `pending` = future slot, no match; `skipped` = past slot, no match.
- [ ] Unattributed sessions are returned as `unplanned` (not dropped).
- [ ] `today` is passed in as an ISO string — no `new Date()` inside the pure function.
- [ ] Tests cover: single match, duplicate-same-day overflow→unplanned, past-no-match (skipped), future-no-match (pending), off-plan material, empty roadmap.
- [ ] fast-check property: every session appears exactly once across `slots[].sessionIds ∪ unplanned`.
- [ ] `pnpm --filter progress test` and typecheck pass.

### Implementer report
Status: ✅ Implemented, awaiting review. Commit: `c50ff53`.

Files changed:
- `packages/progress/src/deriveSlotStatuses.ts`
- `packages/progress/src/index.ts`
- `packages/progress/src/types.ts`
- `packages/progress/test/deriveSlotStatuses.test.ts`

What was done:
- Added pure `deriveSlotStatuses(roadmap, sessions, today)` with `done` / `pending` / `skipped` slot derivation and `unplanned` return for unattributed sessions.
- Implemented the date + material match rule, first available matching slot attribution, and one-time accounting for every session.
- Exported the helper and public types from `@study-tracker/progress`.
- Added unit coverage for single match, duplicate overflow to unplanned, skipped, pending, off-plan material, empty roadmap, all-done week, and a fast-check accounting property.

Deviation:
- Added `materialId?: string` to `SessionEvent`; existing app `SessionLogged` payloads already include `materialId`, but the progress package type did not expose it. The Phase 1 match rule requires this field.

Self-check vs criteria:
- `deriveSlotStatuses` exists and is exported.
- Match rule is date + candidate material id; sessions are assigned to at most one slot.
- Done / pending / skipped are derived from attribution and caller-provided ISO `today`.
- Unattributed sessions return as `unplanned`.
- No `new Date()` usage in the helper.
- Required examples and fast-check property are covered.
- `pnpm --filter progress test` and `pnpm --filter progress typecheck` pass. Both emitted the existing Node engine warning (`wanted >=20`, current `v18.19.0`) but completed successfully.

### Reviewer findings

**Reviewed:** 2026-06-26 (Cowork) · commit `c50ff53` (`git show c50ff53`; confirmed ancestor of HEAD). Verified by diff + code inspection; see note on test execution below.

Per-criterion:
- ✅ `deriveSlotStatuses(roadmap, sessions, today)` present in `packages/progress/src/deriveSlotStatuses.ts`, exported from `index.ts` with its public types.
- ✅ Match rule is exactly `session.date === slot.date && slot.candidateMaterialIds.includes(session.materialId)`, guarded by `materialId !== undefined`. Each session takes the first **unused** matching slot (`usedSlotIndexes`), so a session maps to ≤1 slot and a slot absorbs ≤1 session — matches D-02.
- ✅ `done` = ≥1 attributed with summed `loggedMinutes`; `pending` = `slot.date >= today` & unmatched; `skipped` = past & unmatched. Today-as-pending is correct per D-02 ("date ≥ today").
- ✅ Unattributed sessions returned in `unplanned` (off-plan material, overflow, and empty-roadmap cases all route here).
- ✅ Pure: no `new Date()` / clock read; all decisions use the caller-supplied ISO `today` (string comparison).
- ✅ Tests cover all required cases: single match, duplicate-same-day overflow→unplanned, past-skipped, future-pending, off-plan material, empty roadmap, plus all-done week.
- ✅ fast-check property asserts every session appears exactly once across `slots[].sessionIds ∪ unplanned` (count + Set-size) — no loss, no double-count.
- ✅ (corroborated) Tests/typecheck: implementer reports green on Node 18 (engine warning only). I could **not re-execute in the Cowork sandbox** — `vitest` fails to load `@rollup/rollup-linux-arm64-gnu` (npm optional-deps bug; environment, not a test failure), consistent with this repo's "tests blocked in this environment" caveat. Logic + coverage verified by inspection instead.

Deviation assessment (`materialId?: string` added to `SessionEvent`):
- Sound. The field is **optional**, so it's backward-compatible — no existing `packages/progress` consumer breaks. `RoadmapSlot.dayOfWeek` is typed `string`, so the tests' full day-names typecheck.
- The producer is wired: `apps/app/src/progress/mapEvents.ts::mapSessions` now maps `materialId: e.payload.materialId` (landed in the Phase 2 commit `8019007`, ancestor of HEAD). So when `deriveSlotStatuses` is fed real `SessionEvent[]`, sessions carry `materialId` and the match rule fires — no silent "everything unplanned" failure. ✅

Notes:
- The historical `c50ff53` diff text recorded the SHA as `ed546a7` (a pre-rebase artifact); the **current on-disk** PLAN.md/VERIFICATION.md correctly reference `c50ff53`. No action — flagging only because later phases were rebased the same way; reviewer of Phases 2–7 should confirm each recorded SHA is an ancestor of HEAD.

**Status: ✅ Verified.** No changes requested.

### Resolution
_(implementer fills on redo — loop until ✅ Verified)_

---

## Phase 2 — Read-only month calendar on `/roadmap` (desktop)

### Acceptance criteria
- [ ] `/study/roadmap` renders a month calendar grid for the month containing today, replacing the stub.
- [ ] Cells show status-colored chips (done/pending/skipped/unplanned) per the **D-14 contract**, using design tokens only (no raw hex).
- [ ] D-14 elevation applied: current-week row uses `--cal-week-band`; today's cell uses `--cal-today-fill` + a "Today" pill; out-of-month cells dimmed. No terracotta ring on today/this-week; rust appears only on `skipped`.
- [ ] New tokens `--cal-today-fill` + `--cal-week-band` added to `packages/design-tokens/src/tokens.css`.
- [ ] Each status chip pairs an icon with its color (ti-check / ti-clock / ti-x / ti-plus) — not color-only.
- [ ] Per-cell cap of 3 bubbles, then a `+N more` affordance (D-07).
- [ ] Header progress card shows logged / to-go / % from `useProgressSnapshot`.
- [ ] Legend is present with icon/shape redundancy (not color-only).
- [ ] Empty state renders when `findRoadmap` returns `null` (D-13), with a CTA to onboarding — no crash.
- [ ] Footer Mark-complete / Abandon and Edit / Replan render as disabled placeholders.
- [ ] `calendarModel.ts` is pure and unit-tested (grid boundaries + cell binding + material-title join).
- [ ] `e2e/roadmap.spec.ts` visual walkthrough started (D-15, written not run): screenshots `01-grid`, `02-status-colors` (asserts D-14), `03-empty`.
- [ ] `pnpm --filter app test`, typecheck, lint pass.

### Implementer report
Status: ✅ Implemented, awaiting review. Commit: `8019007`.

Files changed:
- `apps/app/src/roadmap/calendarModel.ts`
- `apps/app/src/roadmap/calendarModel.test.ts`
- `apps/app/src/roadmap/statusStyles.ts`
- `apps/app/src/roadmap/CalendarCell.tsx`
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/roadmap/roadmap.css`
- `apps/app/src/pages/Roadmap.tsx`
- `apps/app/src/progress/mapEvents.ts`
- `packages/design-tokens/src/tokens.css`
- `e2e/roadmap.spec.ts`
- `packages/progress/eslint.config.js`
- `apps/app/src/components/BurnUpChart.tsx`
- `apps/app/supabase/functions/materials-metadata/handler.test.ts`

What was done:
- Replaced `/roadmap` stub with a read-only current-month calendar fed by the event log.
- Added pure `calendarModel` helpers for Monday-start month grids and binding derived slots/unplanned sessions to day cells.
- Added D-14 calendar tokens `--cal-today-fill` and `--cal-week-band`.
- Added status style mapping and icon-paired chips for done/planned/skipped/unplanned; rust is only used by skipped chips in the new roadmap UI.
- Added current-week band, filled today cell + Today pill, dimmed out-of-month cells, per-cell cap of 3 bubbles, `+N more`, legend, progress card, empty state, and disabled footer placeholders for Mark complete / Abandon / Edit / Replan.
- Added the Phase 2 Playwright visual walkthrough steps `01-grid`, `02-status-colors`, and `03-empty`; authored only, not executed.

Deviations:
- Added `apps/app/src/roadmap/roadmap.css` even though the file index did not list a CSS file; this keeps hover/media-query styling auditable and avoids inline CSS bloat.
- Updated `mapSessions` to include `materialId`; without this, real app sessions could not satisfy Phase 1's match rule.
- Fixed narrow pre-existing lint-gate blockers so `pnpm lint` can pass: added `packages/progress/eslint.config.js`, removed two stale disables for an uninstalled React-hooks rule, and removed one unused Deno-test type import.

Self-check vs criteria:
- `/study/roadmap` renders a month calendar instead of the stub.
- D-14 tokens and status chip classes are in place; source audit found no raw color literals in new roadmap UI files.
- Current-week, today, and out-of-month states are styled through tokens/classes.
- Status chips and legend pair color with `ti-*` icon metadata and inline SVG icons.
- Bubbles cap at 3 per cell with `+N more`.
- Progress card calls `useProgressSnapshot`; it falls back to event-derived totals while calibration is unavailable.
- Empty state renders for post-onboarding/no-roadmap state with an onboarding CTA.
- Footer placeholders render disabled.
- `calendarModel.ts` is pure and unit-tested.
- `e2e/roadmap.spec.ts` contains the required write-only walkthrough screenshots.
- Verification passed under Node `v22.17.1`: `pnpm --filter app test`, `pnpm --filter app typecheck`, `pnpm --filter progress test`, `pnpm --filter progress typecheck`, and `pnpm lint`. Running the app tests under the default Node `v18.19.0` failed before tests due jsdom/html-encoding-sniffer ESM compatibility, matching the repo's `node >=20` engine requirement.

### Reviewer findings

**Reviewed:** 2026-06-26 (Cowork) · commit `8019007` (ancestor of HEAD) · by diff + code inspection (tests not executed in sandbox — `vitest` can't load `@rollup/rollup-linux-arm64-gnu`, an env bug, not a failure).

All 12 criteria ✅. Evidence: `Roadmap.tsx` → `<RoadmapCalendar/>`; `statusStyles.ts` maps to `var(--moss)`/`var(--surface-card)`/`var(--rust)` (hex scan of new roadmap files = none); `roadmap.css` `.roadmap-day-current-week{background:var(--cal-week-band)}`, `.roadmap-day-today{background:var(--cal-today-fill)}` + `.roadmap-today-pill`, out-of-month `opacity:.55`, rust only in `.roadmap-chip-skipped`; `tokens.css` adds both `--cal-*`; chips pair icon+color (check/clock/x/plus); cap 3 + `+N more`; header uses `useProgressSnapshot`; legend has `data-icon` redundancy; null roadmap → empty state with `to="/onboarding"` before any deref (D-13); 4 footer buttons disabled; `calendarModel.ts` pure (ISO Monday-start) + tests (31-day mid-week 6 rows, Feb, binding, title join); walkthrough `01/02/03` with D-14 assertions. No `/study` route prefix. Deviations sound: `roadmap.css` (auditable styling) and `mapSessions` `materialId` (required for the Phase-1 match rule to fire on real sessions). Nits only: `--cal-today-fill` 12% vs pill 16% (intentional contrast); the null-guard later migrated to `deriveRoadmapLifecycle` in Phase 6 (behavior preserved).

**Status: ✅ Verified.** No changes requested.

### Resolution

---

## Phase 3 — Month navigation (prev/next/today, clamp, slide)

### Acceptance criteria
- [ ] Prev/next + Today controls change the visible month; default is the month containing today.
- [ ] Prev/next are clamped to the roadmap's start/end months (no empty paging).
- [ ] Month change animates with a horizontal slide (~180ms); `prefers-reduced-motion` respected.
- [ ] Deadline day is visually marked.
- [ ] Clamp bounds unit-tested; walkthrough extended (write only) with screenshots `04-next-month`, `05-prev-month`, `06-today-reset`; deadline-day marker asserted.
- [ ] `pnpm --filter app test` + typecheck pass.

### Implementer report
Status: ✅ Implemented, awaiting review. Commit: `3cb0df6`.

Files changed:
- `apps/app/src/roadmap/MonthNav.tsx`
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/roadmap/CalendarCell.tsx`
- `apps/app/src/roadmap/calendarModel.ts`
- `apps/app/src/roadmap/calendarModel.test.ts`
- `apps/app/src/roadmap/roadmap.css`
- `e2e/roadmap.spec.ts`

What was done:
- Added prev/next/Today month navigation with inclusive clamp bounds from roadmap `startDate` through `deadline`.
- Defaulted the visible month to today's month, clamped into the roadmap range if needed.
- Added a horizontal slide animation for month changes with `prefers-reduced-motion` disabling animation.
- Marked the deadline day with a dedicated deadline pill and bottom accent, separate from today's filled-cell treatment.
- Extended `calendarModel` with pure month-key/bounds/clamp/shift helpers and unit coverage.
- Extended the write-only Playwright walkthrough with `04-next-month`, `05-prev-month`, and `06-today-reset`, including start/end disabled-state checks and a deadline marker assertion.

Deviations:
- Phase 3 and Phase 4 were committed together in `3cb0df6` because the human explicitly asked to start both phases in this run. The implementation still keeps Phase 3 and Phase 4 acceptance evidence separated in this log.

Self-check vs criteria:
- Prev/next/Today controls are rendered by `MonthNav` and update the visible month.
- Prev/next are clamped using `calendarMonthBounds`, `clampMonth`, and `shiftMonth`.
- Month changes animate via `roadmap-calendar-slide` at 180ms and reduced-motion disables animation.
- Deadline day marker is rendered through `CalendarCell`.
- Clamp bounds are unit-tested in `calendarModel.test.ts`.
- Walkthrough steps `04-next-month`, `05-prev-month`, and `06-today-reset` are authored only; E2E was not run per plan constraint.
- Verification passed: `pnpm --filter app test`, `pnpm --filter app typecheck`, and `pnpm lint` (lint passes with 6 pre-existing warnings).

### Reviewer findings

**Reviewed:** 2026-06-26 (Cowork) · commit `3cb0df6` (Phases 3 & 4 shipped together; ancestor of HEAD) · diff + inspection; tests not executed (sandbox rollup env bug).

All 5 criteria ✅. `MonthNav` renders prev/next/Today; `activeViewMonth` defaults to today's month clamped into bounds; clamp via `calendarMonthBounds`/`clampMonth`/`shiftMonth` with buttons disabled at bounds; slide animation 180ms (`.roadmap-calendar-slide`, `key`-remount) with `@media (prefers-reduced-motion: reduce){animation:none}`; deadline day marked via `.roadmap-deadline-pill` (`data-testid=roadmap-deadline-marker`, token accent); clamp unit-tested in `calendarModel.test.ts`; walkthrough `04/05/06` assert disabled-at-bounds + deadline marker. No `/study` route prefix; no raw hex. Nit (non-blocking): changing month doesn't auto-close an open modal — harmless, bubble data is self-contained.

**Status: ✅ Verified.** No changes requested.

### Resolution

---

## Phase 4 — Session-detail modal + day modal (desktop)

### Acceptance criteria
- [ ] `SessionDetailModal` reuses the onboarding/Recalibration modal structure.
- [ ] Modal renders eyebrow (date), title, status pill, body (logged vs planned, material link), and a status-dependent action label (done/pending/skipped/unplanned).
- [ ] Clicking a bubble opens the modal for that session; `+N more` opens the day list.
- [ ] Modal close works; component unit-tested for status→pill/action mapping.
- [ ] Walkthrough extended (write only): screenshots `07-hover-expand`, `08-modal-done`, `09-modal-pending`, `10-day-modal`; modal open/close asserted at each step.
- [ ] `pnpm --filter app test` + typecheck pass.

### Implementer report
Status: ✅ Implemented, awaiting review. Commit: `3cb0df6`.

Files changed:
- `apps/app/src/roadmap/SessionDetailModal.tsx`
- `apps/app/src/roadmap/SessionDetailModal.test.tsx`
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/roadmap/CalendarCell.tsx`
- `apps/app/src/roadmap/calendarModel.ts`
- `apps/app/src/roadmap/roadmap.css`
- `e2e/roadmap.spec.ts`

What was done:
- Added `SessionDetailModal` using the app's existing modal shell classes (`modal-overlay`, `modal-card`, `modal-eyebrow`, `modal-title`, `modal-body`).
- Added status-copy mapping for `done` / `pending` / `skipped` / `unplanned` pills and action labels.
- Rendered the detail modal eyebrow date, title, status pill, logged-vs-planned body, and material link when a `MaterialAdded.url` exists.
- Added a day-list modal in the same file for `+N more`; selecting a row opens the session detail modal.
- Wired `CalendarCell` bubble clicks and overflow clicks through `RoadmapCalendar` state.
- Added unit coverage for status pill/action mapping, material link rendering, close behavior, and null rendering.
- Extended the write-only Playwright walkthrough with `07-hover-expand`, `08-modal-done`, `09-modal-pending`, and `10-day-modal`.

Deviations:
- The day modal lives in `SessionDetailModal.tsx` instead of a separate file. This keeps the Phase 4 desktop overflow modal on the same shell and leaves `DaySheet.tsx` reserved for the distinct Phase 5 mobile bottom sheet.
- The status action buttons are disabled stubs. This matches the plan's allowance because the app does not yet have a session-detail route and start/log flows remain outside this phase.

Self-check vs criteria:
- `SessionDetailModal` reuses the existing app modal structure.
- Modal renders date eyebrow, title, status pill, logged/planned body, material link when present, and the required status-dependent action labels.
- Bubble clicks open the session detail modal; `+N more` opens a day list; day-list rows open the detail modal.
- Modal close is unit-tested; status mapping is unit-tested for all four statuses.
- Walkthrough steps `07-hover-expand`, `08-modal-done`, `09-modal-pending`, and `10-day-modal` are authored only; E2E was not run per plan constraint.
- Verification passed: `pnpm --filter app test`, `pnpm --filter app typecheck`, and `pnpm lint` (lint passes with 6 pre-existing warnings).

### Reviewer findings

**Reviewed:** 2026-06-26 (Cowork) · commit `3cb0df6` · diff + inspection; tests not executed (sandbox rollup env bug).

All 5 criteria ✅. `SessionDetailModal` reuses the app modal shell (`modal-overlay`/`modal-card`/`modal-eyebrow`/`modal-title`/`modal-body`, matching `RecalibrationModal`); renders date eyebrow, title, status pill, logged-vs-planned body, material link when `MaterialAdded.url` present, and the exact status→action mapping (done→View session, pending→Start session, skipped→Log it late, unplanned→View session); bubble click opens the modal, `+N more` opens a day list whose rows open the detail modal; close + status mapping unit-tested (`SessionDetailModal.test.tsx`); walkthrough `07–10` assert open/close; hover-expand gated `@media (pointer: fine)`. Notes (non-blocking): the shared desktop modal overlay uses `position: fixed` (allowed — the fixed-prohibition is specific to the Phase-5 sheet); action buttons are disabled stubs (plan-sanctioned, since start/log routes are out of scope).

**Status: ✅ Verified.** No changes requested.

### Resolution

---

## Phase 5 — Mobile responsive (dots + day sheet + swipe)

### Acceptance criteria
- [ ] Below the width threshold, bubbles render as status dots with a count badge when >1; hover-expand disabled.
- [ ] Tapping a day opens a bottom sheet (normal-flow overlay, never `position: fixed`) listing that day's sessions.
- [ ] Sheet rows open the session-detail modal.
- [ ] Left/right swipe changes months on mobile (reuses the slide).
- [ ] Walkthrough extended (write only) with a mobile-viewport project: screenshots `11-mobile-dots`, `12-day-sheet`, `13-mobile-modal`, `14-mobile-month-change`.
- [ ] `pnpm --filter app test` + typecheck pass.

### Implementer report
Status: ✅ Implemented, awaiting review. Commit: `3967553`.

Files changed:
- `apps/app/src/roadmap/CalendarCell.tsx`
- `apps/app/src/roadmap/DaySheet.tsx`
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/roadmap/roadmap.css`
- `e2e/playwright.config.ts`
- `e2e/roadmap.spec.ts`

What was done:
- Added compact mobile calendar cells: below the mobile threshold, roadmap bubbles render as status dots with a count badge when a day has multiple sessions.
- Disabled the desktop hover/bubble interaction in compact mode by not rendering bubble buttons and using a single day tap target instead.
- Added `DaySheet.tsx`, a normal-flow day-session sheet that lists the tapped day's sessions and opens the existing `SessionDetailModal` from each row.
- Added mobile touch swipe handling in `RoadmapCalendar`; left/right swipes reuse the existing month clamp and slide behavior.
- Added an `app-mobile` Playwright project scoped to `roadmap.spec.ts` and extended the write-only walkthrough with `11-mobile-dots`, `12-day-sheet`, `13-mobile-modal`, and `14-mobile-month-change`.

Deviations:
- The mobile sheet is a normal-flow `section[role="dialog"]` rendered below the calendar, rather than sharing the fixed modal shell. This is deliberate because Phase 5 explicitly says the bottom sheet must never be `position: fixed`.

Self-check vs criteria:
- Status dots plus multi-session count badge render in compact mode.
- Desktop hover expansion is not part of compact rendering; desktop bubbles are omitted below the threshold.
- Tapping a populated mobile day opens the normal-flow day sheet.
- Sheet rows open the session-detail modal.
- Swipe month navigation is wired to the existing clamp/slide behavior.
- Walkthrough steps `11-mobile-dots` through `14-mobile-month-change` are authored only; E2E was not run per plan constraint.
- Verification passed: `pnpm --filter app test` and `pnpm --filter app typecheck`.

### Reviewer findings

**Reviewed:** 2026-06-26 (Cowork) · commit `3967553` · diff + inspection; tests not executed (sandbox rollup env bug).

All 5 criteria ✅. Compact mode (`useMatchMedia('(max-width: 560px)')`) renders status dots + a count badge when `bubbles.length > 1`; desktop bubble buttons are not rendered in compact (hover disabled). **Critical rule honored:** `DaySheet` is a normal-flow `section[role=dialog]` with **no `position` property** — the only `position: fixed` is `.roadmap-modal-overlay` (the separate desktop modal). Sheet rows open `SessionDetailModal`; left/right swipe (`≥48px` deltaX) reuses the clamp + slide, gated to mobile; `app-mobile` Playwright project (Pixel 5) added; walkthrough `11–14`. No `/study` route prefix. **Low (follow-up, non-blocking):** swipe checks only `deltaX`, not `|deltaX| > |deltaY|`, so a mostly-vertical scroll with >48px horizontal drift could spuriously page the month — recommend capturing `clientY` and requiring horizontal dominance. Nit: `formatMinutes` negative-clamp divergence between cell and sheet (cosmetic).

**Status: ✅ Verified** (swipe vertical-intent guard logged as a low-severity follow-up; not an acceptance failure).

### Resolution

---

## Phase 6 — Mark complete / abandon events + `/roadmaps` history

### Acceptance criteria
- [ ] `RoadmapMarkedComplete` / `RoadmapMarkedAbandoned` payload types added to `sync/types.ts` (`{ roadmapCreatedAt, resolvedAt, reason? }`).
- [ ] Detail footer buttons emit the events via `logEvent` (abandon behind a confirm), then route to `/roadmaps`.
- [ ] `roadmapLifecycle.ts` is pure and classifies Active / Completed / Abandoned via latest matching terminal event by `roadmapCreatedAt`; replan supersedes.
- [ ] `/study/roadmaps` renders the three groups + the empty state (italic Fraunces) + "Start a new roadmap" → onboarding.
- [ ] Clicking an entry opens the detail calendar in read-only mode.
- [ ] `roadmapLifecycle.test.ts` covers active/completed/abandoned/replan-supersede/multi-roadmap.
- [ ] Walkthrough extended (write only): screenshots `15-complete-confirm`, `16-history-completed`, `17-history-abandoned`, `18-history-empty`, `19-history-readonly`.
- [ ] `pnpm --filter app test`, typecheck, lint pass.

### Implementer report
Status: ✅ Implemented, awaiting review. Commit: `192cbef`.

Files changed:
- `apps/app/src/sync/types.ts`
- `apps/app/src/roadmap/roadmapLifecycle.ts`
- `apps/app/src/roadmap/roadmapLifecycle.test.ts`
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/pages/Roadmaps.tsx`
- `apps/app/src/roadmap/roadmap.css`
- `e2e/roadmap.spec.ts`

What was done:
- Added `RoadmapMarkedCompletePayload` and `RoadmapMarkedAbandonedPayload` with `{ roadmapCreatedAt, resolvedAt, reason? }`.
- Added pure `deriveRoadmapLifecycle(events)` to classify roadmap snapshots into Active / Completed / Abandoned, with superseded replans separated out of active history groups.
- Enabled `RoadmapCalendar` footer actions: Mark complete emits `RoadmapMarkedComplete`; Abandon confirms then emits `RoadmapMarkedAbandoned`; both route to `/roadmaps`.
- Updated active roadmap selection so `/roadmap` shows only lifecycle-active roadmaps, not a latest roadmap already resolved by a terminal event.
- Replaced the `/roadmaps` stub with Active / Completed / Abandoned sections, italic empty state, onboarding CTA, and read-only calendar selection for history entries.
- Extended the write-only Playwright walkthrough with `15-complete-confirm`, `16-history-completed`, `17-history-abandoned`, `18-history-empty`, and `19-history-readonly`.

Deviations:
- Phase 6 prereq `grep -n "logEvent" apps/app/src/sync/useSync.ts` failed because `useSync.ts` only returns `useSyncContext`; the real `logEvent` implementation is in `apps/app/src/sync/SyncProvider.tsx`. I confirmed `useSync().logEvent` exists through the context and continued.
- `deriveRoadmapLifecycle` exposes a `superseded` bucket internally so replanned snapshots do not appear as active without inventing a terminal event. The rendered history still shows the three required groups only.

Self-check vs criteria:
- Terminal payload types are present in `sync/types.ts`.
- Detail footer emits terminal events through `logEvent`; abandon is guarded by `window.confirm`; both navigate to `/roadmaps`.
- `roadmapLifecycle.ts` is pure and unit-tested for active, completed, abandoned, replan-supersede, and multi-roadmap grouping.
- `/study/roadmaps` renders Active / Completed / Abandoned groups, empty state, and onboarding CTA.
- Clicking an entry renders a read-only `RoadmapCalendar`.
- Walkthrough steps `15` through `19` are authored only; E2E was not run per plan constraint.
- Verification passed: `pnpm --filter app test`, `pnpm --filter app typecheck`, and `pnpm lint` (lint passes with 6 pre-existing warnings).

### Reviewer findings

**Reviewed:** 2026-06-26 (Cowork) · commit `192cbef` · diff + inspection; tests not executed (sandbox rollup env bug).

All 7 criteria ✅. Terminal payload types `{ roadmapCreatedAt, resolvedAt, reason? }` added to `sync/types.ts`; footer emits via `useSync().logEvent` (abandon behind `window.confirm`) then `navigate('/roadmaps')`; `roadmapLifecycle.ts` is pure and matches by **`roadmapCreatedAt` identity (not array index)**, latest terminal by `resolvedAt` wins, terminal check precedes supersede so a resolved replan still classifies correctly; `/roadmaps` renders Active/Completed/Abandoned + Fraunces-italic empty state + `to="/onboarding"`; history entry → `<RoadmapCalendar roadmapCreatedAt readOnly>` and `readOnly` genuinely disables resolve/edit/replan (handler early-returns + buttons hidden/disabled); `roadmapLifecycle.test.ts` covers active/completed/abandoned/replan-supersede/multi-roadmap; walkthrough `15–19`. No `/study` route prefix; empty state uses `--font-display` (Fraunces). Info only: `latestTerminalFor` passes `createdAt` twice (harmless redundancy); the internal `superseded` bucket isn't rendered (documented deviation — keeps replanned snapshots out of "active" without a fake terminal event).

**Status: ✅ Verified.** No changes requested.

### Resolution

---

## Phase 7 — Replan interface seam routed to Python (stubbed UI)

### Acceptance criteria
- [ ] `postRoadmapRegenerate` added to `intelligenceClient.ts`, POSTing to `${BASE}/v1/roadmap/regenerate`, mirroring `postCalibration` (auth header, AbortController timeout, retry/backoff, typed errors).
- [ ] Error normalization follows rule `fetch-typed-error-normalization` (normalize by `name`, not `instanceof Error`).
- [ ] `mapToRegenerateRequest.ts` (pure) builds the exact Python request: `materials[{id,title,totalMinutes,role,additionOrder}]`, `weeks/startDate/selectedStudyDays/weekdayHours/weekendHours`, and `pins[]` with `reason ∈ {completed,today,user-edited}`.
- [ ] `replanRoadmap(events, opts)` boundary calls map→post→parse to `RoadmapOutput`, with an internal TS `offlineReplan` fallback behind the same signature (not UI-wired).
- [ ] `/replan` route reserved in `App.tsx` (under ProtectedRoute + RequireOnboarding; no `/study` in the path) rendering a clear stub.
- [ ] Tests: `mapToRegenerateRequest` field-mapping + pin construction; `postRoadmapRegenerate` 401/≥500/timeout(real `Error` subclass named `AbortError`)/network-`TypeError` exhaustion.
- [ ] Walkthrough extended (write only): screenshot `20-replan-stub`; `/study/replan` resolves under ProtectedRoute + RequireOnboarding with no double `/study` prefix.
- [ ] `pnpm --filter app test`, typecheck, lint pass.

### Implementer report
Status: ✅ Implemented, awaiting review. Commit: `84abbd2`.

Files changed:
- `apps/app/src/lib/intelligenceClient.ts`
- `apps/app/src/lib/intelligenceClient.test.ts`
- `apps/app/src/roadmap/replan/mapToRegenerateRequest.ts`
- `apps/app/src/roadmap/replan/mapToRegenerateRequest.test.ts`
- `apps/app/src/roadmap/replan/replanRoadmap.ts`
- `apps/app/src/App.tsx`
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/pages/Week.tsx`
- `e2e/roadmap.spec.ts`

What was done:
- Added `postRoadmapRegenerate(body)` to the intelligence client, posting to `/v1/roadmap/regenerate` with the same auth header, timeout, retry/backoff, and typed-error normalization behavior as `postCalibration`.
- Added `RoadmapServiceError` and unit coverage for auth failures, transient 5xx retry, real `Error`-subclass `AbortError` timeout normalization, and exhausted network `TypeError` normalization.
- Added pure `mapToRegenerateRequest(events, today)` to map app event state to the Python regenerate request shape: materials, capacity fields, completed pins, today pins, and reserved `RoadmapEdited` user-edited pins.
- Added `replanRoadmap(events, opts)` as the typed boundary; it defaults to the Python transport and keeps TS `regenerateRoadmap` as an opt-in fallback behind the same signature.
- Reserved `/replan` under the protected/onboarded app shell, linked Roadmap and Week replan affordances to it, and added walkthrough screenshot `20-replan-stub`.

Deviations:
- `mapToRegenerateRequest` takes `today` as an explicit argument to keep the mapper pure and deterministic. `replanRoadmap` supplies the current ISO date by default at the boundary.
- The offline TS fallback is opt-in through `offlineFallback`; it is intentionally not wired to UI in this round.

Self-check vs criteria:
- `postRoadmapRegenerate` exists and mirrors calibration auth/timeout/retry/typed-error behavior.
- Mapper tests cover material ordering, capacity fields, completed/today pins, absence of user-edited pins when no `RoadmapEdited` events exist, and exact Python material field names.
- `/replan` route is reserved without a `/study` path literal.
- Roadmap and Week Replan affordances route to `/replan`.
- Walkthrough step `20-replan-stub` is authored only; E2E was not run per plan constraint.
- Verification passed: `pnpm --filter app test`, `pnpm --filter app typecheck`, `pnpm lint`, `grep -n "postRoadmapRegenerate" apps/app/src/lib/intelligenceClient.ts`, and `grep -n "/replan" apps/app/src/App.tsx`.

### Reviewer findings

**Reviewed:** 2026-06-26 (Cowork) · commit `84abbd2` · diff + inspection against the Python ground truth (`services/intelligence/app/schemas/roadmap.py`, `routers/roadmap.py`) and rules `fetch-typed-error-normalization` + `react-router-v7-basename`; tests not executed (sandbox rollup env bug).

All 8 criteria ✅. `postRoadmapRegenerate` mirrors `postCalibration` (supabase auth header, `AbortController` timeout, retry/backoff) and POSTs `/v1/roadmap/regenerate`. **Error-normalization trap avoided:** `normalizedRoadmapError` passes through only the client's own typed errors and **wraps the else-`Error` branch** (no `instanceof Error` pass-through), mapping `name === 'AbortError'` → timeout. `mapToRegenerateRequest` is pure and matches the Python schema **exactly** — `materials[{id,title,totalMinutes,role,additionOrder}]` (correctly translating app `estimatedDuration` → `totalMinutes`), capacity fields from `RoadmapCreatedPayload`, `pins[]` with `reason ∈ {completed,today,user-edited}` (so no silent 422). `replanRoadmap(events, opts)` is the boundary (map→post→parse), with an opt-in TS `offlineReplan` fallback behind the same signature, not UI-wired. `/replan` is reserved under `ProtectedRoute + RequireOnboarding` with path `/replan` (no `/study`). Tests cover field-mapping/pins and 401→auth / ≥500→retryable / timeout via a **real `Error` subclass named `AbortError`** (not jsdom `DOMException`) / network-`TypeError` exhaustion. Walkthrough `20` asserts no double `/study`. Info only: `parseRoadmapOutput` is an unchecked cast (acceptable for a stub; add runtime validation when `/replan` is wired); 401 reuses `CalibrationAuthError` (intentional shared auth class).

**Status: ✅ Verified.** No changes requested.

### Resolution

---

## Cross-cutting checks (reviewer, at plan completion) — ✅ all pass (2026-06-26)
- [x] No `/study` prefix introduced in any `to`/route path (rule `react-router-v7-basename`) — confirmed across all 5 review passes; `/study/...` appears only in e2e `page.goto` URLs.
- [x] No raw hex colors in new UI; design tokens only, incl. the two new `--cal-*` tokens (rule `form-design-spacing`, D-14) — hex scans of `apps/app/src/roadmap/*` + `roadmap.css` returned none.
- [x] D-14 visual contract honored everywhere: rust only on `skipped`; today = `--cal-today-fill`; current week = `--cal-week-band`; every status chip is icon+color.
- [x] `e2e/roadmap.spec.ts` is one ordered visual walkthrough (steps `01`–`20`) writing screenshots to `e2e/__screens__/roadmap/`; authored but not executed (environment constraint, D-15).
- [x] No Dexie schema change was needed — terminal events are additive event kinds; no table touched.
- [x] E2E specs written but not executed (environment constraint).
- [x] `.work/STATUS.md` row updated to reflect the shipped + verified state.

## Outcome — all 7 phases ✅ Verified (2026-06-26, Cowork)
Reviewed by diff + code inspection (5 parallel review passes); test suites authored but not run in the Cowork sandbox (`vitest`/`pnpm` blocked by a `@rollup/rollup-linux-arm64-gnu` optional-dep load error — environment, not a test failure). No changes requested. Follow-ups noted (non-blocking): (a) Phase 5 swipe should require horizontal dominance (`|deltaX| > |deltaY|`) to avoid spurious month paging on vertical scroll; (b) Phase 7 `parseRoadmapOutput` should gain runtime validation when the `/replan` UI is built. **Recommended:** run the Vitest + Playwright suites in a `node >=20` environment with deps reinstalled to confirm the authored tests pass green before treating the feature as shippable.
