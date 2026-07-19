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

5. **If reality doesn't match the step — STOP.** If the plan says "modify line 47 of `auth.py`" and line 47 is something different, do not improvise. Surface the discrepancy: "Plan expected `<X>` at `auth.py:47`, found `<Y>`. Possible causes: plan is stale, file was edited since planning, plan was wrong. How should I proceed?"

6. **Run the tests and post-verification.** Each phase specifies what tests to add or update and the bash command to run. All must pass before the phase is considered done.

7. **Update status and commit.** When the phase is complete:
   - Edit this document: change the phase's `Status:` line to `✅ Complete — <commit-sha-here>`.
   - `git add` the code changes AND this plan file.
   - Commit them together. Suggested message: `Phase N: <phase title>` (with longer body referencing the plan file).
   - The status update and the code change live in the same commit so the doc and the code never drift.

## What you must NOT do

- **Do not skip phases.** Order matters; later phases assume earlier ones completed.
- **Do not modify the Decisions log, the Operating manual preamble, the TL;DR, the Architecture overview, the Files-touched index, the Open questions, the Out-of-scope list, or the References.** Those are immutable above-the-phases content. If you discover a decision is wrong, surface to the human — don't silently revise.
- **Do not re-plan or re-architect.** If the plan seems wrong, that's a signal to stop and surface, not to improvise.
- **Do not implement multiple phases without surfacing for human review** between them, unless the user explicitly asked for batch execution upfront.

## If you get stuck

- Update the phase's `Status:` to `🛑 Blocked: <one-line reason>`.
- Fill in the phase's `Notes (filled in during implementation)` block with what you tried, what's blocking, and what you'd want to know to unblock.
- Hand back to the human.

## Status vocabulary

- `☐ Not started`
- `🟡 In progress`
- `🛑 Blocked: <reason>`
- `✅ Complete — <commit-sha>`

## When status markers and reality drift

The status markers are a fast read, but they are not the source of truth. The phase's `Verification (DONE)` commands are the truth — if you suspect a marker is wrong (someone forgot to update, branches diverged, partial commits, etc.), run the verification commands for the phases marked complete. Trust the commands over the markers, and surface the drift to the human so the markers can be corrected.

---

> **Step 0 — before writing any code:** commit these planning docs verbatim so later diffs are meaningful:
> `docs(plan): add demo-seed-new-model plan + verification`.
> Cowork cannot commit (it is read-only on git); this baseline is the native side's job. After each phase, fill your section of [`VERIFICATION.md`](VERIFICATION.md) (files changed, commit SHA, what you did, deviations + why) and expect review. **A phase is not done until the reviewer marks it `✅ Verified`;** change requests may follow.

---

# Rebuild the dev seeder for the no-slot booking model (demo-ready)

**Slug:** `2026-07-04-demo-seed-new-model`
**Date written:** 2026-07-04
**Author:** Claude (Cowork planner) + Rohit
**Plan status:** Draft
**Upstream:** none (demo-prep task for the 3rd/final Phase-1 review). Related: [`plans/active/2026-06-30-material-session-decoupling/`](../2026-06-30-material-session-decoupling/PLAN.md) (the refactor this seed must catch up to).

## TL;DR

`apps/app/src/dev/seedTestData.ts` still generates the **legacy slot-packed** roadmap shape (`RoadmapCreated.slots`, `SessionLogged` with no `bookingId`, and `selectedStudyDays` as lowercase `"monday"` strings). The `de2339a` refactor retired that model: roadmaps are now **no-slot** (`RoadmapCreated.materialIds` + separate `SessionBooked` events), sessions link to bookings by `bookingId`, and capacity uses 3-letter `DayOfWeek` values (`"Mon"`). This plan rewrites the seed to the current model and enriches it for a live demo: **two past roadmaps** (one completed, one abandoned) that populate `/roadmaps` history, plus **one active roadmap** with a deadline ~5 weeks out, mid-plan, richly logged — so the Week burn-up chart renders, the Home deadline projection shows a finish a few days early, and `/roadmaps` shows a real history. No production (non-dev) code changes; a genuine cross-roadmap progress-scoping issue found during planning is documented as OQ-01, not fixed here.

## Context & background

**The app has three progress surfaces the demo must light up:**

- **Home** (`apps/app/src/pages/Home.tsx`) — "Projected finish · provisional" tile with `X days early/late`, "This week" tile, streak, up-next card, recent activity.
- **Week** (`apps/app/src/pages/Week.tsx`) — daily-minutes bar chart, provisional-finish tile, and the **burn-up chart** (`BurnUpChart`), which only renders when `chartBurnUp.actual.length >= 3 && chartBurnUp.actual.some(p => p.minutes > 0)` (Week.tsx:269).
- **Roadmaps** (`apps/app/src/pages/Roadmaps.tsx`) — active hero (with `%complete`) + history rows for completed/abandoned plans (history rows show title + date range + weeks + a status pill; **no `%complete` in history rows** — see `HistoryRows`, Roadmaps.tsx:35–65).

**Why the current seed is wrong (all verified against source):**

1. `RoadmapCreated` is emitted **with `slots`** (seedTestData.ts:143–157). The current model omits `slots` and carries `materialIds`; bookings are separate `SessionBooked` events. `sync/types.ts:82` labels `slots?` explicitly *"Legacy read-only slot payload. New roadmaps omit slots and emit SessionBooked events."*
2. `selectedStudyDays` is seeded as `['monday','wednesday','friday','saturday']` (lowercase). The capacity engine compares against 3-letter `DayOfWeek` values (`buildPlannedCumulativeFromCapacity` / `capacityWeeklyTarget` test `day === 'Sat'` where `day ∈ ['Sun'..'Sat']`, `progress.ts:47,60,205`). Lowercase names **never match**, so the planned burn-up silently falls back to the legacy slot path.
3. `SessionLogged` carries **no `bookingId`** (seedTestData.ts:202–225). Booking completion (`completedBookingCount`, `roadmapLifecycle.ts:98–108`) keys off `SessionLogged.bookingId`, so no-slot roadmap progress reads 0%.
4. It creates **one** roadmap only — no history, deadline 6 weeks out.

**Key model facts the rewrite relies on (all verified):**

- `findActiveRoadmap` (`progress/mapEvents.ts:290`) returns `deriveRoadmapLifecycle(events).active[0]`; for a no-slot roadmap it folds `SessionBooked`/`BookingEdited`/`BookingCleared` into `Booking[]` (`foldBookingEvents`) then synthesizes `slots` from bookings (`slotFromBooking`). So the active roadmap **must** have `SessionBooked` events or its `slots` come out empty.
- `deriveRoadmapLifecycle` (`roadmap/roadmapLifecycle.ts:147`) marks the **most-recent non-terminal** `RoadmapCreated` as `active`; roadmaps with a matching `RoadmapMarkedComplete`/`RoadmapMarkedAbandoned` (where terminal `createdAt` ≥ roadmap `createdAt`) become `completed`/`abandoned`.
- `SessionBooked.roadmapCreatedAt` must **string-equal** the owning `RoadmapCreated.createdAt` (`foldBookingEvents`, `mapEvents.ts:164`). `EventStore.bulkAppend` uses Dexie `bulkAdd` and **preserves the provided `createdAt`** (`EventStore.ts:36–39`), so the seed controls all timestamps. Seeded events bypass the sync queue (local-only) — desired for dev.
- The burn-up **actual** curve and `progress.totalMinutes` are built from **all** `SessionLogged` events globally, not scoped to the active roadmap (`useProgress.ts:20` → `mapSessions(events)`; `progress.ts:81,222`). Therefore any past-roadmap `SessionLogged` would inflate the active chart/projection. **This is why past roadmaps in this seed carry bookings + terminal events but no `SessionLogged`** (D-02) — and it is the real issue captured as OQ-01.
- `deriveTodaySessionPlan` (`session/sessionPlanning.ts:227`) drives Home's "Start session" up-next card from today's *unlogged* booking. Leaving today's booking unlogged (D-05) makes that card demo-able.

**Support docs:**

- Refactor plan — [`plans/active/2026-06-30-material-session-decoupling/PLAN.md`](../2026-06-30-material-session-decoupling/PLAN.md)
- Status index — [`.work/STATUS.md`](../../../STATUS.md)
- Test credentials for the live demo — `.work/specs/test-login-cred.txt`
- Full-app lifecycle rule — `.claude/rules/playwright-full-app-lifecycle.md`

## Decisions log

### D-01: Change only `seedTestData.ts` (+ the console string in `DevSeeder.tsx`); no production logic changes

**Status:** ✅ Agreed

**Context:** The task is demo-prep. The seed is dev-only tooling; the progress engine, charts, and pages are production code.

**Decision:** Confine edits to `apps/app/src/dev/seedTestData.ts` and the descriptive `console.log` block in `apps/app/src/dev/DevSeeder.tsx`. Do not touch `packages/progress`, `apps/app/src/progress`, chart components, or pages.

**Rationale:** Lowest-risk path to a demo-ready state on review day. Everything the demo needs is producible as events; the engine already handles the no-slot model.

**Alternatives considered:**

- Also scope the burn-up/projection to the active roadmap (fix OQ-01) → rejected for now: production behavior change, higher risk on demo day; deferred as OQ-01.

**Reversibility:** easy — dev-only file.

### D-02: Two past roadmaps carry bookings + terminal events but **no** `SessionLogged`

**Status:** ✅ Agreed

**Context:** Rohit wants `/roadmaps` history populated (2 past + 1 current). But the burn-up "actual" curve and `totalMinutes` are global across all `SessionLogged` (see Context), so past-roadmap sessions would corrupt the *active* roadmap's chart and projection.

**Decision:** Past roadmaps emit `MaterialAdded` + `RoadmapCreated` (no slots) + `SessionBooked` (whole window) + a terminal event (`RoadmapMarkedComplete` / `RoadmapMarkedAbandoned`). **No `SessionLogged`.**

**Rationale:** `/roadmaps` `HistoryRows` renders only title/range/weeks/status-pill — it needs no logged sessions to look complete. Omitting past sessions keeps the active burn-up/projection clean without any production code change.

**Alternatives considered:**

- Give past roadmaps logged sessions for richer detail views → rejected: pollutes the active chart (OQ-01). Their `/roadmap?roadmap=<id>` detail will show booked-but-not-done days; acceptable for the demo.

**Reversibility:** easy.

### D-03: All dates are computed relative to `today` at run time

**Status:** ✅ Agreed

**Context:** The seed must produce a believable mid-plan state whenever it is run during the demo.

**Decision:** Active roadmap `startDate = today − 28`, `deadline = today + 35`. Past#1 (completed): `today − 140 → today − 95`. Past#2 (abandoned): `today − 84 → today − 28`. Study days **Mon, Wed, Fri, Sat**; weekday 90 min, weekend (Sat) 120 min.

**Rationale:** `today + 35` reliably lands in "next month". `today − 28` gives ~4 elapsed weeks of a ~9-week plan (≈45% elapsed) — enough actual points for the burn-up gate and the GP projection (`COLD_START_N = 5`, `projectFinish.ts:1`).

**Reversibility:** easy — constants at the top of the file.

### D-04: Mirror the real `SessionLogged`/`SessionBooked` payloads; **omit `materialPosition`** on seeded sessions

**Status:** ✅ Agreed

**Context:** `buildMaterialLedger` (`packages/progress/src/materialLedger.ts:49`) derives a material's consumed minutes as `max(Σ materialConsumedMinutes, positionToEstimatedMinutes(lastPosition))`. A `materialPosition` of `{kind:'percent', value:100}` (the app's default for a *completed* session) would immediately mark the material fully consumed → remaining 0 → projection degenerates.

**Decision:** Seeded `SessionLogged` sets `bookingId`, `materialConsumedMinutes` (≈ `activeMinutes`), `plannedSessionMinutes`, `resolution:'completed'`, `source:'active'` and the timing fields — but **omits `materialPosition`** (leaves it `undefined`). Consumed minutes then come solely from `materialConsumedMinutes`, and the ledger clamps per material to its estimate.

**Rationale:** Keeps `materialRemainingMinutes > 0` so `projectFinish` yields a meaningful finish. `resolution:'completed'` still lets `completedBookingCount` count the booking done.

**Note:** `buildMaterialLedger` also sets `done=true` for any material with a `resolution:'completed'` session (materialLedger.ts:87). That only affects the material-directory "done" badge, **not** `remainingEstimatedMinutes`. D-06's sequential material assignment keeps this cosmetically sensible (Practice stays untouched/upcoming).

**Reversibility:** easy.

### D-05: Log sessions for bookings **strictly before today**, ~85% completion; leave today + future bookable

**Status:** ✅ Agreed

**Context:** Home's up-next card needs today's booking to be unlogged; a realistic plan has some missed days.

**Decision:** For each active-roadmap booking with `date < today`, emit a `SessionLogged` with ~15% skip probability. Bookings on/after today stay pending.

**Rationale:** Produces pending days (realistic), a today up-next card, and enough completed sessions (>5) for the GP projection.

**Reversibility:** easy.

### D-06: Sequential (curriculum-order) material assignment for bookings

**Status:** ✅ Agreed

**Context:** Round-robin material assignment spreads every material across the whole window, so all materials end up "started/done" and remaining minutes are uniform. A demo reads better as "anchor done, foundation in progress, practice upcoming".

**Decision:** Assign each booking to materials in list order, consuming each material's estimated-minutes budget before advancing (`bookingsForWindow` below). Active materials ordered anchor → foundation → practice.

**Rationale:** Gives a natural progress story and concentrates remaining minutes in the later materials, making the projection and material directory legible.

**Reversibility:** easy.

### D-07: Chart/projection "fixes" are verified live, not assumed

**Status:** ✅ Agreed

**Context:** Rohit asked to "possibly fix any bugs / improve the chart and deadline projection." Planning-time review found the Home `daysEarlyOrLate` sign and the CI ordering (`[ciUpper, ciLower]` = earlier→later) are **correct**; the burn-up planned curve spanning the full plan to `deadline` is **expected** burn-up behavior (target line to 100%, actual tracking below), not a bug.

**Decision:** Phase 3 loads the seed against the running app and confirms the three surfaces render correctly. Only fix a genuine rendering defect if one is observed live; otherwise the "improvement" is the correct data the new seed feeds in. Any real defect found gets a new `D-NN` here before it is changed.

**Reversibility:** n/a (verification phase).

## Architecture overview

The seed emits a flat, time-ordered `Event[]` and writes it via `EventStore.bulkAppend` (preserving `createdAt`). Three independent roadmap "identities" (each keyed by its own `RoadmapCreated.createdAt` ISO string) coexist:

```
Past #1  (completed)   createdAt = today-141
  MaterialAdded × N  →  RoadmapCreated{materialIds, no slots}  →  SessionBooked × (window)  →  RoadmapMarkedComplete{roadmapCreatedAt}
Past #2  (abandoned)   createdAt = today-85
  MaterialAdded × N  →  RoadmapCreated{...}  →  SessionBooked × (window)  →  RoadmapMarkedAbandoned{roadmapCreatedAt}
Active                 createdAt = today-29   ← most-recent non-terminal ⇒ deriveRoadmapLifecycle picks it as `active`
  OnboardingCompleted
  MaterialAdded × 3  →  RoadmapCreated{materialIds:[react,ts,practice], no slots}
  SessionBooked × (Mon/Wed/Fri/Sat, today-28 .. today+35)   [each roadmapCreatedAt = active createdAt]
  SessionLogged × (bookings with date < today, ~85%)         [each bookingId links its booking]
```

Read path (unchanged, production): `findActiveRoadmap` → folds active `SessionBooked` → synthesizes slots → `computeProgress(mapSessions(allEvents), roadmap, calibration, today)` → burn-up (planned from capacity, actual from all sessions), streak, `projectFinish`, weekly stats. `deriveRoadmapLifecycle` sorts the three roadmaps into `active` / `completed` / `abandoned` for `/roadmaps`.

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `apps/app/src/dev/seedTestData.ts` | rewrite | 1, 2 | Emit the no-slot booking model; active roadmap (P1) + two past roadmaps (P2) |
| `apps/app/src/dev/DevSeeder.tsx` | modify | 1 | Update the `console.log` help text to match the new seed |

## Phases

### Phase 1: Rewrite `seedTestData.ts` to the no-slot model — active roadmap only

**Status:** ✅ Complete - `ebf6bbf`; reviewer verified after local-date fix `337976b`
**Depends on:** none — can start immediately
**Estimated scope:** ~1 file rewritten (~200 lines), 1 console string.

#### Codebase state assumed at start

- `apps/app/src/dev/seedTestData.ts` exists and exports `seedTestData(eventStore)` and `wipeTestData(eventStore)`.
- `apps/app/src/sync/types.ts` exports `RoadmapCreatedPayload` (with `materialIds?`, `slots?`), `SessionBookedPayload`, `MaterialAddedPayload`, `RoadmapMarkedCompletePayload`, `RoadmapMarkedAbandonedPayload`.
- `apps/app/src/session/types.ts` exports `SessionLoggedPayload`.
- `@study-tracker/roadmap-engine` exports type `DayOfWeek` (values `'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun'`).
- `EventStore.bulkAppend(events)` preserves each event's `createdAt`.

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
cd /Users/rsaji/projects/1/college-mtech/study-planner-web
grep -n "slots" apps/app/src/dev/seedTestData.ts        # expect legacy slot code present (this is what we're replacing)
grep -n "materialIds\|SessionBookedPayload" apps/app/src/sync/types.ts   # expect both present
grep -n "export type DayOfWeek" packages/roadmap-engine/src/*.ts         # expect DayOfWeek defined
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Replace the entire contents of `apps/app/src/dev/seedTestData.ts`** with the following. (Phase 2 adds the two past roadmaps into the marked block; Phase 1 ships the active roadmap only, with the past-roadmap block left as a `// Phase 2:` placeholder comment.) Implements D-01…D-06.

   ```ts
   import type { EventStore, Event } from '../events/EventStore'
   import type {
     RoadmapCreatedPayload,
     SessionBookedPayload,
     MaterialAddedPayload,
     RoadmapMarkedCompletePayload,
     RoadmapMarkedAbandonedPayload,
   } from '../sync/types'
   import type { SessionLoggedPayload } from '../session/types'
   import type { DayOfWeek } from '@study-tracker/roadmap-engine'

   type OmitId = Omit<Event, 'id'>

   // ---- deterministic RNG (reproducible seed) ----
   let seed = 42
   function rand(): number {
     seed = (seed * 16807) % 2147483647
     return (seed - 1) / 2147483646
   }
   function randInt(min: number, max: number): number {
     return Math.round(min + rand() * (max - min))
   }
   function uuid(): string {
     return crypto.randomUUID()
   }

   // ---- date helpers (local-time day boundaries) ----
   function startOfDay(d: Date): Date {
     const x = new Date(d)
     x.setHours(0, 0, 0, 0)
     return x
   }
   function addDays(base: Date, days: number): Date {
     const d = new Date(base)
     d.setDate(d.getDate() + days)
     return d
   }
   function iso(d: Date): string {
     return d.toISOString()
   }
   function dateStr(d: Date): string {
     return d.toISOString().slice(0, 10)
   }

   // ---- study-day config (D-03) ----
   // Mon, Wed, Fri, Sat  (getDay: 1,3,5,6)
   const STUDY_DAY_NUMS = new Set([1, 3, 5, 6])
   const STUDY_DAYS: DayOfWeek[] = ['Mon', 'Wed', 'Fri', 'Sat']
   function plannedMinutesForDate(d: Date): number {
     const day = d.getDay()
     return day === 0 || day === 6 ? 120 : 90 // weekend 120, weekday 90
   }

   interface SeedMaterial {
     id: string
     title: string
     duration: number
     role: 'anchor' | 'foundation' | 'practice'
     kind: 'youtube' | 'article' | 'manual'
   }
   interface BookingSeed {
     bookingId: string
     date: string
     estimatedDuration: number
     materialId: string
     weekIndex: number
   }

   // Sequential (curriculum-order) material assignment (D-06).
   function bookingsForWindow(start: Date, end: Date, materials: SeedMaterial[]): BookingSeed[] {
     const budgets = materials.map((m) => m.duration)
     let mi = 0
     const out: BookingSeed[] = []
     for (let cur = new Date(start); cur <= end; cur = addDays(cur, 1)) {
       if (!STUDY_DAY_NUMS.has(cur.getDay())) continue
       while (mi < materials.length - 1 && budgets[mi] <= 0) mi++
       const est = plannedMinutesForDate(cur)
       budgets[mi] -= est
       out.push({
         bookingId: uuid(),
         date: dateStr(cur),
         estimatedDuration: est,
         materialId: materials[mi].id,
         weekIndex: Math.max(
           0,
           Math.floor((startOfDay(cur).getTime() - startOfDay(start).getTime()) / (7 * 86_400_000)),
         ),
       })
     }
     return out
   }

   // ---- event builders ----
   function materialEvent(m: SeedMaterial, createdAt: string): OmitId {
     const payload: MaterialAddedPayload = {
       materialId: m.id,
       title: m.title,
       estimatedDuration: m.duration,
       kind: m.kind,
       role: m.role,
     }
     return { kind: 'MaterialAdded', payload: payload as unknown as Record<string, unknown>, createdAt }
   }

   function roadmapEvent(
     args: { start: Date; deadline: Date; materials: SeedMaterial[]; purpose: string },
     createdAt: string,
   ): OmitId {
     const weeks = Math.max(
       1,
       Math.ceil(
         (startOfDay(args.deadline).getTime() - startOfDay(args.start).getTime()) / (7 * 86_400_000),
       ),
     )
     const payload: RoadmapCreatedPayload = {
       startDate: dateStr(args.start),
       deadline: dateStr(args.deadline),
       weeks,
       purpose: args.purpose,
       selectedStudyDays: STUDY_DAYS,
       weekdayHours: 1.5,
       weekendHours: 2,
       weeklyHours: 6.5,
       materialIds: args.materials.map((m) => m.id),
     }
     return { kind: 'RoadmapCreated', payload: payload as unknown as Record<string, unknown>, createdAt }
   }

   function bookingEvent(b: BookingSeed, roadmapCreatedAt: string): OmitId {
     const payload: SessionBookedPayload = {
       roadmapCreatedAt,
       bookingId: b.bookingId,
       date: b.date,
       estimatedDuration: b.estimatedDuration,
       materialId: b.materialId,
     }
     // Same timestamp as the roadmap; fold order is by bookingId, not createdAt.
     return { kind: 'SessionBooked', payload: payload as unknown as Record<string, unknown>, createdAt: roadmapCreatedAt }
   }

   function loggedSessionEvent(b: BookingSeed, mat: SeedMaterial, activeMinutes: number): OmitId {
     const slotDate = new Date(b.date + 'T00:00:00')
     const startHour = [8, 9, 10, 14, 15, 19][Math.floor(rand() * 6)]
     const startedAt = new Date(slotDate)
     startedAt.setHours(startHour, randInt(0, 55), 0, 0)
     const endedAt = new Date(startedAt.getTime() + activeMinutes * 60_000)
     const payload: SessionLoggedPayload = {
       sessionId: uuid(),
       materialId: b.materialId,
       sessionTitle: mat.title,
       slotDate: b.date,
       weekIndex: b.weekIndex,
       plannedMinutes: b.estimatedDuration,
       bookingId: b.bookingId,
       plannedSessionMinutes: b.estimatedDuration,
       // materialPosition intentionally omitted (D-04)
       materialConsumedMinutes: activeMinutes,
       startedAt: iso(startedAt),
       endedAt: iso(endedAt),
       activeMinutes,
       pauseCount: randInt(0, 3),
       totalPauseMinutes: randInt(0, 8),
       pomodorosCompleted: Math.floor(activeMinutes / 25),
       source: 'active',
       resolution: 'completed',
       duration: activeMinutes,
       description: mat.title,
       date: b.date,
     }
     return { kind: 'SessionLogged', payload: payload as unknown as Record<string, unknown>, createdAt: iso(endedAt) }
   }

   export async function seedTestData(eventStore: EventStore): Promise<void> {
     seed = 42

     const existing = await eventStore.getAll()
     if (existing.length > 0) {
       console.warn(`[seed] EventStore already has ${existing.length} events. Wiping first...`)
       await eventStore.wipe()
     }

     const today = startOfDay(new Date())
     const todayStr = dateStr(today)
     const events: OmitId[] = []

     // ============================================================
     // Phase 2 inserts the two PAST roadmaps here (completed + abandoned).
     // ============================================================

     // ---------------- ACTIVE ROADMAP ----------------
     const activeStart = addDays(today, -28)
     const activeDeadline = addDays(today, 35)
     const activeCreatedAt = iso(addDays(activeStart, -1))
     const activeMaterials: SeedMaterial[] = [
       { id: uuid(), title: 'React 19 Deep Dive', duration: 1080, role: 'anchor', kind: 'youtube' },
       { id: uuid(), title: 'TypeScript Patterns', duration: 780, role: 'foundation', kind: 'article' },
       { id: uuid(), title: 'Practice Problems Set', duration: 540, role: 'practice', kind: 'manual' },
     ]

     events.push({ kind: 'OnboardingCompleted', payload: {}, createdAt: activeCreatedAt })
     for (const m of activeMaterials) events.push(materialEvent(m, activeCreatedAt))
     events.push(
       roadmapEvent(
         { start: activeStart, deadline: activeDeadline, materials: activeMaterials, purpose: 'Learn modern React + TypeScript' },
         activeCreatedAt,
       ),
     )

     const activeBookings = bookingsForWindow(activeStart, activeDeadline, activeMaterials)
     for (const b of activeBookings) events.push(bookingEvent(b, activeCreatedAt))

     const matById = new Map(activeMaterials.map((m) => [m.id, m]))
     let loggedCount = 0
     for (const b of activeBookings) {
       if (b.date >= todayStr) continue // leave today + future bookable (D-05)
       if (rand() < 0.15) continue // ~15% skipped
       // pace: first 2 weeks a touch slow, then steady/faster (PACE_KNOB — see Phase 3)
       const pace = b.weekIndex < 2 ? 1.05 + rand() * 0.2 : 0.85 + rand() * 0.2
       const activeMinutes = Math.max(20, Math.round(b.estimatedDuration * pace))
       events.push(loggedSessionEvent(b, matById.get(b.materialId)!, activeMinutes))
       loggedCount++
     }

     events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
     await eventStore.bulkAppend(events)

     console.log(
       `[seed] Done — active roadmap ${dateStr(activeStart)} → ${dateStr(activeDeadline)}; ` +
         `${activeBookings.length} bookings, ${loggedCount} logged sessions; ${events.length} events total.`,
     )
   }

   export async function wipeTestData(eventStore: EventStore): Promise<void> {
     await eventStore.wipe()
     console.log('[seed] Wiped all events from EventStore')
   }
   ```

2. **Update the help text in `apps/app/src/dev/DevSeeder.tsx`** (the `console.log` block, currently lines 25–29): replace `'  __seed()  — generate 4 weeks of test data\n'` with `'  __seed()  — generate demo data (2 past + 1 active roadmap)\n'`. Leave the rest of the file unchanged.

#### Tests

- No unit test exists for `seedTestData` and none is required (dev-only tooling). Rely on typecheck + lint + the live check below.
- Run:

  ```bash
  cd /Users/rsaji/projects/1/college-mtech/study-planner-web
  export FNM_PATH="$HOME/.local/share/fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env --shell bash)" && fnm use 22
  export PNPM_HOME="$HOME/.local/share/pnpm" && export PATH="$PNPM_HOME:$PATH"
  pnpm --filter @study-tracker/app typecheck
  pnpm --filter @study-tracker/app lint
  ```

#### Verification (DONE — run after implementation)

```bash
cd /Users/rsaji/projects/1/college-mtech/study-planner-web
grep -c "slots" apps/app/src/dev/seedTestData.ts     # expect 0 (no legacy slot payload)
grep -c "SessionBooked\|materialIds\|bookingId" apps/app/src/dev/seedTestData.ts   # expect > 0
pnpm --filter @study-tracker/app typecheck            # expect clean
pnpm --filter @study-tracker/app lint                 # expect clean (no new warnings)
```

Then a live smoke check (see `.claude/rules/playwright-full-app-lifecycle.md`): start the app, sign in with the test creds, run `__seed()` in the browser console, and confirm Home + Week populate without console errors. Full live acceptance is Phase 3.

#### Rollback

`git revert` the phase commit. No data migrations; the seed only writes to a dev user's local IndexedDB (call `__wipe()` to clear).

#### Notes (filled in during implementation)

- Implemented in `ebf6bbf`.
- The implementation keeps Phase 1 scoped to `seedTestData.ts` and `DevSeeder.tsx`.
- Deviation: Phase 1 omits `RoadmapMarkedCompletePayload` and `RoadmapMarkedAbandonedPayload` imports until Phase 2 because `apps/app/tsconfig.json` has `noUnusedLocals: true`.
- Deviation: new console text uses plain hyphens instead of em dashes to follow the project instruction.
- Reviewer finding: the UTC day-key helper drifted from Home's local `format(new Date(), 'yyyy-MM-dd')` date near late-evening UTC boundaries.
- Resolved in `337976b`: seed date keys, study-day matching, booking dates, and the today-unlogged rule now use local calendar days; event timestamps remain ISO strings.
- Added focused seed tests for `2026-07-04T20:00:00Z` mapping to `2026-07-05` in `Asia/Kolkata` and for a study-day today booking that remains unlogged.

---

### Phase 2: Add the two past roadmaps (completed + abandoned)

**Status:** ✅ Complete - `edd31ba`; reviewer verified after local-date fix `337976b`
**Depends on:** Phase 1 (✅ Complete) — reuses `materialEvent`, `roadmapEvent`, `bookingEvent`, `bookingsForWindow`, and the `events`/`today` locals defined there.
**Estimated scope:** ~1 file, ~40 lines inserted.

#### Codebase state assumed at start

- Phase 1 landed: `seedTestData.ts` builds the active roadmap and exposes the helper functions above; the `// Phase 2 inserts …` placeholder comment is present inside `seedTestData`.

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
cd /Users/rsaji/projects/1/college-mtech/study-planner-web
grep -n "Phase 2 inserts the two PAST roadmaps here" apps/app/src/dev/seedTestData.ts   # expect the placeholder line
grep -n "function bookingsForWindow\|function roadmapEvent\|function bookingEvent" apps/app/src/dev/seedTestData.ts  # expect all three
```

If any fail, STOP and surface (Phase 1 may not be complete).

#### Steps

1. **Replace the `// Phase 2 inserts …` placeholder block inside `seedTestData`** with the two past roadmaps below. Each uses its own `createdAt` and a matching terminal event (D-02, `roadmapCreatedAt` string-equality). No `SessionLogged`.

   ```ts
     // ---------------- PAST ROADMAP #1 — completed ----------------
     {
       const start = addDays(today, -140)
       const deadline = addDays(today, -95)
       const createdAt = iso(addDays(start, -1))
       const mats: SeedMaterial[] = [
         { id: uuid(), title: 'Foundations of Machine Learning', duration: 900, role: 'anchor', kind: 'youtube' },
         { id: uuid(), title: 'Linear Algebra Refresher', duration: 480, role: 'foundation', kind: 'article' },
       ]
       for (const m of mats) events.push(materialEvent(m, createdAt))
       events.push(roadmapEvent({ start, deadline, materials: mats, purpose: 'Foundations of Machine Learning' }, createdAt))
       for (const b of bookingsForWindow(start, deadline, mats)) events.push(bookingEvent(b, createdAt))
       const resolvedAt = iso(addDays(deadline, -1))
       const terminal: RoadmapMarkedCompletePayload = { roadmapCreatedAt: createdAt, resolvedAt, reason: 'Finished the syllabus' }
       events.push({ kind: 'RoadmapMarkedComplete', payload: terminal as unknown as Record<string, unknown>, createdAt: resolvedAt })
     }

     // ---------------- PAST ROADMAP #2 — abandoned ----------------
     {
       const start = addDays(today, -84)
       const deadline = addDays(today, -28)
       const createdAt = iso(addDays(start, -1))
       const mats: SeedMaterial[] = [
         { id: uuid(), title: 'System Design Interview Prep', duration: 720, role: 'anchor', kind: 'youtube' },
         { id: uuid(), title: 'Distributed Systems Notes', duration: 420, role: 'foundation', kind: 'article' },
       ]
       for (const m of mats) events.push(materialEvent(m, createdAt))
       events.push(roadmapEvent({ start, deadline, materials: mats, purpose: 'System Design Interview Prep' }, createdAt))
       for (const b of bookingsForWindow(start, deadline, mats)) events.push(bookingEvent(b, createdAt))
       const resolvedAt = iso(addDays(start, 30))
       const terminal: RoadmapMarkedAbandonedPayload = { roadmapCreatedAt: createdAt, resolvedAt, reason: 'Shifted focus to the current plan' }
       events.push({ kind: 'RoadmapMarkedAbandoned', payload: terminal as unknown as Record<string, unknown>, createdAt: resolvedAt })
     }
   ```

2. **Update the `console.log` summary** at the end of `seedTestData` to mention the two past roadmaps, e.g. append `+ 2 past roadmaps (1 completed, 1 abandoned)`.

#### Tests

- Same as Phase 1 — typecheck + lint, then the live check in Phase 3. Run:

  ```bash
  cd /Users/rsaji/projects/1/college-mtech/study-planner-web
  pnpm --filter @study-tracker/app typecheck
  pnpm --filter @study-tracker/app lint
  ```

#### Verification (DONE — run after implementation)

```bash
cd /Users/rsaji/projects/1/college-mtech/study-planner-web
grep -c "RoadmapMarkedComplete\|RoadmapMarkedAbandoned" apps/app/src/dev/seedTestData.ts   # expect 2 (one each)
pnpm --filter @study-tracker/app typecheck            # expect clean
pnpm --filter @study-tracker/app lint                 # expect clean
```

Then reseed live (`__wipe()` then `__seed()`) and confirm `/study/roadmaps` History shows exactly **two** rows — one `completed`, one `abandoned` — and the Active hero is unchanged (still the React/TypeScript roadmap). Full acceptance is Phase 3.

#### Rollback

`git revert` the phase commit; the active roadmap from Phase 1 remains intact.

#### Notes (filled in during implementation)

- Implemented in `edd31ba`.
- Deviation: the exact Phase 2 prereq grep in the plan did not match Phase 1's placeholder text because the code used lowercase `past` and a trailing period.
- The semantic placeholder was present at `apps/app/src/dev/seedTestData.ts:216`, so Phase 2 proceeded by explicit user request.
- Deviation: terminal payload objects were left unannotated instead of importing `RoadmapMarkedCompletePayload` and `RoadmapMarkedAbandonedPayload`.
- Reason: the plan's own post-verification grep expects `2`, and spelling the terminal type names in imports or annotations makes that exact guard count more than the two emitted terminal event kinds.
- The emitted payload fields still match the exported terminal payload contract: `roadmapCreatedAt`, `resolvedAt`, and optional `reason`.
- Verification passed: grep guard returned `2`, app typecheck passed, app lint exited 0 with the four pre-existing YouTube-session warnings, and live Chromium smoke showed two history rows with one `abandoned` and one `completed`.
- Reviewer fix `337976b` rechecked that the active roadmap remains the most recent non-terminal roadmap after the local-date change.

---

### Phase 3: Live demo verification + tune pace so the projection lands "a few days early"

**Status:** ✅ Complete - `cf91289`; reviewer verified after local-date fix `337976b`
**Depends on:** Phase 1, Phase 2 (both ✅ Complete).
**Estimated scope:** 0–1 file (only the `PACE_KNOB` constant in `seedTestData.ts` if tuning is needed).

#### Codebase state assumed at start

- Both roadmaps seed cleanly; typecheck + lint pass.
- The app can be run locally with the test account (`.work/specs/test-login-cred.txt`); see `.claude/rules/playwright-full-app-lifecycle.md`.

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
cd /Users/rsaji/projects/1/college-mtech/study-planner-web
./full-app status full     # if stopped: ./full-app start full
curl -i http://localhost:5173/study/sign-in   # expect 200
```

#### Steps

1. **Start the app** (`./full-app start full`), open `http://localhost:5173/study/`, sign in with the test creds, open the browser console, run `__wipe()` then `__seed()`, and reload.

2. **Home (`/study/home`)** — confirm:
   - "Projected finish · provisional" tile shows a date/range and an `N days early` label in moss (D-07). If it shows `days late`, or is missing, adjust pace (step 5).
   - "This week" tile shows non-zero hours; streak card renders; the up-next "Start session" card shows today's booking (today is a study day) or a rest-day card otherwise.
   - "Recent activity" lists recent sessions.

3. **Week (`/study/week`)** — confirm:
   - The **burn-up chart renders** (not the "Log a few more sessions" fallback) — needs `actual.length ≥ 3` with minutes > 0.
   - Daily-minutes bars render; the provisional-finish tile shows a date; past-week navigation (`‹`) works and shows a truncated chart.

4. **Roadmaps (`/study/roadmaps`)** — confirm the Active hero is the React/TypeScript plan with a sensible `%complete` (~40–70%), and History shows the two past rows (completed + abandoned). Optionally open a past roadmap's detail (`/roadmap?roadmap=…`) — booked days show, no completed sessions (expected, D-02).

5. **Tune if needed (`PACE_KNOB`):** the projection basis is GP once `sessionCount ≥ 5` (`projectFinish.ts`). If the finish is not a few days before the deadline, adjust the pace multipliers in the logged-session loop (Phase 1 step 1, the `const pace = …` line): lower pace ⇒ slower ⇒ later finish; higher pace ⇒ earlier. Reseed and re-check. Planning estimate: active material total 2400 min, ~4 weeks elapsed at ~85% completion ≈ 1300 min logged (~54%), analytic finish ≈ today+24 vs deadline today+35 ⇒ ~11 days early. Confirm the GP result is in the same ballpark; if wildly off, note it in VERIFICATION.md and surface (may indicate a real projection bug → new D-NN).

6. **Capture** one screenshot each of Home, Week (chart visible), and Roadmaps for the review, and record any genuine defect found (with repro) in VERIFICATION.md.

#### Tests

- Manual/live acceptance only (see steps). No automated test added.
- Optional regression sanity (does not touch the seed): `pnpm --filter @study-tracker/progress test` should remain green.

#### Verification (DONE — run after implementation)

- [ ] Home projection tile shows a finish a few days **before** the deadline (moss `days early`).
- [ ] Week burn-up chart renders (not the fallback empty state).
- [ ] `/roadmaps` History shows exactly one `completed` + one `abandoned` row; Active hero is the React/TS roadmap.
- [ ] No console errors during seed or navigation.
- [ ] Three screenshots captured and attached to VERIFICATION.md.

#### Rollback

Verification-only; if `PACE_KNOB` was changed, `git revert` that commit to restore Phase-1 pacing.

#### Notes (filled in during implementation)

- Implemented in `cf91289`.
- Live verification must wait for the sync indicator to show `Synced` before running `__wipe()` and `__seed()`.
- Without that wait, initial cloud restore can overwrite the local-only seed on reload and make pre-existing cloud roadmaps appear active.
- Pace tuning changed the active logged-session skip threshold from the literal `0.15` to named `PAST_SESSION_SKIP_PROBABILITY = 0.01`, yielding one deterministic missed past booking and a `41%` active hero.
- Pace tuning changed logged-session multipliers from `1.05 + rand() * 0.2` / `0.85 + rand() * 0.2` to `0.78 + rand() * 0.1` / `0.62 + rand() * 0.1`.
- Final live result after `__wipe()`, `__seed()`, and reload: Home projected `4 DAYS EARLY`, Week burn-up rendered, `/roadmaps` active hero showed `41%`, history showed one abandoned and one completed row, and browser console errors were `0`.
- Screenshots are attached in `screenshots/phase3-home.png`, `screenshots/phase3-week.png`, and `screenshots/phase3-roadmaps.png`.
- Reviewer fix `337976b` repeated the live full-app pass after switching the seed back to local calendar-day keys.
- The repeated live pass showed Home `4 DAYS EARLY`, today's `Start session` card, Week burn-up without fallback, `/roadmaps` active hero `41%`, one completed history row, one abandoned history row, and zero browser console errors.

---

## Open questions

### OQ-01: Burn-up "actual" and `totalMinutes` are global, not scoped to the active roadmap

**Why deferred:** Fixing it is a production behavior change (`apps/app/src/progress/useProgress.ts` and/or `packages/progress/src/progress.ts` would need to scope `mapSessions` output to the active roadmap's date window and/or its `bookingId` set), too risky to land on demo day. This seed sidesteps it by giving past roadmaps no `SessionLogged` (D-02).
**Triggers needing resolution:** any real user who completes one roadmap and starts another will see the new roadmap's burn-up/projection inflated by the prior roadmap's sessions; also blocks giving seeded past roadmaps logged detail (OQ-02).
**Owner / resolution path:** Rohit to decide whether to file an app bug and scope sessions in the progress path; would pair with a new plan + tests.
**Cross-ref:** underlies D-02; blocks OQ-02.

### OQ-02: Should past roadmaps show logged progress in their `/roadmap?roadmap=…` detail view?

**Why deferred:** requires OQ-01 fixed first (otherwise their sessions pollute the active chart).
**Triggers needing resolution:** if the demo walkthrough wants to open a *completed* past roadmap and show a full burn-up.
**Owner / resolution path:** Rohit; revisit after OQ-01.
**Cross-ref:** depends on OQ-01.

## Out of scope

- **Scoping the progress engine to the active roadmap** — production change; captured as OQ-01.
- **Unit/Playwright tests for the seed** — dev-only tooling; live verification (Phase 3) is the acceptance gate.
- **Any change to charts, pages, or the progress/roadmap engines** — D-01. If Phase 3 finds a genuine defect, add a `D-NN` and surface before changing production code.

## References

- Refactor that retired slots — [`plans/active/2026-06-30-material-session-decoupling/PLAN.md`](../2026-06-30-material-session-decoupling/PLAN.md), commit `de2339a`
- Event payload contracts — `apps/app/src/sync/types.ts` (`RoadmapCreatedPayload`, `SessionBookedPayload`, `RoadmapMarked*Payload`), `apps/app/src/session/types.ts` (`SessionLoggedPayload`)
- Read path — `apps/app/src/progress/mapEvents.ts` (`findActiveRoadmap`, `foldBookingEvents`, `slotFromBooking`), `apps/app/src/roadmap/roadmapLifecycle.ts` (`deriveRoadmapLifecycle`, `completedBookingCount`), `packages/progress/src/progress.ts` (`computeProgress`), `packages/progress/src/projectFinish.ts`, `packages/progress/src/materialLedger.ts`
- Surfaces — `apps/app/src/pages/Home.tsx`, `apps/app/src/pages/Week.tsx`, `apps/app/src/pages/Roadmaps.tsx`, `apps/app/src/components/BurnUpChart.tsx`, `apps/app/src/components/DailyMinutesChart.tsx`
- Live-app lifecycle + creds — `.claude/rules/playwright-full-app-lifecycle.md`, `.work/specs/test-login-cred.txt`
