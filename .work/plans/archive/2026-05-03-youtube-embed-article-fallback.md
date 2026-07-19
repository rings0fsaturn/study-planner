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

# Per-kind session rendering with YouTube embed and article new-tab fallback

**Slug:** `007-youtube-embed-article-fallback`
**Date written:** 2026-05-03
**Author:** Claude + Rohit Saji
**Plan status:** Draft
**Upstream:** `../../specs/issues/007-active-session-with-youtube-embed.md` · `../../specs/prd/PRD-study-tracker-web.md`

## TL;DR

The active session screen (`/study/session`) currently renders identically for all material types. This plan adds per-kind rendering: YouTube materials get an inline IFrame Player embed with a slim timer panel above it; article materials auto-open in a new tab with a "come back" banner on the session tab; manual materials keep the existing design. The YouTube integration uses the full JS IFrame Player API via a DI-friendly adapter, enabling session pause to pause the video (unidirectional coupling — video pause does NOT affect our timer). Playback position is persisted for seamless resume. Two new layout components (`SessionYouTubeLayout`, `SessionDefaultLayout`) replace the monolithic render in `Session.tsx`.

## Context & background

The session screen was built in issue #5 as a single layout that shows a centered card with timer, "Open material" button, and material info strip. All materials render identically — the MaterialStrip always shows "MANUAL · LINKED" or "MANUAL · NO EMBED" regardless of actual material kind.

The `MaterialAddedPayload` already stores `kind: 'youtube' | 'article' | 'manual'` and `youtubeVideoId?: string` from onboarding. But `SessionSlotData` (passed via `location.state` from Home) and `ActiveSessionRecord` (persisted to Dexie) don't carry these fields — so the session screen has no way to branch on material type.

This is the core feature for user stories 17, 18, 22, 23 in the PRD: YouTube embeds inside sessions, articles opening in new tabs, and the planned-end signal reaching users across tabs.

**Support docs:**

- Issue: `../../specs/issues/007-active-session-with-youtube-embed.md`
- PRD: `../../specs/prd/PRD-study-tracker-web.md` (user stories 17–20, 22–23)
- Design reference (desktop YouTube): `../../specs/issues/images/expectedDesign/image.png`
- Design reference (mobile YouTube): `../../specs/issues/images/expectedDesign/image copy.png`
- Design reference (current default): `issues/images/image.png`
- Session CSS: `apps/app/src/session/session.css`

## Decisions log

### D-01: Extend TypeScript types without Dexie schema migration

**Status:** ✅ Agreed

**Context:** The session screen needs `kind` and `youtubeVideoId` to branch rendering. These could be added to `SessionSlotData` and `ActiveSessionRecord` with or without a Dexie schema migration.

**Decision:** Add `kind`, `youtubeVideoId`, and `videoPlaybackPosition` as optional fields to the TypeScript interfaces only. No Dexie schema version bump needed.

**Rationale:** Dexie stores all object properties to IndexedDB regardless of whether they're in the schema definition — the schema only defines *indexes* for querying. The `activeSession` table uses schema `'id'` and is only ever accessed via `.get(1)`. Adding fields to the TS type is sufficient; Dexie will persist them automatically.

**Alternatives considered:**

- Dexie v4→v5 migration → rejected: unnecessary ceremony for a singleton table with no index needs
- Async lookup from events table at render time → rejected: causes layout flash on mount and crash recovery

**User pushback / disagreement:** None — user selected this approach from presented options.

**Reversibility:** Easy — remove the optional fields from the interfaces.

### D-02: Two separate layout components instead of conditional rendering

**Status:** ✅ Agreed

**Context:** The YouTube layout is structurally different from the default layout (slim timer strip vs centered card, embedded video, different button positioning).

**Decision:** Create `SessionYouTubeLayout` and `SessionDefaultLayout` as separate components. `Session.tsx` stays as the orchestrator (lifecycle, dialogs, keyboard shortcuts) and delegates rendering.

**Rationale:** The YouTube layout has a fundamentally different DOM hierarchy. Cramming both into one component with conditionals makes both layouts harder to maintain.

**Alternatives considered:**

- Single component with `kind === 'youtube'` conditionals → rejected: too much conditional DOM, hard to reason about

**User pushback / disagreement:** None.

**Reversibility:** Easy — merge back into one component.

### D-03: Full YouTube IFrame Player JS API, not plain iframe

**Status:** ✅ Agreed

**Context:** Initially considered a plain `<iframe>` with embed URL. User clarified requirements: session pause must pause the video, and playback position must persist for resume.

**Decision:** Use the YouTube IFrame Player JavaScript API (`YT.Player`) loaded from `youtube.com/iframe_api`.

**Rationale:** The plain iframe approach cannot programmatically pause/resume the video or read playback position. The JS API is necessary for bidirectional control and position tracking.

**Alternatives considered:**

- Plain `<iframe>` with embed URL → rejected: no programmatic control, can't pause video or read position

**User pushback / disagreement:** User specifically requested playback position persistence and session-pause-pauses-video behavior, which necessitated the JS API.

**Reversibility:** Moderate — would need to remove the adapter layer and script loader, replace with plain iframe.

### D-04: Unidirectional coupling — our pause controls video, video pause does NOT control timer

**Status:** ✅ Agreed

**Context:** Multiple coupling models were discussed. Initially bidirectional (video pause = timer pause), then user reversed to unidirectional.

**Decision:** When user clicks our Pause button → pause video AND timer. When user pauses video via YouTube controls → timer keeps running. Timer only stops via our Pause or "I'll come back later" buttons.

**Rationale:** User explicitly decided: "Let the session run even when video is paused, time only stops when user clicks our pause or I'll be back button." This avoids the ambiguity of guessing intent when a user pauses a video (could be taking notes, could mean to pause session).

**Alternatives considered:**

- Bidirectional coupling → rejected by user after considering edge cases
- Video pause = timer pause with banner prompt → rejected by user: "Scrap it"

**User pushback / disagreement:**
> "Scrap it, Let the session run even when video is paused, time only stops when user clicks our pause or ill be back button."

**Reversibility:** Easy — add `onStateChange` handler that calls `lc.pause()` on PAUSED state.

### D-05: Auto-seek to saved position on resume, no scrub hint

**Status:** ✅ Agreed

**Context:** PRD originally specified "video reloads from zero + scrub hint" because it assumed we wouldn't track playback position. Since we're using the JS API and tracking `getCurrentTime()`, we can auto-seek.

**Decision:** Persist `videoPlaybackPosition` in `ActiveSessionRecord`. On resume, call `player.seekTo(savedPosition)`. Show a temporary banner "Resumed from where you left off" that auto-dismisses. Drop the PRD's scrub hint.

**Rationale:** Telling the user to manually scrub when we know their position would feel broken. PRD will be updated to match.

**Alternatives considered:**

- Scrub hint (PRD original) → rejected: we have the data, use it

**User pushback / disagreement:** User explicitly agreed to update the PRD.

**Reversibility:** Easy — stop persisting position, show scrub hint instead.

### D-06: Escape key triggers confirmation modal, not immediate end

**Status:** ✅ Agreed

**Context:** "End session" button ends immediately. Escape key behavior needed to be decided.

**Decision:** Escape key (when NOT in fullscreen) pauses session + video → shows confirmation modal. Cancel resumes both. Confirm ends session and navigates to home. Check `document.fullscreenElement` — if fullscreen, let browser handle Escape natively (exits fullscreen).

**Rationale:** Gives user a chance to cancel accidental Escape presses. Different from the End button which is a deliberate click.

**Alternatives considered:**

- Escape = immediate end (same as button) → rejected by user
- Escape works in fullscreen too → rejected: "Only when not in full screen shd esc trigger this"

**User pushback / disagreement:** None on final approach.

**Reversibility:** Easy — change Escape handler to call `handleEnd()` directly.

### D-07: Article auto-opens on session start within click gesture

**Status:** ✅ Agreed

**Context:** Articles should open in a new tab when a session starts. Using `setTimeout` would get blocked by popup blockers.

**Decision:** Call `window.open(url, '_blank')` immediately within the "Start session" click handler (same call stack as user gesture). Call `window.focus()` to keep session tab in front. Show banner "Article opened in a new tab — come back here when you're done" with a "Reopen article" button.

**Rationale:** Popup blockers allow `window.open` in the same call stack as a user gesture. Delayed opens via `setTimeout` would be blocked.

**Alternatives considered:**

- Delayed open with message → rejected: popup blocker would block it

**User pushback / disagreement:** User wanted user to see the session page before redirect. Solution: open tab in background, keep session tab focused via `window.focus()`.

**Reversibility:** Easy — remove `window.open` call from start flow.

### D-08: Track videoPlayTime as a metric alongside sessionElapsed

**Status:** ✅ Agreed

**Context:** User proposed branching the timer into sessionElapsed, videoPlayTime, and videoPausedTime for richer metrics (focus ratio, note-taking time, effective pace).

**Decision:** Track `videoPlayTime` (increments only when `YT.PlayerState === PLAYING`) alongside the existing `sessionElapsed`. Derive `videoPausedTime` as the difference. Store `videoPlayTime` in `SessionLoggedPayload`.

**Rationale:** Two explicit counters plus derivation is simpler than three independent counters that can drift. Enables future weekly narrative metrics.

**Alternatives considered:**

- Three independent counters → rejected: can drift out of sync
- No video time tracking → rejected: valuable metric data lost

**User pushback / disagreement:** None.

**Reversibility:** Easy — stop tracking the field, remove from payload.

### D-09: YouTubePlayerAdapter with DI for testability

**Status:** ✅ Agreed

**Context:** The codebase uses DI consistently (AuthGate, SyncEngine, SessionLifecycle). YouTube player integration needs the same pattern.

**Decision:** Create a thin `YouTubePlayerAdapter` class wrapping `YT.Player`, injectable with a hand-written fake for tests.

**Rationale:** Consistent with codebase DI convention. Avoids mocking globals (project rule). Enables deterministic testing of player state change handling.

**Alternatives considered:**

- Direct `YT.Player` usage with global mocks → rejected: violates project testing conventions

**User pushback / disagreement:** None.

**Reversibility:** Easy — inline the calls, remove the adapter.

### D-10: Use current color scheme only

**Status:** ✅ Agreed

**Context:** The expected design mockup has some incorrect colors.

**Decision:** Use the existing Marginalia color scheme from the current design. The expected design images are layout references only — do not derive colors from them.

**Rationale:** User explicitly flagged: "the current colour schema is correct, the expected image has some bad colors."

**Alternatives considered:** None.

**User pushback / disagreement:** None.

**Reversibility:** N/A.

### D-11: Video ended — timer keeps running with gentle prompt

**Status:** ✅ Agreed

**Context:** When the YouTube video reaches its natural end, what happens to the session.

**Decision:** Timer keeps running. Show status strip as "YOUTUBE · 4:12 · ENDED" and a gentle prompt "Video finished — End session when you're ready." Session only ends via user's explicit End action.

**Rationale:** Consistent with the rule that only our Pause/End buttons stop the timer. User might want to rewatch or take notes after the video ends.

**Alternatives considered:**

- Auto-end session → rejected: abrupt, user may want to continue studying

**User pushback / disagreement:** None.

**Reversibility:** Easy — add auto-end on ENDED state.

### D-12: Paused YouTube session keeps embed visible with color shift

**Status:** ✅ Agreed

**Context:** When the user pauses a YouTube session, should the layout switch to the default paused card layout?

**Decision:** Keep the YouTube embed visible. Apply the existing `.is-paused` color shift (muted background, desaturated timer) to the surrounding UI. Don't switch layouts.

**Rationale:** User explicitly asked for the color shift visual indicator. Switching layouts is jarring.

**Alternatives considered:**

- Switch to default paused card layout → rejected by user

**User pushback / disagreement:** None.

**Reversibility:** Easy — conditionally render default layout when paused.

## Architecture overview

```
Session.tsx (orchestrator)
├── Reads kind from location.state or ActiveSessionRecord
├── Initializes SessionLifecycle (unchanged)
├── Initializes YouTubePlayerAdapter (new, YouTube only)
├── Manages Escape key handler (new)
│
├── kind === 'youtube'
│   └── SessionYouTubeLayout (new)
│       ├── Slim timer panel (eyebrow + title + timer inline)
│       ├── YouTube embed container (16:9 aspect ratio)
│       ├── Status strip (YOUTUBE · duration · PLAYING/PAUSED/ENDED)
│       ├── "I'll come back later" link
│       ├── "PRESS ESC TO END" hint (desktop only)
│       └── Fixed "End session" FAB (desktop) / inline button (mobile)
│
├── kind === 'article'
│   └── SessionDefaultLayout (extracted from current Session.tsx)
│       ├── Banner: "Article opened in a new tab..."
│       ├── "Reopen article" button (replaces "Open material")
│       └── Everything else unchanged
│
└── kind === 'manual' (with or without URL)
    └── SessionDefaultLayout (unchanged behavior)

YouTubePlayerAdapter (new, DI-injectable)
├── Wraps YT.Player lifecycle (create, destroy)
├── Exposes: play(), pause(), seekTo(), getCurrentTime(), destroy()
├── Fires onStateChange callbacks
└── Tracks videoPlayTimeMs internally
```

**Data flow for `kind`:**

```
MaterialAdded event (has kind, youtubeVideoId, url)
    ↓
Home.tsx queries MaterialAdded, extracts kind + youtubeVideoId
    ↓
SessionSlotData { ...existing, kind, youtubeVideoId } via location.state
    ↓
SessionLifecycle.start() persists to ActiveSessionRecord { ...existing, kind, youtubeVideoId }
    ↓
Session.tsx reads record.kind → delegates to layout component
```

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `apps/app/src/session/types.ts` | modify | 1 | Add `kind`, `youtubeVideoId`, `videoPlaybackPosition` to `SessionSlotData` + `ActiveSessionRecord`; add `videoPlayTimeMinutes` to `SessionLoggedPayload` |
| `apps/app/src/pages/Home.tsx` | modify | 1 | Pass `kind` + `youtubeVideoId` through `SessionSlotData` when starting session |
| `apps/app/src/session/SessionLifecycle.ts` | modify | 1 | Persist `kind`, `youtubeVideoId`, `videoPlaybackPosition` in `start()` |
| `apps/app/src/session/YouTubePlayerAdapter.ts` | new | 2 | DI-injectable wrapper around YT.Player |
| `apps/app/src/session/YouTubePlayerAdapter.test.ts` | new | 2 | Unit tests for adapter |
| `apps/app/src/session/loadYouTubeApi.ts` | new | 2 | Script loader for YouTube IFrame API |
| `apps/app/src/session/components/SessionDefaultLayout.tsx` | new | 3 | Extracted from current Session.tsx render |
| `apps/app/src/session/components/SessionYouTubeLayout.tsx` | new | 4 | YouTube-specific layout with embed |
| `apps/app/src/session/components/YouTubeEmbed.tsx` | new | 4 | React component wrapping the adapter |
| `apps/app/src/session/components/VideoStatusStrip.tsx` | new | 4 | "YOUTUBE · 4:12 · PLAYING" strip |
| `apps/app/src/session/components/EscapeConfirmModal.tsx` | new | 4 | Escape key confirmation dialog |
| `apps/app/src/session/components/SessionBanner.tsx` | new | 3 | Reusable banner for article/resume messages |
| `apps/app/src/session/components/index.ts` | modify | 3, 4 | Export new components |
| `apps/app/src/pages/Session.tsx` | modify | 3, 4, 5 | Refactor to use layout components, add YouTube orchestration, Escape handler |
| `apps/app/src/session/session.css` | modify | 4 | YouTube layout styles (slim timer, embed container, desktop/mobile) |
| `apps/app/src/session/components/MaterialStrip.tsx` | modify | 3 | Accept `kind` prop for dynamic icon/meta |
| `apps/app/src/session/SessionLifecycle.test.ts` | modify | 1 | Test kind/youtubeVideoId persistence |
| `apps/app/src/session/components/SessionYouTubeLayout.test.tsx` | new | 5 | Layout assertions for YouTube |
| `apps/app/src/session/components/SessionDefaultLayout.test.tsx` | new | 5 | Layout assertions for default |
| `e2e/session-per-kind.spec.ts` | new | 6 | E2E: start/end session for each kind |

## Phases

### Phase 1: Plumb material kind through the data flow

**Status:** ☐ Not started
**Depends on:** none — can start immediately
**Estimated scope:** ~4 files, ~40 lines

#### Codebase state assumed at start

- `apps/app/src/session/types.ts` exists with `SessionSlotData` (line 275) and `ActiveSessionRecord` (line 211)
- `apps/app/src/pages/Home.tsx` exists with session start handler (line 153–167)
- `apps/app/src/session/SessionLifecycle.ts` exists with `start()` method (line 147)
- `MaterialAddedPayload` in `apps/app/src/sync/types.ts` already has `kind: MaterialKind` and `youtubeVideoId?: string`
- Tests pass: `pnpm --filter app test`

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep -n 'MaterialKind' apps/app/src/session/types.ts          # should find the type export
grep -n 'materialUrl' apps/app/src/session/types.ts            # should find it in SessionSlotData and ActiveSessionRecord
grep -n 'youtubeVideoId' apps/app/src/sync/types.ts            # should find it in MaterialAddedPayload
pnpm --filter app test -- --run 2>&1 | tail -5                 # tests should pass
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Modify `apps/app/src/session/types.ts`, interface `SessionSlotData` (currently lines 275–283).** Add `kind` and `youtubeVideoId` fields. Implements D-01.

   ```ts
   export interface SessionSlotData {
     materialId: string;
     sessionTitle: string;
     slotDate: string;
     weekIndex: number;
     plannedMinutes: number;
     materialUrl?: string;
     role?: 'anchor' | 'foundation' | 'practice';
     kind?: MaterialKind;
     youtubeVideoId?: string;
   }
   ```

2. **Modify `apps/app/src/session/types.ts`, interface `ActiveSessionRecord` (currently lines 211–236).** Add `kind`, `youtubeVideoId`, and `videoPlaybackPosition` fields. Implements D-01.

   ```ts
   // Add after materialUrl field (line 235):
   kind?: MaterialKind;
   youtubeVideoId?: string;
   videoPlaybackPosition?: number;
   ```

3. **Modify `apps/app/src/session/types.ts`, interface `SessionLoggedPayload` (currently lines 114–153).** Add `videoPlayTimeMinutes` field. Implements D-08.

   ```ts
   // Add after totalPauseMinutes field (line 134):
   /** Minutes of actual YouTube video playback (undefined for non-YouTube sessions) */
   videoPlayTimeMinutes?: number;
   ```

4. **Modify `apps/app/src/pages/Home.tsx`, session start handler (currently lines 156–167).** Extract `kind` and `youtubeVideoId` from the MaterialAdded event and pass them through `SessionSlotData`.

   ```ts
   const sessionSlot: SessionSlotData = {
     materialId: upNextSlot.candidateMaterialIds[0] ?? '',
     sessionTitle: upNextSlot.sessionTitle ?? 'Study session',
     slotDate: upNextSlot.date,
     weekIndex: upNextSlot.weekIndex,
     plannedMinutes: upNextSlot.plannedMinutes,
     materialUrl: material?.payload.url as string | undefined,
     role: upNextSlot.role as SessionSlotData['role'],
     kind: (material?.payload.kind as MaterialKind | undefined) ?? 'manual',
     youtubeVideoId: material?.payload.youtubeVideoId as string | undefined,
   };
   ```

   Also add `MaterialKind` import at the top of the file:

   ```ts
   import type { ActiveSessionRecord, SessionSlotData } from '../session/types';
   import type { MaterialKind } from '../session/types';
   ```

5. **Modify `apps/app/src/session/SessionLifecycle.ts`, `start()` method (currently lines 155–168, the record construction).** Persist `kind`, `youtubeVideoId`, and `videoPlaybackPosition` from `slotData`.

   ```ts
   this.record = {
     id: 1,
     sessionId,
     materialId: slotData.materialId,
     sessionTitle: slotData.sessionTitle,
     slotDate: slotData.slotDate,
     weekIndex: slotData.weekIndex,
     plannedMinutes: slotData.plannedMinutes,
     startedAt,
     status: 'active',
     pauseIntervals: [],
     pomodoroConfig: this.pomodoroConfig,
     materialUrl: slotData.materialUrl,
     kind: slotData.kind,
     youtubeVideoId: slotData.youtubeVideoId,
   };
   ```

#### Tests

- Update `apps/app/src/session/SessionLifecycle.test.ts` — add test case: "start() persists kind and youtubeVideoId to activeSession record"

   ```ts
   it('persists kind and youtubeVideoId from slot data', async () => {
     const lc = new SessionLifecycle(makeDeps());
     await lc.initialize();
     await lc.start({
       ...slotData,
       kind: 'youtube',
       youtubeVideoId: 'dQw4w9WgXcQ',
     });
     const record = lc.getRecord();
     expect(record?.kind).toBe('youtube');
     expect(record?.youtubeVideoId).toBe('dQw4w9WgXcQ');
   });

   it('defaults kind to undefined when not provided', async () => {
     const lc = new SessionLifecycle(makeDeps());
     await lc.initialize();
     await lc.start(slotData);
     const record = lc.getRecord();
     expect(record?.kind).toBeUndefined();
   });
   ```

- Run: `pnpm --filter app test -- --run`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run 2>&1 | tail -5                # all tests pass
pnpm typecheck 2>&1 | tail -5                                  # no type errors
grep -n 'kind.*MaterialKind' apps/app/src/session/types.ts     # field exists in both interfaces
```

#### Rollback

Revert the optional field additions from the three interfaces and the Home.tsx/SessionLifecycle.ts changes. No data migration involved — existing records without `kind` will simply have `undefined`.

#### Notes (filled in during implementation)



---

### Phase 2: YouTube IFrame Player adapter and script loader

**Status:** ☐ Not started
**Depends on:** none — can start immediately (no dependency on Phase 1)
**Estimated scope:** ~3 new files, ~250 lines

#### Codebase state assumed at start

- No YouTube-related files exist yet in the codebase
- DI pattern exists in `apps/app/src/auth/AuthGate.ts` and `apps/app/src/session/SessionLifecycle.ts` as reference
- `apps/app/src/session/NotificationStrategy.ts` shows the pattern for DI-injectable browser API wrappers

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
ls apps/app/src/session/YouTubePlayerAdapter.ts 2>/dev/null && echo "EXISTS" || echo "DOES NOT EXIST"  # should not exist
pnpm --filter app test -- --run 2>&1 | tail -5                                                          # tests should pass
```

If any of these fail, STOP.

#### Steps

1. **Create `apps/app/src/session/loadYouTubeApi.ts`** — singleton script loader for the YouTube IFrame API.

   ```ts
   let loadPromise: Promise<void> | null = null;

   export function loadYouTubeApi(): Promise<void> {
     if (loadPromise) return loadPromise;

     loadPromise = new Promise<void>((resolve, reject) => {
       if (typeof window === 'undefined') {
         reject(new Error('loadYouTubeApi requires a browser environment'));
         return;
       }

       if (window.YT?.Player) {
         resolve();
         return;
       }

       const existing = document.getElementById('youtube-iframe-api');
       if (existing) {
         const prev = (window as any).onYouTubeIframeAPIReady;
         (window as any).onYouTubeIframeAPIReady = () => {
           prev?.();
           resolve();
         };
         return;
       }

       (window as any).onYouTubeIframeAPIReady = () => resolve();

       const script = document.createElement('script');
       script.id = 'youtube-iframe-api';
       script.src = 'https://www.youtube.com/iframe_api';
       script.onerror = () => {
         loadPromise = null;
         reject(new Error('Failed to load YouTube IFrame API'));
       };
       document.head.appendChild(script);
     });

     return loadPromise;
   }
   ```

2. **Create `apps/app/src/session/YouTubePlayerAdapter.ts`** — DI-injectable wrapper around `YT.Player`. Implements D-03, D-09.

   ```ts
   export type YouTubePlayerState = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended' | 'cued';

   export interface YouTubePlayerAdapterDeps {
     containerId: string;
     videoId: string;
     startSeconds?: number;
     onStateChange?: (state: YouTubePlayerState) => void;
     onReady?: () => void;
     onError?: (errorCode: number) => void;
   }

   const YT_STATE_MAP: Record<number, YouTubePlayerState> = {
     [-1]: 'unstarted',
     [0]: 'ended',
     [1]: 'playing',
     [2]: 'paused',
     [3]: 'buffering',
     [5]: 'cued',
   };

   export class YouTubePlayerAdapter {
     private player: YT.Player | null = null;
     private readonly deps: YouTubePlayerAdapterDeps;
     private videoPlayTimeMs = 0;
     private lastPlayStartedAt: number | null = null;

     constructor(deps: YouTubePlayerAdapterDeps) {
       this.deps = deps;
     }

     create(): void {
       this.player = new YT.Player(this.deps.containerId, {
         videoId: this.deps.videoId,
         playerVars: {
           autoplay: 1,
           modestbranding: 1,
           rel: 0,
           start: this.deps.startSeconds ? Math.floor(this.deps.startSeconds) : undefined,
         },
         events: {
           onReady: () => this.deps.onReady?.(),
           onStateChange: (event: YT.OnStateChangeEvent) => {
             const state = YT_STATE_MAP[event.data] ?? 'unstarted';
             this.trackPlayTime(state);
             this.deps.onStateChange?.(state);
           },
           onError: (event: YT.OnErrorEvent) => {
             this.deps.onError?.(event.data);
           },
         },
       });
     }

     play(): void {
       this.player?.playVideo();
     }

     pause(): void {
       this.player?.pauseVideo();
     }

     seekTo(seconds: number): void {
       this.player?.seekTo(seconds, true);
     }

     getCurrentTime(): number {
       return this.player?.getCurrentTime() ?? 0;
     }

     getDuration(): number {
       return this.player?.getDuration() ?? 0;
     }

     getVideoPlayTimeMs(): number {
       if (this.lastPlayStartedAt !== null) {
         return this.videoPlayTimeMs + (Date.now() - this.lastPlayStartedAt);
       }
       return this.videoPlayTimeMs;
     }

     destroy(): void {
       this.flushPlayTime();
       this.player?.destroy();
       this.player = null;
     }

     private trackPlayTime(state: YouTubePlayerState): void {
       if (state === 'playing') {
         this.lastPlayStartedAt = Date.now();
       } else if (this.lastPlayStartedAt !== null) {
         this.flushPlayTime();
       }
     }

     private flushPlayTime(): void {
       if (this.lastPlayStartedAt !== null) {
         this.videoPlayTimeMs += Date.now() - this.lastPlayStartedAt;
         this.lastPlayStartedAt = null;
       }
     }
   }
   ```

3. **Add YT type declarations.** Create `apps/app/src/youtube.d.ts`:

   ```ts
   interface YTPlayerOptions {
     videoId: string;
     playerVars?: {
       autoplay?: number;
       modestbranding?: number;
       rel?: number;
       start?: number;
     };
     events?: {
       onReady?: () => void;
       onStateChange?: (event: YT.OnStateChangeEvent) => void;
       onError?: (event: YT.OnErrorEvent) => void;
     };
   }

   declare namespace YT {
     class Player {
       constructor(elementId: string, options: YTPlayerOptions);
       playVideo(): void;
       pauseVideo(): void;
       seekTo(seconds: number, allowSeekAhead: boolean): void;
       getCurrentTime(): number;
       getDuration(): number;
       destroy(): void;
     }
     interface OnStateChangeEvent {
       data: number;
     }
     interface OnErrorEvent {
       data: number;
     }
   }

   interface Window {
     YT?: typeof YT;
     onYouTubeIframeAPIReady?: () => void;
   }
   ```

#### Tests

- Create `apps/app/src/session/YouTubePlayerAdapter.test.ts` — test the adapter with a hand-written fake `YT.Player`:

   ```ts
   // Test cases:
   // - create() instantiates YT.Player with correct options
   // - play() calls playVideo()
   // - pause() calls pauseVideo()
   // - seekTo() calls seekTo with allowSeekAhead=true
   // - getCurrentTime() returns player value
   // - onStateChange fires with mapped state strings
   // - getVideoPlayTimeMs() accumulates play time correctly
   // - destroy() cleans up player
   ```

- Run: `pnpm --filter app test -- --run`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run 2>&1 | tail -5                # all tests pass
pnpm typecheck 2>&1 | tail -5                                  # no type errors
ls apps/app/src/session/YouTubePlayerAdapter.ts                # file exists
ls apps/app/src/session/loadYouTubeApi.ts                      # file exists
```

#### Rollback

Delete the three new files. No other changes to revert.

#### Notes (filled in during implementation)



---

### Phase 3: Extract SessionDefaultLayout + article/manual branch

**Status:** ☐ Not started
**Depends on:** Phase 1
**Estimated scope:** ~5 files, ~200 lines

#### Codebase state assumed at start

- Phase 1 is complete: `SessionSlotData` and `ActiveSessionRecord` have `kind` and `youtubeVideoId` fields
- `apps/app/src/pages/Session.tsx` renders the current monolithic layout (lines 191–241)
- `apps/app/src/session/components/MaterialStrip.tsx` exists with `title`, `meta`, `iconLabel` props
- `apps/app/src/session/components/PlannedEndBanner.tsx` exists as the pattern for banner components

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep -n 'kind.*MaterialKind' apps/app/src/session/types.ts     # should find kind in SessionSlotData and ActiveSessionRecord
pnpm --filter app test -- --run 2>&1 | tail -5                  # tests should pass
```

If any of these fail, STOP.

#### Steps

1. **Create `apps/app/src/session/components/SessionBanner.tsx`** — reusable banner component for article/resume messages.

   ```ts
   interface SessionBannerProps {
     message: string;
     actionLabel?: string;
     onAction?: () => void;
     onDismiss?: () => void;
     autoDismissMs?: number;
   }
   ```

   Follows the same DOM structure as `PlannedEndBanner` (`.banner` class), but with `info` variant instead of `attention`. If `autoDismissMs` is set, auto-dismisses via `useEffect` + `setTimeout`.

2. **Modify `apps/app/src/session/components/MaterialStrip.tsx`** — make icon and meta dynamic based on `kind`.

   ```ts
   import type { MaterialKind } from '../../session/types';

   interface MaterialStripProps {
     title: string;
     meta: string;
     kind?: MaterialKind;
     iconLabel?: string;
   }

   function getIconLabel(kind?: MaterialKind): string {
     switch (kind) {
       case 'youtube': return 'YT';
       case 'article': return 'AR';
       default: return 'NB';
     }
   }

   export function MaterialStrip({ title, meta, kind, iconLabel }: MaterialStripProps) {
     return (
       <div className="material-strip">
         <div className="material-strip-icon">{iconLabel ?? getIconLabel(kind)}</div>
         <div className="material-strip-body">
           <div className="material-strip-title">{title}</div>
           <div className="material-strip-meta">{meta}</div>
         </div>
       </div>
     );
   }
   ```

3. **Create `apps/app/src/session/components/SessionDefaultLayout.tsx`** — extract the current `Session.tsx` render block (lines 191–240) into this component. This handles `article`, `manual-with-url`, and `manual-without-url` kinds. Implements D-07 for article auto-open.

   Props interface:

   ```ts
   interface SessionDefaultLayoutProps {
     record: ActiveSessionRecord;
     sessionState: SessionState;
     elapsedActiveMs: number;
     pomodoroPhase: PomodoroPhase;
     isPaused: boolean;
     isOverrun: boolean;
     isBreak: boolean;
     overrunMinutes: number;
     onPauseResume: () => void;
     onEnd: () => void;
     onComeBackLater: () => void;
     articleAutoOpened?: boolean;
   }
   ```

   The component renders exactly the current layout. For `kind === 'article'`:
   - Shows `SessionBanner` with "Article opened in a new tab — come back here when you're done"
   - Replaces `OpenMaterialButton` with a "Reopen article" button (same component, different label)
   - `materialMeta` shows `'ARTICLE · LINKED'` instead of `'MANUAL · LINKED'`

   For `kind === 'manual'`:
   - Behavior unchanged from current code
   - `materialMeta` stays `'MANUAL · LINKED'` or `'MANUAL · NO EMBED'`

4. **Update `apps/app/src/session/components/index.ts`** — add exports for `SessionDefaultLayout` and `SessionBanner`.

5. **Modify `apps/app/src/pages/Session.tsx`** — for non-YouTube sessions, delegate to `SessionDefaultLayout`. For YouTube, render a placeholder for now (Phase 4 adds the real YouTube layout). Handle article auto-open via `window.open` in the `init` effect.

   Key changes in `Session.tsx`:
   - After `lc.start(slotData)`, if `slotData.kind === 'article' && slotData.materialUrl`, call `window.open(slotData.materialUrl, '_blank')` then `window.focus()`. Implements D-07.
   - Compute `materialMeta` based on `record.kind` instead of hardcoded "MANUAL"
   - Render `<SessionDefaultLayout>` for non-YouTube, passing all needed props
   - For YouTube, render a temporary fallback (just the default layout) — Phase 4 adds the real YouTube layout

#### Tests

- Create `apps/app/src/session/components/SessionDefaultLayout.test.tsx` — basic render test with props
- Update existing Session.tsx snapshot/render tests if any exist
- Run: `pnpm --filter app test -- --run`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run 2>&1 | tail -5                # all tests pass
pnpm typecheck 2>&1 | tail -5                                  # no type errors
ls apps/app/src/session/components/SessionDefaultLayout.tsx    # file exists
ls apps/app/src/session/components/SessionBanner.tsx           # file exists
```

#### Rollback

Delete new component files, revert Session.tsx to inline rendering, revert MaterialStrip changes.

#### Notes (filled in during implementation)



---

### Phase 4: YouTube layout, embed component, and Escape key handler

**Status:** ☐ Not started
**Depends on:** Phase 2, Phase 3
**Estimated scope:** ~6 files, ~400 lines

#### Codebase state assumed at start

- Phase 2 complete: `YouTubePlayerAdapter` and `loadYouTubeApi` exist
- Phase 3 complete: `SessionDefaultLayout` exists, `Session.tsx` delegates to layout components
- `apps/app/src/lib/useMatchMedia.ts` exists (used for desktop detection)
- `apps/app/src/session/session.css` has desktop media query at `@media (min-width: 1024px)` (line 303)

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
ls apps/app/src/session/YouTubePlayerAdapter.ts                # should exist (Phase 2)
ls apps/app/src/session/components/SessionDefaultLayout.tsx    # should exist (Phase 3)
pnpm --filter app test -- --run 2>&1 | tail -5                  # tests should pass
```

If any of these fail, STOP.

#### Steps

1. **Create `apps/app/src/session/components/YouTubeEmbed.tsx`** — React component wrapping the `YouTubePlayerAdapter`.

   ```ts
   interface YouTubeEmbedProps {
     videoId: string;
     startSeconds?: number;
     onStateChange?: (state: YouTubePlayerState) => void;
     onReady?: () => void;
     adapterRef?: React.MutableRefObject<YouTubePlayerAdapter | null>;
   }
   ```

   - Uses `useEffect` to call `loadYouTubeApi()` then `adapter.create()`
   - Cleans up via `adapter.destroy()` on unmount
   - Renders a `<div id={containerId}>` wrapped in a 16:9 aspect-ratio container
   - Exposes adapter instance via `adapterRef` for parent to call `pause()`, `seekTo()`, etc.

2. **Create `apps/app/src/session/components/VideoStatusStrip.tsx`** — status line below the embed.

   ```ts
   interface VideoStatusStripProps {
     kind: 'youtube';
     durationFormatted: string;
     playerState: YouTubePlayerState;
   }
   ```

   Renders: `YOUTUBE · 4:12 · PLAYING` (or PAUSED/ENDED). Uses `.material-strip-meta` styling.

3. **Create `apps/app/src/session/components/EscapeConfirmModal.tsx`** — modal shown when Escape is pressed. Implements D-06.

   Uses the same modal pattern as `WalkAwayDialog`. Contains:
   - "End this session?" title
   - "Cancel" button (resumes session + video)
   - "End session" button (ends session, navigates to home)

4. **Create `apps/app/src/session/components/SessionYouTubeLayout.tsx`** — the YouTube-specific layout. Implements D-02, D-04, D-10, D-11, D-12.

   Props interface:

   ```ts
   interface SessionYouTubeLayoutProps {
     record: ActiveSessionRecord;
     sessionState: SessionState;
     elapsedActiveMs: number;
     pomodoroPhase: PomodoroPhase;
     isPaused: boolean;
     isOverrun: boolean;
     isBreak: boolean;
     overrunMinutes: number;
     isDesktop: boolean;
     onPauseResume: () => void;
     onEnd: () => void;
     onComeBackLater: () => void;
     playerAdapterRef: React.MutableRefObject<YouTubePlayerAdapter | null>;
     playerState: YouTubePlayerState;
     resumeBannerVisible: boolean;
     onDismissResumeBanner: () => void;
   }
   ```

   Desktop layout (from `expectedDesign/image.png`):
   - Slim timer panel: eyebrow + title + elapsed time inline row
   - YouTube embed centered at ~880px (`max-width: 880px`)
   - Video status strip below embed
   - "I'll come back later" + "PRESS ESC TO END" text below
   - Fixed bottom-right "End session" FAB

   Mobile layout (from `expectedDesign/image copy.png`):
   - Pause button top-left
   - Timer panel stacked (same as desktop but vertically arranged)
   - YouTube embed full width
   - "End session" button inline (not FAB)
   - "I'll come back later" below
   - No "PRESS ESC TO END"

   Paused state: embed stays visible, `.is-paused` color shift applies. Implements D-12.
   Video ended: status strip shows "ENDED", gentle prompt appears. Implements D-11.

5. **Add YouTube layout CSS to `apps/app/src/session/session.css`**.

   ```css
   /* YouTube layout — slim timer + embed */
   .session-layout-youtube {
     max-width: 880px;
     padding: 20px 20px 96px;
   }

   .session-yt-timer-panel {
     display: flex;
     justify-content: space-between;
     align-items: baseline;
     margin-bottom: var(--space-4);
     padding-bottom: var(--space-4);
     border-bottom: 1px solid var(--border-subtle);
   }

   .session-yt-timer-left {
     flex: 1;
     min-width: 0;
   }

   .session-yt-timer-right {
     text-align: right;
     flex-shrink: 0;
   }

   .session-yt-timer-right .session-timer-time {
     font-size: 36px;
   }

   .session-yt-embed-container {
     position: relative;
     width: 100%;
     padding-bottom: 56.25%; /* 16:9 */
     margin-bottom: var(--space-3);
     background: var(--ink);
     border-radius: var(--radius-md);
     overflow: hidden;
   }

   .session-yt-embed-container iframe {
     position: absolute;
     top: 0;
     left: 0;
     width: 100%;
     height: 100%;
     border: 0;
   }

   .session-yt-status-strip {
     font-family: var(--font-mono);
     font-size: 11px;
     text-transform: uppercase;
     letter-spacing: 0.06em;
     color: var(--text-tertiary);
     margin-bottom: var(--space-4);
   }

   .session-yt-bottom-row {
     display: flex;
     justify-content: space-between;
     align-items: center;
   }

   .session-yt-esc-hint {
     font-family: var(--font-mono);
     font-size: 11px;
     text-transform: uppercase;
     letter-spacing: 0.06em;
     color: var(--text-tertiary);
     display: none;
   }

   @media (min-width: 1024px) {
     .session-layout-youtube {
       max-width: 880px;
       padding: var(--space-7) var(--space-6) var(--space-9);
     }

     .session-yt-timer-right .session-timer-time {
       font-size: 48px;
     }

     .session-yt-esc-hint {
       display: block;
     }
   }
   ```

6. **Modify `apps/app/src/pages/Session.tsx`** — add YouTube orchestration. Key additions:

   - Import and use `useMatchMedia('(min-width: 1024px)')` for `isDesktop`
   - Track `playerState` via `useState<YouTubePlayerState>('unstarted')`
   - Track `resumeBannerVisible` for the "Resumed from where you left off" banner
   - Create `playerAdapterRef` via `useRef`
   - On `handlePauseResume`: if YouTube, also call `adapter.pause()` or `adapter.play()`. Implements D-04.
   - On `handleComeBackLater`: save `adapter.getCurrentTime()` to the record's `videoPlaybackPosition` before pausing. Implements D-05.
   - On `handleEnd`: read `adapter.getVideoPlayTimeMs()` and include in the logged event. Implements D-08.
   - Add `useEffect` for Escape key listener: check `!document.fullscreenElement`, then show `EscapeConfirmModal`. Implements D-06.
   - Render `SessionYouTubeLayout` when `record.kind === 'youtube'`, otherwise `SessionDefaultLayout`
   - If resuming a YouTube session (record has `videoPlaybackPosition`), pass `startSeconds` to the embed and show the resume banner. Implements D-05.

7. **Update `apps/app/src/session/components/index.ts`** — add exports for new components.

#### Tests

- Unit tests for `VideoStatusStrip` rendering
- Unit tests for `EscapeConfirmModal` (cancel calls resume, confirm calls end)
- Run: `pnpm --filter app test -- --run`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run 2>&1 | tail -5                # all tests pass
pnpm typecheck 2>&1 | tail -5                                  # no type errors
ls apps/app/src/session/components/SessionYouTubeLayout.tsx    # file exists
ls apps/app/src/session/components/YouTubeEmbed.tsx            # file exists
```

#### Rollback

Delete the new component files and CSS additions. Revert Session.tsx YouTube-specific logic. SessionDefaultLayout remains (from Phase 3).

#### Notes (filled in during implementation)



---

### Phase 5: Unit tests for per-kind branching and layout assertions

**Status:** ☐ Not started
**Depends on:** Phase 3, Phase 4
**Estimated scope:** ~2 files, ~200 lines

#### Codebase state assumed at start

- Phase 3 and 4 complete: both `SessionDefaultLayout` and `SessionYouTubeLayout` exist
- `Session.tsx` delegates to the correct layout based on `record.kind`
- Existing test patterns: `SessionLifecycle.test.ts` uses fake timers and DI

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
ls apps/app/src/session/components/SessionYouTubeLayout.tsx    # should exist
ls apps/app/src/session/components/SessionDefaultLayout.tsx    # should exist
pnpm --filter app test -- --run 2>&1 | tail -5                  # tests should pass
```

If any of these fail, STOP.

#### Steps

1. **Create `apps/app/src/session/components/SessionDefaultLayout.test.tsx`** — layout assertions for all non-YouTube kinds:

   Test cases:
   - Article kind: renders banner with "Article opened in a new tab" text, renders "Reopen article" button
   - Manual with URL: renders "Open material" button, no banner
   - Manual without URL: no "Open material" button, no banner
   - MaterialStrip shows correct icon label per kind (AR/NB)
   - materialMeta shows correct string per kind

2. **Create `apps/app/src/session/components/SessionYouTubeLayout.test.tsx`** — layout assertions for YouTube kind:

   Test cases:
   - Renders YouTube embed container (`session-yt-embed-container`)
   - Timer panel shows slim layout (not centered card)
   - VideoStatusStrip renders with correct state text
   - "PRESS ESC TO END" hint visible only in desktop (mock `useMatchMedia`)
   - Paused state: embed container still in DOM, `.is-paused` class applied
   - Resume banner visible when `resumeBannerVisible` is true
   - Video ended state: status strip shows "ENDED"

- Run: `pnpm --filter app test -- --run`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run 2>&1 | tail -5                # all tests pass
```

#### Rollback

Delete the test files. No production code changes.

#### Notes (filled in during implementation)



---

### Phase 6: E2E tests for per-kind session start/end

**Status:** ☐ Not started
**Depends on:** Phase 4
**Estimated scope:** ~1 file, ~200 lines

#### Codebase state assumed at start

- All previous phases complete
- `e2e/session-planned-end.spec.ts` exists as the pattern for E2E session tests
- `e2e/playwright.config.ts` configured with app web server
- The YouTube IFrame API will NOT be available in test — need to mock `YT.Player` via `page.addInitScript()`

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
ls e2e/session-planned-end.spec.ts                             # pattern file exists
ls apps/app/src/session/components/SessionYouTubeLayout.tsx    # YouTube layout exists
```

If any of these fail, STOP.

#### Steps

1. **Create `e2e/session-per-kind.spec.ts`** — E2E tests covering session start/end for each material kind.

   Follow the pattern from `e2e/session-planned-end.spec.ts`:
   - Create test user via Supabase admin client
   - Sign in via the UI
   - Seed `activeSession` record directly into IndexedDB with the appropriate `kind`
   - Navigate to `/study/session`
   - Assert layout matches the kind

   Test cases:
   - **YouTube**: seeds record with `kind: 'youtube'`, verifies YouTube layout renders (`.session-layout-youtube` class present), verifies embed container exists
   - **Article**: seeds record with `kind: 'article'`, verifies default layout renders with banner text
   - **Manual with URL**: seeds record with `kind: 'manual'` and `materialUrl` set, verifies "Open material" button exists
   - **Manual without URL**: seeds record with `kind: 'manual'` and no `materialUrl`, verifies no "Open material" button

   For the YouTube test, inject a fake `YT.Player` via `page.addInitScript()`:

   ```ts
   await page.addInitScript(() => {
     (window as any).YT = {
       Player: class FakePlayer {
         constructor(_el: string, opts: any) {
           setTimeout(() => opts.events?.onReady?.(), 100);
         }
         playVideo() {}
         pauseVideo() {}
         seekTo() {}
         getCurrentTime() { return 0; }
         getDuration() { return 252; }
         destroy() {}
       },
     };
     (window as any).onYouTubeIframeAPIReady?.();
   });
   ```

   **Note:** These tests are written to be run on a machine with Playwright and Supabase access. They will NOT be run in this environment.

#### Tests

- Run (on a machine with Playwright access): `pnpm test:e2e -- --grep "per-kind"`

#### Verification (DONE — run after implementation)

```bash
ls e2e/session-per-kind.spec.ts                                # file exists
pnpm typecheck 2>&1 | tail -5                                  # no type errors in test file
```

#### Rollback

Delete the E2E test file. No production code changes.

#### Notes (filled in during implementation)



---

## Open questions

### OQ-01: Video playback metrics in weekly narrative

**Why deferred:** The `videoPlayTimeMinutes` field is being stored in `SessionLoggedPayload`, but no downstream consumer (ProgressEngine, WeeklyNarrative) reads it yet.
**Triggers needing resolution:** When issue #011 (WeeklyNarrative) is implemented.
**Owner / resolution path:** Address during issue #011 planning.
**Cross-ref:** D-08

### OQ-02: PRD update for auto-seek behavior

**Why deferred:** The PRD currently specifies "video reloads from zero + scrub hint." Decision D-05 changes this to auto-seek. The PRD text needs updating.
**Triggers needing resolution:** Before the next PRD review cycle.
**Owner / resolution path:** Rohit Saji updates the PRD manually.
**Cross-ref:** D-05

## Out of scope

- **Web Push notifications** — v1.1 feature; not part of this issue
- **YouTube playback speed tracking** — could be useful for effective pace metrics but adds complexity
- **Offline YouTube playback** — YouTube IFrame API requires network; no offline mode possible
- **Video-pause-pauses-timer coupling** — explicitly rejected in D-04; timer always runs
- **Banner on video pause** — explicitly rejected by user ("Scrap it")
- **Fullscreen detection for Escape key** — handled simply via `document.fullscreenElement` check, not a separate feature

## References

- Issue #007: `../../specs/issues/007-active-session-with-youtube-embed.md`
- PRD: `../../specs/prd/PRD-study-tracker-web.md`
- YouTube IFrame Player API: https://developers.google.com/youtube/iframe_api_reference
- Design mockup (desktop YouTube): `../../specs/issues/images/expectedDesign/image.png`
- Design mockup (mobile YouTube): `../../specs/issues/images/expectedDesign/image copy.png`
- Design mockup (current default): `issues/images/image.png`
- Session CSS: `apps/app/src/session/session.css`
- Existing E2E pattern: `e2e/session-planned-end.spec.ts`
- DI pattern reference: `apps/app/src/auth/AuthGate.ts`
- useMatchMedia hook: `apps/app/src/lib/useMatchMedia.ts`
