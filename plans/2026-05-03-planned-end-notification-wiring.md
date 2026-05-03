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

# Wire planned-end notification into the active session page

**Slug:** `008-planned-end-notification-wiring`
**Date written:** 2026-05-03
**Author:** Claude + Rohit Saji
**Plan status:** Draft
**Upstream:** `issues/008-planned-end-ping-notification-strategy.md` · `prd/PRD-study-tracker-web.md` (user stories 22, 23)

## TL;DR

The `TabNotificationStrategy` (favicon dot, tab title flash, auto-restore) and `SessionLifecycle` notifier integration are fully implemented and tested — but `Session.tsx` never instantiates a notifier, so the entire notification machinery is inert. This plan adds a `createBrowserDeps()` factory to `NotificationStrategy.ts`, wires a `TabNotificationStrategy` instance into `Session.tsx`, and renders the existing `PlannedEndBanner` component inside both layout components when planned end is reached. This is ~80 lines across 4 files — a single-phase change.

## Context & background

Issue #008 specifies that when an active session reaches its planned end time, the user should know — even if the tab is in the background. The system should flash the tab title, overlay a dot on the favicon, and show an in-app banner when the tab is visible.

**What already exists (no changes needed):**

- `TabNotificationStrategy` class (`apps/app/src/session/NotificationStrategy.ts`) — fully implements favicon dot, tab title flash (1.5s interval), auto-restore after 60s, visibility change handling. 14 unit tests passing.
- `SessionLifecycle` notifier integration (`apps/app/src/session/SessionLifecycle.ts`) — accepts `PlannedEndNotifier` via constructor DI, schedules on start (line 194-196), cancels on pause (line 227), reschedules on resume (line 259-268), handles visibility via DurabilityHooks (line 67-74), exposes `isPlannedEndReached()` and `dismissPlannedEnd()`. 8 unit tests passing.
- `PlannedEndBanner` component (`apps/app/src/session/components/PlannedEndBanner.tsx`) — renders attention banner with optional action button. Used on Home page.
- `DurabilityHooks` (`apps/app/src/lib/DurabilityHooks.ts`) — shared `visibilitychange`/`pagehide` event handler, already subscribed by SessionLifecycle.
- `favicon.svg` and `favicon-dot.svg` in `apps/app/public/`.
- E2E test (`e2e/session-planned-end.spec.ts`) — covers full flow: start → background tab → wait past planned end → return → see banner → dismiss → favicon restored.

**The gap:** `Session.tsx` line 55-60 creates `SessionLifecycle` without passing a `notifier` (only `audioContext: null`). The layout components don't render `PlannedEndBanner`. The E2E test is presumably failing because this wiring doesn't exist yet.

**Support docs:**

- Issue: `issues/008-planned-end-ping-notification-strategy.md`
- PRD: `prd/PRD-study-tracker-web.md` (user stories 22, 23)
- Existing plan for session per-kind rendering: `plans/2026-05-03-youtube-embed-article-fallback.md`

## Decisions log

### D-01: Create TabNotificationStrategy in Session.tsx, not in a provider

**Status:** ✅ Agreed

**Context:** The notifier needs a home — either a React context provider (like SyncProvider) or inline in the component that owns the session.

**Decision:** Create the `TabNotificationStrategy` inside `Session.tsx`'s initialization `useEffect`, alongside the `SessionLifecycle` instance.

**Rationale:** The notifier's lifecycle is tied to the session page. It should start when the session mounts and clean up when it unmounts. `SessionLifecycle.destroy()` already calls `notifier.destroy()`, so cleanup is handled. Creating it in a provider would mean it exists when there's no active session — wasted complexity.

**Alternatives considered:**

- Provider/AppShell level → rejected: notifier only makes sense when a session is active, and the provider would need lifecycle coordination with SessionLifecycle anyway
- Separate useEffect → rejected: would need to coordinate with the SessionLifecycle useEffect for initialization order

**User pushback / disagreement:** None.

**Reversibility:** Easy — move the instantiation to a different location without changing the strategy class or SessionLifecycle integration.

### D-02: Extract createBrowserDeps() factory in NotificationStrategy.ts

**Status:** ✅ Agreed

**Context:** `TabNotificationStrategy` requires a `TabNotificationStrategyDeps` object with ~8 DOM accessor functions. This boilerplate needs to live somewhere.

**Decision:** Export a `createBrowserDeps()` factory function from `NotificationStrategy.ts`, co-located with the class that consumes it.

**Rationale:** Keeps `Session.tsx` to a one-liner (`new TabNotificationStrategy(createBrowserDeps())`). The deps are implementation details of the strategy, not of the session page. Co-location makes the deps easy to find and modify.

**Alternatives considered:**

- Inline in Session.tsx → rejected: 8+ lines of DOM boilerplate in an already 350-line component

**User pushback / disagreement:** None.

**Reversibility:** Easy — it's a pure factory function with no state.

### D-03: Dismiss banner clears favicon dot

**Status:** ✅ Agreed

**Context:** When the user dismisses the `PlannedEndBanner` on the session page, should the favicon dot also clear?

**Decision:** Yes — dismissing the banner calls `SessionLifecycle.dismissPlannedEnd()`, which internally calls `notifier.dismiss()`, which restores the original favicon.

**Rationale:** Matches the acceptance criteria: "favicon dot persists until the session ends or the user explicitly dismisses." The E2E test at `e2e/session-planned-end.spec.ts:114-123` explicitly asserts this behavior. The Home page's banner dismiss only hides the banner locally (it doesn't own a notifier), but the session page should use the lifecycle's method since it owns the notifier.

**Alternatives considered:**

- Favicon dot persists after banner dismiss → rejected: contradicts acceptance criteria and the E2E test

**User pushback / disagreement:** None.

**Reversibility:** Easy — change the dismiss handler.

### D-04: Include "End session" action button in the banner

**Status:** ✅ Agreed

**Context:** `PlannedEndBanner` supports an optional `actionLabel` + `onAction` prop for a CTA button alongside the dismiss X.

**Decision:** Show an "End session" button in the banner on the session page.

**Rationale:** The banner says "wrap up when you're ready, or keep going." An "End session" button gives the user a one-tap path to wrap up. Dismiss means "keep going." This matches user story #22: "a gentle signal when planned end is reached, so that I can choose to wrap up or continue with intention."

**Alternatives considered:**

- Informational banner only (no action button) → rejected: misses the opportunity for a direct "wrap up" affordance

**User pushback / disagreement:** None.

**Reversibility:** Easy — remove the `actionLabel` and `onAction` props.

### D-05: Propagate plannedEndReached via tick interval polling

**Status:** ✅ Agreed

**Context:** The React layer needs to know when `plannedEndReached` flips to true to show the banner. The `SessionLifecycle.subscribe()` listener only receives `SessionState` changes, not the planned-end flag.

**Decision:** Add a `plannedEndReached` React state variable, updated inside the existing 1-second tick interval by reading `lc.isPlannedEndReached()`.

**Rationale:** The tick loop at `Session.tsx:107-115` already runs every second and reads multiple lifecycle getters. Adding one more `setState` call is minimal. React bails out of re-renders when the boolean hasn't changed. No new subscription mechanism or abstraction needed.

**Alternatives considered:**

- Add a separate subscription/callback for the planned-end flag → rejected: over-engineering for a boolean that the tick already touches
- Listen inside DurabilityHooks visibility handler → rejected: the tick catches it within 1 second of tab regain anyway

**User pushback / disagreement:** None.

**Reversibility:** Easy.

### D-06: Flat props for layout components (not bundled object)

**Status:** ✅ Agreed

**Context:** The layout components need 4 new props for the planned-end banner: `plannedEndReached`, `plannedEndDismissed`, `onDismissPlannedEnd`, `onEndFromBanner`.

**Decision:** Pass as 4 individual flat props, consistent with the existing prop pattern.

**Rationale:** Both layouts already use 10-15 flat props (`isPaused`, `isOverrun`, `onEnd`, etc.). A nested object would break the pattern. The layout tests use flat prop spreading.

**Alternatives considered:**

- Bundled object prop `plannedEnd: { ... }` → rejected: inconsistent with existing prop convention

**User pushback / disagreement:** None.

**Reversibility:** Easy.

## Architecture overview

The change is a thin wiring layer connecting three existing pieces:

```
Session.tsx (page)
  │
  ├── creates TabNotificationStrategy(createBrowserDeps())  ← NEW
  │     │
  │     └── deps: document.title, favicon <link>, document.hidden, timers
  │
  ├── passes notifier to SessionLifecycle constructor        ← NEW (was undefined)
  │     │
  │     └── SessionLifecycle schedules/cancels/dismisses via PlannedEndNotifier interface
  │
  ├── reads lc.isPlannedEndReached() in tick interval        ← NEW
  │
  └── passes plannedEndReached + handlers to layouts         ← NEW
        │
        ├── SessionDefaultLayout renders PlannedEndBanner    ← NEW
        └── SessionYouTubeLayout renders PlannedEndBanner    ← NEW
```

No new modules, no new interfaces, no new test infrastructure. Just connecting existing pieces.

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `apps/app/src/session/NotificationStrategy.ts` | modify | 1 | Add `createBrowserDeps()` factory function |
| `apps/app/src/pages/Session.tsx` | modify | 1 | Wire notifier, add planned-end state, pass to layouts |
| `apps/app/src/session/components/SessionDefaultLayout.tsx` | modify | 1 | Add planned-end banner props + render |
| `apps/app/src/session/components/SessionYouTubeLayout.tsx` | modify | 1 | Add planned-end banner props + render |
| `apps/app/src/session/components/SessionDefaultLayout.test.tsx` | modify | 1 | Add planned-end banner rendering test |
| `apps/app/src/session/components/SessionYouTubeLayout.test.tsx` | modify | 1 | Add planned-end banner rendering test |

## Phases

### Phase 1: Wire planned-end notification into session page and layouts

**Status:** ✅ Complete
**Depends on:** none — can start immediately
**Estimated scope:** ~6 files, ~80 lines

#### Codebase state assumed at start

- `TabNotificationStrategy` class exists in `apps/app/src/session/NotificationStrategy.ts` with constructor accepting `TabNotificationStrategyDeps`
- `TabNotificationStrategyDeps` interface is exported from the same file (line 8-18)
- `SessionLifecycle` constructor accepts optional `notifier?: PlannedEndNotifier | null` in its deps (line 34)
- `SessionLifecycle` exposes `isPlannedEndReached(): boolean` (line 408) and `dismissPlannedEnd(): void` (line 412)
- `PlannedEndBanner` component exported from `apps/app/src/session/components/index.ts` (line 17)
- `PlannedEndBanner` accepts props: `onDismiss`, optional `actionLabel`, optional `onAction`
- `favicon.svg` and `favicon-dot.svg` exist in `apps/app/public/`
- `<link rel="icon">` exists in `apps/app/index.html` (line 5)
- E2E test exists at `e2e/session-planned-end.spec.ts`
- NotificationStrategy unit tests passing (14 tests in `apps/app/src/session/NotificationStrategy.test.ts`)
- SessionLifecycle notifier unit tests passing (8 tests in `apps/app/src/session/SessionLifecycle.test.ts`)

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep -n 'export class TabNotificationStrategy' apps/app/src/session/NotificationStrategy.ts
# expected: line 20, class definition

grep -n 'notifier.*PlannedEndNotifier' apps/app/src/session/SessionLifecycle.ts
# expected: line 34, optional notifier in deps interface

grep -n 'isPlannedEndReached' apps/app/src/session/SessionLifecycle.ts
# expected: line 408, public method

grep -n 'PlannedEndBanner' apps/app/src/session/components/index.ts
# expected: line 17, re-export

ls apps/app/public/favicon-dot.svg
# expected: file exists
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Add `createBrowserDeps()` factory to `apps/app/src/session/NotificationStrategy.ts` (append after the class, before EOF).** Implements D-02.

   ```typescript
   export function createBrowserDeps(): TabNotificationStrategyDeps {
     const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
     const originalHref = link?.getAttribute('href') ?? '/favicon.svg';

     return {
       getTitle: () => document.title,
       setTitle: (title: string) => { document.title = title; },
       setFaviconHref: (href: string) => { if (link) link.setAttribute('href', href); },
       getOriginalFaviconHref: () => originalHref,
       isDocumentHidden: () => document.hidden,
       setTimeout: (cb: () => void, ms: number) => window.setTimeout(cb, ms),
       clearTimeout: (id: number) => window.clearTimeout(id),
       setInterval: (cb: () => void, ms: number) => window.setInterval(cb, ms),
       clearInterval: (id: number) => window.clearInterval(id),
     };
   }
   ```

2. **Modify `apps/app/src/pages/Session.tsx` — add import for `TabNotificationStrategy` and `createBrowserDeps` (top of file, after existing imports).** Implements D-01.

   Add this import after the existing session imports (after line 17):

   ```typescript
   import { TabNotificationStrategy, createBrowserDeps } from '../session/NotificationStrategy';
   ```

3. **Modify `apps/app/src/pages/Session.tsx` — add `PlannedEndBanner` import (line 11-17, inside the destructured import from `'../session/components'`).**

   Add `PlannedEndBanner` to the existing destructured import:

   ```typescript
   import {
     WalkAwayDialog,
     RecoveryDialog,
     SessionDefaultLayout,
     SessionYouTubeLayout,
     EscapeConfirmModal,
     PlannedEndBanner,
   } from '../session/components';
   ```

   Note: `PlannedEndBanner` is imported here but rendered inside the layout components (steps 6-7), not directly in `Session.tsx`. Remove this import if you wire the banner only through layout props — but see step 5 for context on why `Session.tsx` needs to know about planned-end state regardless.

   **Actually — on reflection, `Session.tsx` does NOT need to import `PlannedEndBanner` itself. The banner is rendered by the layout components. Remove this import.** The layout components already import it from their own index. `Session.tsx` only needs to pass the state and handlers as props.

4. **Modify `apps/app/src/pages/Session.tsx` — wire the notifier into SessionLifecycle creation (inside the initialization `useEffect`, currently lines 51-60).** Implements D-01.

   Replace the `SessionLifecycle` construction block:

   ```typescript
   // Current code (lines 55-60):
   const lc = new SessionLifecycle({
     eventStore,
     durabilityHooks: durability,
     pomodoroConfig: DEFAULT_POMODORO_CONFIG,
     audioContext: null,
   });
   ```

   With:

   ```typescript
   const notifier = new TabNotificationStrategy(createBrowserDeps());

   const lc = new SessionLifecycle({
     eventStore,
     durabilityHooks: durability,
     pomodoroConfig: DEFAULT_POMODORO_CONFIG,
     audioContext: null,
     notifier,
   });
   ```

5. **Modify `apps/app/src/pages/Session.tsx` — add planned-end React state and propagate via tick interval.** Implements D-05.

   Add state declaration after the existing state declarations (after line 48):

   ```typescript
   const [plannedEndReached, setPlannedEndReached] = useState(false);
   const [plannedEndDismissed, setPlannedEndDismissed] = useState(false);
   ```

   Inside the tick interval effect (line 107-118), add one line after `setPomodoroPhase(...)`:

   ```typescript
   // Inside the setInterval callback, after line 114:
   setPlannedEndReached(lc.isPlannedEndReached());
   ```

   Add a dismiss handler after the existing handlers (e.g., after `handleEscapeCancel` around line 238):

   ```typescript
   const handleDismissPlannedEnd = useCallback(() => {
     const lc = lcRef.current;
     if (!lc) return;
     lc.dismissPlannedEnd();
     setPlannedEndDismissed(true);
     setPlannedEndReached(false);
   }, []);
   ```

6. **Modify `apps/app/src/pages/Session.tsx` — pass planned-end props to `SessionDefaultLayout` (around line 304-318).** Implements D-04 and D-06.

   Add four props to the `SessionDefaultLayout` JSX:

   ```tsx
   <SessionDefaultLayout
     record={record}
     sessionState={sessionState}
     elapsedActiveMs={elapsedActiveMs}
     pomodoroPhase={pomodoroPhase}
     isPaused={isPaused}
     isOverrun={isOverrun}
     isBreak={isBreak}
     overrunMinutes={overrunMinutes}
     onPauseResume={handlePauseResume}
     onEnd={handleEnd}
     onComeBackLater={handleComeBackLater}
     articleAutoOpened={articleAutoOpened}
     plannedEndReached={plannedEndReached}
     plannedEndDismissed={plannedEndDismissed}
     onDismissPlannedEnd={handleDismissPlannedEnd}
     onEndFromBanner={handleEnd}
   />
   ```

7. **Modify `apps/app/src/pages/Session.tsx` — pass planned-end props to `SessionYouTubeLayout` (around line 281-302).** Implements D-04 and D-06.

   Add four props to the `SessionYouTubeLayout` JSX:

   ```tsx
   <SessionYouTubeLayout
     record={record}
     sessionState={sessionState}
     elapsedActiveMs={elapsedActiveMs}
     pomodoroPhase={pomodoroPhase}
     isPaused={isPaused}
     isOverrun={isOverrun}
     isBreak={isBreak}
     overrunMinutes={overrunMinutes}
     isDesktop={isDesktop}
     onPauseResume={handlePauseResume}
     onEnd={handleEnd}
     onComeBackLater={handleComeBackLater}
     playerAdapterRef={playerAdapterRef}
     playerState={playerState}
     videoDurationFormatted={formatDuration(videoDuration)}
     resumeBannerVisible={resumeBannerVisible}
     onDismissResumeBanner={() => setResumeBannerVisible(false)}
     videoEndedPromptVisible={videoEndedPromptVisible}
     onPlayerStateChange={handlePlayerStateChange}
     onPlayerReady={handlePlayerReady}
     plannedEndReached={plannedEndReached}
     plannedEndDismissed={plannedEndDismissed}
     onDismissPlannedEnd={handleDismissPlannedEnd}
     onEndFromBanner={handleEnd}
   />
   ```

8. **Modify `apps/app/src/session/components/SessionDefaultLayout.tsx` — add planned-end props to interface and render the banner.** Implements D-06.

   Add to the `SessionDefaultLayoutProps` interface (after `articleAutoOpened?: boolean;` on line 33):

   ```typescript
   plannedEndReached?: boolean;
   plannedEndDismissed?: boolean;
   onDismissPlannedEnd?: () => void;
   onEndFromBanner?: () => void;
   ```

   Add to the destructured props in the function signature:

   ```typescript
   plannedEndReached,
   plannedEndDismissed,
   onDismissPlannedEnd,
   onEndFromBanner,
   ```

   Add the `PlannedEndBanner` import at the top (add to the existing import from `'./index'`):

   ```typescript
   import {
     PulseDot,
     SessionEyebrow,
     getEyebrowColorClass,
     SessionTitle,
     SessionSubtitle,
     TimerDisplay,
     PomodoroIndicator,
     PlannedEndLine,
     OpenMaterialButton,
     MaterialStrip,
     EndSessionButton,
     ComeBackLaterButton,
     PauseResumeButton,
     SessionFrame,
     PlannedEndBanner,
   } from './index';
   ```

   Render the banner inside the component's return, right after the `<div className="session-top-bar">` block and before the article banner (before line 81):

   ```tsx
   {plannedEndReached && !plannedEndDismissed && onDismissPlannedEnd && (
     <PlannedEndBanner
       onDismiss={onDismissPlannedEnd}
       actionLabel="End session"
       onAction={onEndFromBanner}
     />
   )}
   ```

9. **Modify `apps/app/src/session/components/SessionYouTubeLayout.tsx` — add planned-end props to interface and render the banner.** Implements D-06.

   Add to the `SessionYouTubeLayoutProps` interface (after `onPlayerReady: () => void;` on line 37):

   ```typescript
   plannedEndReached?: boolean;
   plannedEndDismissed?: boolean;
   onDismissPlannedEnd?: () => void;
   onEndFromBanner?: () => void;
   ```

   Add to the destructured props in the function signature:

   ```typescript
   plannedEndReached,
   plannedEndDismissed,
   onDismissPlannedEnd,
   onEndFromBanner,
   ```

   Add `PlannedEndBanner` to the existing import from `'./index'`:

   ```typescript
   import {
     PulseDot,
     SessionEyebrow,
     getEyebrowColorClass,
     PomodoroIndicator,
     PlannedEndLine,
     ComeBackLaterButton,
     PauseResumeButton,
     PlannedEndBanner,
   } from './index';
   ```

   Render the banner inside the component's return, right after the `<div className="session-top-bar">` block and before the resume banner (before line 78):

   ```tsx
   {plannedEndReached && !plannedEndDismissed && onDismissPlannedEnd && (
     <PlannedEndBanner
       onDismiss={onDismissPlannedEnd}
       actionLabel="End session"
       onAction={onEndFromBanner}
     />
   )}
   ```

#### Tests

- **Add test to `apps/app/src/session/components/SessionDefaultLayout.test.tsx`** — verify `PlannedEndBanner` renders when `plannedEndReached=true` and `plannedEndDismissed=false`, and does not render when dismissed or not reached.

- **Add test to `apps/app/src/session/components/SessionYouTubeLayout.test.tsx`** — same planned-end banner rendering test.

- Existing tests in `NotificationStrategy.test.ts` (14 tests) and `SessionLifecycle.test.ts` (8 notifier tests) should continue passing with no changes — they test the strategy and lifecycle independently of the React wiring.

- Run:
  ```bash
  pnpm --filter app test -- --run
  ```

  Expected: all previously passing tests still pass, plus the new layout tests. The 4 pre-existing failures (SyncEngine, PlaylistPickerPopup) are unrelated and should remain unchanged.

#### Verification (DONE — run after implementation)

```bash
# Unit tests pass (excluding pre-existing failures)
pnpm --filter app test -- --run 2>&1 | grep -E '(PASS|FAIL).*session'
# expected: all session-related test files PASS

# NotificationStrategy exports createBrowserDeps
grep -n 'export function createBrowserDeps' apps/app/src/session/NotificationStrategy.ts
# expected: function definition found

# Session.tsx creates and passes notifier
grep -n 'TabNotificationStrategy\|createBrowserDeps\|notifier' apps/app/src/pages/Session.tsx
# expected: import line, instantiation, and notifier prop in deps

# Layouts render PlannedEndBanner
grep -n 'PlannedEndBanner' apps/app/src/session/components/SessionDefaultLayout.tsx
# expected: import + JSX usage

grep -n 'PlannedEndBanner' apps/app/src/session/components/SessionYouTubeLayout.tsx
# expected: import + JSX usage

# Typecheck passes
pnpm typecheck 2>&1 | tail -5
# expected: no errors in session-related files
```

#### Rollback

`git revert <commit-sha>`. No data migrations, no schema changes, no external side-effects. The change is purely additive wiring — reverting returns to the state where the notifier is not passed and the banner is not rendered.

#### Notes (filled in during implementation)

*(empty)*

---

## Out of scope

- **Web Push notifications (v1.1)** — the `PlannedEndNotifier` interface is designed for this upgrade, but v1 uses only the tab notification strategy. No server-side push infrastructure in this plan.
- **Sound/audio notification at planned end** — `AudioContext` is already passed to `SessionLifecycle` (currently `null`), and `createChime` exists for Pomodoro transitions. Adding a planned-end chime is a separate concern.
- **PlannedEndBanner on the Home page connecting to the notifier** — Home's banner is independent (reads Dexie state directly, dismisses locally). This is correct: Home doesn't own a notifier, and the favicon dot is a session-page concern.

## References

- Issue #008: `issues/008-planned-end-ping-notification-strategy.md`
- PRD: `prd/PRD-study-tracker-web.md` — user stories 22, 23
- `TabNotificationStrategy`: `apps/app/src/session/NotificationStrategy.ts`
- `SessionLifecycle`: `apps/app/src/session/SessionLifecycle.ts`
- `PlannedEndBanner`: `apps/app/src/session/components/PlannedEndBanner.tsx`
- `DurabilityHooks`: `apps/app/src/lib/DurabilityHooks.ts`
- NotificationStrategy tests: `apps/app/src/session/NotificationStrategy.test.ts` (14 tests)
- SessionLifecycle notifier tests: `apps/app/src/session/SessionLifecycle.test.ts` (8 tests in `planned-end notifier` describe block)
- E2E test: `e2e/session-planned-end.spec.ts`
- Prior plan (session per-kind rendering): `plans/2026-05-03-youtube-embed-article-fallback.md`
