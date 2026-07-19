# VERIFICATION — material ↔ session decoupling

Round-trip review log for [`PLAN.md`](./PLAN.md). **Planner pre-fills acceptance criteria** (below).
**Implementer (Codex/Sonnet)** fills the *Implementer report* per phase (files, commit SHA, deviations,
self-check). **Reviewer (Cowork)** fills *Reviewer findings* (per-criterion verdict, status
`✅ Verified` / `🔁 Changes requested`) by reading the actual diff (`git show <sha>`), not the report alone.
A phase is **not done** until it's `✅ Verified`.

Legend: `[ ]` unmet · `[x]` met · `[~]` partial. Status: ☐ Not started · 🟡 In progress · ✅ Verified · 🔁 Changes requested.

Cross-cutting invariants (must hold at every phase):
- Zero destructive event migration; legacy `RoadmapCreated.slots` still readable (D-02/D11).
- Calibration feed intact — `interrupted`/partial `SessionLogged` still satisfy `source:'active' && activeMinutes>0` with denominator `materialConsumedMinutes ?? plannedMinutes`; research G1 "INCLUDE partials".
- No detector/calibrator model change (research G1/G2).
- Finish-date labels shown **provisional**; ETA is a cold-start fallback layered on GP, never a GP replacement (research G3 / D-07).
- Per-user Dexie isolation preserved; new event kinds need no schema version bump (events table is generic) — but any `activeSession` field additions must not break existing records.
- New roadmaps can omit `slots`; app read paths must use `materialIds` + booking events and only synthesize legacy slots for compatibility.

---

## Plan review log

- **2026-07-01** Senior ML/UI review hardened `PLAN.md` against the current code and supporting docs. Resolved hollow steps around deterministic booking IDs, no-slot roadmap reads, material-consumed calibration denominators, out-of-session material progress, direct `/session` starts, client-side ETA wiring, and replan shorten/drop payloads. No app implementation code changed in this review.

---

## Phase 1 — engine bookings + event shapes · Status: ✅ Verified

**Acceptance criteria**
- [x] `Booking { id, date, estimatedDuration, materialId?, status }` + `BookingStatus` exported from `packages/roadmap-engine/src/index.ts`.
- [x] `generateBookings(BookingLayoutInput)` returns bookings by **book-to-exhaustion + buffer**: count = `ceil(totalMaterialMinutes / per-day capacity)` laid on selected study-days from `startDate`; bookings are **blank** (`materialId` undefined); weekend/weekday capacity honored; days past exhaustion unbooked; generated IDs are deterministic (`planned:<ordinal>:<date>` or equivalent), not `uuid()` (D-01).
- [x] `suggestMaterialForBooking` prefers a started-but-not-done material, else foundation→anchor→practice interleave; skips done (D9a #2).
- [x] Packer removed from the new live booking path: no `candidateMaterialIds`/`__rest__`/tie-resolution/`tagRoleCandidates`/`assignMaterialsToSlots` in `generateBookings`; these remain only in deprecated legacy slot APIs. `inferRole`/`ROLE_TO_LABEL`/`LABEL_TO_ROLE` retained.
- [x] `sync/types.ts`: `SessionBookedPayload`, `BookingEditedPayload` (with `materialId?: string|null` detach), `BookingClearedPayload`, and `MaterialProgressMarkedPayload` added; `RoadmapCreatedPayload.materialIds?` and `materialDurationOverrides?` added; `RoadmapCreatedPayload.slots` made optional/legacy-only (not deleted).
- [x] `SessionLoggedPayload`: `bookingId?`, `resolution?: 'completed'|'trimmed'|'interrupted'`, `materialPosition?`, `plannedSessionMinutes?`, and `materialConsumedMinutes?` added. `ActiveSessionRecord`/`SessionSlotData` carry `bookingId`, `materialEstimatedMinutes`, and `materialStartPosition` without breaking older records.
- [x] `pnpm --filter @study-tracker/roadmap-engine test` green; `pnpm --filter app typecheck` green (deprecated `generateRoadmap` kept while current callers migrate in later phases).
- [~] Booking-layout tests added. Legacy slot/packing tests were retained as deprecated API regression coverage because old callers still compile against that path until Phases 3/5/7.

**Implementer report (2026-07-01):**
- Files changed: `packages/roadmap-engine/src/roadmap-engine.ts`, `packages/roadmap-engine/src/index.ts`, `packages/roadmap-engine/src/roadmap-engine.test.ts`, `apps/app/src/sync/types.ts`, `apps/app/src/session/types.ts`, plus minimal optional-slot guards in app callers required for typecheck.
- Commit SHA: `327ca45` (`feat(planner): add booking foundations`). Planning baseline was already committed as `8c65b07`.
- What changed: added deterministic `Booking`/`BookingLayoutInput`/`generateBookings`, `suggestMaterialForBooking`, deprecated legacy slot APIs, booking/session/material-progress event payload types, optional `materialIds`/`materialDurationOverrides`, optional legacy `slots`, and session booking/material-position fields.
- Deviations: retained legacy slot packer tests instead of deleting them because current app callers still import deprecated slot APIs. No new booking path depends on the packer.
- Self-check: `pnpm --filter @study-tracker/roadmap-engine test` passed (`36` tests); `pnpm --filter app typecheck` passed; `git diff --check` passed.

**Reviewer findings (2026-07-01, Cowork senior review — read against `git show 327ca45`):** **Status: ✅ Verified**
- [x] `Booking`/`BookingStatus`/`BookingLayoutInput` + `generateBookings` + `suggestMaterialForBooking` exported from `index.ts` (verified in diff).
- [x] `generateBookings` is book-to-exhaustion + buffer, blank bookings, deterministic `planned:<ordinal>:<date>` IDs, weekday/weekend capacity honored, no RNG. Tests assert count (`ceil` = 3 for 180min@60), buffer day unbooked, ID stability across repeated calls, mixed weekend capacity. ✅
- [x] Packer quarantined: `generateBookings` contains no `candidateMaterialIds`/`__rest__`/`tagRoleCandidates`/`assignMaterialsToSlots`; `generateRoadmap` + slot mutators kept and tagged `@deprecated`; `inferRole`/`ROLE_TO_LABEL`/`LABEL_TO_ROLE` retained. ✅
- [x] `sync/types.ts`: `SessionBookedPayload`, `BookingEditedPayload` (`materialId?: string|null` detach), `BookingClearedPayload`, `MaterialProgressMarkedPayload`; `RoadmapCreatedPayload.materialIds?`/`materialDurationOverrides?` added; `slots?` made optional (not deleted). ✅
- [x] Session payload/record fields added (`bookingId`, `resolution:'…|interrupted'`, `materialPosition`, `plannedSessionMinutes`, `materialConsumedMinutes`, `materialEstimatedMinutes`, `materialStartPosition`) — all optional, back-compat preserved. ✅
- [x] `pnpm --filter @study-tracker/roadmap-engine test` = 36 green (re-run by reviewer); `pnpm --filter app typecheck` green (re-run). Optional-slot guards in `Step4Confirm`/`RoadmapCalendar`/`mapToRegenerateRequest` are non-behavioral (`payload.slots ?? []`). ✅
- Non-blocking nits (do not gate Phase 1): (1) `suggestMaterialForBooking` applies role order **sequentially** (all foundation, then anchor, then practice) rather than a true interleave, and drops the `usedMaterialIds` guard in the second (fallback) role loop — acceptable under the plan's wording, revisit if the suggestion UX in P3/P4 needs interleave. (2) `roadmapIdentity` is now duplicated across `mapEvents.ts`, `roadmapLifecycle.ts`, `mapToRegenerateRequest.ts` — consider hoisting to one shared util in a later phase.

**Resolution (on redo):** _n/a — verified as-is._

---

## Phase 2 — derivations + read-time adapter · Status: ✅ Verified

**Acceptance criteria**
- [x] `deriveBookingStatuses(bookings, sessions, today)` → per-booking `done|booked|missed|unplanned` by **exact `bookingId`**; interrupted session does **not** mark `done`; unplanned = logged w/o matching bookingId grouped by date (D-03).
- [x] `buildMaterialLedger` returns per-material `{estimatedMinutes, activeMinutesLogged, estimatedConsumedMinutes, remainingEstimatedMinutes, done, started, lastPosition}` and folds both `SessionLogged` partials and `MaterialProgressMarked`; `buildDailyActivity` returns per-day minutes. Both exported from `packages/progress/src/index.ts`.
- [x] Shared calibration denominator helper uses `materialConsumedMinutes ?? plannedMinutes`; calibration test covers a partial session where `activeMinutes/plannedMinutes` would be wrong, and Bayesian/CUSUM/trend/calibration code paths use the helper.
- [x] `SessionEvent` gains `bookingId`/`materialPosition`/`materialConsumedMinutes`; `mapSessions` maps them.
- [x] `mapBookings` folds `SessionBooked`/`BookingEdited`/`BookingCleared` by `bookingId` in event order (detach via `materialId:null`); scoped to active roadmap.
- [x] **Legacy adapter** `deriveBookingsForRoadmap`: legacy `RoadmapCreated.slots` (future) → bookings (`date + plannedMinutes||capacity + candidateMaterialIds[0]`), then booking events applied on top; new roadmaps derive purely from booking events (D-02/D11).
- [x] `mapEvents.findActiveRoadmap`, `roadmapLifecycle.ts`, and `roadmapProgress.ts` tolerate `RoadmapCreated.slots === undefined`; new material sets come from `materialIds`, legacy material sets from slots.
- [x] `deriveSlotStatuses` marked `@deprecated` but still present (call sites migrate in Phase 5).
- [x] Capacity weekly-target helper available for Week (D-08).
- [x] `pnpm --filter @study-tracker/progress test` + `pnpm --filter app test -- mapEvents` green; new tests cover legacy-adapter + booking-fold + status derivation.

**Implementer report (2026-07-01):**
- Files changed: `packages/progress/src/{deriveBookingStatuses,materialLedger,dailyActivity,calibrationDenominator,types,index,deriveSlotStatuses,bayesian,calibration,cusum,trend}.ts`, matching progress tests, `apps/app/src/progress/mapEvents.ts`, `apps/app/src/progress/mapEvents.test.ts`, `apps/app/src/roadmap/{roadmapLifecycle,roadmapProgress}.ts`, plus minimal legacy optional-slot guards/tests in `RoadmapCalendar`, `Step4Confirm`, and `mapToRegenerateRequest`.
- Commit SHA: `327ca45` (`feat(planner): add booking foundations`).
- What changed: added booking status derivation, material ledger, daily activity, calibration denominator helper, new SessionEvent fields, booking event folding, legacy-slot-to-booking adapter, material scoping by `materialIds`, no-slot active-roadmap bridge, no-slot lifecycle/progress summaries, and capacity weekly-target helper.
- Deviations: `deriveBookingStatuses` uses a local structural `BookingLike` instead of importing `@study-tracker/roadmap-engine` because `@study-tracker/progress` does not declare that package as a dependency and app typecheck caught the boundary. This preserves structural compatibility without adding a package dependency.
- Self-check: `pnpm --filter @study-tracker/progress test` passed (`90` tests); `pnpm --filter app test -- mapEvents` passed (`52` app test files / `472` tests under the filter run); `pnpm --filter app typecheck` passed; `git diff --check` passed.
**Reviewer findings (2026-07-01, Cowork senior review — read against `git show 327ca45`):** **Status: 🔁 Changes requested**

Logic is correct and complete; the block is a **missing-test** gap that the plan explicitly requires.

- [x] `deriveBookingStatuses` — exact-`bookingId` match; interrupted session does **not** mark done (test asserts `missed`); future/past unmatched → `booked`/`missed`; unplanned grouped by date. Verified + well-tested. ✅
- [x] `buildMaterialLedger` — `estimatedConsumedMinutes = max(Σ materialConsumedMinutes, latest-position-converted)`; folds in-session + out-of-session marks; `done`/`started`/`lastPosition`/`remaining` correct. `buildDailyActivity` per-day. Both exported + tested. ✅
- [x] **Calibration denominator** helper `materialConsumedMinutes ?? plannedMinutes` wired into **all four** modules (`bayesian`, `cusum`, `trend`, `calibration`) via `isCalibrationSession`/`calibrationDenominator`; test proves a partial session yields ratio `30/20` (multiplier > 1), not `30/60`. Legacy events fall back to `plannedMinutes` → back-compat intact (G1/D8). ✅
- [x] `SessionEvent` gains `bookingId`/`materialPosition`/`materialConsumedMinutes`/`plannedSessionMinutes`/`resolution`; `mapSessions` maps them. ✅
- [x] `mapBookings` folds `SessionBooked`/`BookingEdited`/`BookingCleared` by `bookingId` in event order, scoped to roadmap; detach via `materialId:null` tested; `BookingCleared` order tested. ✅
- [x] Legacy adapter `deriveBookingsForRoadmap` maps future legacy slots → bookings then applies booking events on top; `mapMaterialsForRoadmap` scopes by `materialIds` (falls back to slot candidates for legacy) — tested (`mat-2` only, not all `MaterialAdded`). ✅
- [x] `findActiveRoadmap`/`findRoadmap`/`roadmapLifecycle.ts`/`roadmapProgress.ts` tolerate `slots === undefined`; `roadmapIdentity` correctly reroutes `RoadmapReplanned` booking scope to the original `roadmapCreatedAt`. ✅ (compiles + typecheck green)
- [x] `deriveSlotStatuses` tagged `@deprecated`, still present. `capacityWeeklyTarget` (D-08) present + exported. ✅
- [~] **`pnpm --filter @study-tracker/progress test` (90) + `mapEvents` (472) green — BUT one plan test requirement is unmet.** The Phase-2 "Tests" block requires: *"`roadmapLifecycle.test.ts` + `roadmapProgress.test.ts`: no-slots roadmap does not crash and computes active dashboard progress from bookings/sessions."*
  - `roadmapLifecycle.test.ts` received **only** mechanical `base.slots![0]` non-null fixups — **no** new test exercising the new no-slots path (`bookingIdsForRoadmap` / `completedBookingCount`).
  - **`roadmapProgress.test.ts` does not exist.** The ~90-line no-slots branch of `summarizeRoadmapProgress` (`bookingsForEntry`, `materialLedgerForEntry`, completed-booking counting, ledger-vs-booking `totalPlanned`/`toGo`) is the **largest new logic block in Phase 2 and has zero coverage.** VERIFICATION checks the "tolerate `slots===undefined`" criterion `[x]`, but that tolerance is untested for the progress summary.

**Required changes to reach ✅ Verified (Phase 2):**
1. Add `apps/app/src/roadmap/roadmapProgress.test.ts`: a no-slots `RoadmapLifecycleEntry` (payload with `materialIds`, no `slots`) + `MaterialAdded` + `SessionBooked` + `SessionLogged` (one completed, one `interrupted`) → assert `summarizeRoadmapProgress` returns correct `completedSlots`/`totalSlots`/`loggedMinutes`/`toGoMinutes`/`percentComplete`, that an `interrupted` session does **not** count as completed, and that ledger-based `totalPlanned`/`toGo` are used when `materialIds` resolve.
2. Add a no-slots case to `roadmapLifecycle.test.ts` proving `deriveRoadmapLifecycle` computes `totalSlots`/`completedSlots`/`percentComplete` from booking events (via `bookingIdsForRoadmap`/`completedBookingCount`) and does not crash when `payload.slots === undefined`.
3. Re-run `pnpm --filter @study-tracker/progress test && pnpm --filter app test -- roadmapProgress roadmapLifecycle` and update the implementer report.

No correctness defects found in the code itself — `sessionsCount === completedSlots` matches the legacy branch's own semantics, so no behavioral drift for existing consumers.

**Resolution (redo 2026-07-01):**
- Analysis: the Phase 2 logic was correct, but my first self-check over-weighted green package/mapEvents tests and missed the plan's app-level test line for `roadmapLifecycle.test.ts` + `roadmapProgress.test.ts`. That left the no-slots dashboard progress branch unguarded despite being production logic.
- Added `apps/app/src/roadmap/roadmapProgress.test.ts`: no-slots `RoadmapLifecycleEntry` with `materialIds`, `MaterialAdded`, `SessionBooked`, and `SessionLogged` events; asserts `completedSlots=1`, `totalSlots=2`, `loggedMinutes=70`, `totalPlannedMinutes=180`, `toGoMinutes=60`, and `percentComplete=50`; interrupted booked session is logged but does not count complete; material-ledger totals win over booking-duration fallback.
- Added a no-slots case to `apps/app/src/roadmap/roadmapLifecycle.test.ts`: proves `deriveRoadmapLifecycle` handles `payload.slots === undefined`, counts active booking events after `BookingCleared`, ignores interrupted sessions for completion, and returns `totalSlots=2`, `completedSlots=1`, `percentComplete=50`.
- Verification: `pnpm --filter @study-tracker/progress test` passed (`90` tests); `pnpm --filter app test -- roadmapProgress roadmapLifecycle` passed (`53` files / `474` tests under the filter run); `pnpm --filter app typecheck` passed; `git diff --check` passed.
- Status: redo implemented locally; awaiting Cowork reviewer re-check. Not self-marking Phase 2 verified.

**Reviewer re-check (2026-07-01, Cowork — read both new test files + re-ran suites):** **Status: ✅ Verified**
- [x] `apps/app/src/roadmap/roadmapProgress.test.ts` added and meaningful: no-slots entry (`materialIds:['mat-1','mat-2']`, no `slots`) + `MaterialAdded`(100/80) + 2×`SessionBooked` + `SessionLogged`(completed) + `SessionLogged`(interrupted). Asserts the exact expected summary object — `completedSlots=1` (interrupted excluded), `totalSlots=2`, `loggedMinutes=70`, ledger-driven `totalPlannedMinutes=180`/`toGoMinutes=60`, `percentComplete=50`. Exercises `bookingsForEntry` + `materialLedgerForEntry` + completed-booking counting. ✅
- [x] `roadmapLifecycle.test.ts` no-slots case added: proves `payload.slots === undefined` tolerated, `bookingIdsForRoadmap` honors a `BookingCleared` (booked 3, cleared 1 → `totalSlots=2`), interrupted session excluded from `completedBookingCount` (`completedSlots=1`, `percentComplete=50`). Goes beyond the minimum ask. ✅
- [x] Reviewer re-ran `pnpm --filter app test -- roadmapProgress roadmapLifecycle` → **53 files / 474 tests green**; `pnpm --filter app typecheck` clean. The `[~]` test-coverage criterion is now `[x]`.
- No correctness defects. **Phase 2 closed.** Both foundation phases (1 & 2) are ✅ Verified — proceed to Phase 3 (onboarding p3).

---

## Phase 3 — Onboarding page 3 · Status: ✅ Verified

**Acceptance criteria** (visual contract `mocks/proposed/onboarding-3.html`)
- [x] `SchedulePreview`, `SwapFab`, tie-resolution, `previewEdits`, `generateRoadmap` slot path removed from `Step3Preview.tsx`.
- [x] Preview = capacity **summary** (projected-finish verdict w/ **provisional** eyebrow, backlog-fits-capacity bar, sessions/total/buffer stats, material directory) + **expandable multi-month calendar** (toggle on the finish card; `‹ ›` month arrows; booked study-days marked) — matches the mock (D13/D13a).
- [~] `Step3Materials.tsx` materials **grouped by type** (Videos/Playlists/Links/Manual, collapsible, count+total) with compact expand-on-edit rows (D14). Implemented grouped compact sections and expandable rows; group headers themselves are not collapsible.
- [x] Playlist row opens the **existing `PlaylistPickerPopup`** modal — not an inline checklist (D14a).
- [x] `handleCommit` emits events in order: `MaterialAdded` per material → `RoadmapCreated` with capacity+deadline+`materialIds` and **no `slots`** → `SessionBooked` per generated deterministic booking → `OnboardingCompleted`.
- [x] **`/study/onboarding/3?new=1` renders without the packer bug** (no tie warnings, no crash).
- [x] `pnpm --filter app typecheck` + `pnpm --filter app test -- onboarding` green; Playwright authored (not run).

**Implementer report (2026-07-01):**
- Files changed: `apps/app/src/onboarding/steps/Step3Preview.tsx`, `Step3Materials.tsx`, onboarding tests, `apps/app/src/onboarding/onboarding.css`, plus sync/EventStore created-at plumbing so no-slot `RoadmapCreated` and generated `SessionBooked` events share the intended roadmap identity.
- Commit SHA: uncommitted local implementation in this working tree.
- What changed: replaced the slot packer preview with a booking summary, capacity bar, stats, material directory chips, and expandable calendar; grouped material rows by type; reused `PlaylistPickerPopup`; changed commit to emit `RoadmapCreated{materialIds}` with no `slots` followed by deterministic `SessionBooked` events.
- Deviations: group headers are not collapsible; rows expand for edit/attention states. Visual behavior is aligned with the mock intent but not a pixel-identical port.
- Self-check: `pnpm --filter app typecheck` passed; `pnpm --filter app test -- onboarding` passed (`55` files / `476` tests under the filter run after Phase 4 additions); `grep -n "SchedulePreview\|SwapFab" apps/app/src/onboarding/steps/Step3Preview.tsx` returned no matches; `git diff --check` passed. Authored Playwright coverage in `e2e/material-session-decoupling.spec.ts` includes `/study/onboarding/3?new=1` summary/no-tie assertions and was discovery-checked with `pnpm exec playwright test --config e2e/playwright.config.ts e2e/material-session-decoupling.spec.ts --list` (not executed).

**Reviewer findings (2026-07-01, Cowork senior review — read against `git show de2339a`):** **Status: ✅ Verified**
- [x] `Step3Preview.tsx` fully retires the slot packer: no `SchedulePreview`/`SwapFab`/`generateRoadmap`/tie/`previewEdits` (grep clean). Preview = provisional-eyebrow projected-finish toggle card (`role=button`, `aria-expanded`/`aria-controls`, Enter/Space) → slide-down multi-month calendar with `‹ ›` nav disabled at `calendarMonthBounds`, booked days marked; capacity bar + sessions/total/buffer stats + "What you'll study" directory chips. Matches D13/D13a. ✅
- [x] `handleCommit` emits exact order **MaterialAdded → RoadmapCreated{materialIds, slots:undefined} → SessionBooked×N → OnboardingCompleted**, clears the onboarding draft, and keeps the new-roadmap-while-active guard (routes to `/roadmaps`). Test `Step3Preview.test.tsx:178` asserts the kind order **and the cross-phase linkage** — `SessionBooked.roadmapCreatedAt === RoadmapCreated`'s explicit `createdAt` (via the new `logEvent(kind,payload,createdAt)` plumbing) with deterministic `planned:0:2026-07-01` IDs. This is the load-bearing tie between Phases 1–4 and it is proven. ✅
- [x] Materials grouped by type (Videos / Playlists / Links & articles / Manual) with count + total and compact expand-on-edit rows; playlist rows open the existing `PlaylistPickerPopup` (D14a). ✅
- [x] `logEvent`/`SyncEngine.logEvent`/`EventStore.append` `createdAt` param is optional + defaulted → backward compatible; also removes the prior local-vs-queue timestamp divergence. No sync regression. ✅
- [x] `pnpm --filter app typecheck` + `pnpm --filter app test -- onboarding` re-run by reviewer → green (55 files / 476 tests). Playwright authored (not run) per env constraint. ✅
- [~] **Non-blocking deviation (D14):** group section headers are not collapsible ("collapse finished buckets" unmet). Substance of D14 (grouped-by-type, counts, expand-on-edit, playlist modal) is met; collapsibility is cosmetic. Tracked as a follow-up, not a phase blocker.

**Resolution:** _n/a — verified; group-collapsibility tracked in follow-ups below._

---

## Phase 4 — Session flow (Home → pre-session → running end-sheet) · Status: ✅ Verified

**Acceptance criteria** (contracts `home.html`, `session-presession.html`, `session-running.html`)
- [x] Home booking card reads "Study session · ~Nmin" + **"Suggested material: <title>"**; Start passes `SessionSlotData{bookingId, materialId, plannedMinutes, …}` to `/session` (D15). Continue card preserved.
- [x] `Session.tsx` renders **`PreSessionSetup`** when `idle && no active record` instead of auto-starting; direct `/session` without location state derives today's booking or enters ad-hoc mode; running layout renders directly when a record exists (Continue bypasses setup — D-06).
- [~] `PreSessionSetup` matches V1 mock: suggested material as title + `material-strip` + "Change" (picker), **`SessionDial`** for planned length (cap-aware, pace-first recommended), "Start" → `lc.start({…, materialId, plannedMinutes, bookingId})`. Dial **not** on the running screen (D-05). Implemented a Marginalia-skinned circular readout plus range control; cap/recommendation is based on the booking target, not full hours-per-day minus done-today math.
- [x] `PreSessionSetup` ad-hoc start emits `SessionBooked` first, then starts with that `bookingId`.
- [x] `SessionLifecycle.interrupt(materialPosition?)` emits `SessionLogged{resolution:'interrupted', bookingId, materialPosition, plannedSessionMinutes, materialConsumedMinutes}`, material left open; `end()` (complete) carries `bookingId` plus complete-position denominator. `stale_midnight` now auto-interrupts (logs partial) instead of `SessionAbandoned` (D-04).
- [~] `EndSessionSheet`: single primary **End session** opens it; position capture (presets + % slider; YouTube auto); complete-vs-keep-open smart default from position; Pause·come-back-later stays ghost (D-04/D18). Running numeric timer/frame unchanged (D-05). Implemented presets/slider/smart default; YouTube-specific auto-position is not implemented yet.
- [x] Calibration feed intact — an interrupted active session still flows into `calibration.ts` filter (G1 partials INCLUDED).
- [x] `pnpm --filter app typecheck` + `pnpm --filter app test -- session` green; Playwright authored (not run).

**Implementer report (2026-07-01):**
- Files changed: `apps/app/src/pages/Home.tsx`, `Session.tsx`, `apps/app/src/session/{sessionPlanning,PreSessionSetup,SessionLifecycle,types}.ts(x)`, `apps/app/src/session/components/{EndSessionSheet,index}.ts(x)`, `apps/app/src/session/session.css`, related tests, and `e2e/material-session-decoupling.spec.ts`.
- Commit SHA: uncommitted local implementation in this working tree.
- What changed: Home now derives today's booking/material suggestion from booking events + material ledger; `/session` now renders setup instead of auto-starting when idle, derives direct-route suggestions, preserves active-record Continue bypass, logs ad-hoc `SessionBooked` before start, carries booking/material metadata into the active record, opens an end sheet for complete/interrupted logging, emits `materialPosition`/`materialConsumedMinutes`, and auto-interrupts stale-midnight sessions.
- Deviations: pre-session uses a range-backed dial rather than the full SVG radial interaction; cap math is booking-target based; YouTube auto-position capture remains manual through the percent sheet. These are UI/interaction fidelity gaps, not event-model blockers.
- Self-check: `pnpm --filter app typecheck` passed; `pnpm --filter app test -- session` passed (`55` files / `476` tests); `grep -n "interrupt\|materialPosition\|materialConsumedMinutes" apps/app/src/session/SessionLifecycle.ts` shows the Phase 4 lifecycle path; `grep -n "PreSessionSetup\|EndSessionSheet" apps/app/src/pages/Session.tsx apps/app/src/session/components/*` shows the wiring; `git diff --check` passed. Authored Playwright coverage in `e2e/material-session-decoupling.spec.ts` covers Home → pre-session → start → interrupt partial and Continue bypass; discovery checked with `pnpm exec playwright test --config e2e/playwright.config.ts e2e/material-session-decoupling.spec.ts --list` (not executed).

**Reviewer findings (2026-07-01, Cowork senior review — read against `git show de2339a`):** **Status: ✅ Verified**
- [x] `Session.tsx` gate (D-06): on `idle` + no active record → renders `PreSessionSetup` (no auto-start); direct `/session` without location state derives today's plan via `deriveTodaySessionPlan`; when a record exists (`state!=='idle'`) the running layout renders directly → **Continue bypasses setup**. `this.record` is set (SessionLifecycle:91) before the stale check, so the new stale-midnight `interrupt()` path is safe. ✅
- [x] Ad-hoc start (`handleStartFromSetup`): when `!bookingId && setupRoadmapCreatedAt`, emits `SessionBooked{bookingId: crypto.randomUUID(), date, estimatedDuration, materialId}` **before** `lc.start(...)` with that bookingId (D9a #3). Random UUID here is correct (user-created, not engine-deterministic). ✅
- [x] `SessionLifecycle`: `interrupt(pos?)` → `logSession('interrupted', …)` leaves material open; `end(pos?)` → `logSession('completed', …)`. `logSession` now emits `bookingId`, `plannedSessionMinutes`, `materialPosition`, `materialConsumedMinutes`, then clears the `activeSession` record and returns to idle. `stale_midnight` now `interrupt()`s (auto-logs the partial) instead of `SessionAbandoned` (D-04). Tests prove `materialConsumedMinutes=30` (25%→50% of 120min delta), interrupted resolution + fields, and no `SessionAbandoned` on midnight crossing. ✅
- [x] `materialConsumedMinutes` = position-delta converted vs `materialEstimatedMinutes` (completed⇒remaining-to-100%; interrupted⇒`min(remaining, start+active)`; fallback to `activeMinutes` when position unchanged) — matches D-04/D8; calibration denominator (Phase 2 helper) consumes it, so partials feed throughput not the dial target. ✅
- [x] `EndSessionSheet` (D18): single **End session** opens it; presets ¼/½/¾/Done + % slider; complete-vs-keep-open with smart default (`finished = position≥100`); "unusual" checkbox; one primary **Log session** → complete vs interrupt. Pause·come-back-later stays a ghost; running numeric timer/frame unchanged (D-05, no dial on running screen). ✅
- [x] Home (`Home.tsx`) surfaces the booking + suggested material via `deriveTodaySessionPlan` and passes `SessionSlotData` to `/session`; Continue card preserved. ✅
- [x] `pnpm --filter app typecheck` + `pnpm --filter app test -- session` re-run by reviewer → green (55 files / 476 tests). Playwright authored (not run). ✅
- [~] **Non-blocking deviations (UI fidelity, honestly disclosed):**
  1. Pre-session dial is a Marginalia-skinned `range` input, not the SVG radial from `SessionDial.jsx` (D7/D15a). Interaction is functionally equivalent for capturing `plannedMinutes`.
  2. Dial cap/recommendation is booking-target based, not the D5 soft-cap (`hoursPerDay − minutesLoggedToday`) nor the D6 pace-first nudge. The D6 pace-first recommendation is genuinely gated on Phase 6 (ETA/pace); the pure D5 soft-cap is buildable now — see follow-ups.
  3. `EndSessionSheet` YouTube auto-position (D18: "auto from video progress, read-only") is not pre-filled; user sets % manually. `videosCompleted` still flows into `SessionLogged`, so YouTube throughput signal is intact.
  None touch the event model, the D-06 gate, D-04 complete/interrupt semantics, or the calibration feed — all of which later phases depend on and all of which are correct + tested.

**Resolution:** _n/a — verified; deviations tracked in follow-ups below._

---

## Follow-ups tracked from Phase 3 & 4 review — RECTIFIED 2026-07-01 (post-review deviation fixes)
- [x] **D7/D15a** — Built the radial `SessionDial` (`apps/app/src/session/SessionDial.tsx`), a faithful port of `mocks/proposed/session-presession.html` (270° sweep, comfort/stretch bands split at cap, terracotta dashed `cap` notch, moss `rec` triangle, draggable ink knob, center readout). A visually-hidden `range` (aria-label "Planned session length") preserves keyboard/AT control + existing tests. Wired into `PreSessionSetup`. **Playwright visual check:** app dial screenshot is pixel-identical to the mock `#dial1`; full pre-session frame matches (eyebrow, title, strip, "Recommended 1h · within today's 2h cap", legend, terracotta primary).
- [x] **D5** — Pre-session soft-cap now derives from `hoursPerDay − minutesLoggedToday`: `sessionPlanning.dailyCapacityForDate` (weekday/weekend hours from the active roadmap payload) + `softCapMinutes` + today's minutes from `buildDailyActivity`; threaded through `SessionPlan` → `Session.tsx` → `PreSessionSetup` → `SessionDial`. Over-cap is allowed but flagged. Unit-tested (`sessionPlanning.test.ts`).
- [x] **D14** — Onboarding material group headers (Playlists + each type group) are now collapsible `<button>`s with `aria-expanded` + rotating chevron; body renders conditionally (`Step3Materials.tsx`).
- [x] **D18** — `EndSessionSheet` captures YouTube/playlist position automatically (read-only "N of M videos watched" → `materialPosition {kind:'videos', value, ofTotal}`) instead of the manual slider; non-YouTube keeps presets/slider. Unit-tested.
- [x] **D6** — pace-first *nudge* **implemented 2026-07-01** once Phase 6 landed the pace/ETA model: `sessionPlanning.recommendedSessionMinutes` computes the deadline-required daily rate (remaining material × throughput ÷ days-to-deadline), nudges from demonstrated pace toward it, clamps to the D5 soft cap, and recommends the cap when infeasible. Unit-tested. (See Phase 6 Resolution below.)

**Verification of the fixes:** `pnpm --filter app typecheck` clean; `pnpm --filter app test` green (**56 files / 480 tests**, +4: EndSessionSheet YouTube, 3× sessionPlanning); Playwright screenshot diff of the pre-session dial vs mock confirmed matching (throwaway preview harness used then removed). D6 remains the only open item and is correctly deferred to Phase 6.

---

## Phase 5 — Roadmap page + booking interactions · Status: ✅ Verified (deviations rectified 2026-07-01)

**Acceptance criteria** (contract `mocks/proposed/roadmap.html`)
- [x] `RoadmapCalendar.tsx` uses `deriveBookingStatuses` (over `deriveBookingsForRoadmap`) — **no `deriveSlotStatuses`** in the live roadmap path; legend = done/booked/missed/unplanned (D9).
- [x] Future = outlined **booking** bubbles (blank = "Session · pick at start"), past = filled **activity**; "+ add session" on empty in-month days.
- [x] Collapsible **Materials directory panel** below calendar (from `buildMaterialLedger`, per-material progress + Mark progress).
- [x] Header **ETA card** (finish + burn-up sparkline, **provisional**); full 5–6 row month grid (no clipping).
- [x] Booking editor: swap/detach material (`BookingEdited`, `materialId:null`), **duration stepper** (`BookingEdited`, *not the dial*), move day (`BookingEdited`), **remove** (`BookingCleared`) (D21).
- [x] Add-session sheet → `SessionBooked`; material picker includes "No material · pick at start".
- [x] `RoadmapEdited`/`logRoadmapEdit` slot-coordinate path replaced by booking events; `SessionDetailModal` = read-only past-session detail.
- [x] Materials directory **Mark progress** emits `MaterialProgressMarked{roadmapCreatedAt, materialId, markedAt, materialPosition, source:'directory'}`; it updates ledger/ETA and does not emit `SessionLogged`.
- [x] `pnpm --filter app typecheck` + `pnpm --filter app test -- RoadmapCalendar calendarModel` green; Playwright authored (not run).

**Implementer report (2026-07-01):**
- Files changed: `apps/app/src/roadmap/{RoadmapCalendar,CalendarCell,SessionDetailModal,calendarModel,statusStyles}.ts(x)`, `apps/app/src/roadmap/booking/*`, `apps/app/src/roadmap/roadmap.css`, roadmap tests, `apps/app/src/pages/{Home,Week}.tsx` copy touch, and `e2e/material-session-decoupling.spec.ts`.
- Commit SHA: uncommitted local implementation in this working tree.
- What changed: swapped the calendar binding to booking/activity bubbles; added done/booked/missed/unplanned status styles; added the provisional roadmap ETA card; added the collapsible material directory with per-material progress bars; added booking edit/add/progress sheets; replaced live slot-coordinate edits with `SessionBooked`/`BookingEdited`/`BookingCleared`/`MaterialProgressMarked`; kept past activity in the read-only `SessionDetailModal`; authored Playwright coverage for add/edit/remove booking events.
- Deviations: the booking/add sheets use native `<select>` material pickers and a native date input instead of reusing the full grouped directory/playlist picker modal from D10/D21. The required "No material · pick at start" detach path, duration stepper, move-day edit, remove, and booking events are implemented and tested; grouped picker reuse is deferred as UI polish, not event-model logic.
- Self-check: `pnpm --filter app typecheck` passed; `pnpm --filter app test -- RoadmapCalendar calendarModel` passed (`56` files / `483` tests under the filter run); `pnpm exec playwright test --config e2e/playwright.config.ts e2e/material-session-decoupling.spec.ts --list` listed the new roadmap interaction spec (not run, per project rule); `grep -n "deriveBookingStatuses" apps/app/src/roadmap/RoadmapCalendar.tsx` shows import + live derivation call; `grep -rn "deriveSlotStatuses" apps/app/src packages/progress/src` shows only the deferred Phase-7 replan path and deprecated progress export; `git diff --check` passed.

**Reviewer findings (2026-07-01, Cowork senior review — read the working-tree diff):** **Status: 🔁 Changes requested → RECTIFIED (see Resolution)**
- Event model, statuses, ETA card, directory panel, and Mark-progress path all correct and tested. ✅
- **[BLOCKING deviation vs D21 + `mocks/proposed/roadmap.html`]** The self-disclosed native-picker shortcut was a real mock/decision violation, not just polish: `BookingEditorSheet`/`AddSessionSheet` used a native `<select>` for material and a native `<input type="date">` for the day. The mock's load-bearing D21 element — the **radio-list material picker sheet** (`#bkPick`, "No material · pick at start" + per-material status rows, suggested pre-selected) opened from a **tappable material card** (`#bkEdit`) / **"Attach" link** (`#bkAdd`) — was **never built**. Per the user's firm "deviations must be rectified" bar, this blocks Phase 5.

**Resolution (rectified 2026-07-01):**
- New `apps/app/src/roadmap/booking/MaterialPickerSheet.tsx` — radio-list picker faithful to `#bkPick` (detach row first, `material-icon` per kind, `in progress · N/M` / `done` / `not started` sublines, suggested/attached pre-selected, "Use this material" / "Cancel"). New shared `booking/types.ts` (`BookingMaterialOption` enriched from the material ledger, `materialIcon`, `materialStatusLine`).
- `BookingEditorSheet` rebuilt to `#bkEdit`: tappable `bk-matcard` → picker (attach/swap/**detach** via `materialId:null`), settings-row Length stepper, **Day** as a `bk-link` backed by a hidden native date input (`showPicker()`), primary **Done** + **Remove booking** ghost, backdrop-close.
- `AddSessionSheet` rebuilt to `#bkAdd`: **Length first** (with "within today's Xh cap" hint from the D5 soft cap), then a Material **"Attach"** `bk-link` → picker.
- `RoadmapCalendar` now feeds ledger-enriched material options (`kind`/`started`/`done`/`remaining`/`lastPosition`) + today's cap; booking events (`BookingEdited`/`BookingCleared`/`SessionBooked`) unchanged. Added the mock's `bk-matcard`/`bk-link`/`chooser`/hidden-date CSS to `roadmap.css`; removed orphaned `bk-select-row`/`bk-date-input`.
- Tests: `MaterialPickerSheet.test.tsx` (new, 4); `RoadmapCalendar.test.tsx` booking flows migrated to the picker interaction. **Playwright screenshot of the live editor + picker confirmed pixel-faithful to `mocks/proposed/roadmap.html`.**
- Verification: `pnpm --filter app typecheck` clean; `pnpm --filter app test` green (**57 files / 494 tests**); E2E **run** (not just authored) — `e2e/material-session-decoupling.spec.ts` "Roadmap can add, edit, and remove bookings" passes end-to-end against real Supabase auth (throwaway user), exercising add→picker→attach, edit→picker→detach, remove, and Mark progress (asserts `SessionBooked`/`BookingEdited{materialId:null}`/`BookingCleared`/`MaterialProgressMarked`, no `SessionLogged`). A real-login live spec (`e2e/roadmap-booking-live.spec.ts`) also passes. **Status: ✅ Verified.**

---

## Phase 6 — ETA composite + Week wiring · Status: ✅ Verified (D6 closed 2026-07-01)

**Acceptance criteria** (research §2 / D-07/D-08)
- [x] `packages/progress/src/projectFinish.ts` with `COLD_START_N = 5` and switch: (1) `sessionCount<5` → analytic; (2) GP finish ≥ horizonEnd (non-crossing) → analytic; (3) else GP point + CI.
- [x] `sessionCount === 0 || consumedActualMin <= 0` returns `finishDate:null` with `basis:'analytic'` and `provisional:true`; product does not claim an ETA before evidence even though the Python helper returns today for no sessions.
- [x] Analytic uses **actual-minutes currency** (`consumedActual/elapsedDays` rate; `remainingActual/rate` days) with **no throughput multiplication**; mirrors the phase's product contract for `forecast_gp_plus_analytic_finish`.
- [x] `progress.ts` uses `projectFinish`; `projection` carries `basis`/`provisional`; CI only when `basis==='gp'` (analytic CI = null — not presented as calibrated).
- [x] This phase intentionally updates the local TS progress path consumed by the app; `/v1/progress` parity remains deferred unless the service becomes a live app dependency.
- [x] Home / Week / Roadmap ETA render the finish with a **provisional** eyebrow.
- [x] Week `plannedMinutesThisWeek` from **capacity** (D-08); no other Week UI change; no booked-day marker.
- [x] `pnpm --filter @study-tracker/progress test` green; `projectFinish.test.ts` covers all three branches + actual-minutes/no-pace-multiply; a case cross-checked vs the Python reference where feasible.

**Implementer report (2026-07-01):**
- Files changed: `packages/progress/src/{projectFinish,progress,types,index}.ts`, `packages/progress/test/{projectFinish,progress,deriveBookingStatuses,cusum}.test.ts`, `apps/app/src/progress/mapEvents.ts`, `apps/app/src/pages/{Home,Week}.tsx`, `apps/app/src/pages/{Home,Week}.test.tsx`, and `apps/app/src/progress/useProgress.test.ts`.
- Commit SHA: uncommitted local implementation in this working tree.
- What changed: added `projectFinish` with `COLD_START_N=5`, analytic cold-start/no-crossing fallback and GP crossing + CI; extended projection type with `basis`/`provisional`; wired `computeProgress` to use material ledger totals/remaining minutes from `mapEvents`; changed weekly target to capacity when roadmap capacity fields are present; added provisional finish copy on Home, Week, and Roadmap; added focused ETA tests.
- Deviations: direct Python subprocess parity was not added because the research helper's no-evidence behavior and elapsed-day convention differ from the product-specific Phase 6 contract. The TS tests assert the product contract directly: no ETA before evidence, cold-start analytic, actual-minutes/no pace multiplication, GP non-crossing rescue, and GP crossing + CI.
- Verification hygiene: `packages/progress/test/cusum.test.ts` used `Math.random()` in an unrelated "stable signal" fixture and failed once during package verification. The fixture is now seeded with the existing `mulberry32` helper; CUSUM production logic was not changed.
- Open follow-up: the D6 pace-first pre-session *recommendation nudge* remains open from the Phase 3/4 review. Phase 6 implemented the ETA/projection and Week capacity target specified in `PLAN.md`; `PreSessionSetup` still recommends the booking target clamped to D5 soft cap, not a demonstrated-pace-vs-required-rate nudge.
- Self-check: `pnpm --filter @study-tracker/progress test` passed (`13` files / `95` tests); `pnpm typecheck` passed across progress, roadmap-engine, app, and marketing; `pnpm --filter app test -- Home Week useProgress` passed (`56` files / `483` tests under the filter run); `grep -n "COLD_START_N\|projectFinish" packages/progress/src/projectFinish.ts` and `grep -n "projectFinish" packages/progress/src/progress.ts` show the new projection path; `git diff --check` passed.

**Reviewer findings (2026-07-01, Cowork senior review):** **Status: ✅ Verified (ETA/Week) · D6 follow-up RECTIFIED**
- `projectFinish` composite (COLD_START_N=5, cold-start/no-crossing analytic, GP+CI), no-evidence→null, actual-minutes currency, `basis`/`provisional` wiring, capacity Week target, and provisional finish copy on Home/Week/Roadmap — all correct and tested. ✅
- Python-subprocess parity is **not** a deviation — PLAN Phase 6 explicitly ships the TS mirror and defers `/v1/progress` parity to OQ-01/OQ-02. The `cusum.test.ts` change is a test-only `mulberry32` seeding fix; **no production CUSUM logic changed** (diff confirmed). ✅
- **D6 pace-first recommendation was the one open decision-vs-code gap.** It was legitimately gated on Phase 6's pace/ETA model; with that now landed, the deferred "booking-target clamped to cap" recommendation no longer matches D6.

**Resolution (D6 rectified 2026-07-01):**
- `apps/app/src/session/sessionPlanning.ts`: replaced `recommendedForBooking` with `recommendedSessionMinutes` implementing D6 — `requiredDailyMinutes = remaining material × throughput ÷ days-to-deadline` (actual-minutes currency), nudge from demonstrated pace toward the required rate, **clamp to the D5 soft cap**, and when the cap can't hit the deadline recommend the cap (never an impossible number; levers live on Replan/Phase 7). New helpers `demonstratedThroughputFactor` (uses the Phase-2 `calibrationDenominator`, i.e. `materialConsumedMinutes ?? plannedMinutes`) and `demonstratedDailyMinutes`; threaded through `deriveTodaySessionPlan`. `PreSessionSetup` consumes the richer `recommendedMinutes` unchanged.
- Tests: 7 new `sessionPlanning.test.ts` cases (throughput denominator, demonstrated-daily, pace-first nudge, infeasible→cap, throughput applied, no-material→booking-target). `pnpm --filter app test` green (57 files / 494). **D6 is now closed.** Status: ✅ Verified.

---

## Phase 7 — Replan window · Status: ✅ Verified (rework re-checked 2026-07-02)

**Acceptance criteria** (contract `mocks/proposed/replan.html` / D-09/D22)
- [x] `Replan.tsx` no longer renders `SchedulePreview` or calls `replanRoadmap`/`mapToRegenerateRequest` (slot-regen retired).
- [x] Levers = extend-deadline presets · hours/day stepper + study-day chips · per-material **shorten stepper + × drop** · "Keep current" = accept later finish; layout = split levers + sticky outcome (matches mock).
- [x] Live projected finish updates as levers change (**provisional**): current-pace baseline still uses `projectFinish`; capacity/material levers use a capacity-aware analytic projection.
- [x] Commit emits `RoadmapReplanned` with new **capacity+deadline+`materialIds`+`materialDurationOverrides`** (no slots) + `BookingCleared` (old future bookings) + `SessionBooked` (new bookings from `generateBookings`); dropped materials removed from `materialIds`; "Keep current" emits nothing.
- [x] No `/v1/roadmap/regenerate` call in the replan path.
- [x] `pnpm --filter app typecheck` + `pnpm --filter app test -- Replan` green; Playwright authored (not run).

**Implementer report (2026-07-01):**
- Files changed: `apps/app/src/pages/Replan.tsx` (complete rewrite — levers UI), `apps/app/src/roadmap/replan/commitReplan.ts` (new interface), `apps/app/src/roadmap/replan/commitReplan.test.ts` (updated to new behavior), `apps/app/src/roadmap/replan/Replan.test.tsx` (new), `apps/app/src/roadmap/roadmap.css` (new `.rp-*`/`.lever`/`.stepper`/`.daychip`/`.preset`/`.matline`/`.mshort`/`.mdrop`/`.provisional` CSS), `e2e/material-session-decoupling.spec.ts` (two new Playwright specs authored).
- Commit SHA: _see below after commit_
- What changed: `Replan.tsx` replaced `SchedulePreview`/`replanRoadmap`/`mapToRegenerateRequest`/slot path with a levers layout (extend deadline presets, hours/day stepper + study-day chips, per-material shorten/drop rows, sticky outcome panel with live `projectFinish` analytic re-projection). `commitReplan` emits `RoadmapReplanned{capacity, deadline, materialIds, materialDurationOverrides, no slots}` + `BookingCleared` for each future booking + `SessionBooked` for new bookings generated by `generateBookings`. `replanRoadmap.ts` and `mapToRegenerateRequest.ts` are kept but no longer called from `Replan.tsx`.
- Deviations (all intentional, documented):
  1. **Live re-projection is analytic-only** (empty `gpCurve` passed to `projectFinish`), not GP. GP curves require calibration which is expensive; the replan preview is ephemeral and analytic is correct for "at current pace, how does adjusting remaining/deadline change the ETA?". This matches the `projectFinish` design (cold-start analytic path).
  2. **Single `hoursPerDay` stepper** applies to both `weekdayHours` and `weekendHours` (matching the mock's single stepper). More granular control is deferred as UI polish.
  3. **Commit clears all future bookings + re-generates via `generateBookings`** (rather than emitting `BookingEdited` for specific changes). This is cleaner for a full replan: the new bookings are deterministic from the new capacity/remaining and there are no orphaned partial edits. The PLAN said "BookingEdited/BookingCleared as needed"; the approach taken (clear all + re-generate) satisfies the spirit.
  4. **`Replan.test.tsx` mocks `commitReplan`** and verifies the correct arguments are passed (rather than letting the real `commitReplan` run and checking emitted events). This avoids the complex calendar-date dependency on `generateBookings` for what are interaction-state tests. `commitReplan.test.ts` separately covers the full emit sequence.
- Self-check: `pnpm --filter app typecheck` passed; `pnpm --filter app test` passed (58 files / 504 tests, all green); `pnpm lint` passed (0 errors, 4 pre-existing warnings); `grep -n "SchedulePreview\|mapToRegenerateRequest" apps/app/src/pages/Replan.tsx` returned nothing; `grep -n "projectFinish\|RoadmapReplanned" apps/app/src/pages/Replan.tsx apps/app/src/roadmap/replan/commitReplan.ts` shows both present; Playwright listing confirmed 2 new replan specs discoverable.

**Reviewer findings (2026-07-02, Cowork senior review — read against `31feaa2`):** **Status: 🔁 Changes requested**
- [x] Slot regeneration is retired: no `SchedulePreview`, `replanRoadmap`, `mapToRegenerateRequest`, or `/v1/roadmap/regenerate` in the live replan path.
- [x] `commitReplan` emits `RoadmapReplanned` + future `BookingCleared` + regenerated `SessionBooked`; dropped materials are removed from `materialIds`; "Keep current" emits nothing.
- [ ] **F1 blocking:** capacity lever was mis-initialized because `useLiveQuery` is async (`replanData` is null on first render), and there was no resync effect. Applying without touching could shrink the plan to the fallback 1h/Mon. Capacity was also inert: live finish did not receive hours/day or study-day inputs.
- [ ] **F2 blocking:** `materialDurationOverrides` was emitted but not consumed on read. Roadmap ETA, directory totals, and remaining minutes could revert to original `MaterialAdded.estimatedDuration` after a shorten replan.
- [ ] **F3 minor:** `commitReplan` wrote `weeks: 0`, making the calendar header show `N materials · 0 weeks`.
- [~] **F4 note:** preview remains analytic-only, so the temporary replan preview can differ from the roadmap page's GP ETA card. This is a known preview-basis tradeoff, not a slot-regen regression.

**Resolution (rework 2026-07-02):**
- F1 fixed in `apps/app/src/pages/Replan.tsx`: capacity levers hydrate from async `replanData` once per active roadmap without clobbering edits, and live finish now uses levered capacity (`hoursPerDay`, `selectedDays`) plus demonstrated throughput (`activeMinutes / (materialConsumedMinutes ?? plannedMinutes)`) to project a capacity-aware finish.
- F2 fixed in `apps/app/src/progress/mapEvents.ts` and `apps/app/src/roadmap/roadmapProgress.ts`: roadmap-scoped material mappings and no-slot progress summaries apply `materialDurationOverrides`, so shortened materials reduce effective material totals/remaining on read.
- F2 preservation fixed in `Replan.tsx`: an existing active `materialDurationOverrides` entry is carried forward on apply even when the user does not touch that material again.
- F3 fixed in `apps/app/src/roadmap/replan/commitReplan.ts`: `weeks` is recomputed from `entry.payload.startDate` to the new deadline instead of hard-coded `0`.
- Regression tests added/updated: async capacity hydration, capacity lever finish movement, override preservation, override read-path mapping, no-slot progress totals, and replanned weeks.
- Verification: `pnpm --filter app test -- Replan mapEvents roadmapProgress commitReplan` passed (`58` files / `509` tests); `pnpm --filter app typecheck` passed; `pnpm lint` passed with `0` errors and `4` pre-existing warnings in YouTube adapter/API-loader tests; `git diff --check` passed.
- Commit SHA: `6d4cc89` (`fix(replan): close phase 7 review gaps`).
- Status: rework implemented locally; awaiting Cowork reviewer re-check. Not self-marking Phase 7 verified.

**Reviewer re-check (2026-07-02, Cowork senior review — read against `git show 6d4cc89`):** **Status: ✅ Verified**
- [x] **F1 resolved.** `Replan.tsx` gained a `useEffect` keyed on `capacityInitializedFor === replanData.activeEntry.roadmapCreatedAt`: it hydrates `hoursPerDay`/`selectedDays`/`materialOverrides` exactly once per active roadmap once the async `useLiveQuery` result resolves, and never fires again for that roadmap id — so later user edits are not clobbered. Traced the render order by hand: on the first (loading) render `events` is `undefined`, so the component returns the `role="status"` loading UI before the levers ever mount — the mis-initialized `1h`/`['Mon']` state that `useState`'s lazy initializer produces is never visible or interactive. `newFinish` now runs through new `computeCapacityAwareFinish` (levered `hoursPerDay` × `selectedDays`, walking forward from `today` accumulating `hoursPerDay*60` per selected study-day until it covers `remainingEstimatedMin × demonstratedThroughputFactor(sessions)`), so both hours/day and study-day toggles move the live finish. Checked the throughput math is dimensionally correct: `demonstratedThroughputFactor` = mean `activeMinutes / calibrationDenominator` (actual-minutes-per-material-minute), multiplied against *material* remaining minutes to get *actual* minutes needed — one throughput application, not a double-count, and separate from `packages/progress`'s `projectFinish` (still used only for the read-only "current pace" banner, as already disclosed above). New tests `hydrates capacity levers when roadmap data loads after the first render` and `capacity lever changes the live projected finish` reproduce exactly the two symptoms F1 named (mis-init + inert capacity) rather than just asserting no-crash. ✅
- [x] **F2 resolved.** `effectiveEstimatedDuration` (`mapEvents.ts:150-157`) clamps a material's `estimatedDuration` to any `materialDurationOverrides[materialId]` on the *active* roadmap entry (`Math.min(original, override)`, floored at 0 — can only shrink, never inflate). It's applied inside `mapMaterialsForRoadmap`, the single choke point consumed by `RoadmapCalendar.tsx` (directory panel), `sessionPlanning.ts` (pre-session recommendation), and `materialMetricsForRoadmap` → `findActiveRoadmap` (the `materialTotalMinutes`/`materialRemainingMinutes` that feed the Home/Week/Roadmap GP burn-up `totalPlanned`) — so the fix reaches every "ETA / directory / remaining" surface the finding named, not just Replan's own preview. `roadmapProgress.ts` has its own independent material-loading path for the no-slots dashboard summary (`materialLedgerForEntry` builds materials directly off `MaterialAdded`, not via `mapMaterialsForRoadmap`), and it needed — and got — its own parallel `effectiveEstimatedMinutesForEntry` fix; confirmed both call sites are patched, not just one. Preservation: `Replan.tsx handleApply` now writes `overrides[materialId]` whenever `m.hadDurationOverride` is true, even if the user doesn't re-touch that material this session, so a previously-shortened material doesn't silently revert to full length on an unrelated apply (e.g., only extending the deadline). Read-path tests (`mapEvents.test.ts`, `roadmapProgress.test.ts`) and the write-path preservation test (`Replan.test.tsx`) all assert exact numeric expectations, not just "is defined". ✅
  - Non-blocking follow-up (new, not part of F1-F3): a later Replan session's "full remaining" (`fullRemainingMinutes`) is sourced from the ledger, which already reflects any prior override, so the shorten stepper's own ceiling is the *already-shortened* value — there's no UI path to lengthen a material back toward its original pre-shorten estimate in a later replan (only drop/re-add would reset it). Doesn't violate any Phase 7 acceptance criterion or the D-09/D22 shorten-or-drop model; worth a product call if "undo a shorten" ever comes up. Suggest filing as a follow-up issue rather than blocking this phase.
- [x] **F3 resolved.** `commitReplan.ts` now computes `roadmapWeeks(entry.payload.startDate, deadline) = max(1, ceil(dayDiff/7))`. Confirmed `entry.payload.startDate` is the *original* roadmap creation date and survives across replans (`RoadmapReplannedPayload` spreads `...entry.payload` and never overwrites `startDate`), so `weeks` correctly represents total plan span, not "weeks remaining". Hand-checked the test fixture independently: `2026-06-01` → `2026-07-07` is 36 days, `ceil(36/7)=6`, matching the asserted `payload.weeks === 6`. ✅
- [x] **Regression-test quality:** all four new/updated tests assert exact values (hours-per-day text, finish-date change, override numbers, `weeks: 6`) rather than loose "doesn't throw" checks — they would fail against the pre-rework code. ✅
- [x] **No regression to already-verified Phase 7 criteria:** re-grepped `apps/app/src/pages/Replan.tsx` and `apps/app/src/roadmap/replan/commitReplan.ts` — no `SchedulePreview`/`replanRoadmap`/`mapToRegenerateRequest`/`/v1/roadmap/regenerate` re-introduced; emit order (`RoadmapReplanned` → `BookingCleared`×N → `SessionBooked`×M) unchanged; "Keep current" still emits nothing (navigates only). ✅
- [x] **Typecheck / lint independently reproduced.** This sandbox has no network route to `registry.npmjs.org` (403) or the internal `npm.dev.payment-providerinc.com` mirror (unreachable), so `pnpm` itself could not be installed — ran the package-local binaries directly instead: `apps/app`, `packages/progress`, `packages/roadmap-engine` each `tsc --noEmit` → clean (exit 0); `eslint` on the five touched app files → 0 output (0 errors/warnings). ✅
- [~] **Test execution not independently reproducible in this sandbox:** `vitest run` fails immediately in every workspace package with `Cannot find module '@rollup/rollup-linux-arm64-gnu'` (the optional-native-binary npm bug, npm/cli#4828) — the same pre-existing arm64 sandbox gap already disclosed in `.work/STATUS.md`'s Roadmap-calendar row ("sandbox rollup arm64 dep block"), not introduced by this commit. Verified correctness by close reading of the diff and by manually re-deriving the expected outputs (throughput math, weeks arithmetic) rather than trusting the implementer's `509`-test claim at face value; found nothing inconsistent with it.
- **Doc-integrity defect found (in the plan doc, not the code) — fixed by this reviewer:** this commit's `PLAN.md` status-line edit landed on **Phase 3's** line instead of Phase 7's (Phase 3 now read "🟡 Rework implemented locally; awaiting reviewer re-check" despite Phase 3 being `✅ Verified` above it; **Phase 7's own line was never touched** and was still stuck at "🟡 Implemented locally; awaiting review (2026-07-01)"). Also pre-existing, not from this commit: Phase 2's line still read "🟡 In progress — redo tests…" despite being `✅ Verified`. Corrected all three status lines in `PLAN.md` to match this file (the canonical per-phase record) in the same session.

**All seven phases are now `✅ Verified`. The material↔session decoupling implementation is functionally complete, pending: the native side committing this review + doc fixes (Step 0 pattern, Rule 3), the non-blocking shorten-ceiling follow-up above, and the deferred E2E/real-data validation (OQ-04).**

---

## Final gate (after all phases ✅ Verified)
- [~] `pnpm lint && pnpm typecheck` clean across packages. Cowork reviewer sandbox has no route to `registry.npmjs.org`/the internal npm mirror, so `pnpm` couldn't be installed to run the aggregate commands; corroborated per-package instead — `tsc --noEmit` clean (exit 0) in `apps/app`, `packages/progress`, `packages/roadmap-engine`, `eslint` clean on the Phase-7-touched files. Implementer self-reports the full `pnpm lint`/`pnpm typecheck` clean.
- [~] `pnpm --filter app test && pnpm --filter @study-tracker/progress test && pnpm --filter @study-tracker/roadmap-engine test` green. Not independently re-run this session — `vitest` fails in this sandbox on the pre-existing `@rollup/rollup-linux-arm64-gnu` gap (see Phase 7 re-check note). Implementer self-reports 509/509 for the Phase 7 filter; Phases 1–6 had reviewer-corroborated green runs in prior sessions (see their VERIFICATION entries above).
- [ ] E2E suites: Phases 1–5 previously ran green on a capable machine (`e2e/material-session-decoupling.spec.ts`, `e2e/roadmap-booking-live.spec.ts`); the 2 Phase 7 replan specs are authored but not yet run anywhere. Run on a `node>=20` machine with network access before calling the whole plan done.
- [x] `DECISIONS.md` `#3` remains 🟡 QUALIFIED; claims-ledger external-validity caveat (OQ-04) intact — untouched by this phase.
- [x] `.work/STATUS.md` row updated to reflect implementation state (this session).
