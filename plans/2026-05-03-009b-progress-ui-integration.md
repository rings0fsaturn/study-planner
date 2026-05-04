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

# ProgressEngine & PaceCalibration — UI integration (Plan B of 2)

**Slug:** `009b-progress-ui-integration`
**Date written:** 2026-05-03
**Author:** Claude + Rohit Saji
**Plan status:** Draft
**Upstream:** `issues/009-progress-engine-and-pace-calibration.md`, `prd/PRD-study-tracker-web.md`
**Prerequisite plan:** Plan A (`plans/2026-05-03-009a-progress-ml-algorithms.md`) — must be complete before Phase 2+.

## TL;DR

Wire the `@study-tracker/progress` package (built in Plan A) into the React app. Upgrade the Home page with a streak card, calibrated projection stats, and exceptional tagging on recent activity. Replace the Week page stub with a real weekly review featuring the burn-up chart (The Ledger). Add `SessionTaggedExceptional` and `RecalibrationPromptResolved` event kinds with three UI entry points for exceptional tagging and a recalibration prompt modal. Update the manual log form with time-of-day chips and estimated duration.

## Context & background

Plan A created a pure `@study-tracker/progress` package with `computeCalibration()` and `computeProgress()`. This plan wires those functions into the React UI.

The design source of truth is `design/screens.html`: Section C (Home), Section E (Log), Section F (Weekly progress). The burn-up chart uses The Ledger variant from `issues/images/expectedDesign/burnupchart.png`. A BurnUpChart prototype already exists at `apps/app/src/components/BurnUpChart.tsx` using Visx — this plan refines it.

**Support docs:**

- Plan A: `plans/2026-05-03-009a-progress-ml-algorithms.md`
- Design mockups: `design/screens.html` (Sections C, E, F)
- Burn-up chart design: `issues/images/expectedDesign/burnupchart.png`
- BurnUpChart prototype: `apps/app/src/components/BurnUpChart.tsx`
- Issue: `issues/009-progress-engine-and-pace-calibration.md`

## Decisions log

All major decisions are in Plan A's decisions log (D-01 through D-15). This plan references them. Additional UI-specific decisions:

### D-B01: Phase 1 has zero Plan A dependency

**Status:** ✅ Agreed

**Context:** Should we wait for Plan A to complete before starting any Plan B work?

**Decision:** Phase 1 (SessionTaggedExceptional event + Log form updates) can start immediately — it uses existing `useSync().logEvent()` infrastructure. Only Phases 2+ need Plan A hooks.

**Rationale:** Unblocks parallel work. The event kind and Log form changes are pure app-side work on existing patterns.

**Reversibility:** Easy.

### D-B02: Manual log sessions get a client-generated sessionId

**Status:** ✅ Agreed

**Context:** Manual `SessionLogged` events currently have no `sessionId`. But `SessionTaggedExceptional` events correlate via `sessionId`. Without one, manual logs can't be tagged as exceptional.

**Decision:** Generate `sessionId` via `crypto.randomUUID()` for manual logs and include it in the `SessionLogged` payload. The follow-up `SessionTaggedExceptional` event references the same ID.

**Rationale:** Enables exceptional tagging for manual logs. Doesn't affect existing active sessions (which already have `sessionId`).

**Reversibility:** Easy — one field addition.

### D-B03: Streak CSS variables from design system

**Status:** 🤔 Assumed (unconfirmed)

**Context:** The streak heatmap needs 4 color levels. `design/screens.html` defines `--streak-0` through `--streak-3` in its inline styles.

**Decision:** Add these CSS variables to `packages/design-tokens/src/tokens.css` so the app can use them.

**Rationale:** Centralized in the design system, consistent with how other colors are managed.

**Reversibility:** Easy.

### D-B04: Recalibration modal is dismissable without consequence

**Status:** ✅ Agreed

**Context:** What happens if the user closes the recalibration modal without choosing a response?

**Decision:** Closing without choosing does nothing — no event emitted, CUSUM not reset, prompt re-appears on next Home visit.

**Rationale:** The user may need time to decide. Forcing a response on accidental taps is bad UX. The prompt is persistent until explicitly resolved.

**Reversibility:** Easy.

## Architecture overview

```
@study-tracker/progress (from Plan A)
        │
        │  computeCalibration() → CalibrationState
        │  computeProgress()    → ProgressSnapshot
        │  getPromptDetail()    → PromptDetail
        │
        ▼
apps/app/src/progress/
  useCalibration.ts ──→ CalibrationState
  useProgress.ts    ──→ ProgressSnapshot
        │
        ├──→ Home.tsx
        │     ├── StreakCard (from ProgressSnapshot.streak)
        │     ├── StatCards (from ProgressSnapshot.projection, weeklyStats)
        │     ├── RecalibrationBanner (from CalibrationState.promptNeeded)
        │     └── RecentActivity (flag icon → SessionTaggedExceptional event)
        │
        ├──→ Week.tsx
        │     ├── VerdictBlock (from ProgressSnapshot.verdict)
        │     ├── DailyMinutesChart (from ProgressSnapshot.weeklyStats)
        │     └── BurnUpChart (from ProgressSnapshot.burnUp)
        │
        ├──→ Log.tsx
        │     ├── TimeOfDay chips (Morning/Afternoon/Evening)
        │     ├── EstimatedDuration field
        │     └── "This was unusual" checkbox → SessionTaggedExceptional
        │
        ├──→ Session.tsx
        │     └── "Unusual" toggle on end → SessionTaggedExceptional
        │
        └──→ RecalibrationModal
              ├── "Adjust roadmap" → RecalibrationPromptResolved (replan)
              ├── "This is my pace now" → RecalibrationPromptResolved (acknowledged)
              └── "This was temporary" → RecalibrationPromptResolved (temporary)
                    └── Session checklist → batch SessionTaggedExceptional
```

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `apps/app/src/session/types.ts` | modify | 1 | Add event kind constants |
| `apps/app/src/pages/Log.tsx` | modify | 1 | Time-of-day chips, duration field, exceptional checkbox |
| `apps/app/src/pages/Log.test.tsx` | new | 1 | Unit tests for Log form updates |
| `apps/app/src/components/BurnUpChart.tsx` | modify | 2 | Import types from @study-tracker/progress |
| `apps/app/src/components/BurnUpChartTest.tsx` | modify | 2 | Update to package types |
| `apps/app/src/pages/Week.tsx` | modify | 2 | Full implementation replacing stub |
| `apps/app/src/components/DailyMinutesChart.tsx` | new | 2 | Bar chart for weekly daily minutes |
| `packages/design-tokens/src/tokens.css` | modify | 3 | Add streak color variables |
| `apps/app/src/components/StreakCard.tsx` | new | 3 | Streak heatmap component |
| `apps/app/src/pages/Home.tsx` | modify | 3 | Major overhaul — streak, stats, exceptional flags |
| `apps/app/src/session/components/SessionDefaultLayout.tsx` | modify | 4 | Add exceptional toggle |
| `apps/app/src/session/components/SessionYouTubeLayout.tsx` | modify | 4 | Add exceptional toggle |
| `apps/app/src/pages/Session.tsx` | modify | 4 | Wire toggle to event emission |
| `apps/app/src/components/RecalibrationModal.tsx` | new | 5 | Modal with 3 responses + session checklist |
| `apps/app/src/components/RecalibrationBanner.tsx` | new | 5 | Banner on Home when promptNeeded |
| `apps/app/src/pages/Home.tsx` | modify | 5 | Wire banner + modal |
| `e2e/progress-home.spec.ts` | new | 6 | E2E: log sessions → verify streak + projection |

## Phases

### Phase 1: SessionTaggedExceptional event and Log form updates

**Status:** ✅ Complete
**Depends on:** none — can start immediately (no Plan A dependency)
**Estimated scope:** ~3 files, ~200 lines

#### Codebase state assumed at start

- `apps/app/src/pages/Log.tsx` exists with a form: duration, date, description fields
- `apps/app/src/session/types.ts` exists with `SESSION_EVENT_KINDS` constant
- `useSync().logEvent(kind, payload)` pattern works for emitting events
- Design reference: `design/screens.html` lines 2890-2950 (Log form with time chips + unusual checkbox)

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep "SESSION_EVENT_KINDS" apps/app/src/session/types.ts   # should exist
grep "logEvent" apps/app/src/pages/Log.tsx   # should show the form submit handler
```

If any of these fail, STOP.

#### Steps

1. **Add event kind constants to `apps/app/src/session/types.ts`:** In the `SESSION_EVENT_KINDS` object, add:

   ```typescript
   TAGGED_EXCEPTIONAL: 'SessionTaggedExceptional',
   RECALIBRATION_RESOLVED: 'RecalibrationPromptResolved',
   ```

2. **Update `apps/app/src/pages/Log.tsx`:** Major update to the form. Add three new sections matching the design mockup at `design/screens.html` lines 2890-2950:

   a. **Time-of-day chips** — three `<button className="chip">` elements: Morning, Afternoon, Evening. Default selected based on current hour (before 12=morning, 12-17=afternoon, after 17=evening). State: `useState<'morning'|'afternoon'|'evening'>`.

   b. **Estimated duration** — the existing duration field stays. Make it not strictly required but show a nudge text ("Can you estimate how long? Even a rough guess helps") if the user tries to submit without a duration.

   c. **"This was unusual" checkbox** — matching design lines 2940-2946:
   ```html
   <div class="checkbox-row">
     <span class="checkbox-box"></span>
     <div class="checkbox-body">
       <div class="checkbox-title">This was unusual</div>
       <div class="checkbox-desc">Sick day, marathon session, etc. — keeps it out of your typical pattern.</div>
     </div>
   </div>
   ```

   d. **Generate sessionId** for manual logs — `const sessionId = crypto.randomUUID()`. Include in `SessionLogged` payload. Implements D-B02.

   e. **Updated submit handler:**
   ```typescript
   const handleSubmit = async () => {
     const sessionId = crypto.randomUUID()
     await logEvent('SessionLogged', {
       source: 'manual',
       sessionId,
       duration,
       date,
       description,
       timeOfDay,
       // ... existing fields
     })
     if (isUnusual) {
       await logEvent('SessionTaggedExceptional', {
         sessionId,
         exceptional: true,
       })
     }
     // navigate to confirmation
   }
   ```

3. **Create `apps/app/src/pages/Log.test.tsx`:** Unit tests.

   Key test cases:
   - Time-of-day defaults to correct bucket based on current hour
   - Submitting with "unusual" checked emits both `SessionLogged` and `SessionTaggedExceptional`
   - Submitting without "unusual" emits only `SessionLogged`
   - Both events share the same `sessionId`
   - Duration nudge appears when submitting without duration

#### Tests

- Run: `pnpm --filter app test`

#### Verification (DONE — run after implementation)

```bash
grep "TAGGED_EXCEPTIONAL" apps/app/src/session/types.ts   # should return the constant
grep "SessionTaggedExceptional" apps/app/src/pages/Log.tsx   # should appear in submit handler
pnpm --filter app test   # all tests pass
```

#### Rollback

`git revert <commit-sha>`. No data migrations.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 2: BurnUpChart refinement and Week page implementation

**Status:** ✅ Complete
**Depends on:** Plan A Phase 2 (types), Plan A Phase 7 (hooks)
**Estimated scope:** ~4 files, ~400 lines

#### Codebase state assumed at start

- `apps/app/src/components/BurnUpChart.tsx` exists as a prototype with local `BurnUpData` type
- `apps/app/src/pages/Week.tsx` exists as a "Coming soon" stub
- `@study-tracker/progress` package exists with `BurnUpData` type (field: `gpCurve`, not `gp`)
- `useProgressSnapshot()` hook exists at `apps/app/src/progress/useProgress.ts`
- Design reference: `design/screens.html` Section F (lines 2986-3290)

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep "gpCurve" packages/progress/src/types.ts   # should exist (from Plan A)
grep "useProgressSnapshot" apps/app/src/progress/useProgress.ts   # should exist (from Plan A Phase 7)
ls apps/app/src/components/BurnUpChart.tsx   # should exist (prototype)
```

If any of these fail, STOP.

#### Steps

1. **Update `apps/app/src/components/BurnUpChart.tsx`:** Remove the local `BurnUpData` interface. Import from `@study-tracker/progress` instead. Rename all internal references from `data.gp` to `data.gpCurve`. Ensure `GPPoint` and `CumulativePoint` types align.

2. **Create `apps/app/src/components/DailyMinutesChart.tsx`:** A bar chart component for the Week page showing minutes studied per day (Mon-Sun). Matches the design at lines 3030-3048. Uses Visx `<Bar>` primitives. Accepts `weeklyStats.minutesByDay` data. Shows "Marked unusual" bars in terracotta color for sessions tagged exceptional.

3. **Replace `apps/app/src/pages/Week.tsx`** with full implementation. Layout matches design:

   **Mobile (lines 3000-3092):**
   - Week header: "Week N · Date range" + "Your week" title
   - Verdict block: "Behind plan." / "On track." / "Ahead." with trailing-target or ahead-of-target subtitle
   - Streaming text placeholder (text area for future issue #011 LLM narrative — for now show a static summary: "You logged Xh Ym against a Zh target this week.")
   - DailyMinutesChart component
   - BurnUpChart component (shows when behind plan)
   - Action buttons: "Replan the rest" (accent, navigates to `/roadmap` for now) + "Stay the course" (ghost)

   **Desktop (lines 3167-3286):**
   - Magazine layout: verdict + narrative left, charts right (via CSS grid `grid-template-columns: 1.1fr 1fr`)
   - Mini-week streak strip across the top right

   Wire `useProgressSnapshot()` and `useCalibrationState()` hooks for all data.

4. **Update `apps/app/src/components/BurnUpChartTest.tsx`:** Update to use the package `BurnUpData` type. Keep the dev route functional for testing.

#### Tests

- Add unit test for Week page rendering with mock progress data
- Run: `pnpm --filter app test`

#### Verification (DONE — run after implementation)

```bash
grep "from '@study-tracker/progress'" apps/app/src/components/BurnUpChart.tsx   # imports from package
pnpm --filter app test   # all tests pass
pnpm typecheck   # passes
```

#### Rollback

`git revert <commit-sha>`. No data migrations.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 3: Home page overhaul — streak card, updated stats, exceptional flags

**Status:** ☐ Not started
**Depends on:** Phase 1 (exceptional event kind), Plan A Phase 7 (hooks)
**Estimated scope:** ~4 files, ~500 lines

#### Codebase state assumed at start

- `apps/app/src/pages/Home.tsx` exists with current layout (greeting, up-next, stat cards, total time, recent activity)
- `useCalibrationState()` and `useProgressSnapshot()` hooks exist (Plan A Phase 7)
- `SessionTaggedExceptional` event kind exists (Phase 1)
- Design reference: `design/screens.html` Section C (lines 1991-2120)

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep "useCalibrationState" apps/app/src/progress/useCalibration.ts   # should exist
grep "TAGGED_EXCEPTIONAL" apps/app/src/session/types.ts   # should exist
```

If any of these fail, STOP.

#### Steps

1. **Add streak CSS variables to `packages/design-tokens/src/tokens.css`:** Implements D-B03.

   ```css
   --streak-0: transparent;
   --streak-1: rgba(90, 114, 71, 0.25);
   --streak-2: rgba(90, 114, 71, 0.50);
   --streak-3: rgba(90, 114, 71, 0.85);
   ```

2. **Create `apps/app/src/components/StreakCard.tsx`:** Matches design lines 2038-2052.

   Props: `{ current: number, weeklyMinutes: number, grid: DayCell[] }`

   Renders:
   - Header: "{N}-day streak" (left) + "{hours} this week" (right)
   - 7-cell mini-week grid (Mon-Sun) with `data-lvl` attribute and background color from `--streak-{level}`
   - Today's cell gets a border highlight (`box-shadow: inset 0 0 0 1.5px var(--ink)`)

3. **Overhaul `apps/app/src/pages/Home.tsx`:** Major rewrite of the component body.

   a. **Replace greeting:** Change from "Hello, {email}" to time-of-day greeting with date header matching design lines 2017-2026:
   ```
   Mon · May 3
   Good morning, Jess.
   ```
   (Use email prefix or generic greeting since we only have email)

   b. **Wire hooks:**
   ```typescript
   const calibration = useCalibrationState()
   const progress = useProgressSnapshot(calibration)
   ```

   c. **Keep existing up-next and active session cards** — they work correctly.

   d. **Replace stat cards:** Use `progress.projection` for projected finish (show CI range: "Jun 17–23"). Use `progress.weeklyStats` for "This week" card.

   e. **Add StreakCard** between up-next and stats. Data from `progress.streak`.

   f. **Remove standalone "Total time logged" card** — total is now part of the stats.

   g. **Update recent activity list:** Add a flag icon per session row. Query `SessionTaggedExceptional` events from EventStore to build a `Set<string>` of exceptional sessionIds. For sessions with a `sessionId` in the set, show an "Unusual" tag (terracotta). Clicking the flag toggles: emit `SessionTaggedExceptional` with `exceptional: true/false`.

   h. **Graceful fallback:** When `progress === null` (no roadmap yet), show minimal UI (greeting + recent activity only, no streak/stats).

4. **Update Home tests:** Adapt existing tests to account for new component structure. Add test for exceptional flag toggle.

#### Tests

- Run: `pnpm --filter app test`

#### Verification (DONE — run after implementation)

```bash
grep "StreakCard" apps/app/src/pages/Home.tsx   # should import and render
grep "useProgressSnapshot" apps/app/src/pages/Home.tsx   # should appear
pnpm --filter app test   # all tests pass
pnpm typecheck   # passes
```

#### Rollback

`git revert <commit-sha>`. No data migrations.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 4: Session end exceptional toggle

**Status:** ☐ Not started
**Depends on:** Phase 1 (event kind constant)
**Estimated scope:** ~3 files, ~80 lines

#### Codebase state assumed at start

- `SessionTaggedExceptional` event kind constant exists in `session/types.ts` (Phase 1)
- `apps/app/src/pages/Session.tsx` has a `handleEnd` callback that calls `lc.end()` and navigates to `/home`
- `apps/app/src/session/components/SessionDefaultLayout.tsx` renders `EndSessionButton`
- `apps/app/src/session/components/SessionYouTubeLayout.tsx` renders `EndSessionButton`

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep "TAGGED_EXCEPTIONAL" apps/app/src/session/types.ts   # should exist
grep "handleEnd" apps/app/src/pages/Session.tsx   # should exist
```

If any of these fail, STOP.

#### Steps

1. **Add exceptional toggle to `SessionDefaultLayout.tsx`:** Below the `EndSessionButton`, add a checkbox-style toggle:

   ```tsx
   <div className="checkbox-row" style={{ marginTop: '12px' }}>
     <input type="checkbox" checked={unusual} onChange={() => setUnusual(!unusual)} />
     <div className="checkbox-body">
       <div className="checkbox-title">This was unusual</div>
     </div>
   </div>
   ```

   Pass `unusual` state up via a new `onUnusualChange` prop or have the parent manage state.

2. **Add same toggle to `SessionYouTubeLayout.tsx`:** Same component, same position relative to End button.

3. **Update `Session.tsx` `handleEnd`:** After `lc.end()` (which emits `SessionLogged`), if the unusual toggle is on, emit `SessionTaggedExceptional` using the session's `record.sessionId`:

   ```typescript
   const handleEnd = async () => {
     await lc.end()
     if (unusual && record) {
       await logEvent('SessionTaggedExceptional', {
         sessionId: record.sessionId,
         exceptional: true,
       })
     }
     navigate('/home')
   }
   ```

#### Tests

- Add test in `SessionDefaultLayout.test.tsx` for toggle presence and callback
- Run: `pnpm --filter app test`

#### Verification (DONE — run after implementation)

```bash
grep "SessionTaggedExceptional" apps/app/src/pages/Session.tsx   # should appear in handleEnd
pnpm --filter app test   # all tests pass
```

#### Rollback

`git revert <commit-sha>`. No data migrations.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 5: Recalibration prompt — banner and modal

**Status:** ☐ Not started
**Depends on:** Phase 1 (event kind), Phase 3 (Home page wired with hooks), Plan A Phase 6 (`getPromptDetail`)
**Estimated scope:** ~4 new files, ~400 lines

#### Codebase state assumed at start

- `CalibrationState.promptNeeded` field exists (Plan A)
- `getPromptDetail()` function exported from `@study-tracker/progress` (Plan A Phase 6)
- Home page uses `useCalibrationState()` hook (Phase 3)
- `RecalibrationPromptResolved` event kind constant exists (Phase 1)
- Design reference for banners: `design/screens.html` lines 2146-2158 (banner pattern)

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep "getPromptDetail" packages/progress/src/index.ts   # should be exported
grep "useCalibrationState" apps/app/src/pages/Home.tsx   # should appear (Phase 3)
grep "RECALIBRATION_RESOLVED" apps/app/src/session/types.ts   # should exist
```

If any of these fail, STOP.

#### Steps

1. **Create `apps/app/src/components/RecalibrationBanner.tsx`:** A banner matching the existing banner pattern (attention variant). Shows "Your pace has shifted — your roadmap's time estimates may be stale." with a CTA button "Review". Clicking opens the modal.

2. **Create `apps/app/src/components/RecalibrationModal.tsx`:** Modal dialog with three response sections. Implements Plan A D-10.

   **Structure:**
   - Header: "Your pace has changed"
   - Subtext: "You've been consistently finishing sessions {faster/slower} than planned."
   - Three response buttons:

   a. **"Adjust my roadmap"** — emits `RecalibrationPromptResolved` with `resolution: 'replan'`, navigates to `/roadmap` (future replan route from issue #010).

   b. **"This is my pace now"** — emits `RecalibrationPromptResolved` with `resolution: 'acknowledged'`, closes modal.

   c. **"This was temporary"** — expands to show session checklist. Calls `getPromptDetail()` to get the sessions in the CUSUM detection window. Each session row shows:
      - Date (e.g., "Tue, Apr 28")
      - Time (e.g., "2:30 PM" from `timeOfDay`)
      - Session title
      - "60 min planned → 92 min actual"
      - Checkbox (checked by default)

   On confirm: emits `RecalibrationPromptResolved` with `resolution: 'temporary'` AND batch-emits `SessionTaggedExceptional` for each checked session.

   **Dismissal:** Closing without choosing does nothing (D-B04). Modal re-appears on next Home visit.

3. **Wire into `apps/app/src/pages/Home.tsx`:** Render `<RecalibrationBanner>` after existing banners (PlannedEndBanner, AbandonedSessionBanner) when `calibration?.promptNeeded === true`. Banner opens modal state.

4. **Create `apps/app/src/components/RecalibrationModal.test.tsx`:** Tests for all three response paths.

   Key test cases:
   - "Adjust roadmap" emits `RecalibrationPromptResolved` with `resolution: 'replan'`
   - "This is my pace now" emits `RecalibrationPromptResolved` with `resolution: 'acknowledged'`
   - "This was temporary" shows checklist, confirm emits both events
   - Closing modal without choosing emits nothing
   - Session checklist shows correct session data from `getPromptDetail()`

#### Tests

- Run: `pnpm --filter app test`

#### Verification (DONE — run after implementation)

```bash
grep "RecalibrationModal" apps/app/src/pages/Home.tsx   # should import and render
grep "RecalibrationBanner" apps/app/src/pages/Home.tsx   # should import and render
pnpm --filter app test   # all tests pass
```

#### Rollback

`git revert <commit-sha>`. No data migrations.

#### Notes (filled in during implementation)

*(empty)*

---

### Phase 6: E2E test — session log to streak and projection update

**Status:** ☐ Not started
**Depends on:** All previous phases + Plan A fully complete
**Estimated scope:** ~1 file, ~100 lines

#### Codebase state assumed at start

- All Plan A phases complete (algorithms work)
- All Plan B phases 1-5 complete (UI wired)
- E2E infrastructure exists: `e2e/playwright.config.ts` with `app` project
- Existing E2E specs pattern: `e2e/session-log.spec.ts`, `e2e/onboarding.spec.ts`

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
ls e2e/playwright.config.ts   # should exist
grep "StreakCard" apps/app/src/pages/Home.tsx   # should exist (Phase 3)
pnpm --filter app test   # all unit tests pass
```

If any of these fail, STOP.

#### Steps

1. **Create `e2e/progress-home.spec.ts`:** Playwright test covering the acceptance criterion: "log several sessions across days → see streak update, projection update, burn-up update on Home."

   **Test flow:**
   a. Sign in as test user (follow pattern from `session-log.spec.ts`)
   b. Complete onboarding (if needed — follow pattern from `onboarding.spec.ts`)
   c. Navigate to `/study/log`
   d. Log a session for today (fill duration, submit)
   e. Navigate to `/study/home`
   f. Verify streak card shows "1-day streak"
   g. Verify stat cards show projected finish date
   h. Log another session for yesterday (via "Earlier" date option)
   i. Return to Home
   j. Verify streak updates to "2-day streak"
   k. Verify recent activity shows both sessions

   **Note:** Per CLAUDE.md, E2E tests cannot be run due to environment issues — write the test but do not attempt to run it.

#### Tests

- Write only, do not run: `e2e/progress-home.spec.ts`

#### Verification (DONE — run after implementation)

```bash
ls e2e/progress-home.spec.ts   # should exist
pnpm typecheck   # passes (test file compiles)
```

#### Rollback

`git revert <commit-sha>`. No external effects.

#### Notes (filled in during implementation)

*(empty)*

---

## Out of scope

- **ReplanEngine** — issue #010, consumes ProgressSnapshot. The "Replan the rest" button navigates to `/roadmap` for now.
- **WeeklyNarrativeService / LLM streaming** — issue #011. The Week page shows a static summary placeholder where the narrative will go.
- **Web Push notifications** — v1.1 per PRD. All reminders are in-app.
- **Settings page** — issue #015. Calibration state is not user-configurable in v1.

## References

- Plan A: `plans/2026-05-03-009a-progress-ml-algorithms.md`
- Issue #009: `issues/009-progress-engine-and-pace-calibration.md`
- PRD: `prd/PRD-study-tracker-web.md`
- Design screens: `design/screens.html` (Sections C, E, F, G)
- Burn-up design: `issues/images/expectedDesign/burnupchart.png`
- Session types: `apps/app/src/session/types.ts`
- BurnUpChart prototype: `apps/app/src/components/BurnUpChart.tsx`
- Existing E2E patterns: `e2e/session-log.spec.ts`, `e2e/onboarding.spec.ts`
