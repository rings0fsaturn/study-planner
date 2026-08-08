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

# Fix lint configuration and test failures

**Slug:** `fix-lint-and-test-failures`
**Date written:** 2026-05-03
**Author:** Claude + Rohit Saji
**Plan status:** Draft
**Upstream:** none

## TL;DR

Four issues prevent `pnpm lint` and `pnpm --filter app test` from passing cleanly. (1) The `apps/app/` package has no ESLint config, so `eslint .` scans `dist/` and crashes. (2) `Home.test.tsx` mocks `useLiveQuery` as a single-return function, but Home.tsx makes two distinct `useLiveQuery` calls — the second one (for `activeSession`) receives an events array instead of `undefined`, then crashes iterating `.pauseIntervals`. (3) `PlaylistPickerPopup` renders all videos in a flat list, but the test expects 10-per-page pagination with Next/Back controls. (4) `OnboardingFlow.test.tsx` has three failures: a `getByText` that can't match text split by an `<em>` tag, a commit test that clicks "Looks good" before the roadmap has rendered, and a tie-resolution test that exposes a production bug where resolving a tie doesn't set the slot's `role` or `sessionTitle`.

## Context & background

Running the full CI surface (`pnpm lint && pnpm --filter app test && pnpm --filter progress-engine test && pnpm typecheck`) reveals 1 lint failure and 6 test failures across 3 test files. Typechecks and progress-engine tests pass cleanly.

The lint failure is a configuration gap — `apps/app/` never had an ESLint config created, so the existing `"lint": "eslint ."` script has presumably never worked. The test failures are a mix of incomplete mocks, missing component features, and one production bug in the onboarding preview's tie-resolution logic.

**Support docs:**

- `packages/progress-engine/eslint.config.js` — reference ESLint flat config pattern
- `.agents/rules/32-dexie-testing.agents.md` — Dexie test patterns
- `.agents/rules/40-onboarding-flow.agents.md` — onboarding flow architecture
- `apps/app/src/session/types.ts` — `ActiveSessionRecord` type definition

## Decisions log

### D-01: ESLint flat config for apps/app

**Status:** 🤔 Assumed (unconfirmed)

**Context:** `apps/app/` has no ESLint config. The `progress-engine` package uses ESLint 8 flat config format. Need to pick a config approach.

**Decision:** Create `apps/app/eslint.config.js` using flat config format matching `progress-engine`, extended with React/JSX support. Ignore `dist/` via the config's `ignores` field.

**Rationale:** Flat config is the ESLint 8+ standard and matches the existing pattern in the monorepo. Using `ignores` in the config is more reliable than `.eslintignore`.

**Alternatives considered:**

- `.eslintignore` + legacy `.eslintrc` → rejected: inconsistent with `progress-engine` pattern
- Change lint script to `eslint src/` → rejected: would miss config files in root

**User pushback / disagreement:** none

**Reversibility:** easy — delete the file

### D-02: Differentiate useLiveQuery calls by deps argument

**Status:** 🤔 Assumed (unconfirmed)

**Context:** `Home.tsx` calls `useLiveQuery` twice. The first call (events) passes no deps array. The second call (activeSession) passes `[]`. The test mock needs to return different values for each.

**Decision:** Replace the static `useLiveQuery: () => mockEvents` mock with a function that checks whether a `deps` argument was passed. If `deps` is an array (the activeSession query), return `mockActiveSession` (default `undefined`). Otherwise return `mockEvents`.

**Rationale:** This leverages the actual API difference between the two call sites without fragile call-counting. The convention is stable — `useLiveQuery(querier)` vs `useLiveQuery(querier, deps)`.

**Alternatives considered:**

- `mockReturnValueOnce` chaining → rejected: fragile with React re-renders, breaks if render count changes
- Execute the querier callback → rejected: the mock `getAll()` returns a Promise, not synchronous data
- Track call index → rejected: fragile, depends on render order

**User pushback / disagreement:** none

**Reversibility:** easy — test-only change

### D-03: Add pagination to PlaylistPickerPopup component

**Status:** 🤔 Assumed (unconfirmed)

**Context:** The test expects 10-per-page pagination with Next/Back buttons and a "1 of 2" page indicator. The component currently renders all videos in a single list.

**Decision:** Add `page` state (0-indexed), `PAGE_SIZE = 10` constant, slice `filteredVideos` for the current page, and add pagination controls (Back/Next buttons + "X of Y" indicator) at the bottom of the list area. Reset page to 0 when the search query changes.

**Rationale:** Matches the test expectations. Pagination is practical UX for playlists with many videos.

**Alternatives considered:**

- Virtual scrolling → rejected: more complex, overkill for this use case
- Modify test to not expect pagination → rejected: pagination is a reasonable feature for 10+ video playlists

**User pushback / disagreement:** none

**Reversibility:** easy — revert the component file

### D-04: Fix OnboardingFlow test 1 — use toHaveTextContent for em-split text

**Status:** 🤔 Assumed (unconfirmed)

**Context:** `screen.getByText(/Here's a plan/)` fails because the DOM renders `Here's a <em>plan</em>.` and `getByText` can't match text split across elements.

**Decision:** Replace `screen.getByText(/Here's a plan/)` with `screen.getByRole('heading', { level: 1 })` + `expect(heading).toHaveTextContent(/Here's a plan/)`. The `toHaveTextContent` matcher concatenates all child text nodes.

**Rationale:** `toHaveTextContent` is the standard Testing Library approach for matching text that spans multiple DOM elements. The heading role selector is more semantically correct anyway.

**Alternatives considered:**

- Remove the `<em>` from Step3Preview → rejected: changes production UI for test convenience
- Use `screen.getByText` with a function matcher → rejected: more verbose, `toHaveTextContent` is simpler

**User pushback / disagreement:** none

**Reversibility:** easy — test-only change

### D-05: Fix OnboardingFlow test 2 — wait for schedule content before clicking commit

**Status:** 🤔 Assumed (unconfirmed)

**Context:** Test 2 ("commit fires MaterialAdded × N...") finds the "Looks good" button immediately (it's always in the DOM) and clicks it before `OnboardingProvider` has restored state from IndexedDB. At that point `displayRoadmap` is null, so `handleCommit` returns early and `logEvent` is never called.

**Decision:** Add a `waitFor` that checks for schedule content (a material title from the mock roadmap) before clicking the commit button. This proves `displayRoadmap` is populated and `handleCommit` will proceed.

**Rationale:** The button exists in the DOM before the roadmap data loads. Waiting for roadmap-derived content ensures the component is in a state where the commit will succeed.

**Alternatives considered:**

- Use fake timers → rejected: adds complexity and doesn't address the real issue (async IndexedDB restore)
- Check button disabled state → rejected: button is only disabled for over-capacity/ties, not for "roadmap not loaded yet"

**User pushback / disagreement:** none

**Reversibility:** easy — test-only change

### D-06: Fix tie resolution — set slot.role and slot.sessionTitle from resolved material (production bug)

**Status:** 🤔 Assumed (unconfirmed)

**Context:** When a user resolves a tie in the onboarding preview, `handleResolveTie` stores the chosen `materialId` as a preview edit. The `displayRoadmap` computation applies this edit by setting `slot.candidateMaterialIds = [materialId]`, but it never sets `slot.role` or `slot.sessionTitle`. The slot retains `role: null` and `sessionTitle: null` from the original tie roadmap, so no role badge or title appears after resolution.

**Decision:** After applying edits in the `displayRoadmap` useMemo, if a slot has exactly 1 candidate material and `slot.role` is null, look up the material from `expandedMaterials` and set `slot.role` and `slot.sessionTitle`. Add `expandedMaterials` to the useMemo dependency array.

**Rationale:** This is a production bug, not just a test issue. Users resolving ties in onboarding would see blank slots with no role badge or title. The fix infers the correct values from the resolved material's metadata.

**Alternatives considered:**

- Store role in the edit itself (modify `OnboardingSlotEdit` type) → rejected: requires changing the type and all call sites; inference is simpler and handles all cases
- Fix only the test to not check for role badge → rejected: hides a real UX bug

**User pushback / disagreement:** none

**Reversibility:** easy — revert the added lines in Step3Preview.tsx

## Architecture overview

These are four independent fixes with no cross-dependencies. Each phase can be implemented and verified in isolation. The changes span three areas:

1. **Build tooling** — ESLint config for `apps/app/`
2. **Test mocks** — `Home.test.tsx` useLiveQuery mock + `OnboardingFlow.test.tsx` assertions
3. **Component feature** — `PlaylistPickerPopup` pagination
4. **Production bug** — `Step3Preview` tie-resolution slot metadata

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `apps/app/eslint.config.js` | new | 1 | ESLint flat config with TS + React + dist ignore |
| `apps/app/package.json` | modify | 1 | Add missing ESLint plugin devDependencies |
| `apps/app/src/pages/Home.test.tsx` | modify | 2 | Fix useLiveQuery mock to differentiate two calls |
| `apps/app/src/onboarding/components/PlaylistPickerPopup.tsx` | modify | 3 | Add 10-per-page pagination |
| `apps/app/src/onboarding/steps/Step3Preview.tsx` | modify | 4 | Set slot.role and slot.sessionTitle after tie resolution |
| `apps/app/src/onboarding/OnboardingFlow.test.tsx` | modify | 4 | Fix text matcher and commit test timing |

## Phases

### Phase 1: Add ESLint configuration for apps/app

**Status:** ✅ Complete
**Depends on:** none — can start immediately
**Estimated scope:** ~2 files, ~40 lines

#### Codebase state assumed at start

- `apps/app/package.json` exists with `"lint": "eslint ."` script (line 9)
- No `eslint.config.*` or `.eslintrc*` file exists in `apps/app/`
- `apps/app/dist/` exists with build artifacts
- `packages/progress-engine/eslint.config.js` exists as reference pattern
- ESLint 8 is already in `apps/app/` devDependencies (`"eslint": "^8.57.0"`)

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
ls apps/app/eslint.config.* 2>/dev/null && echo "CONFIG EXISTS" || echo "NO CONFIG"   # should print NO CONFIG
grep '"eslint"' apps/app/package.json   # should show eslint in devDependencies
ls apps/app/dist/ | head -1   # should show dist exists
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Add missing ESLint plugin devDependencies to `apps/app/package.json`:**

   The `progress-engine` package has `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, and `globals` — `apps/app` is missing all three. Add them to `devDependencies`:

   ```json
   "@typescript-eslint/eslint-plugin": "^8.57.0",
   "@typescript-eslint/parser": "^8.57.0",
   "globals": "^17.5.0"
   ```

   Then run `pnpm install` to update the lockfile.

2. **Create new file `apps/app/eslint.config.js`:**

   ```js
   import globals from 'globals'
   import tseslint from '@typescript-eslint/eslint-plugin'
   import tsparser from '@typescript-eslint/parser'

   export default [
     {
       ignores: ['dist/**'],
     },
     {
       files: ['**/*.ts', '**/*.tsx'],
       languageOptions: {
         parser: tsparser,
         parserOptions: {
           ecmaVersion: 'latest',
           sourceType: 'module',
           ecmaFeatures: { jsx: true },
         },
         globals: {
           ...globals.browser,
           ...globals.es2021,
         },
       },
       plugins: {
         '@typescript-eslint': tseslint,
       },
       rules: {
         '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
         '@typescript-eslint/no-explicit-any': 'warn',
       },
     },
   ]
   ```

#### Tests

- No test changes needed for this phase.
- Run: `cd apps/app && pnpm lint`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app lint   # should exit 0 (or show only warnings, no crash)
```

#### Rollback

Delete `apps/app/eslint.config.js` and revert the `package.json` devDependencies changes. Run `pnpm install`.

#### Notes (filled in during implementation)

---

### Phase 2: Fix Home.test.tsx useLiveQuery mock

**Status:** ✅ Complete
**Depends on:** none — can start immediately
**Estimated scope:** ~1 file, ~15 lines

#### Codebase state assumed at start

- `apps/app/src/pages/Home.test.tsx` exists with `useLiveQuery` mock at lines 25–27
- `apps/app/src/pages/Home.tsx` has two `useLiveQuery` calls:
  - Line 59: `useLiveQuery(() => eventStore.getAll()) ?? []` — no deps argument
  - Line 61–64: `useLiveQuery(() => eventStore.table('activeSession').get(1), [])` — deps is `[]`
- `ActiveSessionRecord` type at `apps/app/src/session/types.ts:213` has `pauseIntervals: PauseInterval[]`

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep "useLiveQuery: () => mockEvents" apps/app/src/pages/Home.test.tsx   # should match the current mock
grep "pauseIntervals" apps/app/src/pages/Home.tsx   # should show the iteration at line 71
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Modify `apps/app/src/pages/Home.test.tsx`, `useLiveQuery` mock (currently lines 23–27):**

   Replace the current mock block:

   ```ts
   let mockEvents: Array<{ id?: number; kind: string; payload: Record<string, unknown>; createdAt: string }> = []

   vi.mock('dexie-react-hooks', () => ({
     useLiveQuery: () => mockEvents,
   }))
   ```

   With:

   ```ts
   let mockEvents: Array<{ id?: number; kind: string; payload: Record<string, unknown>; createdAt: string }> = []
   let mockActiveSession: unknown = undefined

   vi.mock('dexie-react-hooks', () => ({
     useLiveQuery: (querier: unknown, deps?: unknown[]) => {
       if (Array.isArray(deps)) return mockActiveSession
       return mockEvents
     },
   }))
   ```

2. **Modify `beforeEach` (currently line 30–32) to reset `mockActiveSession`:**

   Replace:

   ```ts
   beforeEach(() => {
     mockEvents = []
   })
   ```

   With:

   ```ts
   beforeEach(() => {
     mockEvents = []
     mockActiveSession = undefined
   })
   ```

#### Tests

- Run: `pnpm --filter app test -- --reporter=verbose src/pages/Home.test.tsx`
- Both Home tests should now pass:
  - "shows only total time when no roadmap events exist"
  - "shows projected finish and Up next card when RoadmapCreated event exists"

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- src/pages/Home.test.tsx   # 2 tests should pass
```

#### Rollback

Revert `apps/app/src/pages/Home.test.tsx` to its previous state.

#### Notes (filled in during implementation)

---

### Phase 3: Add pagination to PlaylistPickerPopup

**Status:** ✅ Complete
**Depends on:** none — can start immediately
**Estimated scope:** ~1 file, ~30 lines

#### Codebase state assumed at start

- `apps/app/src/onboarding/components/PlaylistPickerPopup.tsx` exists, rendering all `filteredVideos` in a flat list (lines 155–189)
- `apps/app/src/onboarding/components/PlaylistPickerPopup.test.tsx` exists with test "paginates at 10 per page" expecting:
  - Only first 10 videos visible on page 1
  - "1 of 2" page indicator text
  - "Next" button to advance, "Back" button to go back
  - Videos 11–15 visible on page 2, Video 1 not visible
  - "2 of 2" page indicator text

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep -c "page" apps/app/src/onboarding/components/PlaylistPickerPopup.tsx   # should be 0 or very low (no pagination state yet)
grep "paginates at 10 per page" apps/app/src/onboarding/components/PlaylistPickerPopup.test.tsx   # should exist
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Modify `apps/app/src/onboarding/components/PlaylistPickerPopup.tsx`, add pagination state and constant (after line 33, after `thumbErrors` state):**

   ```tsx
   const [page, setPage] = useState(0)

   const PAGE_SIZE = 10
   ```

2. **Reset page to 0 when search query changes.** Add a `useEffect` after the `filteredVideos` useMemo (after line 45):

   ```tsx
   useEffect(() => {
     setPage(0)
   }, [normalizedQuery])
   ```

   Add `useEffect` to the import on line 1:

   ```tsx
   import { useState, useMemo, useEffect } from 'react'
   ```

3. **Compute paginated videos.** Add after the `filteredVideoIds` useMemo (after line 50):

   ```tsx
   const totalPages = Math.ceil(filteredVideos.length / PAGE_SIZE)
   const paginatedVideos = filteredVideos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
   ```

4. **Replace `filteredVideos.map(v => {` with `paginatedVideos.map(v => {`** in the render (line 155). Only this one `.map()` call changes — the empty state check at line 144 still uses `filteredVideos.length === 0`.

5. **Add pagination controls after the video list, inside `.playlist-picker-list-wrap`** (after the closing `)}` of the list div around line 191, before the closing `</div>` of `.playlist-picker-list-wrap`):

   ```tsx
   {totalPages > 1 && (
     <div className="playlist-picker-pagination">
       <button
         className="btn btn-ghost btn-sm"
         disabled={page === 0}
         onClick={() => setPage(p => p - 1)}
       >
         Back
       </button>
       <span className="playlist-picker-page-indicator">
         {page + 1} of {totalPages}
       </span>
       <button
         className="btn btn-ghost btn-sm"
         disabled={page >= totalPages - 1}
         onClick={() => setPage(p => p + 1)}
       >
         Next
       </button>
     </div>
   )}
   ```

#### Tests

- Run: `pnpm --filter app test -- --reporter=verbose src/onboarding/components/PlaylistPickerPopup.test.tsx`
- All 8 tests should pass, including "paginates at 10 per page"

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- src/onboarding/components/PlaylistPickerPopup.test.tsx   # 8 tests should pass
```

#### Rollback

Revert `apps/app/src/onboarding/components/PlaylistPickerPopup.tsx` to its previous state.

#### Notes (filled in during implementation)

---

### Phase 4: Fix Step3Preview tie-resolution bug and OnboardingFlow test assertions

**Status:** ✅ Complete
**Depends on:** none — can start immediately
**Estimated scope:** ~2 files, ~25 lines

#### Codebase state assumed at start

- `apps/app/src/onboarding/steps/Step3Preview.tsx` exists with `displayRoadmap` useMemo at lines 63–90
- The `displayRoadmap` computation applies preview edits (lines 66–82) but never sets `slot.role` or `slot.sessionTitle` when a tie is resolved to a single material
- `expandedMaterials` is available in scope from `useOnboarding()` (line 26) but not in the `displayRoadmap` dependency array
- `apps/app/src/onboarding/OnboardingFlow.test.tsx` has 4 tests, 3 failing:
  - Test 1 (line 140): `screen.getByText(/Here's a plan/)` fails due to `<em>` tag splitting text
  - Test 2 (line 153): clicks "Looks good" before roadmap renders, `handleCommit` returns early
  - Test 4 (line 218): expects "Main reading" badge after tie resolution, but `slot.role` stays null

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep "slot.role" apps/app/src/onboarding/steps/Step3Preview.tsx   # should NOT find any assignment in displayRoadmap
grep "expandedMaterials" apps/app/src/onboarding/steps/Step3Preview.tsx   # should exist (line 26) but NOT in displayRoadmap deps
grep "Here's a plan" apps/app/src/onboarding/OnboardingFlow.test.tsx   # should find the getByText call
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Modify `apps/app/src/onboarding/steps/Step3Preview.tsx`, `displayRoadmap` useMemo (lines 63–90).** Implements D-06.

   After the edit-application loop (after line 81, after the closing `}` of the `if (edit)` block), add slot metadata inference before the closing `}` of the inner `for` loop:

   ```ts
           if (slot.candidateMaterialIds.length === 1 && !slot.role) {
             const mat = expandedMaterials.find(m => m.id === slot.candidateMaterialIds[0])
             if (mat) {
               slot.role = mat.role
               if (!slot.sessionTitle) slot.sessionTitle = mat.title
             }
           }
   ```

   Also update the dependency array on line 90 — change `[roadmap, previewEdits]` to `[roadmap, previewEdits, expandedMaterials]`.

2. **Modify `apps/app/src/onboarding/OnboardingFlow.test.tsx`, test 1 (line 140).** Implements D-04.

   Replace the `getByText` assertion inside the `waitFor` block:

   ```ts
   // Before:
   expect(screen.getByText(/Here's a plan/)).toBeInTheDocument()

   // After:
   const heading = screen.getByRole('heading', { level: 1 })
   expect(heading).toHaveTextContent(/Here's a plan/)
   ```

3. **Modify `apps/app/src/onboarding/OnboardingFlow.test.tsx`, test 2 (lines 153–181).** Implements D-05.

   Add a `waitFor` that checks for schedule content before clicking the commit button. Replace the existing `waitFor` block (lines 158–163):

   ```ts
   // Before:
   let commitButton: HTMLElement | undefined
   await waitFor(() => {
     const buttons = screen.getAllByRole('button')
     commitButton = buttons.find(b => b.textContent?.includes('Looks good'))
     expect(commitButton).toBeDefined()
   })

   // After:
   await waitFor(() => {
     expect(screen.getByText('Designing Data-Intensive Applications')).toBeInTheDocument()
   })
   let commitButton: HTMLElement | undefined
   const buttons = screen.getAllByRole('button')
   commitButton = buttons.find(b => b.textContent?.includes('Looks good'))
   expect(commitButton).toBeDefined()
   ```

#### Tests

- Run: `pnpm --filter app test -- --reporter=verbose src/onboarding/OnboardingFlow.test.tsx`
- All 4 tests should pass

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- src/onboarding/OnboardingFlow.test.tsx   # 4 tests should pass
pnpm --filter app test   # all tests should pass (full suite)
```

#### Rollback

Revert `apps/app/src/onboarding/steps/Step3Preview.tsx` and `apps/app/src/onboarding/OnboardingFlow.test.tsx` to their previous states.

#### Notes (filled in during implementation)

---

## Out of scope

- **ESLint rule tuning beyond basic TS rules** — the config mirrors `progress-engine`'s minimal ruleset. Adding `eslint-plugin-react-hooks` or `eslint-plugin-jsx-a11y` is desirable but separate work.
- **Fixing any lint warnings surfaced by the new ESLint config** — the goal is to make `pnpm lint` not crash, not to achieve zero warnings.
- **PlaylistPickerPopup CSS for pagination controls** — the pagination HTML uses existing `btn btn-ghost btn-sm` classes. Custom pagination styling can be added later if needed.
- **E2E tests** — per AGENTS.md, E2E tests cannot be run due to environment issues, so only unit/integration tests are verified.

## References

- `packages/progress-engine/eslint.config.js` — reference ESLint flat config pattern
- `packages/progress-engine/package.json` — reference for ESLint devDependencies versions
- `.agents/rules/32-dexie-testing.agents.md` — Dexie test patterns
- `.agents/rules/40-onboarding-flow.agents.md` — onboarding flow architecture
- `apps/app/src/session/types.ts:213` — `ActiveSessionRecord` type with `pauseIntervals`
- `packages/progress-engine/src/constants.ts` — `ROLE_TO_LABEL` mapping (`anchor → 'Main reading'`)
