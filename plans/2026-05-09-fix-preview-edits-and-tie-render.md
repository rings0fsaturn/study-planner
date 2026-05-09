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

The status markers are a fast read, but they are not the source of truth. The phase's `Verification (DONE)` commands are the truth — if you suspect a marker is wrong (someone forgot to update, branches diverged, partial commits, etc.), run the verification commands for the phases marked complete. Trust the commands over the markers, and surface the drift to the human.

---

# Fix stale preview edits and resolved-tie rendering in roadmap preview

**Slug:** `fix-preview-edits-and-tie-render`
**Date written:** 2026-05-09
**Author:** Claude + Rohit Saji
**Plan status:** Draft
**Upstream:** none

## TL;DR

Two bugs in the onboarding roadmap preview (Step3Preview). First, when a user changes a material's role (foundation/anchor/practice), adds/removes materials, or confirms a playlist, the `previewEdits` array is never cleared — stale edits from the previous roadmap generation persist and override new slot assignments, creating phantom/remnant slots. Second, when a user resolves a boundary-slot tie by picking a material for review, the resulting slot renders with a "foundations" role tag but no session title and 0 minutes, because `handleResolveTie` creates an edit with `sessionTitle: null` and `plannedMinutes: 0`. Fix: clear `previewEdits` in 7 reducer actions, and backfill session title + capacity in `handleResolveTie`.

## Context & background

The onboarding wizard's Step3Preview generates a roadmap via `@study-tracker/roadmap-engine` and lets the user fine-tune it with manual edits (tie resolution, renames, swaps). These edits are stored in `state.previewEdits` and overlaid onto the generated roadmap in the `displayRoadmap` memo.

The roadmap engine's Stage 5 (material assignment) creates a "boundary slot" per role when the material queue empties — a multi-candidate slot with `candidateMaterialIds = [...materialIds, '__rest__']` that prompts the user to choose review or rest (Decision 16 from the engine design).

**Bug 1 — Stale edits:** `previewEdits` are only modified by `SET_PREVIEW_EDITS` dispatches (from swap, rename, tie resolve). None of the 7 reducer actions that change roadmap inputs (`UPDATE_MATERIAL`, `REMOVE_MATERIAL`, `ADD_MATERIAL`, `PLAYLIST_SET_ROLE`, `REMOVE_PLAYLIST`, `ADD_PLAYLIST`, `PLAYLIST_CONFIRM`) clear the edits. When the roadmap regenerates, stale edits force old material assignments onto slots whose meaning has changed.

**Bug 2 — Resolved tie rendering:** When the user resolves a boundary-slot tie by clicking a material chip, `handleResolveTie` creates an edit with `materialId` set but `sessionTitle: null` and `plannedMinutes: 0`. The slot renders via the regular slot path (not tie, not rest) showing the role tag ("foundations") but empty title and "0m" duration. The fallback patch at `Step3Preview.tsx:81-87` that would backfill the title requires `!slot.role`, but the engine preserves the role on boundary slots (`roadmap-engine.ts:580`), so the patch never fires.

**Support docs:**

- Roadmap engine algorithm: `packages/roadmap-engine/src/roadmap-engine.ts`
- Engine design guide: `design/algo/ROADMAP_ENGINE_GUIDE.md`
- Onboarding architecture: `.claude/rules/onboarding-architecture.md`

## Decisions log

### D-01: Clear ALL previewEdits on input change, not surgical per-material

**Status:** ✅ Agreed

**Context:** When a material's role changes, should we clear all edits or only edits referencing that specific material?

**Decision:** Clear all edits (`previewEdits: []`).

**Rationale:** A role change fundamentally reshuffles the entire roadmap — different slots get different role tags, the round-robin redistributes, session counts change, boundary slots move. An edit at `2:WED` that swapped two anchor sessions is meaningless after a material moves from anchor to practice — the slot at `2:WED` might now belong to a different role entirely. Surgical removal by material ID would leave orphaned swap edits that reference slot coordinates whose meaning has changed.

**Alternatives considered:**

- Only remove edits for the changed material → rejected: swap edits reference two slots, and both slots' meanings change on regeneration
- Keep edits and let `displayRoadmap` validate them → rejected: validation logic would be complex and fragile

**User pushback / disagreement:** none

**Reversibility:** Easy — single line per reducer case

### D-02: Which reducer actions clear previewEdits

**Status:** ✅ Agreed

**Context:** Multiple user actions change the inputs to `generateRoadmap`. All make existing edits stale.

**Decision:** Seven actions clear `previewEdits: []`:
1. `UPDATE_MATERIAL` — role or duration change
2. `REMOVE_MATERIAL` — material deleted
3. `ADD_MATERIAL` — new material joins a role queue
4. `PLAYLIST_SET_ROLE` — playlist role change feeds into expanded materials
5. `REMOVE_PLAYLIST` — playlist removed
6. `ADD_PLAYLIST` — new playlist added
7. `PLAYLIST_CONFIRM` — video selection changes duration

`FETCH_SUCCEEDED` is excluded — it fires before Step3Preview is visible, so there are no edits to clear.

**Alternatives considered:**

- Include `FETCH_SUCCEEDED` → rejected: fires before preview exists, would be dead code

**User pushback / disagreement:** none

**Reversibility:** Easy

### D-03: Resolved tie gets "Review · {title}" and capacityMinutes

**Status:** ✅ Agreed

**Context:** When user resolves a boundary-slot tie by picking a material, what should the session title and planned minutes be?

**Decision:** `sessionTitle = "Review · {material title}"`, `plannedMinutes = slot.capacityMinutes`.

**Rationale:** The boundary slot is an optional review session, not a numbered continuation. "session 2 of 1" would be incoherent. "Review" prefix signals discretionary reinforcement. Setting `plannedMinutes` to `capacityMinutes` makes the slot visually meaningful — a 0-minute session shows "0m" in the UI.

**Alternatives considered:**

- Continue session numbering (e.g., "session 2 of 2") → rejected: the engine already counted all real sessions; the boundary slot is supplementary
- Leave plannedMinutes as 0 and patch in displayRoadmap → rejected: splits resolve logic across two places (see D-04)

**User pushback / disagreement:** none

**Reversibility:** Easy — one callback function

### D-04: Fix lives in handleResolveTie, not displayRoadmap

**Status:** ✅ Agreed

**Context:** Should the session title and planned minutes be set at edit-creation time (in `handleResolveTie`) or at display time (in the `displayRoadmap` memo)?

**Decision:** In `handleResolveTie`.

**Rationale:** The edit is the source of truth for what the user decided. Setting values at creation time keeps the resolve-tie logic in one place. `displayRoadmap` stays a dumb overlay.

**Alternatives considered:**

- Patch in `displayRoadmap` → rejected: splits logic, makes displayRoadmap responsible for business rules it shouldn't own

**User pushback / disagreement:** none

**Reversibility:** Easy

### D-05: Rest selection clears role to null

**Status:** ✅ Agreed

**Context:** When the user picks `__rest__` from a boundary slot, the slot's `role` stays `'foundation'` (or whatever the engine tagged). Should we clear it?

**Decision:** Clear `role` to `null` in `displayRoadmap` when an edit sets `candidateMaterialIds` to empty.

**Rationale:** A rest day isn't a foundation session. Clearing `role` makes the slot semantically correct and prevents the fallback patch at `Step3Preview.tsx:81-87` from ever re-tagging it. The rest-day render path already doesn't show a role tag, so this is defensive correctness.

**Alternatives considered:**

- Add `role` field to `OnboardingSlotEdit` type → rejected: over-engineering for one case; inline in displayRoadmap is simpler

**User pushback / disagreement:** none

**Reversibility:** Easy — one line in displayRoadmap

### D-06: capacityMinutes threaded from SchedulePreview

**Status:** ✅ Agreed

**Context:** `handleResolveTie` needs `capacityMinutes` to set `plannedMinutes` on the edit. It doesn't currently have access.

**Decision:** Add `capacityMinutes` as a 4th argument to `onResolveTie`. `SchedulePreview` passes it from the slot (already in scope at render time).

**Rationale:** Threading from the call site avoids a redundant lookup in `handleResolveTie`. Minimal API surface change.

**Alternatives considered:**

- Have `handleResolveTie` look up the slot from `displayRoadmap` → rejected: redundant scan, SchedulePreview already has the slot

**User pushback / disagreement:** none

**Reversibility:** Easy

### D-07: Silent clear, no toast UI

**Status:** ✅ Agreed

**Context:** When edits are cleared on input change, should we show a toast?

**Decision:** No. Silent clear.

**Rationale:** The user is on Step3Materials, not looking at the preview. The preview regenerates fresh when they navigate forward — that is the feedback.

**Alternatives considered:**

- Toast notification → rejected: references something the user isn't currently seeing, would feel noisy

**User pushback / disagreement:** none

**Reversibility:** Easy — add toast later if user feedback warrants it

## Architecture overview

```
Step3Materials (role change / add / remove)
    │
    ▼
OnboardingProvider reducer ─── clears previewEdits: [] ──┐
    │                                                      │
    ▼                                                      │
expandedMaterials (useMemo)                                │
    │                                                      │
    ▼                                                      │
Step3Preview                                               │
    │                                                      │
    ├─ roadmapInput (useMemo) ─► generateRoadmap()         │
    │                               │                      │
    │                               ▼                      │
    ├─ displayRoadmap (useMemo) ◄── roadmap + previewEdits ◄┘
    │       │
    │       ├─ Apply edits (materialId, sessionTitle, plannedMinutes)
    │       ├─ Clear role on rest edits (D-05)
    │       └─ Backfill patch (existing, unchanged)
    │
    ├─ handleResolveTie ─── sets sessionTitle + plannedMinutes (D-03)
    │
    └─ SchedulePreview ─── passes capacityMinutes to onResolveTie (D-06)
```

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `apps/app/src/onboarding/OnboardingProvider.tsx` | modify | 1 | Add `previewEdits: []` to 7 reducer actions |
| `apps/app/src/onboarding/OnboardingProvider.test.tsx` | modify | 1 | Test that 7 actions clear previewEdits |
| `apps/app/src/onboarding/steps/Step3Preview.tsx` | modify | 2 | Fix handleResolveTie + displayRoadmap rest-role clear |
| `apps/app/src/onboarding/components/SchedulePreview.tsx` | modify | 2 | Thread capacityMinutes through onResolveTie |
| `apps/app/src/onboarding/steps/Step3Preview.test.tsx` | modify | 2 | Test resolved tie rendering |

## Phases

### Phase 1: Clear previewEdits on reducer actions that change roadmap inputs

**Status:** ☐ Not started
**Depends on:** none — can start immediately
**Estimated scope:** 2 files, ~30 lines

#### Codebase state assumed at start

- File `apps/app/src/onboarding/OnboardingProvider.tsx` exists with `onboardingReducer` function containing `UPDATE_MATERIAL`, `REMOVE_MATERIAL`, `ADD_MATERIAL`, `ADD_PLAYLIST`, `REMOVE_PLAYLIST`, `PLAYLIST_CONFIRM`, `PLAYLIST_SET_ROLE` cases
- `previewEdits` is a field on `OnboardingState` (line 58), initialized to `[]` (line 72)
- File `apps/app/src/onboarding/OnboardingProvider.test.tsx` exists with test suites for the reducer

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep -n "previewEdits" apps/app/src/onboarding/OnboardingProvider.tsx   # should show field on lines 58, 72, 205
grep -n "UPDATE_MATERIAL" apps/app/src/onboarding/OnboardingProvider.tsx  # should show line ~156
pnpm --filter app test -- --run apps/app/src/onboarding/OnboardingProvider.test.tsx  # should pass
pnpm --filter app test -- --run apps/app/src/onboarding/OnboardingProvider.test.ts   # should pass
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Modify `apps/app/src/onboarding/OnboardingProvider.tsx`, `onboardingReducer` function (lines 148–215).** Add `previewEdits: []` to 7 reducer cases. Implements D-01, D-02.

   Replace line 155 (`ADD_MATERIAL` case):
   ```tsx
   case 'ADD_MATERIAL':
     return { ...state, materials: [...state.materials, { ...action.material, additionOrder: state.nextAdditionOrder }], nextAdditionOrder: state.nextAdditionOrder + 1, previewEdits: [], stepReached: Math.max(state.stepReached, 3) }
   ```

   Replace line 157 (`UPDATE_MATERIAL` case):
   ```tsx
   case 'UPDATE_MATERIAL':
     return { ...state, materials: state.materials.map(m => m.id === action.id ? { ...m, ...action.updates } : m), previewEdits: [] }
   ```

   Replace line 159 (`REMOVE_MATERIAL` case):
   ```tsx
   case 'REMOVE_MATERIAL':
     return { ...state, materials: state.materials.filter(m => m.id !== action.id), previewEdits: [] }
   ```

   Replace lines 171–176 (`ADD_PLAYLIST` case):
   ```tsx
   case 'ADD_PLAYLIST':
     return {
       ...state,
       playlists: [...state.playlists, { ...action.playlist, confirmed: false, additionOrder: state.nextAdditionOrder, role: 'foundation' as const }],
       nextAdditionOrder: state.nextAdditionOrder + 1,
       previewEdits: [],
       stepReached: Math.max(state.stepReached, 3),
     }
   ```

   Replace line 178 (`REMOVE_PLAYLIST` case):
   ```tsx
   case 'REMOVE_PLAYLIST':
     return { ...state, playlists: state.playlists.filter(p => p.id !== action.playlistId), previewEdits: [] }
   ```

   Replace lines 183–201 (`PLAYLIST_CONFIRM` case):
   ```tsx
   case 'PLAYLIST_CONFIRM': {
     const playlist = state.playlists.find(p => p.id === action.playlistId)
     if (!playlist) return state
     return {
       ...state,
       playlists: state.playlists.map(p =>
         p.id === action.playlistId
           ? {
               ...p,
               confirmed: true,
               videos: p.videos.map(v => ({
                 ...v,
                 selected: action.selectedVideoIds.includes(v.youtubeVideoId),
               })),
             }
           : p
       ),
       previewEdits: [],
     }
   }
   ```

   Replace line 203 (`PLAYLIST_SET_ROLE` case):
   ```tsx
   case 'PLAYLIST_SET_ROLE':
     return { ...state, playlists: state.playlists.map(p => p.id === action.playlistId ? { ...p, role: action.role } : p), previewEdits: [] }
   ```

#### Tests

Add the following test to the **"OnboardingProvider — fetch and playlist actions"** describe block in `apps/app/src/onboarding/OnboardingProvider.test.tsx`. The test component needs a `previewEdits` display element and a button to seed edits.

2. **Modify `apps/app/src/onboarding/OnboardingProvider.test.tsx`**, `ReducerTestComponent` (lines 190–231). Add a `previewEdits` display and a "seed edits" button:

   After line 199 (`<span data-testid="expandedMaterials">...`), add:
   ```tsx
   <span data-testid="previewEdits">{JSON.stringify(state.previewEdits)}</span>
   <button data-testid="seedEdits" onClick={() => dispatch({ type: 'SET_PREVIEW_EDITS', edits: [{ weekIndex: 0, dayOfWeek: 'Mon', materialId: 'mat-1', sessionTitle: 'Test', plannedMinutes: 60 }] })}>SeedEdits</button>
   <button data-testid="updateMaterialRole" onClick={() => dispatch({ type: 'UPDATE_MATERIAL', id: 'mat-1', updates: { role: 'practice' } })}>UpdateRole</button>
   <button data-testid="removeMaterial" onClick={() => dispatch({ type: 'REMOVE_MATERIAL', id: 'mat-1' })}>RemoveMat</button>
   ```

3. **Add tests** to the same describe block:

   ```tsx
   it('UPDATE_MATERIAL clears previewEdits', async () => {
     await renderAndWait()
     fireEvent.click(screen.getByTestId('addMaterial'))
     fireEvent.click(screen.getByTestId('seedEdits'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(1)

     fireEvent.click(screen.getByTestId('updateMaterialRole'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(0)
   })

   it('REMOVE_MATERIAL clears previewEdits', async () => {
     await renderAndWait()
     fireEvent.click(screen.getByTestId('addMaterial'))
     fireEvent.click(screen.getByTestId('seedEdits'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(1)

     fireEvent.click(screen.getByTestId('removeMaterial'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(0)
   })

   it('ADD_MATERIAL clears previewEdits', async () => {
     await renderAndWait()
     fireEvent.click(screen.getByTestId('seedEdits'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(1)

     fireEvent.click(screen.getByTestId('addMaterial'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(0)
   })

   it('PLAYLIST_SET_ROLE clears previewEdits', async () => {
     await renderAndWait()
     fireEvent.click(screen.getByTestId('addPlaylist'))
     fireEvent.click(screen.getByTestId('playlistFetchOk'))
     fireEvent.click(screen.getByTestId('playlistConfirm'))
     fireEvent.click(screen.getByTestId('seedEdits'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(1)

     fireEvent.click(screen.getByTestId('playlistSetRole'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(0)
   })

   it('REMOVE_PLAYLIST clears previewEdits', async () => {
     await renderAndWait()
     fireEvent.click(screen.getByTestId('addPlaylist'))
     fireEvent.click(screen.getByTestId('seedEdits'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(1)

     fireEvent.click(screen.getByTestId('removePlaylist'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(0)
   })

   it('ADD_PLAYLIST clears previewEdits', async () => {
     await renderAndWait()
     fireEvent.click(screen.getByTestId('seedEdits'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(1)

     fireEvent.click(screen.getByTestId('addPlaylist'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(0)
   })

   it('PLAYLIST_CONFIRM clears previewEdits', async () => {
     await renderAndWait()
     fireEvent.click(screen.getByTestId('addPlaylist'))
     fireEvent.click(screen.getByTestId('playlistFetchOk'))
     fireEvent.click(screen.getByTestId('seedEdits'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(1)

     fireEvent.click(screen.getByTestId('playlistConfirm'))
     expect(JSON.parse(screen.getByTestId('previewEdits').textContent!)).toHaveLength(0)
   })
   ```

- Run: `pnpm --filter app test -- --run apps/app/src/onboarding/OnboardingProvider.test.tsx`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run apps/app/src/onboarding/OnboardingProvider.test.tsx  # all green
pnpm --filter app test -- --run apps/app/src/onboarding/OnboardingProvider.test.ts   # still passes (unit tests for expandPlaylistsToMaterials)
pnpm typecheck  # no type errors
```

#### Rollback

`git revert <commit-sha>`. No data migrations. Phase 2 does not depend on Phase 1's edits being cleared — the bugs are independent.

#### Notes (filled in during implementation)

<empty>

---

### Phase 2: Fix resolved-tie rendering — session title, planned minutes, and rest role clearing

**Status:** ☐ Not started
**Depends on:** none — can start immediately (independent of Phase 1)
**Estimated scope:** 3 files, ~30 lines

#### Codebase state assumed at start

- File `apps/app/src/onboarding/steps/Step3Preview.tsx` exists with `handleResolveTie` callback (lines 102–111) and `displayRoadmap` memo (lines 63–97)
- File `apps/app/src/onboarding/components/SchedulePreview.tsx` exists with `onResolveTie` prop (line 14) and tie-chip rendering (lines 94–108)
- `handleResolveTie` currently creates edits with `sessionTitle: null, plannedMinutes: 0`
- `expandedMaterials` is available via `useOnboarding()` at Step3Preview line 26
- File `apps/app/src/onboarding/steps/Step3Preview.test.tsx` exists with test infrastructure

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep -n "handleResolveTie" apps/app/src/onboarding/steps/Step3Preview.tsx  # should show lines ~102-111
grep -n "onResolveTie" apps/app/src/onboarding/components/SchedulePreview.tsx  # should show line ~14 and call sites
pnpm --filter app test -- --run apps/app/src/onboarding/steps/Step3Preview.test.tsx  # should pass
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Modify `apps/app/src/onboarding/components/SchedulePreview.tsx`, `SchedulePreviewProps` interface (line 14).** Add `capacityMinutes` parameter to `onResolveTie`. Implements D-06.

   Replace line 14:
   ```tsx
   onResolveTie: (weekIndex: number, dayOfWeek: string, materialId: string | null, capacityMinutes: number) => void
   ```

2. **Modify `apps/app/src/onboarding/components/SchedulePreview.tsx`, tie chip onClick handlers (lines 94–108).** Pass `slot.capacityMinutes` as 4th argument.

   Replace lines 94–108:
   ```tsx
   {slot.candidateMaterialIds.map(id => {
     if (id === '__rest__') {
       return (
         <button key="__rest__" className="chip" onClick={(e) => { e.stopPropagation(); onResolveTie(slot.weekIndex, slot.dayOfWeek, null, slot.capacityMinutes) }}>
           Rest day
         </button>
       )
     }
     const mat = materials.find(m => m.id === id)
     return (
       <button key={id} className="chip" onClick={(e) => { e.stopPropagation(); onResolveTie(slot.weekIndex, slot.dayOfWeek, id, slot.capacityMinutes) }}>
         Review {mat?.title ?? id}
       </button>
     )
   })}
   ```

3. **Modify `apps/app/src/onboarding/steps/Step3Preview.tsx`, `handleResolveTie` callback (lines 102–111).** Accept `capacityMinutes`, set `sessionTitle` and `plannedMinutes` for material picks. Implements D-03, D-04, D-06.

   Replace lines 102–111:
   ```tsx
   const handleResolveTie = useCallback((weekIndex: number, dayOfWeek: string, materialId: string | null, capacityMinutes: number) => {
     const edits: OnboardingSlotEdit[] = [...state.previewEdits]
     const existingIdx = edits.findIndex(e => e.weekIndex === weekIndex && e.dayOfWeek === dayOfWeek)

     let sessionTitle: string | null = null
     let plannedMinutes = 0
     if (materialId) {
       const mat = expandedMaterials.find(m => m.id === materialId)
       sessionTitle = `Review · ${mat?.title ?? materialId}`
       plannedMinutes = capacityMinutes
     }

     if (existingIdx >= 0) {
       edits[existingIdx] = { ...edits[existingIdx], materialId, sessionTitle, plannedMinutes }
     } else {
       edits.push({ weekIndex, dayOfWeek, materialId, sessionTitle, plannedMinutes })
     }
     dispatch({ type: 'SET_PREVIEW_EDITS', edits })
   }, [state.previewEdits, dispatch, expandedMaterials])
   ```

4. **Modify `apps/app/src/onboarding/steps/Step3Preview.tsx`, `displayRoadmap` memo (lines 63–97).** Clear `role` when an edit sets `candidateMaterialIds` to empty. Implements D-05.

   After line 72 (`slot.candidateMaterialIds = edit.materialId ? [edit.materialId] : []`), add a role-clearing line. The block at lines 70–80 becomes:
   ```tsx
   if (edit) {
     if (edit.materialId !== undefined) {
       slot.candidateMaterialIds = edit.materialId ? [edit.materialId] : []
       if (!edit.materialId) slot.role = null
     }
     if (edit.sessionTitle !== null) {
       slot.sessionTitle = edit.sessionTitle
     }
     if (edit.plannedMinutes > 0) {
       slot.plannedMinutes = edit.plannedMinutes
     }
   }
   ```

#### Tests

5. **Modify `apps/app/src/onboarding/steps/Step3Preview.test.tsx`.** Add a test for resolved tie rendering.

   Add a `mockBoundaryRoadmap` factory after `mockTieRoadmap` (line ~121):
   ```tsx
   function mockBoundaryRoadmap() {
     return {
       weeks: [
         {
           weekIndex: 0,
           startDate: '2026-05-04',
           slots: [
             { weekIndex: 0, dayOfWeek: 'Mon' as const, date: '2026-05-04', candidateMaterialIds: ['mat-1'], role: 'foundation' as const, sessionTitle: 'DDIA · session 1 of 1', plannedMinutes: 60, capacityMinutes: 120 },
             { weekIndex: 0, dayOfWeek: 'Wed' as const, date: '2026-05-06', candidateMaterialIds: ['mat-1', '__rest__'], role: 'foundation' as const, sessionTitle: null, plannedMinutes: 0, capacityMinutes: 120 },
           ],
         },
       ],
       capacityCheck: {
         status: 'fits' as const,
         totalMaterialMinutes: 60,
         totalCapacityMinutes: 240,
         suggestedWeeks: undefined,
       },
       warnings: [{ kind: 'unresolved-tie-count' as const, detail: { count: 1 } }],
     }
   }
   ```

   Add test:
   ```tsx
   it('resolving a boundary tie sets session title and planned minutes', async () => {
     await seedOnboardingState(testDb, {
       materials: [
         { id: 'mat-1', title: 'DDIA', estimatedDuration: 60, role: 'foundation', additionOrder: 0, userOverrodeType: false },
       ],
     })
     const { generateRoadmap } = await import('@study-tracker/roadmap-engine')
     vi.mocked(generateRoadmap).mockReturnValue(mockBoundaryRoadmap())

     renderPreview()

     await waitFor(() => {
       expect(screen.getByText('Review DDIA')).toBeInTheDocument()
     })

     fireEvent.click(screen.getByText('Review DDIA'))

     await waitFor(() => {
       expect(screen.getByText('Review · DDIA')).toBeInTheDocument()
       expect(screen.getByText('2h 0m')).toBeInTheDocument()
     })
   })
   ```

- Run: `pnpm --filter app test -- --run apps/app/src/onboarding/steps/Step3Preview.test.tsx`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run apps/app/src/onboarding/steps/Step3Preview.test.tsx  # all green
pnpm --filter app test -- --run apps/app/src/onboarding/OnboardingProvider.test.tsx  # still passes
pnpm typecheck  # no type errors
pnpm lint       # no lint errors
```

#### Rollback

`git revert <commit-sha>`. No data migrations. Phase 1 and Phase 2 are independent — reverting either doesn't affect the other.

#### Notes (filled in during implementation)

<empty>

---

## Out of scope

- **Roadmap engine algorithm changes** — the engine's boundary-slot logic (Decision 16) is working correctly. The bugs are in the consumer (Step3Preview + OnboardingProvider), not the engine.
- **Practice distribution toward deadline** — the known limitation (engine guide section 8.2, item 3) where practice fills chronologically rather than ramping toward the deadline. Separate issue.

## References

- Roadmap engine core algorithm: `packages/roadmap-engine/src/roadmap-engine.ts`
- Engine design guide: `design/algo/ROADMAP_ENGINE_GUIDE.md`
- OnboardingProvider reducer: `apps/app/src/onboarding/OnboardingProvider.tsx`
- Step3Preview: `apps/app/src/onboarding/steps/Step3Preview.tsx`
- SchedulePreview: `apps/app/src/onboarding/components/SchedulePreview.tsx`
- Onboarding architecture rule: `.claude/rules/onboarding-architecture.md`
