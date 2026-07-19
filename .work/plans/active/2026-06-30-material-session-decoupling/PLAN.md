<!--
  This is the verbatim operating-manual preamble. It is pasted as the first content
  of every plan written by the write-implementation-plan skill. Do NOT modify it
  per-plan — keeping it identical across plans means implementing agents learn
  the protocol once and recognize it everywhere.
-->

# How to use this plan

> **You are the implementing agent.** This document is your runbook for one cohesive change to this codebase. It was written collaboratively by Claude and a human after a planning discussion, and it is the source of truth for this work. Read this preamble in full before doing anything else.

## What you're holding

A phase-by-phase implementation plan. Each phase is a **vertical slice** — an end-to-end working increment that leaves the codebase in a working state. Phases are designed so any one of them can be implemented by a fresh agent in a new context window, with only this document and the codebase as input.

## Your job

1. **Read the document header in full first.** TL;DR, Context, Decisions log, Architecture overview, and Files-touched index. These give you the *why* behind every step. The Decisions log especially — those decisions were made deliberately and explain choices that may otherwise look arbitrary or wrong. Reference IDs (D-NN) appear inside phase steps so you can look up rationale.

2. **Find your starting phase.** Scan the phase list. Pick the first phase whose status is `☐ Not started` AND whose `Depends on:` phases are all `✅ Complete`. Implement that phase only. **Do not skip ahead. Do not implement multiple phases in one go unless the human explicitly asks.**

3. **Run the prereq verification.** Each phase has a "Verification (run BEFORE starting)" block. Run those commands. **If any fail, STOP** — the codebase isn't in the state this phase expects. Surface to the human: "Phase N's prereqs failed: `<command>` returned `<result>`. Want me to investigate or hand back?"

4. **Follow the steps in order.** Code blocks in steps are the actual code, not pseudocode or sketches. Apply them as written.

5. **If reality doesn't match the step — STOP.** If the plan says "modify line 47 of `auth.py`" and line 47 is something different, do not improvise. Surface the discrepancy.

6. **Run the tests and post-verification.** Each phase specifies what tests to add or update and the bash command to run. All must pass before the phase is considered done.

7. **Update status and commit.** When the phase is complete:
   - Edit this document: change the phase's `Status:` line to `✅ Complete — <commit-sha-here>`.
   - `git add` the code changes AND this plan file, plus your `VERIFICATION.md` section.
   - Commit them together. Suggested message: `Phase N: <phase title>`.

## What you must NOT do

- **Do not skip phases.** Order matters; later phases assume earlier ones completed.
- **Do not modify the Decisions log, the preamble, the TL;DR, the Architecture overview, the Files-touched index, the Open questions, the Out-of-scope list, or the References.** If a decision is wrong, surface to the human — don't silently revise.
- **Do not re-plan or re-architect.** If the plan seems wrong, stop and surface.
- **Do not implement multiple phases without surfacing for human review** between them, unless asked.

## If you get stuck

- Update the phase's `Status:` to `🛑 Blocked: <one-line reason>`.
- Fill in the phase's `Notes` block with what you tried and what's blocking.
- Hand back to the human.

## Status vocabulary

- `☐ Not started` · `🟡 In progress` · `🛑 Blocked: <reason>` · `✅ Complete — <commit-sha>`

---

## Cowork operating notes for THIS plan (repo-specific)

- **Step 0 — before writing any code:** commit these planning docs verbatim so later diffs are meaningful:
  `docs(plan): add material-session-decoupling PLAN + VERIFICATION`. (Cowork cannot commit — the native side establishes the baseline.)
- **After each phase**, fill your section of [`VERIFICATION.md`](./VERIFICATION.md) (files changed, commit SHA, what you did, deviations + why, self-check vs. the phase's acceptance criteria) and expect review. **A phase is not done until the reviewer marks it `✅ Verified`**; change requests may follow.
- **The visual contract is the mock set** in [`mocks/`](./mocks/) — each screen's locked `mocks/proposed/*.html` is the pixel/interaction target; build to it. Use the real design-system classes (the mocks copy them verbatim into `mocks/css/`).
- **The design source of truth is** [`DECISIONS.md`](./DECISIONS.md) (D1–D22). The research contract is [`../../handovers/2026-07-01-research-verdicts-for-ui-impl.md`](../../handovers/2026-07-01-research-verdicts-for-ui-impl.md). Project rules are the project-local `.agents/rules/*.agents.md` files (not `.claude/rules/*`).
- **E2E tests: author only, do not run** (environment constraint — see repo `CLAUDE.md`). Vitest unit tests DO run.

---

# Material ↔ Session decoupling — implementation

**Slug:** `material-session-decoupling`
**Date written:** 2026-07-01
**Author:** Claude + Rohit
**Plan status:** Draft
**Upstream:** [`DECISIONS.md`](./DECISIONS.md) (D1–D22) · UI handoff [`handovers/2026-06-30-ui-planning-handoff.md`](../../handovers/2026-06-30-ui-planning-handoff.md) · research verdicts [`handovers/2026-07-01-research-verdicts-for-ui-impl.md`](../../handovers/2026-07-01-research-verdicts-for-ui-impl.md)

## TL;DR

Retire the prescriptive day-by-day **slot packer** (root cause of the `/onboarding/3?new=1` bug) and replace it with a **session-booking model**: the roadmap engine lays out **blank capacity bookings** (`{id, date, estimatedDuration, materialId?, status}`) — no material-to-day packing — and the user **picks/confirms the material at session start**. Materials become a browsable **directory**. Progress is **material-based** with **partial-position** capture; interrupted sessions **auto-log** and keep the material open. The intelligence layer is unchanged in math (**calibration `enriched_shrink` transfers; detection stays CUSUM** — research G1/G2), and a **finish-date ETA composite** is added as a **cold-start/small-plan analytic fallback layered on GP** (research G3 — *not* a GP replacement), shown with **provisional** labels. Legacy slot-based roadmaps are adapted **at read time**; new bookings are first-class `SessionBooked`/`BookingEdited`/`BookingCleared` events. Seven phases: two foundation slices (engine+events, then derivations+adapter) followed by one slice per screen (onboarding p3, session flow, roadmap, ETA+week, replan), each built to its locked mock.

## Context & background

The roadmap engine force-fits each `Material` onto a calendar day as a `Slot` (`packages/roadmap-engine/src/roadmap-engine.ts`), and the boundary "tie" slots (`candidateMaterialIds = [...ids, '__rest__']`, `plannedMinutes=0`) plus tie-resolution / `addMaterialToRoadmap` mishandle session-title counts and role inference — the `/onboarding/3?new=1` bug. The redesign (fully grilled; see `DECISIONS.md`) removes prescriptive packing entirely. The app is **event-sourced** (append-only, synced to Supabase, replayed via Dexie per-user DBs) — **history is never rewritten**; legacy roadmaps are adapted on read (D11).

Ground-truth facts verified in code during planning (do not re-derive):
- `generateRoadmap(input: RoadmapInput, config?)` returns `RoadmapOutput { weeks: RoadmapWeek[]; warnings; capacityCheck }`; `Slot { weekIndex, dayOfWeek, date, capacityMinutes, role, candidateMaterialIds, plannedMinutes, sessionTitle }` (`roadmap-engine.ts:41–97`). Tie/packing lives in `tagRoleCandidates` (325–404) and `assignMaterialsToSlots` (520–613); `__rest__` at 577; `inferRole` at 684–707.
- Calibration reads pace off events with filter `source==='active' && plannedMinutes>0 && activeMinutes>0` (`packages/progress/src/calibration.ts:57–63`). **Already decoupled from the dated grid.** Research G1: keep `enriched_shrink`, **INCLUDE** partial-chunk throughput points.
- `deriveSlotStatuses(roadmap, sessions, today)` (`packages/progress/src/deriveSlotStatuses.ts:36–77`) matches session→slot by date + `materialId ∈ candidateMaterialIds`, FCFS; statuses `done|pending|skipped` + `unplanned`. **Replaced by booking-status derivation (D9).**
- finish-date is computed **client-side** in `packages/progress/src/progress.ts` `findProjectedFinish()` (63–91) over the GP burn-up (`gp.ts` `fitBurnUpGP`). `ProgressSnapshot.projection = { finishDate: string|null; confidenceInterval: [string,string]|null }` (types.ts:178–181). The Python service has `/v1/progress` and `/v1/roadmap/regenerate` (`services/intelligence/app/routers/`) but the app currently computes progress client-side; `/v1/progress` is unused by the app.
- Session lifecycle: `SessionLifecycle.start(slotData)` builds+persists the `activeSession` singleton (id=1) and emits `SessionStarted`; `end()` → `logSession('completed', …)`; resolutions today are **only** `'completed' | 'trimmed'` (`SessionLifecycle.ts:513`, `types.ts:144`). **No** `'interrupted'`, `materialPosition`, or `bookingId` fields exist yet.
- `SessionBooked`/`BookingEdited`/`BookingCleared` **do not exist**. Event kinds are string literals (not a shared enum) in `sync/types.ts` payloads + `mapEvents.ts`.

**Support docs:** `DECISIONS.md` · research verdicts baton (above) · `mocks/` (visual contract) · project-local `.agents/rules/*.agents.md` (cited per phase).

## Decisions log

### D-01: Engine emits blank capacity bookings, not packed slots
**Status:** ✅ Agreed (DECISIONS D1/D9/D9a/D13a)
**Context:** The slot packer is the bug source and no longer needed once material choice moves to session start.
**Decision:** `generateRoadmap` returns **bookings** `Booking { id, date, estimatedDuration, materialId?, status }`, computed as *book-to-exhaustion + buffer*: one booking per selected study-day from `startDate`, each sized to that day's capacity (`weekdayHours`/`weekendHours`), stopping once cumulative booked minutes ≥ total material minutes; remaining days to deadline stay unbooked (buffer). **No** `candidateMaterialIds`, tie-resolution, `__rest__`, or role-tie packing. Pure counting: `ceil(totalMaterialMin / per-day capacity)` study-days.
**Rationale:** Kills the bug by construction (no material-to-day assignment); matches the honest "capacity + finish projection" model.
**Alternatives:** book-every-study-day-to-deadline → rejected (implies precision that doesn't exist, no visible buffer). One-time event rewrite of legacy → rejected (D11, event-sourcing-unsafe).
**Reversibility:** hard — engine API + event shape change.

### D-02: Bookings are first-class events; legacy slots adapted at read time
**Status:** ✅ Agreed (DECISIONS D11)
**Context:** Event-sourced app; must not rewrite history.
**Decision:** New events `SessionBooked` / `BookingEdited` / `BookingCleared` (mutable: add/move/duration/attach/detach/remove). `RoadmapCreated` for **new** roadmaps carries capacity + deadline + an ordered `materialIds` snapshot, **not** slots or bookings. `mapEvents` **adapts legacy `RoadmapCreated.slots` on read** → derived bookings (`date + estimatedDuration + suggested material = candidateMaterialIds[0]`); past `SessionLogged` already carry `materialId`/`date` and feed the material ledger directly.
**Rationale:** No destructive migration; one mapper; no second legacy UI.
**Reversibility:** hard.

### D-03: Attribution + statuses keyed by `bookingId`; `deriveSlotStatuses` replaced
**Status:** ✅ Agreed (DECISIONS D9)
**Context:** Fuzzy date+materialId FCFS matching goes away with slots.
**Decision:** `SessionLogged` gains `bookingId`. New `deriveBookingStatuses(bookings, sessions, today)` → per-booking `done | booked | missed | unplanned` by exact `bookingId`; plus `buildMaterialLedger` (per-material logged/estimated/position) and `buildDailyActivity` (per-day minutes). These replace `deriveSlotStatuses` at every call site.
**Reversibility:** moderate.

### D-04: Session end = complete / interrupt + partial-position capture
**Status:** ✅ Agreed (DECISIONS D4/D10/D18)
**Context:** Users finish *materials*, not hours; interrupted sessions are real signal.
**Decision:** `SessionLoggedPayload.resolution` gains `'interrupted'`. Add `materialPosition?: { kind: 'percent' | 'videos' | 'position'; value: number; ofTotal?: number }` and `materialConsumedMinutes?: number` (estimated material minutes consumed during this session). **End · complete** → log + mark material done; **Interrupt** → auto-log real `activeMinutes` (`resolution:'interrupted'`) + material stays open. For non-YouTube, capture position at end (percent/position); YouTube auto (`videosCompleted`). Both feed throughput (G1: partials INCLUDED): calibration must use `activeMinutes / (materialConsumedMinutes ?? plannedMinutes)` so the pre-session dial target does not silently become the Pillar-A denominator. This replaces today's `stale_midnight → SessionAbandoned` no-log path with an auto-logged partial.
**Reversibility:** moderate (new optional fields; backward-compatible reads).

### D-05: Dial is pre-session only; running timer unchanged
**Status:** ✅ Agreed (DECISIONS D17)
**Context:** Rohit rejected "timer becomes the dial."
**Decision:** `SessionDial` is used **only** on the new pre-session setup page to set `plannedMinutes`. The running session keeps the current numeric `TimerDisplay` and layout unchanged. No live "actual ring."
**Reversibility:** easy.

### D-06: Pre-session runs once; Continue resumes, bypassing it
**Status:** ✅ Agreed (DECISIONS D16)
**Context:** Don't re-prompt setup on resume.
**Decision:** The pre-session setup renders only when `SessionLifecycle.initialize()` returns `idle` **and** there is no `activeSession` record. "Start" persists the record (materialId + dial `plannedMinutes` + `bookingId`) via `start()`. Pause/"come back later" persists `status:'paused'`; **Continue** routes to `/session` with no payload → `initialize()` finds the record → renders the running layout directly.
**Reversibility:** easy.

### D-07: ETA composite = GP + analytic cold-start fallback (client-side), provisional
**Status:** ✅ Agreed / research-QUALIFIED (DECISIONS #3; research G3)
**Context:** #3 was gated on R4; verdict = composite beats GP **only on the small/cold-start band**.
**Decision:** Extend the client-side finish projection (`packages/progress/src/progress.ts`) with a composite `projectFinish`: (1) `sessions < COLD_START_N` (**5**) → analytic required-rate; (2) GP finish ≥ horizon end (non-crossing) → analytic; (3) else GP point + CI. Analytic in **actual-minutes currency** (`consumed_actual/elapsed_days` daily rate; `remaining_actual/daily` days-left), **no throughput multiplication**. Mirror the research reference `forecast_gp_plus_analytic_finish` (`research/comparison/src/research_comparison/baselines/projection.py`). All finish-date labels shown **provisional**. **Not** a GP replacement; the raw analytic path is never its own user-facing mode.
**Rationale:** Research-cleared to ship regime-specific; client-side matches where finishDate is consumed today and needs no service round-trip (OQ-01/03 not blocking dev).
**Alternatives:** server-side in `/v1/progress` → deferred to OQ-01 (parity mirror); pure analytic → rejected (0 Holm wins).
**Reversibility:** moderate.

### D-08: Week weekly-target from capacity, not summed slot minutes
**Status:** ✅ Agreed (DECISIONS D19)
**Context:** No slots to sum.
**Decision:** `weeklyStats.plannedMinutesThisWeek` derives from capacity (`hoursPerDay × study-days that week`, or that week's booked-session minutes). No Week UI change.
**Reversibility:** easy.

### D-09: Replan = pull levers → re-project finish, not slot regen
**Status:** ✅ Agreed (DECISIONS D22)
**Context:** Slot regen preview (`SchedulePreview`) is retired.
**Decision:** `/replan` becomes levers (extend deadline / capacity / shorten+drop materials / accept later finish) with a **live re-projection** of the finish date. Commit emits `RoadmapReplanned` carrying new capacity/deadline, ordered `materialIds`, and optional `materialDurationOverrides` (**not** slots) + `BookingEdited`/`BookingCleared` as needed. The `mapToRegenerateRequest` → `/v1/roadmap/regenerate` slot path is retired/repurposed.
**Reversibility:** moderate.

### D-10: Materials directory grouped by type; playlist keeps existing picker modal
**Status:** ✅ Agreed (DECISIONS D14/D14a)
**Context:** Flat material stack doesn't scale.
**Decision:** Onboarding p3 + Roadmap directory group materials by type (Videos/Playlists/Links/Manual), compact expand-on-edit rows. A playlist row opens the **existing** `PlaylistPickerPopup` modal (kept as-is), not an inline checklist.
**Reversibility:** easy.

## Architecture overview

```
BEFORE:  generateRoadmap → Slot[] (material packed onto days)
         Home reads next Slot → /session (pre-bound) → timer → SessionLogged(materialId, slotDate)
         deriveSlotStatuses(roadmap, sessions) → calendar

AFTER:   generateBookings → Booking[] (date + estimatedDuration only; book-to-exhaustion + buffer)
         RoadmapCreated{capacity, deadline, materialIds, slots?: legacy}  +  SessionBooked/BookingEdited/BookingCleared events
         mapEvents: legacy RoadmapCreated.slots ──read-time adapter──► bookings
         Home (booking, "Suggested material") → /session PRE-SESSION (confirm/swap material + dial)
              → start() persists activeSession(materialId, plannedMinutes, bookingId, materialStartPosition) → running timer
              → End·complete | Interrupt + position capture → SessionLogged(bookingId, resolution, materialPosition, materialConsumedMinutes)
         deriveBookingStatuses(bookings, sessions) + buildMaterialLedger(sessions + MaterialProgressMarked) + buildDailyActivity → Roadmap/Home/Week
         projectFinish = GP everywhere + analytic fallback (cold-start / GP-non-crossing)  [provisional]
```

Intelligence layer math is unchanged (calibration `enriched_shrink`, detection CUSUM). The ETA composite is net-new client-side logic layered on the existing GP.

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `packages/roadmap-engine/src/roadmap-engine.ts` | modify | 1 | Replace slot packer with booking layout; export `Booking`, `generateBookings`, `suggestMaterialForBooking` |
| `packages/roadmap-engine/src/index.ts` | modify | 1 | Export new booking API/types |
| `packages/roadmap-engine/src/*.test.ts` | modify | 1 | Retire tie/packing tests; add booking-layout tests |
| `apps/app/src/sync/types.ts` | modify | 1 | Add `SessionBooked/BookingEdited/BookingCleared` + `MaterialProgressMarked` payloads; `RoadmapCreatedPayload.materialIds` and optional legacy `slots`; `bookingId`/`resolution:'interrupted'`/`materialPosition`/`materialConsumedMinutes` on session payloads |
| `apps/app/src/session/types.ts` | modify | 1 | `ActiveSessionRecord.bookingId/materialStartPosition/materialEstimatedMinutes`; `SessionLoggedPayload` fields; resolution union |
| `packages/progress/src/deriveBookingStatuses.ts` | new | 2 | Booking status by `bookingId` (done/booked/missed/unplanned) |
| `packages/progress/src/materialLedger.ts` | new | 2 | Per-material actual logged minutes + estimated material consumed/remaining + position |
| `packages/progress/src/dailyActivity.ts` | new | 2 | Per-day activity minutes |
| `packages/progress/src/index.ts` | modify | 2 | Export new derivations; deprecate `deriveSlotStatuses` |
| `apps/app/src/progress/mapEvents.ts` | modify | 2 | Read-time legacy-slot→booking adapter; booking event mapping; capacity weekly target (D-08) |
| `apps/app/src/roadmap/roadmapLifecycle.ts` | modify | 2 | Lifecycle/progress counts work for no-slots roadmaps by using bookings |
| `apps/app/src/roadmap/roadmapProgress.ts` | modify | 2 | Roadmaps dashboard progress from bookings/material ledger, not slots |
| `apps/app/src/onboarding/steps/Step3Materials.tsx` | modify | 3 | Grouped-by-type material directory |
| `apps/app/src/onboarding/steps/Step3Preview.tsx` | modify | 3 | Summary + expandable calendar; delete slot/tie/swap preview |
| `apps/app/src/onboarding/components/*` | modify/delete | 3 | Retire SchedulePreview/SwapFab/tie; keep PlaylistPickerPopup |
| `apps/app/src/pages/Home.tsx` | modify | 4 | "Suggested material" card; route to pre-session |
| `apps/app/src/pages/Session.tsx` | modify | 4 | Pre-session gate (D-06); render setup vs running |
| `apps/app/src/session/PreSessionSetup.tsx` | new | 4 | Material confirm/swap + dial (D-05) |
| `apps/app/src/session/SessionLifecycle.ts` | modify | 4 | `interrupt()`; `bookingId`+`materialPosition` on log; partial-log path |
| `apps/app/src/session/components/EndSessionSheet.tsx` | new | 4 | complete/keep-open + position capture (D-04/D18) |
| `apps/app/src/roadmap/RoadmapCalendar.tsx` | modify | 5 | Booking statuses; add/edit/clear sheets; directory panel; ETA card |
| `apps/app/src/roadmap/calendarModel.ts` | modify | 5 | Bind bookings (not slots) to cells |
| `apps/app/src/roadmap/statusStyles.ts` | modify | 5 | done/booked/missed/unplanned |
| `apps/app/src/roadmap/booking/*` | new | 5 | Booking editor + add-session sheet + logging events |
| `packages/progress/src/progress.ts` | modify | 6 | `projectFinish` composite (D-07) |
| `packages/progress/src/projectFinish.ts` | new | 6 | Analytic + GP-non-crossing switch |
| `apps/app/src/pages/Week.tsx` + progress hooks | modify | 6 | Provisional finish label; capacity weekly target already in P2 |
| `apps/app/src/pages/Replan.tsx` | modify | 7 | Levers → live re-projection; retire SchedulePreview |
| `apps/app/src/roadmap/replan/*` | modify | 7 | Repurpose commit to capacity/deadline/material edits |

## Phases

---

### Phase 1: Foundation — engine emits bookings + booking/session event shapes

**Status:** ✅ Complete — `327ca45`
**Depends on:** none — can start immediately
**Estimated scope:** ~5 files (engine + its tests, `sync/types.ts`, `session/types.ts`). Large; the implementer may sub-split engine vs types.

#### Codebase state assumed at start
- `packages/roadmap-engine/src/roadmap-engine.ts` exports `generateRoadmap`, `Slot`, `RoadmapInput`, `RoadmapOutput` (lines per Context).
- `apps/app/src/sync/types.ts` has `RoadmapCreatedPayload` (66–76), `MaterialAddedPayload`, `RoadmapEditedPayload`, `SessionLoggedPayload`; no booking events.
- `apps/app/src/session/types.ts` has `ActiveSessionRecord` (219–254), `SessionLoggedPayload.resolution?: 'completed'|'trimmed'` (144), `SESSION_EVENT_KINDS` (186–194).

#### Verification (run BEFORE starting)
```bash
grep -n "candidateMaterialIds" packages/roadmap-engine/src/roadmap-engine.ts   # exists → packer present
grep -n "SessionBooked\|BookingEdited\|BookingCleared" apps/app/src/sync/types.ts   # returns nothing
pnpm --filter @study-tracker/roadmap-engine test   # baseline green
```

#### Steps

1. **Add the `Booking` type + booking layout to `roadmap-engine.ts`.** Add exported type and a pure, deterministic `generateBookings`:
   ```ts
   export type BookingStatus = 'booked' | 'done' | 'missed' | 'unplanned'
   export interface Booking {
     id: string                    // deterministic bookingId within a roadmap, e.g. planned:${ordinal}:${date}
     date: string                  // ISO YYYY-MM-DD
     estimatedDuration: number     // minutes = that day's capacity
     materialId?: string           // soft-suggested or user-attached; undefined = pick at start
     status: BookingStatus         // engine emits 'booked'; derivation overwrites (Phase 2)
   }
   export interface BookingLayoutInput {
     startDate: string; deadline: string
     selectedStudyDays: DayOfWeek[]; weekdayHours: number; weekendHours: number
     materials: Material[]         // for totalMaterialMinutes + suggestion ordering only
   }
   // Book-to-exhaustion + buffer (D-01): one booking per study-day from startDate,
   // each sized to that day's capacity, until cumulative >= sum(material.totalMinutes).
   export function generateBookings(input: BookingLayoutInput, config?: Partial<RoadmapConfig>): { bookings: Booking[]; warnings: Warning[]; capacityCheck: CapacityCheck }
   ```
   Implementation: iterate calendar days `startDate..deadline`; for each `selectedStudyDays` day, `cap = isWeekend ? weekendHours*60 : weekdayHours*60`; push `{ id: \`planned:${ordinal}:${date}\`, date, estimatedDuration: cap, status: 'booked' }` and accumulate; stop when `cumulative >= totalMaterialMinutes`. `capacityCheck` reuses existing `CapacityCheck` shape (`fits|over-capacity|under-capacity-buffer` comparing total capacity-to-deadline vs material minutes). **No** `candidateMaterialIds`/tie/`__rest__`. Do **not** call `crypto.randomUUID()` or any random source inside `@study-tracker/roadmap-engine`; the package invariant is deterministic same-input/same-output. User-added ad-hoc bookings outside the engine may use `crypto.randomUUID()` in the app layer.

2. **Add `suggestMaterialForBooking`** (D9a #2 soft-suggest, prefer in-progress): pure helper `suggestMaterialForBooking(materials: Material[], ledger: {materialId:string;done:boolean;started:boolean}[], usedMaterialIds: string[]): string | undefined` — foundation→anchor→practice interleave, **prefer a started-but-not-done material**, skip done. Used by the adapter/UI, not by `generateBookings` (bookings stay blank by default).

3. **Retire the packer from the new live path, but keep the legacy slot API compiling.** Keep `generateRoadmap`, `addMaterialToRoadmap`, `removeMaterialFromRoadmap`, and `regenerateRoadmap` deprecated-but-present through this phased migration because existing app callers still import them until Phases 3/7. Mark `generateRoadmap` and slot mutators `@deprecated` in comments/exports, and make all new code use `generateBookings`. Do **not** delete `tagRoleCandidates`, `assignMaterialsToSlots`, `__rest__`, or tie warnings in Phase 1 unless every current call site has already migrated in the same commit; otherwise `app typecheck` will fail mid-phase. Acceptance for Phase 1 is: no new booking path depends on candidate material packing, while legacy slot code is quarantined behind deprecated APIs. Keep `inferRole`, `ROLE_TO_LABEL`, `LABEL_TO_ROLE` (still used for material role in the directory). Keep `Warning`/`CapacityCheck`.

4. **Export the new API** in `packages/roadmap-engine/src/index.ts`: `Booking`, `BookingStatus`, `BookingLayoutInput`, `generateBookings`, `suggestMaterialForBooking`.

5. **New events in `apps/app/src/sync/types.ts`** (mirror existing payload style):
   ```ts
   export interface SessionBookedPayload {
     roadmapCreatedAt: string; bookingId: string
     date: string; estimatedDuration: number; materialId?: string
   }
   export interface BookingEditedPayload {
     roadmapCreatedAt: string; bookingId: string
     date?: string; estimatedDuration?: number
     materialId?: string | null      // null = detach (pick at start)
   }
   export interface BookingClearedPayload { roadmapCreatedAt: string; bookingId: string }
   export interface MaterialProgressMarkedPayload {
     roadmapCreatedAt: string; materialId: string; markedAt: string
     materialPosition: { kind: 'percent' | 'videos' | 'position'; value: number; ofTotal?: number }
     source: 'directory' | 'session-end'
   }
   ```
   `RoadmapCreatedPayload`: keep `startDate, deadline, weeks, purpose, selectedStudyDays, weekdayHours, weekendHours, weeklyHours`; add `materialIds?: string[]` (ordered selected material IDs for no-slots/new roadmaps) and `materialDurationOverrides?: Record<string, number>` (roadmap-scoped shortened remaining minutes for replan); **make `slots` optional/legacy-only** (`slots?: Slot[]` with a comment: legacy read-only; new roadmaps omit it and emit `SessionBooked` per booking). Do **not** delete `slots` from the type (legacy events still carry it). `RoadmapReplannedPayload` inherits this shape and must carry updated `materialIds`/`materialDurationOverrides` when materials are shortened/dropped.

6. **Session payload fields in `apps/app/src/sync/types.ts` + `apps/app/src/session/types.ts`:**
   - `SessionLoggedPayload`: add `bookingId?: string`; widen `resolution?: 'completed' | 'trimmed' | 'interrupted'`; add `plannedSessionMinutes?: number` (the pre-session dial target), `materialPosition?: { kind: 'percent' | 'videos' | 'position'; value: number; ofTotal?: number }`, and `materialConsumedMinutes?: number` (estimated material minutes consumed; calibration denominator override). Implements D-04/D8.
   - `ActiveSessionRecord`: add `bookingId?: string`, `plannedSessionMinutes?: number`, `materialEstimatedMinutes?: number`, `materialStartPosition?: { kind: 'percent' | 'videos' | 'position'; value: number; ofTotal?: number }`. (`slotDate`/`weekIndex` stay for back-compat; mark derived/deprecated in a comment.)
   - `SessionSlotData`: add `bookingId?: string`, `materialEstimatedMinutes?: number`, `materialStartPosition?: { kind: 'percent' | 'videos' | 'position'; value: number; ofTotal?: number }` (passed from Home/pre-session into `start()`).

#### Tests
- `packages/roadmap-engine/src/*.test.ts`: **add** `generateBookings` tests — booking count = `ceil(totalMaterialMinutes / perDayCapacity)` on study-days; bookings are blank (`materialId` undefined); IDs are deterministic across repeated calls; buffer days unbooked; weekend vs weekday capacity honored; `suggestMaterialForBooking` prefers started-not-done then foundation→anchor→practice. Remove or quarantine tests that assert tie/`__rest__` behaviour for the new path; keep only minimal deprecated-slot API smoke coverage needed while old callers still compile.
- Run: `pnpm --filter @study-tracker/roadmap-engine test`

#### Verification (DONE)
```bash
grep -n "candidateMaterialIds\|__rest__" packages/roadmap-engine/src/roadmap-engine.ts   # only in deprecated slot API, not generateBookings
grep -n "generateBookings\|export interface Booking" packages/roadmap-engine/src/index.ts   # present
grep -n "SessionBookedPayload\|BookingEditedPayload\|BookingClearedPayload\|MaterialProgressMarkedPayload" apps/app/src/sync/types.ts   # present
grep -n "interrupted\|materialPosition\|materialConsumedMinutes\|bookingId" apps/app/src/session/types.ts   # present
pnpm --filter @study-tracker/roadmap-engine test && pnpm --filter app typecheck
```

#### Rollback
Revert the engine + types changes. No data migration (events are additive; legacy `slots` untouched). Note: any code importing the removed packer helpers will fail typecheck until Phase 2/3 migrate call sites — keep `generateRoadmap` deprecated-but-present to avoid breaking the build mid-phase.

#### Notes (filled in during implementation)
*(empty)*

---

### Phase 2: Foundation — booking-status derivations + read-time legacy adapter

**Status:** ✅ Complete — verified 2026-07-01 (see VERIFICATION Phase 2; status line was stale, corrected 2026-07-02)
**Depends on:** Phase 1
**Estimated scope:** ~5 files (3 new in `packages/progress`, `progress/index.ts`, `apps/app/src/progress/mapEvents.ts`).

#### Codebase state assumed at start
- Phase 1 complete: `Booking` type exported; booking events defined; `SessionLogged.bookingId` exists.
- `apps/app/src/progress/mapEvents.ts` exports `mapSessions`, `findActiveRoadmap`, `findRoadmap`, `mapExceptionalTags`, `mapResolutions`.
- `packages/progress/src/deriveSlotStatuses.ts` exists (call sites in `RoadmapCalendar.tsx`, `progress.ts`).
- `roadmapLifecycle.ts` and `roadmapProgress.ts` currently compute totals from `payload.slots`; no-slots roadmaps will break unless this phase updates them.

#### Verification (run BEFORE starting)
```bash
grep -rn "deriveSlotStatuses" apps/app packages/progress   # list all call sites to migrate
grep -n "export interface Booking" packages/roadmap-engine/src/index.ts   # Phase 1 done
pnpm --filter @study-tracker/progress test   # baseline green
```

#### Steps

1. **New `packages/progress/src/deriveBookingStatuses.ts`** (implements D-03):
   ```ts
   import type { Booking } from '@study-tracker/roadmap-engine'
   import type { SessionEvent } from './types'
   export interface DerivedBooking { booking: Booking; status: 'done'|'booked'|'missed'|'unplanned'; loggedMinutes: number; sessionIds: string[] }
   export interface BookingStatusDerivation { bookings: DerivedBooking[]; unplanned: { date: string; sessionIds: string[]; minutes: number }[] }
   // done: booking has a SessionLogged with matching bookingId AND resolution!=='interrupted' (material completed for that booking)
   // booked (future/today, date>=today, no completing session) ; missed (past, date<today, no session)
   // unplanned: SessionLogged with no bookingId (or bookingId not in bookings) → grouped by date
   export function deriveBookingStatuses(bookings: Booking[], sessions: SessionEvent[], today: string): BookingStatusDerivation
   ```
   Match by **exact `bookingId`** (no fuzzy date/material). Add `bookingId?: string` to `SessionEvent` in `packages/progress/src/types.ts` and map it in `mapSessions` (Step 5).

2. **New `packages/progress/src/materialLedger.ts`:**
   ```ts
   export interface MaterialProgressMark { materialId: string; markedAt: string; materialPosition: MaterialPosition }
   export interface MaterialLedgerEntry {
     materialId: string; title: string; estimatedMinutes: number;
     activeMinutesLogged: number; estimatedConsumedMinutes: number; remainingEstimatedMinutes: number;
     done: boolean; started: boolean; lastPosition?: MaterialPosition
   }
   export function buildMaterialLedger(
     materials: {id:string;title:string;estimatedMinutes:number}[],
     sessions: SessionEvent[],
     progressMarks: MaterialProgressMark[] = [],
   ): MaterialLedgerEntry[]
   ```
   `activeMinutesLogged` = Σ `activeMinutes`/`duration` for sessions with that `materialId`; `estimatedConsumedMinutes` = max of (a) Σ session `materialConsumedMinutes`, (b) latest in-session `materialPosition` converted against `estimatedMinutes`, and (c) latest out-of-session `MaterialProgressMarked` position converted against `estimatedMinutes`; `remainingEstimatedMinutes = max(0, estimatedMinutes - estimatedConsumedMinutes)`. `done` = any `SessionLogged` with `resolution==='completed'` OR latest position at 100%; `started` = any logged/marked progress; `lastPosition` from the latest session/mark. Powers the directory + suggestion + ETA "remaining". Out-of-session marks update material progress/ETA only; they do not become calibration sessions.

3. **New `packages/progress/src/dailyActivity.ts`:** `buildDailyActivity(sessions): { date:string; minutes:number; sessionIds:string[] }[]` (Σ `activeMinutes` per `date`). Powers Week `minutesByDay` + calendar past-activity.

4. **Export from `packages/progress/src/index.ts`**: the three new functions/types; add `@deprecated` on `deriveSlotStatuses` (keep until Phase 5 removes the last call site). Add `materialConsumedMinutes?: number`, `bookingId?: string`, `resolution?: 'completed'|'trimmed'|'interrupted'`, and `materialPosition?` to `SessionEvent`.

5. **Calibration denominator helper in `packages/progress` (D8/G1):** add a small shared helper used by `bayesian.ts`, `cusum.ts`, `trend.ts`, and `calibration.ts`: `calibrationDenominator(session) = session.materialConsumedMinutes ?? session.plannedMinutes`. Keep the existing filter shape but substitute this denominator so interrupted/partial sessions feed throughput, while legacy events still use old `plannedMinutes`. Add tests proving a session with `plannedSessionMinutes=60`, `activeMinutes=30`, `materialConsumedMinutes=20` contributes ratio `30/20`, not `30/60`.

6. **`apps/app/src/progress/mapEvents.ts` — booking mapping + read-time adapter (D-02):**
   - `mapSessions`: map `bookingId`, `resolution`, `materialPosition`, `materialConsumedMinutes`, and `plannedSessionMinutes` off `SessionLogged` payload.
   - New `mapMaterialProgressMarks(events, roadmapCreatedAt?)`: map `MaterialProgressMarked` payloads for the active/selected roadmap.
   - New `mapMaterialsForRoadmap(events, roadmapEntry)`: use `roadmapEntry.payload.materialIds` for new roadmaps; for legacy rows with no `materialIds`, derive the material set from `payload.slots.flatMap(candidateMaterialIds)` and then join to `MaterialAdded` events. This prevents no-slots roadmaps from accidentally using all historical materials.
   - New `mapBookings(events): Booking[]`: fold `SessionBooked` (add), `BookingEdited` (patch date/duration/materialId; `materialId:null` detaches), `BookingCleared` (remove) by `bookingId`, in event order, scoped to the active roadmap's `roadmapCreatedAt`.
   - **Legacy adapter:** new `deriveBookingsForRoadmap(events, roadmapEntry)`: if the active `RoadmapCreated` payload has `slots` (legacy), map each **future** slot → `{ id: \`legacy:${weekIndex}:${dayOfWeek}:${date}\`, date: slot.date, estimatedDuration: slot.plannedMinutes||capacity, materialId: slot.candidateMaterialIds[0], status:'booked' }`; then apply any `SessionBooked/BookingEdited/BookingCleared` on top. New roadmaps: bookings come purely from the booking events. Past days are represented by `SessionLogged`/daily activity, not bookings.
   - `findActiveRoadmap`: keep returning a progress-compatible `RoadmapInput` during the migration, but it must no longer assume `payload.slots` exists. If slots are absent, synthesize temporary RoadmapSlot-like entries from `deriveBookingsForRoadmap` for consumers not yet migrated; mark this compatibility bridge `@deprecated` and migrate live callers to bookings in Phases 4-6. Add capacity weekly-target helper (D-08) used by Week in Phase 6.

7. **`roadmapLifecycle.ts` + `roadmapProgress.ts` no-slots support:** replace `payload.slots.length` and slot/date/material matching with booking-derived counts when `slots` is absent. `totalSlots` becomes `totalBookings`; `completedSlots` counts `deriveBookingStatuses(...).status === 'done'`; progress summaries use material ledger estimated-consumed/remaining where available. Keep legacy slot logic only as fallback for existing events.

#### Tests
- `packages/progress/src/deriveBookingStatuses.test.ts` (new): done/booked/missed/unplanned by bookingId; interrupted session does NOT mark done; unplanned grouping.
- `packages/progress/src/materialLedger.test.ts`, `dailyActivity.test.ts` (new), plus calibration helper tests proving `materialConsumedMinutes` overrides `plannedMinutes`.
- `apps/app/src/progress/mapEvents.test.ts` (update/new): legacy-slot adapter produces bookings; new no-slots roadmap material set comes from `materialIds`; booking events fold correctly; detach via `materialId:null`.
- `apps/app/src/roadmap/roadmapLifecycle.test.ts` + `roadmapProgress.test.ts`: no-slots roadmap does not crash and computes active dashboard progress from bookings/sessions.
- Run: `pnpm --filter @study-tracker/progress test && pnpm --filter app test -- mapEvents`

#### Verification (DONE)
```bash
grep -n "deriveBookingStatuses\|buildMaterialLedger\|buildDailyActivity" packages/progress/src/index.ts
grep -n "mapBookings\|deriveBookingsForRoadmap" apps/app/src/progress/mapEvents.ts
grep -n "materialConsumedMinutes" packages/progress/src/bayesian.ts packages/progress/src/cusum.ts packages/progress/src/trend.ts packages/progress/src/calibration.ts
pnpm --filter @study-tracker/progress test
```

#### Rollback
Revert new files + mapEvents changes; `deriveSlotStatuses` still present so callers keep working.

#### Notes
*(empty)*

---

### Phase 3: Onboarding page 3 → capacity summary + expandable calendar + grouped materials

**Status:** ✅ Complete — verified 2026-07-01 (see VERIFICATION Phase 3; a Phase-7 status edit mistakenly landed on this line 2026-07-02, corrected same day)
**Depends on:** Phase 1, Phase 2
**Estimated scope:** ~4 files. Visual contract: [`mocks/proposed/onboarding-3.html`](./mocks/proposed/onboarding-3.html) (D13/D13a/D14/D14a).

#### Codebase state assumed at start
- `generateBookings` + `Booking` exported (P1); `buildMaterialLedger`/`suggestMaterialForBooking` available (P1/P2); `RoadmapCreatedPayload.materialIds` exists.
- `Step3Materials.tsx` / `Step3Preview.tsx` currently render the packer preview (`SchedulePreview`, `SwapFab`, tie-resolution, `generateRoadmap`).
- `PlaylistPickerPopup.tsx` exists and stays (D-10 / D14a).

#### Verification (BEFORE)
```bash
grep -n "SchedulePreview\|SwapFab\|unresolved-tie" apps/app/src/onboarding/steps/Step3Preview.tsx   # present → to remove
sed -n '1,220p' .work/plans/active/2026-06-30-material-session-decoupling/mocks/proposed/onboarding-3.html   # target mock exists/readable
```

#### Steps
1. **`Step3Preview.tsx` — replace the slot preview with the summary+calendar** exactly per the mock: (a) delete `SchedulePreview`, `SwapFab`, `useSwapStateMachine`, `computeSwapEdits`, `handleResolveTie`, `handleRename`, `previewEdits`, `unresolved-tie` logic and the `displayRoadmap`/`generateRoadmap` slot path; (b) compute `generateBookings(...)` for the summary; (c) render the **Projected finish** verdict card (provisional eyebrow — the real value comes from Phase 6; here show `capacityCheck`-based estimate), the **backlog-fits-capacity** bar, the **sessions/total/buffer** stat row, the **material directory** chips, and the **expandable calendar** (reuse `roadmap-calendar-shell` classes; month `‹ ›` arrows; booked study-days marked). The finish card is a toggle that slides the calendar panel (per mock JS behaviour: `aria-expanded`, chevron rotate, hover affordance).
2. **`Step3Materials.tsx` — grouped-by-type directory** (D-10): replace the flat `material-list` with collapsible sections **Videos / Playlists / Links & articles / Manual** (count + total), compact expand-on-edit rows; playlist rows open **`PlaylistPickerPopup`** (unchanged). Keep paste/add-manually/metadata-fetch logic.
3. **`handleCommit`** (in `Step3Preview.tsx`): emit events in this order: `MaterialAdded` per committed material (unchanged) → `RoadmapCreated` with **capacity + deadline + `materialIds`, no `slots`** (D-01/D-02) → one `SessionBooked` per generated booking using the deterministic booking IDs from `generateBookings` → `OnboardingCompleted` if this is the first onboarding. Do not leave bookings implicit; D-02 says bookings are first-class events from day one. Keep the new-roadmap-draft guard that routes back to `/roadmaps` when another active roadmap exists.
4. Honour rules: `.agents/rules/react-router-v7-basename.agents.md` (never put `/study` in `to`), `.agents/rules/form-design-spacing.agents.md`, `.agents/rules/css-workspace-packages.agents.md`.

#### Tests
- Update `apps/app/src/onboarding/**` tests that referenced tie/swap → remove. Add a Vitest test: committing onboarding emits `MaterialAdded` events, `RoadmapCreated{materialIds, slots: undefined}`, N `SessionBooked`, and `OnboardingCompleted` in order; generated booking IDs are stable across preview/commit.
- Author (do not run) Playwright: `/onboarding/3?new=1` renders summary + calendar, no `SchedulePreview`, no tie warnings; **the original bug URL no longer errors**.
- Run: `pnpm --filter app test -- onboarding`

#### Verification (DONE)
```bash
grep -n "SchedulePreview\|SwapFab" apps/app/src/onboarding/steps/Step3Preview.tsx   # gone
pnpm --filter app typecheck && pnpm --filter app test -- onboarding
```

#### Rollback
Revert onboarding files; engine/derivations from P1/P2 remain.

#### Notes
*(empty)*

---

### Phase 4: Session flow — Home suggestion → pre-session dial → running end-sheet

**Status:** ✅ Complete — verified 2026-07-01 (see VERIFICATION Phase 4; status line was stale, corrected 2026-07-02)
**Depends on:** Phase 1, Phase 2
**Estimated scope:** ~6 files. **Large — implementer may sub-split** (4a Home+gate, 4b pre-session, 4c end-sheet+lifecycle). Visual contracts: [`mocks/proposed/home.html`](./mocks/proposed/home.html), [`session-presession.html`](./mocks/proposed/session-presession.html), [`session-running.html`](./mocks/proposed/session-running.html). Decisions D-04/D-05/D-06 (DECISIONS D15/D15a/D16/D17/D18).

#### Codebase state assumed at start
- `SessionLifecycle.start/pause/resume/end/initialize` per Context; resolutions widened in P1 (`interrupted`), `bookingId`/`materialPosition` fields exist.
- `materialConsumedMinutes` and the calibration denominator helper exist from P1/P2; `PreSessionSetup` must pass enough material metadata for `SessionLifecycle` to compute it.
- Home reads `getUpNextSlot`/`SessionSlotData`; Session auto-`start`s when `idle && slotData`.

#### Verification (BEFORE)
```bash
grep -n "getUpNextSlot\|SessionSlotData" apps/app/src/pages/Home.tsx
grep -n "logSession('completed'\|resolution" apps/app/src/session/SessionLifecycle.ts
```

#### Steps
1. **Home (`Home.tsx`)** (D15): keep layout; change the up-next/booking card to read **"Study session · ~Nmin"** with **"Suggested material: <title>"** (derived from the day's booking + `suggestMaterialForBooking`), per `home.html`. "Start session" navigates to `/session` passing `SessionSlotData { bookingId, materialId (suggested), plannedMinutes: booking.estimatedDuration, plannedSessionMinutes: booking.estimatedDuration, materialEstimatedMinutes, materialStartPosition, ... }`. `materialEstimatedMinutes` and `materialStartPosition` come from the Phase-2 material ledger so throughput can be computed from progress delta. No-booking-today → show browse/start-ad-hoc affordance; when the user starts ad-hoc under an active roadmap, first emit `SessionBooked{roadmapCreatedAt, bookingId: crypto.randomUUID(), date: today, estimatedDuration: dialValue, materialId?}` in the app layer, then start with that `bookingId` (D9a #3). Keep the Continue card when an `activeSession` exists.
2. **Pre-session gate (`Session.tsx`)** (D-06): replace the auto-`start` on `idle && slotData` with: if `initialize()` returns `idle` **and no active record**, render new `<PreSessionSetup slotData={...} />` **instead of** starting. If `location.state` is absent (user opens `/session` directly), derive today's booking/material suggestion from events; if no booking exists, render the same setup component in "pick a material / start ad-hoc" mode. If a record exists (resume path), render the running layout directly (unchanged).
3. **New `PreSessionSetup.tsx`** (D-05, V1 confirm-card): build to `session-presession.html` — `session-frame` with eyebrow "Ready to start", suggested material as title, `material-strip` + "Change" (opens material picker reusing directory/`PlaylistPickerPopup`), the **`SessionDial`** (planned length; Marginalia-skinned; cap = `hoursPerDay − doneToday`; recommended pace-first per D6), and "Start session" → `lc.start({ ...slotData, materialId: chosen, plannedMinutes: dialValue, plannedSessionMinutes: dialValue, materialEstimatedMinutes, materialStartPosition, bookingId })`. Port `mocks` `SessionDial` interaction; the dial is **pre-session only** (do not add it to the running screen).
4. **`SessionLifecycle` — interrupt + position + throughput denominator (D-04/D8):** add `async interrupt(materialPosition?): Promise<void>` → `logSession('interrupted', elapsedActiveMs, { materialPosition })`, leaves material open (no completion). Extend `logSession` signature to accept `resolution: 'completed'|'trimmed'|'interrupted'` and an optional `{ materialPosition, bookingId }`; include `bookingId` (from the active record), `materialPosition`, `plannedSessionMinutes`, and `materialConsumedMinutes` in the emitted `SessionLogged` payload. Compute `materialConsumedMinutes` as the **delta** between `materialStartPosition` and final `materialPosition` converted against `materialEstimatedMinutes`; for YouTube playlists use completed video durations/current index; if position is skipped, use the D8 fallback `min(activeMinutes, remainingEstimatedMinutes)` and record that inferred value. `end()` → complete path carries `bookingId` and material position; `interrupt()` carries position and does not mark done. Replace `stale_midnight → SessionAbandoned` with an auto-`interrupt()` (logs the partial).
5. **New `EndSessionSheet.tsx`** (D-04/D18): built to `session-running.html`'s sheet — opened by the single primary **End session**; contains position capture (presets ¼/½/¾/Done + % slider; auto for YouTube), the complete-vs-keep-open choice (smart default from position), "unusual" checkbox, primary "Log session". On confirm: if "finished" → `lc.end()` (complete); else → `lc.interrupt(position)`. Wire into `SessionDefaultLayout`/`SessionYouTubeLayout`: replace the current `EndSessionButton` "log all" with "End session" → open sheet; keep **Pause · come back later** ghost as-is. Running numeric timer/frame unchanged (D-05).
6. Feed the material ledger and calibration: `SessionLogged` now carries `bookingId`/`materialPosition`/`materialConsumedMinutes`; Phase 2 derivations pick them up. Keep calibration feed intact by verifying `materialConsumedMinutes` is present for interrupted/partial active sessions and the Phase-2 denominator helper uses it. Do **not** rely on the dial's `plannedSessionMinutes` as the calibration denominator.

#### Tests
- `apps/app/src/session/SessionLifecycle.test.ts`: add `interrupt()` emits `SessionLogged{resolution:'interrupted', bookingId, materialPosition, materialConsumedMinutes}` and leaves material open; `end()` carries `bookingId` and complete-position denominator. Follow `.agents/rules/dexie-test-setup.agents.md`.
- `EndSessionSheet` + `PreSessionSetup` component tests (React Testing Library) — smart default, dial value → `start`, direct `/session` without location state derives today's booking, ad-hoc start emits `SessionBooked` before `SessionStarted`. Follow `.agents/rules/sync-provider-testing.agents.md` where providers wrap.
- Author (not run) Playwright: Home → pre-session → start → running; interrupt logs partial; Continue bypasses pre-session (D-06).
- Run: `pnpm --filter app test -- session`

#### Verification (DONE)
```bash
grep -n "interrupt\|materialPosition\|materialConsumedMinutes" apps/app/src/session/SessionLifecycle.ts   # present
grep -n "PreSessionSetup\|EndSessionSheet" apps/app/src/pages/Session.tsx apps/app/src/session/components/*   # wired
pnpm --filter app typecheck && pnpm --filter app test -- session
```

#### Rollback
Revert session files; Home reverts to `getUpNextSlot`. New `SessionLogged` fields are optional → older events still read.

#### Notes
*(empty)*

---

### Phase 5: Roadmap page — booking calendar + directory + booking interactions

**Status:** ✅ Complete — deviations rectified + verified 2026-07-01 (native pickers → mock radio-list picker; E2E run green)
**Depends on:** Phase 1, Phase 2
**Estimated scope:** ~5 files. Visual contract: [`mocks/proposed/roadmap.html`](./mocks/proposed/roadmap.html) (D20/D21).

#### Codebase state assumed at start
- `deriveBookingStatuses`, `buildMaterialLedger`, `mapBookings`, `deriveBookingsForRoadmap` available (P2).
- `RoadmapCalendar.tsx` currently uses `deriveSlotStatuses` + `calendarModel.bindCells` + `SessionDetailModal` + `RoadmapEditedPayload`.

#### Verification (BEFORE)
```bash
grep -n "deriveSlotStatuses\|bindCells\|RoadmapEdited" apps/app/src/roadmap/RoadmapCalendar.tsx
sed -n '1,220p' .work/plans/active/2026-06-30-material-session-decoupling/mocks/proposed/roadmap.html
```

#### Steps
1. **`calendarModel.ts`**: replace slot-binding with booking-binding — `bindCells(grid, derivedBookings, dailyActivity, materialsById)`. Past cells show **activity** (done/unplanned); future cells show **bookings** (booked, with/without suggested material). Keep month-grid + `MonthBounds` machinery.
2. **`statusStyles.ts`**: legend/status set → `done | booked | missed | unplanned` (D9). `booked` = outlined chip (reuse `roadmap-chip-pending` visual as the mock does), `done` moss, `missed` rust, `unplanned` dashed.
3. **`RoadmapCalendar.tsx`**: swap `deriveSlotStatuses(roadmap, sessions, today)` → `deriveBookingStatuses(bookings, sessions, today)` where `bookings = deriveBookingsForRoadmap(events, activeEntry)`. Replace header progress card with the **ETA card** (finish + burn-up sparkline; **provisional** — real value from Phase 6; until then show ledger `% done` + capacity estimate). Add the collapsible **Materials directory panel** below the calendar (from `buildMaterialLedger`; per-material progress bar + "Mark progress"). Keep month-nav + 5–6 row grid (`buildMonthGrid` is correct — the mock's clipped calendar was mock-only).
4. **Booking interactions** (D21) — new `apps/app/src/roadmap/booking/`:
   - **Booking editor** (click a future booking): sheet with material (opens picker → `BookingEdited{materialId}` / detach `materialId:null`), **duration stepper** (`BookingEdited{estimatedDuration}`), Move day (`BookingEdited{date}`), **Remove** (`BookingCleared`). *Duration via stepper, NOT the dial (D-05).*
   - **Add-session** (click empty day "+ add session"): duration stepper + optional attach → `SessionBooked{ bookingId: crypto.randomUUID(), date, estimatedDuration, materialId? }` in the app layer. Random IDs are okay here because this is a user-created event, unlike deterministic engine-generated bookings.
   - **Material picker** reused (grouped directory; includes "No material · pick at start").
   - Replace the slot-coordinate `RoadmapEdited`/`logRoadmapEdit` usage with the booking events. `SessionDetailModal` becomes read-only session detail for past activity; the booking editor is the new future-booking modal.
   - **Mark progress** in the Materials directory emits `MaterialProgressMarked{roadmapCreatedAt, materialId, markedAt, materialPosition, source:'directory'}`. This updates `buildMaterialLedger`/ETA remaining only; it must not create a `SessionLogged` or calibration point.
5. Route `/roadmap` unchanged; readOnly history view keeps working via the same booking derivation over the selected roadmap's events. Read-only history can show material progress but must not render booking edit/add controls.

#### Tests
- `calendarModel.test.ts`, `RoadmapCalendar.test.tsx`: booking statuses render; add-session emits `SessionBooked`; editor emits `BookingEdited`/`BookingCleared`; Mark progress emits `MaterialProgressMarked` and does not emit `SessionLogged`. Use role/class selectors; `.agents/rules/astro-selectors.agents.md` only applies if marketing/Astro is touched (n/a).
- Author (not run) Playwright: add a session on an empty day; edit a booking's material/duration; remove a booking.
- Run: `pnpm --filter app test -- RoadmapCalendar calendarModel`

#### Verification (DONE)
```bash
grep -n "deriveBookingStatuses" apps/app/src/roadmap/RoadmapCalendar.tsx   # present
grep -rn "deriveSlotStatuses" apps/app   # ONLY (if any) in soon-to-be-removed spots; ideally gone
pnpm --filter app typecheck && pnpm --filter app test -- RoadmapCalendar
```

#### Rollback
Revert roadmap files; derivations remain for other consumers.

#### Notes
*(empty)*

---

### Phase 6: ETA composite (GP + analytic cold-start fallback) + Week wiring

**Status:** ✅ Complete — verified 2026-07-01; D6 pace-first recommendation closed (see VERIFICATION Phase 6)
**Depends on:** Phase 2 (material ledger for "remaining actual"), Phase 1
**Estimated scope:** ~4 files. Research contract: handover §2 + `research/comparison/src/research_comparison/baselines/projection.py` (`forecast_gp_plus_analytic_finish`, `COLD_START_N=5`). Implements D-07/D-08. The research baton suggested the Python service seam, but current app code consumes finish-date from the local TS `computeProgress`; this phase intentionally ships a TS mirror first and leaves `/v1/progress` parity as OQ-01/OQ-02.

#### Codebase state assumed at start
- `packages/progress/src/progress.ts` `findProjectedFinish(gpCurve, totalPlanned)` (63–91) + `gp.ts` `fitBurnUpGP` exist. `ProgressSnapshot.projection` shape known.
- `buildMaterialLedger` available (P2) → gives `remaining actual minutes`.

#### Verification (BEFORE)
```bash
grep -n "findProjectedFinish\|projection" packages/progress/src/progress.ts
sed -n '119,210p' research/comparison/src/research_comparison/baselines/projection.py   # reference impl
```

#### Steps
1. **New `packages/progress/src/projectFinish.ts`** — TS port of the composite (D-07):
   ```ts
   export const COLD_START_N = 5
   export interface FinishProjection { finishDate: string | null; confidenceInterval: [string,string]|null; basis: 'gp'|'analytic'; provisional: true }
   // sessions = active sessions to date; ledger gives remaining actual minutes; gpCurve from fitBurnUpGP
   export function projectFinish(args: {
     sessionCount: number; consumedActualMin: number; remainingActualMin: number;
     startDate: string; today: string; horizonEnd: string;   // horizonEnd = deadline (or grid end)
     gpCurve: {date:string;mean:number;lower:number;upper:number}[]; totalPlanned: number;
   }): FinishProjection
   ```
   Switch logic mirroring the reference:
   1. `sessionCount === 0 || consumedActualMin <= 0` → no projection yet: `{ finishDate:null, confidenceInterval:null, basis:'analytic', provisional:true }` (the Python research helper returns today for no sessions, but the product should not claim an ETA before any evidence).
   2. `sessionCount < COLD_START_N` → **analytic**: `elapsedDays = max(1, daysBetween(startDate, today))`; `dailyRate = consumedActualMin / elapsedDays`; `daysLeft = ceil(remainingActualMin / dailyRate)`; `finishDate = today + daysLeft`. **Actual-minutes currency; no throughput multiplication.**
   3. else compute GP finish (first `gpCurve[i].mean >= totalPlanned`). If none / `gpFinish >= horizonEnd` (**non-crossing rescue**) → analytic (as above).
   4. else → GP `finishDate` + CI (from `lower/upper` crossing). `basis` set accordingly. Always `provisional:true`.
2. **`progress.ts`**: replace the `findProjectedFinish` call with `projectFinish(...)`, sourcing `sessionCount`/`consumedActualMin` from actual sessions and `remainingActualMin` from Phase-2 material ledger (`remainingEstimatedMinutes` converted into the same actual-minutes scale used by the current burn-up; do not multiply by throughput a second time). Keep `confidenceInterval` from GP when `basis==='gp'`; null on analytic (don't present analytic as calibrated). Populate `ProgressSnapshot.projection` (+ optional `basis`/`provisional` — extend the type).
3. **Provisional labels (UI):** ensure Home stat card, Week burn-up, and Roadmap ETA card render the finish with a **provisional** eyebrow (matches mocks). Don't present raw GP intervals as calibrated on small data (research: `conformal` is the coverage fix — leave as OQ, don't fake it).
4. **Week (`Week.tsx`) — D-08**: source `weeklyStats.plannedMinutesThisWeek` from capacity (`hoursPerDay × study-days that week`) via the P2 helper, not summed slot minutes. No other Week UI change (D19). Do **not** add the booked-day marker (explicitly out of scope, D19).

#### Tests
- `packages/progress/src/projectFinish.test.ts` (new): zero sessions → null projection; cold-start (<5 sessions) → analytic; GP non-crossing → analytic; rich + crossing → GP+CI; analytic uses actual minutes, no pace multiply. Cross-check a couple non-zero cases against the Python reference values if feasible.
- Update `progress.test.ts` projection assertions.
- Run: `pnpm --filter @study-tracker/progress test`

#### Verification (DONE)
```bash
grep -n "COLD_START_N\|projectFinish" packages/progress/src/projectFinish.ts
grep -n "projectFinish" packages/progress/src/progress.ts
pnpm --filter @study-tracker/progress test && pnpm --filter app typecheck
```

#### Rollback
Revert `projectFinish.ts` + the `progress.ts` swap → falls back to plain GP `findProjectedFinish`.

#### Notes
*(empty)*

---

### Phase 7: Replan window — levers → live re-projection

**Status:** ✅ Complete — rework verified 2026-07-02, `6d4cc89` (see VERIFICATION Phase 7)
**Depends on:** Phase 1, Phase 2, Phase 6
**Estimated scope:** ~4 files. Visual contract: [`mocks/proposed/replan.html`](./mocks/proposed/replan.html) (D22/D-09).

#### Codebase state assumed at start
- `Replan.tsx` renders `SchedulePreview` slot preview via `replanRoadmap`/`mapToRegenerateRequest`/`commitReplan`.
- `projectFinish` available (P6); booking events + `RoadmapReplannedPayload` exist.

#### Verification (BEFORE)
```bash
grep -n "SchedulePreview\|replanRoadmap\|mapToRegenerateRequest" apps/app/src/pages/Replan.tsx
sed -n '1,220p' .work/plans/active/2026-06-30-material-session-decoupling/mocks/proposed/replan.html
```

#### Steps
1. **`Replan.tsx`**: delete the `SchedulePreview` slot preview + `replanRoadmap`/`extendWeeks` slot path. Build the **levers + sticky outcome** layout per `replan.html`: context banner ("at this pace you'll finish X — N days past deadline"), levers = **extend deadline** presets, **capacity** (hours/day stepper + study-day chips), **materials** (per-material *shorten* stepper + × *drop*), and **Keep current = accept later finish**. As levers change, recompute the projected finish via `projectFinish` (P6) over the adjusted inputs and update the outcome panel live (**provisional**).
2. **Commit (`commitReplan.ts` / new helper)**: emit `RoadmapReplanned` carrying the new **capacity + deadline + `materialIds`** (extends `RoadmapCreatedPayload`, `roadmapCreatedAt` identity) — **not** slots — plus `BookingEdited`/`BookingCleared` for any per-booking changes. Shorten/drop controls are represented only in this roadmap snapshot: drop removes the material from `materialIds`; shorten writes `materialDurationOverrides: Record<string, number>` on `RoadmapReplannedPayload`. Do not add vague "material edits", and do not mutate historical `MaterialAdded` facts. Retire/repurpose `mapToRegenerateRequest` (no longer builds slot regen requests).
3. Triggers unchanged: Week "Replan the rest", Home `RecalibrationModal` → Replan, Roadmap footer Replan → `/replan` (basename rule).
4. The `/v1/roadmap/regenerate` service call is **removed from the replan path** (D-09). If a server round-trip is later wanted for re-projection, that's OQ-01/OQ-03.

#### Tests
- `Replan.test.tsx`: levers update the live finish; commit emits `RoadmapReplanned{materialIds, materialDurationOverrides, slots: undefined}` + expected booking edits/clears; "Keep current" emits nothing and navigates back.
- Author (not run) Playwright: extend deadline / drop a material → finish updates → Apply.
- Run: `pnpm --filter app test -- Replan`

#### Verification (DONE)
```bash
grep -n "SchedulePreview\|mapToRegenerateRequest" apps/app/src/pages/Replan.tsx   # gone
grep -n "projectFinish\|RoadmapReplanned" apps/app/src/pages/Replan.tsx apps/app/src/roadmap/replan/*   # present
pnpm --filter app typecheck && pnpm --filter app test -- Replan
```

#### Rollback
Revert replan files; the retired slot-regen path can be restored from git if needed.

#### Notes
*(empty)*

---

## Open questions

### OQ-01: Server-side ETA parity (`/v1/progress`)
**Why deferred:** The composite is shipped client-side (D-07); the Python `/v1/progress` route exists but is unused by the app. Production ETA routing was never wired (research §3).
**Triggers needing resolution:** adopting server-computed progress, or needing `conformal` intervals at scale.
**Owner / resolution path:** mirror `projectFinish` into `services/intelligence` `py_progress` projection; confirm request/response against the service; gate on OQ-03.
**Cross-ref:** D-07.

### OQ-02: Production Intelligence Service (deploy + auth + CORS)
**Why deferred:** OQ-03 in DECISIONS; gates *production* calibration and any server-side ETA/replan. Local/dev fine.
**Triggers:** production launch.
**Owner:** infra.

### OQ-03: Ideal / target burn-up line (linear-to-deadline vs capacity-shaped)
**Why deferred:** research R4b DEFERRED — not decided. If the Week/Roadmap burn-up draws an ideal line, the shape is unresolved.
**Triggers:** designing the burn-up reference line.
**Cross-ref:** research handover §4.

### OQ-04: Real-data validation of ETA / partial-throughput (circularity guard)
**Why deferred:** research G4/R6 DEFERRED — no real N=1 logs yet; all ETA/partial results rest on the synthetic generator. **UI copy must not imply the ETA is validated on real usage** (hence "provisional").
**Triggers:** real logs captured (`research/comparison/scripts/capture_evidence.py` / pilot).
**Cross-ref:** claims ledger `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`.

### OQ-05: Ad-hoc "study now" with no booking today
**Why deferred:** D9a #3 says auto-create a booking on spontaneous start; exact UX (Home affordance) is light in the mocks.
**Triggers:** Phase 4 implementation of the no-booking-today Home state.

## Out of scope

- **Detector/calibrator algorithm changes** — research G1/G2: calibration `enriched_shrink` and detection CUSUM **transfer unchanged**. No model swap; keep feeding throughput points (incl. partials).
- **Server-side ETA** — client-side only for now (OQ-01).
- **`conformal` calibrated intervals in the UI** — not wired; don't present GP intervals as calibrated on small data (research §2).
- **Week visual redesign** — derivation-only (D19); no booked-day marker.
- **Destructive migration of legacy roadmaps** — read-time adapter only (D-02/D11).

## References

- Design SoT: [`DECISIONS.md`](./DECISIONS.md) (D1–D22) · visual contract: [`mocks/`](./mocks/) (+ `mocks/index.html`)
- Research verdicts: [`handovers/2026-07-01-research-verdicts-for-ui-impl.md`](../../handovers/2026-07-01-research-verdicts-for-ui-impl.md)
- Research reference impl: `research/comparison/src/research_comparison/baselines/projection.py` (`forecast_gp_plus_analytic_finish`, `forecast_analytic_required_rate`, `COLD_START_N`), `runners/projection.py`
- Claims ledger: `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`
- Rules: `.agents/rules/{eventstore-per-user-db,dexie-schema-migration,dexie-test-setup,sync-provider-testing,react-router-v7-basename,form-design-spacing,css-workspace-packages,auth-testing-fakes,fetch-typed-error-normalization,roadmap-engine,sync-architecture,eventstore-architecture,onboarding-architecture,supabase-schema,playwright-config,astro-selectors}.agents.md`
- Verification log: [`VERIFICATION.md`](./VERIFICATION.md)
