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

# Fix roadmap engine handling of YouTube playlists — treat playlist as one material

**Slug:** `playlist-as-one-material`
**Date written:** 2026-05-08
**Author:** Claude + Rohit Saji
**Plan status:** Draft
**Upstream:** `../../specs/issues/011-playlist-as-one-material.md`

## TL;DR

When a user pastes a YouTube playlist with many short videos, `expandPlaylistsToMaterials()` explodes it into N separate materials. The engine's "one slot = one material" design wastes 97% of slot capacity on 3-minute videos in 2-hour slots, and most videos never get scheduled. Fix: consolidate each playlist into a single `Material` with `totalMinutes = sum of video durations`. The engine schedules it like a book. The app layer resolves which videos to play per session at render time, using a cursor tracked in `SessionLogged` events. The session page auto-advances through playlist videos with a brief interstitial.

## Context & background

The roadmap engine was designed for 3–5 substantial study materials (books, courses) that fill or exceed slot capacity. It enforces "Decision 1: one slot = one material" — each slot gets exactly one material assignment. This works well for DDIA (600 min) in a 120-min slot (5 sessions), but breaks catastrophically for YouTube playlists:

- A 30-video playlist (each ~3 min) becomes 30 separate `Material` entries via `expandPlaylistsToMaterials()`
- `inferRole` uses `>=`, so all equal-duration videos become `anchor` (the scarcest role: 1 slot/week)
- Only ~8 of 30 videos get scheduled; the rest silently vanish (no warning due to `allocated > 0` guard)
- Each scheduled 3-min video consumes a full 120-min slot

The fix treats each playlist as one material. The engine never knows about individual videos — it schedules "React Tutorial Playlist (90 min)" across slots using its existing partial-slot filling. The session page, which already has `SessionYouTubeLayout` with embedded YouTube player, gains multi-video auto-advance capability.

**Support docs:**

- `../../specs/issues/011-playlist-as-one-material.md` — issue with acceptance criteria
- `design/algo/ROADMAP_ENGINE_GUIDE.md` — engine algorithm decisions
- `.claude/rules/roadmap-engine.md` — engine architecture rule
- `.claude/rules/eventstore-architecture.md` — event schema

## Decisions log

### D-01: Playlist = one material

**Status:** ✅ Agreed

**Context:** The engine treats each material as a separate scheduling unit. The question was whether a 30-video playlist should be 30 materials or 1.

**Decision:** One playlist = one `Material` with `totalMinutes = sum of all selected video durations`.

**Rationale:** A playlist is a single study commitment, like a book. Individual videos are sessions *within* that material, not independent study goals. This maps onto the engine's existing partial-slot filling without any engine changes.

**Alternatives considered:**

- 30 separate materials → rejected: causes the bugs described above
- Grouped materials (new engine concept) → rejected: unnecessary engine complexity

**User pushback / disagreement:** None — user proposed this framing.

**Reversibility:** Easy — change `expandPlaylistsToMaterials()` back.

### D-02: Engine stays ignorant of videos

**Status:** ✅ Agreed

**Context:** Should the engine emit per-video sub-sessions, or should the app layer compute video breakdown?

**Decision:** Engine stays pure. It emits "React Tutorial · 90 min in this slot." The app layer holds the video list and cursor, computing which videos fall in each slot at render time.

**Rationale:** Video-level tracking is runtime state (depends on what user actually watched). The engine is a one-shot planner. Keeping video resolution in the app layer means zero engine changes and the `Material` type stays unchanged.

**Alternatives considered:**

- Engine tracks sub-items → rejected: adds runtime state to a pure function package

**User pushback / disagreement:** None.

**Reversibility:** Easy — engine API unchanged.

### D-03: Video cursor in SessionLogged events

**Status:** ✅ Agreed

**Context:** Where to persist which video the user is up to.

**Decision:** Two locations following existing patterns: `activeSession` table (Dexie singleton) for within-session position (survives tab close), and `SessionLogged` event payload for durable cursor (syncs to Supabase).

**Rationale:** Matches existing architecture exactly. `activeSession` already stores `videoPlaybackPosition`. `SessionLogged` already has `materialId`, `activeMinutes`, etc. No new persistence mechanism needed.

**Alternatives considered:**

- New event type `VideoProgressUpdated` → rejected: unnecessary event proliferation
- New Dexie table for cursor → rejected: cursor derives naturally from session history

**User pushback / disagreement:** User asked "And this is stored in Dexie or Supabase?" — confirmed both via existing sync pipeline.

**Reversibility:** Easy — new fields are additive to existing payloads.

### D-04: Auto-advance with interstitial

**Status:** ✅ Agreed

**Context:** When a 3-minute video ends mid-session, should the next video start automatically?

**Decision:** Auto-advance with 3–5 second interstitial showing "Up next: Video 8 — Merge Sort" with a skip button. Session timer continues throughout.

**Rationale:** Manual "next video" for 24 three-minute videos would be maddening. Auto-advance mirrors YouTube's own playlist behavior.

**Alternatives considered:**

- Manual next → rejected: too many taps for short videos
- Instant advance (no interstitial) → rejected: user needs a beat to process

**User pushback / disagreement:** None.

**Reversibility:** Easy — UI-only change.

### D-05: Roll-forward cursor

**Status:** ✅ Agreed

**Context:** If a user ends a session early (watched videos 7–14 out of planned 7–18), what happens to videos 15–18?

**Decision:** Roll forward. The playlist cursor = "completed through video 14." Next session starts at video 15 regardless of slot boundaries.

**Rationale:** This is how every podcast/audiobook app works. Resetting per-slot would cause re-watches or gaps.

**Alternatives considered:**

- Reset per slot → rejected: causes re-watches

**User pushback / disagreement:** None.

**Reversibility:** Easy — cursor logic is app-layer only.

### D-06: One role per playlist

**Status:** ✅ Agreed

**Context:** What if a playlist mixes content types (lectures + exercises)?

**Decision:** One playlist = one role, chosen at playlist level after confirming videos. No splitting.

**Rationale:** Mixed-content playlists are rare. If a user truly has one, they can paste it twice and curate each copy. Don't build for the edge case.

**Alternatives considered:**

- Per-video roles → rejected: UI complexity, engine doesn't support mixed-role materials
- Playlist splitting UI → rejected: significant state complexity for rare case

**User pushback / disagreement:** None.

**Reversibility:** Moderate — would need new UI for split workflow.

### D-07: Slot merging deferred

**Status:** ✅ Agreed

**Context:** Individual short materials (not playlists) still waste slots. Should we allow merging materials into shared slots?

**Decision:** Deferred to issue #012. The playlist fix is the 80/20. Slot merging requires Roadmap page buildout and its own design pass.

**Alternatives considered:**

- Implement now → rejected: scope creep, different UX questions

**User pushback / disagreement:** None.

**Reversibility:** N/A — future work.

## Architecture overview

```
Onboarding flow (data in):
  Step3Materials → user confirms playlist videos, picks role
  OnboardingProvider.expandPlaylistsToMaterials() → ONE Material per playlist
  Step3Preview → generateRoadmap(input) → engine schedules playlist like a book
  handleCommit → MaterialAdded event (with videos[] array) + RoadmapCreated event

Session flow (data out):
  Home.tsx → "Up Next" card → computes which videos in this slot via cursor
  Session.tsx → SessionYouTubeLayout → auto-advances through playlist videos
  SessionLifecycle.logSession() → SessionLogged event (with videosCompleted)
```

No changes to `@study-tracker/roadmap-engine` package. All changes are in `apps/app/`.

## Files touched (index)

| Path | Change | Phase | Purpose |
|------|--------|-------|---------|
| `apps/app/src/onboarding/OnboardingProvider.tsx` | modify | 1 | Consolidate `expandPlaylistsToMaterials()` — one material per playlist |
| `apps/app/src/sync/types.ts` | modify | 1 | Add `videos` array to `MaterialAddedPayload` |
| `apps/app/src/onboarding/steps/Step3Preview.tsx` | modify | 1 | Update `handleCommit` to emit `videos` in `MaterialAdded` payload |
| `apps/app/src/onboarding/OnboardingProvider.test.ts` | new | 1 | Unit tests for consolidated `expandPlaylistsToMaterials()` |
| `apps/app/src/session/types.ts` | modify | 2 | Add `videos` to `SessionSlotData`, `ActiveSessionRecord`, `SessionLoggedPayload` |
| `apps/app/src/pages/Home.tsx` | modify | 2 | Pass `videos` array when constructing `SessionSlotData` for playlist materials |
| `apps/app/src/session/SessionLifecycle.ts` | modify | 2 | Store `videos` + `currentVideoIndex` in record; emit `videosCompleted` in `SessionLogged` |
| `apps/app/src/session/components/SessionYouTubeLayout.tsx` | modify | 3 | Multi-video playback with auto-advance interstitial |
| `apps/app/src/session/components/YouTubeEmbed.tsx` | modify | 3 | Accept `videoId` changes for auto-advance (re-mount on videoId change already works) |
| `apps/app/src/pages/Session.tsx` | modify | 3 | Wire video advancement state + handlers to `SessionYouTubeLayout` |
| `apps/app/src/pages/Home.tsx` | modify | 4 | Add `computePlaylistCursor` — slice videos from cursor for roll-forward resume |

## Phases

### Phase 1: Consolidate playlist into single material + event payload

**Status:** ☐ Not started
**Depends on:** none — can start immediately
**Estimated scope:** ~3 files modified, ~1 new file, ~80 lines

#### Codebase state assumed at start

- `apps/app/src/onboarding/OnboardingProvider.tsx` exists with `expandPlaylistsToMaterials()` at lines 120–139, which currently returns one `OnboardingMaterial` per selected video in a confirmed playlist
- `apps/app/src/sync/types.ts` exists with `MaterialAddedPayload` at lines 48–57, currently with optional `playlistId` and `youtubeVideoId` fields
- `apps/app/src/onboarding/steps/Step3Preview.tsx` exists with `handleCommit` at lines 154–202, which iterates `expandedMaterials` to emit `MaterialAdded` events

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep -n "expandPlaylistsToMaterials" apps/app/src/onboarding/OnboardingProvider.tsx  # should show function at ~line 120
grep -n "MaterialAddedPayload" apps/app/src/sync/types.ts  # should show interface at ~line 48
pnpm --filter app test -- --run 2>&1 | tail -5  # existing tests should pass
```

If any of these fail, STOP — the codebase isn't in the expected state. Surface to the human.

#### Steps

1. **Add `PlaylistVideoInfo` type and `videos` field to `MaterialAddedPayload` in `apps/app/src/sync/types.ts` (after line 57).** This is the durable schema for playlist video metadata in the event log. Implements D-02 (engine-ignorant; videos live in event payload only).

   ```ts
   export interface PlaylistVideoInfo {
     youtubeVideoId: string
     title: string
     durationMinutes: number
   }

   export interface MaterialAddedPayload {
     materialId: string
     title: string
     estimatedDuration: number
     url?: string
     kind: MaterialKind
     role: 'anchor' | 'foundation' | 'practice'
     playlistId?: string
     youtubeVideoId?: string
     videos?: PlaylistVideoInfo[]
   }
   ```

2. **Rewrite `expandPlaylistsToMaterials()` in `apps/app/src/onboarding/OnboardingProvider.tsx` (lines 120–139).** Instead of returning one `OnboardingMaterial` per video, return one per playlist with aggregated duration. Keep the video list accessible on the material for the commit step. Implements D-01.

   Add a new field to `OnboardingMaterial` interface (line 8–19) for playlist video metadata:

   ```ts
   export interface OnboardingMaterial {
     id: string
     title: string
     estimatedDuration: number
     role: MaterialRole
     url?: string
     additionOrder: number
     userOverrodeType: boolean
     kind: MaterialKind
     fetchStatus: FetchStatus
     playlistId?: string
     youtubeVideoId?: string
     /** Ordered video list when kind === 'youtube' and this material represents a playlist */
     playlistVideos?: Array<{ youtubeVideoId: string; title: string; durationMinutes: number }>
   }
   ```

   Then rewrite the function:

   ```ts
   export function expandPlaylistsToMaterials(playlists: PlaylistEntry[]): OnboardingMaterial[] {
     return playlists
       .filter(p => p.confirmed)
       .map(p => {
         const selectedVideos = p.videos.filter(v => v.selected)
         const totalDuration = selectedVideos.reduce((sum, v) => sum + v.durationMinutes, 0)
         return {
           id: p.id,
           title: p.title,
           estimatedDuration: totalDuration,
           role: p.role,
           url: `https://youtube.com/playlist?list=${p.youtubePlaylistId}`,
           additionOrder: p.additionOrder,
           userOverrodeType: false,
           kind: 'youtube' as const,
           fetchStatus: 'success' as const,
           playlistId: p.id,
           playlistVideos: selectedVideos.map(v => ({
             youtubeVideoId: v.youtubeVideoId,
             title: v.title,
             durationMinutes: v.durationMinutes,
           })),
         }
       })
   }
   ```

3. **Update `handleCommit` in `apps/app/src/onboarding/steps/Step3Preview.tsx` (lines 160–174).** When emitting `MaterialAdded` for a playlist material, include the `videos` array. The existing loop iterates `expandedMaterials`, so each consolidated playlist material emits one event with its video list.

   Replace the `MaterialAdded` payload construction (lines 163–173):

   ```ts
   const payload: MaterialAddedPayload = {
     materialId: mat.id,
     title: mat.title,
     estimatedDuration: mat.estimatedDuration,
     url: mat.url,
     kind: mat.kind ?? 'manual',
     role: mat.role,
     playlistId: mat.playlistId,
     youtubeVideoId: mat.youtubeVideoId,
     videos: mat.playlistVideos?.map(v => ({
       youtubeVideoId: v.youtubeVideoId,
       title: v.title,
       durationMinutes: v.durationMinutes,
     })),
   }
   ```

   Also add the import for `PlaylistVideoInfo` if needed (the `MaterialAddedPayload` import at line 14 already covers it since `videos` is typed inline).

#### Tests

- Create `apps/app/src/onboarding/OnboardingProvider.test.ts`:
  - Test `expandPlaylistsToMaterials` returns one material per confirmed playlist
  - Test `estimatedDuration` equals sum of selected video durations
  - Test `playlistVideos` contains only selected videos in order
  - Test unconfirmed playlists are excluded
  - Test playlist with zero selected videos is excluded (estimatedDuration would be 0, filtered by Step3Preview)
- Run: `pnpm --filter app test -- --run`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run  # all tests pass
pnpm typecheck  # no type errors
pnpm lint  # no lint errors
```

#### Rollback

Revert `expandPlaylistsToMaterials()` to the per-video expansion. Remove `playlistVideos` from `OnboardingMaterial`. Remove `videos` from `MaterialAddedPayload`. No data migration needed — existing events without `videos` field are unaffected.

#### Notes (filled in during implementation)

---

### Phase 2: Wire playlist videos through session start flow + cursor tracking

**Status:** ☐ Not started
**Depends on:** Phase 1
**Estimated scope:** ~3 files modified, ~60 lines

#### Codebase state assumed at start

- `MaterialAddedPayload` in `apps/app/src/sync/types.ts` has optional `videos?: PlaylistVideoInfo[]` field
- `expandPlaylistsToMaterials()` returns one material per playlist with `playlistVideos` array
- `apps/app/src/session/types.ts` has `SessionSlotData` at lines 285–295 with `youtubeVideoId?: string`
- `apps/app/src/session/types.ts` has `ActiveSessionRecord` at lines 215–246 with `youtubeVideoId?: string`
- `apps/app/src/session/types.ts` has `SessionLoggedPayload` at lines 114–155
- `apps/app/src/pages/Home.tsx` constructs `SessionSlotData` at lines 237–249
- `apps/app/src/session/SessionLifecycle.ts` has `start(slotData)` at lines 147–197 and `logSession()` at lines 488–532

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep -n "PlaylistVideoInfo" apps/app/src/sync/types.ts  # should exist from Phase 1
grep -n "playlistVideos" apps/app/src/onboarding/OnboardingProvider.tsx  # should exist from Phase 1
pnpm --filter app test -- --run 2>&1 | tail -5  # should pass
```

If any of these fail, STOP.

#### Steps

1. **Add playlist fields to `SessionSlotData` in `apps/app/src/session/types.ts` (lines 285–295).** Implements D-03.

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
     /** Ordered video list for playlist materials */
     videos?: Array<{ youtubeVideoId: string; title: string; durationMinutes: number }>;
   }
   ```

2. **Add playlist fields to `ActiveSessionRecord` in `apps/app/src/session/types.ts` (lines 215–246).** The active session needs to know the video list and current position for resume.

   Add after `videoPlaybackPosition` (line 245):

   ```ts
   /** Ordered video list for playlist sessions */
   videos?: Array<{ youtubeVideoId: string; title: string; durationMinutes: number }>;
   /** Index into videos[] for currently playing video (0-based) */
   currentVideoIndex?: number;
   ```

3. **Add cursor fields to `SessionLoggedPayload` in `apps/app/src/session/types.ts` (lines 114–155).** Implements D-03 (durable cursor).

   Add after `videoPlayTimeMinutes` (line 136):

   ```ts
   /** Number of playlist videos completed during this session */
   videosCompleted?: number;
   /** Index of last completed video in playlist (0-based). Used to compute cursor across sessions. */
   lastVideoIndex?: number;
   ```

4. **Update Home.tsx to pass `videos` when constructing `SessionSlotData` (lines 237–249).** Read videos from the `MaterialAdded` event payload. Implements D-05 (roll-forward cursor — future phase will compute starting video from prior SessionLogged events; for now, pass the full list).

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
     videos: material?.payload.videos as SessionSlotData['videos'],
   };
   ```

5. **Update `SessionLifecycle.start()` in `apps/app/src/session/SessionLifecycle.ts` (lines 147–197).** Store `videos` and `currentVideoIndex` on the active session record.

   In the `this.record = { ... }` block (lines 155–170), add:

   ```ts
   videos: slotData.videos,
   currentVideoIndex: slotData.videos ? 0 : undefined,
   ```

6. **Update `SessionLifecycle.logSession()` in `apps/app/src/session/SessionLifecycle.ts` (lines 488–532).** Emit `videosCompleted` and `lastVideoIndex` in `SessionLoggedPayload`.

   In the `payload` object (lines 504–522), add:

   ```ts
   videosCompleted: this.record.currentVideoIndex != null ? this.record.currentVideoIndex : undefined,
   lastVideoIndex: this.record.currentVideoIndex != null ? this.record.currentVideoIndex - 1 : undefined,
   ```

   Note: `currentVideoIndex` points to the *next* video to play. So `videosCompleted = currentVideoIndex` (0-based next = count of completed).

7. **Add a public method `advanceVideo()` to `SessionLifecycle` for Phase 3 to call.** Add after the `pause()` method (~line 199):

   ```ts
   advanceVideo(): void {
     if (!this.record || !this.record.videos || this.record.currentVideoIndex == null) return;
     if (this.record.currentVideoIndex < this.record.videos.length - 1) {
       this.record.currentVideoIndex++;
       this.record.videoPlaybackPosition = 0;
       this.persistToDb();
     }
   }

   getCurrentVideo(): { youtubeVideoId: string; title: string; durationMinutes: number } | null {
     if (!this.record?.videos || this.record.currentVideoIndex == null) return null;
     return this.record.videos[this.record.currentVideoIndex] ?? null;
   }

   getVideoProgress(): { current: number; total: number } | null {
     if (!this.record?.videos || this.record.currentVideoIndex == null) return null;
     return { current: this.record.currentVideoIndex, total: this.record.videos.length };
   }

   isPlaylistSession(): boolean {
     return !!(this.record?.videos && this.record.videos.length > 0);
   }
   ```

#### Tests

- Update `apps/app/src/session/SessionLifecycle.test.ts`:
  - Test `start()` stores `videos` and `currentVideoIndex` when `slotData.videos` is provided
  - Test `advanceVideo()` increments `currentVideoIndex` and resets `videoPlaybackPosition`
  - Test `advanceVideo()` does not advance past the last video
  - Test `logSession()` includes `videosCompleted` and `lastVideoIndex` when session has videos
  - Test non-playlist sessions are unaffected (no `videos`, no crash)
- Run: `pnpm --filter app test -- --run`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run  # all tests pass
pnpm typecheck  # no type errors
```

#### Rollback

Remove added fields from types. Remove `advanceVideo()`/`getCurrentVideo()`/`getVideoProgress()`/`isPlaylistSession()` from `SessionLifecycle`. Revert Home.tsx `SessionSlotData` construction.

#### Notes (filled in during implementation)

---

### Phase 3: Multi-video session playback with auto-advance

**Status:** ☐ Not started
**Depends on:** Phase 2
**Estimated scope:** ~3 files modified, ~120 lines

#### Codebase state assumed at start

- `SessionSlotData` and `ActiveSessionRecord` have `videos` and `currentVideoIndex` fields
- `SessionLifecycle` has `advanceVideo()`, `getCurrentVideo()`, `getVideoProgress()`, `isPlaylistSession()` methods
- `SessionYouTubeLayout` at `apps/app/src/session/components/SessionYouTubeLayout.tsx` renders a single `YouTubeEmbed` with `record.youtubeVideoId`
- `YouTubeEmbed` at `apps/app/src/session/components/YouTubeEmbed.tsx` re-mounts when `videoId` changes (key'd by `videoId` in the `useEffect` deps at line 65)
- `Session.tsx` at `apps/app/src/pages/Session.tsx` detects YouTube sessions at line 301: `const isYouTube = record.kind === 'youtube' && record.youtubeVideoId`
- The existing `videoEndedPromptVisible` state (Session.tsx line 50) shows a banner when a video ends

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep -n "advanceVideo" apps/app/src/session/SessionLifecycle.ts  # should exist from Phase 2
grep -n "currentVideoIndex" apps/app/src/session/types.ts  # should exist from Phase 2
pnpm --filter app test -- --run 2>&1 | tail -5  # should pass
```

If any of these fail, STOP.

#### Steps

1. **Update `Session.tsx` to manage video advancement state.** Add state for the interstitial and wire video advancement. Implements D-04.

   Add state variables (after line 51):

   ```ts
   const [interstitialVisible, setInterstitialVisible] = useState(false);
   const [nextVideoTitle, setNextVideoTitle] = useState('');
   ```

   Replace `handlePlayerStateChange` (lines 165–172) to handle playlist auto-advance:

   ```ts
   const handlePlayerStateChange = useCallback((state: YouTubePlayerState) => {
     setPlayerState(state);
     const lc = lcRef.current;
     if (state === 'ended' && lc?.isPlaylistSession()) {
       const progress = lc.getVideoProgress();
       if (progress && progress.current < progress.total - 1) {
         // More videos — show interstitial
         const nextVideo = lc.getRecord()?.videos?.[progress.current + 1];
         setNextVideoTitle(nextVideo?.title ?? 'Next video');
         setInterstitialVisible(true);
         // Auto-advance after 4 seconds
         const timer = setTimeout(() => {
           lc.advanceVideo();
           setInterstitialVisible(false);
           // Force re-render with new video ID
           setSessionState(lc.getState());
         }, 4000);
         return () => clearTimeout(timer);
       } else {
         // Last video or no playlist — show ended prompt
         setVideoEndedPromptVisible(true);
       }
     } else if (state === 'playing') {
       setVideoEndedPromptVisible(false);
       setInterstitialVisible(false);
     }
   }, []);
   ```

   Add a skip-interstitial handler:

   ```ts
   const handleSkipInterstitial = useCallback(() => {
     const lc = lcRef.current;
     if (!lc) return;
     lc.advanceVideo();
     setInterstitialVisible(false);
     setSessionState(lc.getState());
   }, []);
   ```

2. **Update the YouTube session detection in `Session.tsx` (line 301).** For playlist sessions, use the current video's ID instead of `record.youtubeVideoId`.

   ```ts
   const currentVideo = lcRef.current?.getCurrentVideo();
   const activeVideoId = currentVideo?.youtubeVideoId ?? record.youtubeVideoId;
   const isYouTube = record.kind === 'youtube' && activeVideoId;
   ```

   Update the `YouTubeEmbed` render in `SessionYouTubeLayout` to pass the active video ID. This requires passing it as a prop.

3. **Add interstitial + video progress props to `SessionYouTubeLayout`.** Modify `SessionYouTubeLayoutProps` in `apps/app/src/session/components/SessionYouTubeLayout.tsx`:

   Add to the props interface (after line 44):

   ```ts
   activeVideoId?: string;
   videoProgress?: { current: number; total: number } | null;
   interstitialVisible?: boolean;
   nextVideoTitle?: string;
   onSkipInterstitial?: () => void;
   ```

4. **Render interstitial and video progress in `SessionYouTubeLayout`.** 

   Replace the `YouTubeEmbed` usage (lines 152–158) to use `activeVideoId`:

   ```tsx
   {interstitialVisible ? (
     <div className="session-yt-interstitial">
       <div className="session-yt-interstitial-label">Up next</div>
       <div className="session-yt-interstitial-title">{nextVideoTitle}</div>
       <button className="btn btn-ghost btn-sm" onClick={onSkipInterstitial}>
         Skip
       </button>
     </div>
   ) : (
     <YouTubeEmbed
       videoId={activeVideoId ?? record.youtubeVideoId!}
       startSeconds={record.videoPlaybackPosition}
       onStateChange={onPlayerStateChange}
       onReady={onPlayerReady}
       adapterRef={playerAdapterRef}
     />
   )}
   ```

   Add video progress indicator below the embed (after `VideoStatusStrip`):

   ```tsx
   {videoProgress && videoProgress.total > 1 && (
     <div className="session-yt-video-progress">
       Video {videoProgress.current + 1} of {videoProgress.total}
     </div>
   )}
   ```

5. **Wire the new props from `Session.tsx` into `SessionYouTubeLayout`.** In the `<SessionYouTubeLayout>` render (lines 306–333), add:

   ```tsx
   activeVideoId={activeVideoId}
   videoProgress={lcRef.current?.getVideoProgress() ?? null}
   interstitialVisible={interstitialVisible}
   nextVideoTitle={nextVideoTitle}
   onSkipInterstitial={handleSkipInterstitial}
   ```

6. **Add minimal CSS for interstitial.** In `apps/app/src/session/session.css`, add:

   ```css
   .session-yt-interstitial {
     display: flex;
     flex-direction: column;
     align-items: center;
     justify-content: center;
     aspect-ratio: 16 / 9;
     width: 100%;
     background: var(--surface-invert);
     color: var(--text-on-invert);
     border-radius: var(--radius-md);
     gap: var(--space-2);
   }

   .session-yt-interstitial-label {
     font-size: var(--text-sm);
     text-transform: uppercase;
     letter-spacing: 0.05em;
     opacity: 0.7;
   }

   .session-yt-interstitial-title {
     font-size: var(--text-lg);
     font-weight: 600;
     text-align: center;
     padding: 0 var(--space-4);
   }

   .session-yt-video-progress {
     text-align: center;
     font-size: var(--text-sm);
     color: var(--text-secondary);
     margin-top: var(--space-2);
   }
   ```

#### Tests

- Add test in `apps/app/src/session/components/SessionYouTubeLayout.test.tsx`:
  - Test that video progress indicator renders when `videoProgress.total > 1`
  - Test that interstitial renders when `interstitialVisible` is true
  - Test that interstitial does not render when `interstitialVisible` is false
- Run: `pnpm --filter app test -- --run`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run  # all tests pass
pnpm typecheck  # no type errors
pnpm lint  # no lint errors
pnpm dev:app  # start dev server, manually test with a playlist
```

Manual verification: paste a YouTube playlist during onboarding, confirm videos, verify the roadmap preview shows one material (not N). Start a session — video should play, and when it ends, the interstitial should appear for 4 seconds before auto-advancing to the next video.

#### Rollback

Revert `Session.tsx` state management changes. Revert `SessionYouTubeLayout` props and rendering. Remove interstitial CSS. The session falls back to single-video behavior.

#### Notes (filled in during implementation)

---

### Phase 4: Roll-forward video cursor for playlist sessions

**Status:** ☐ Not started
**Depends on:** Phase 2
**Estimated scope:** ~1 file modified, ~30 lines

#### Codebase state assumed at start

- `SessionLoggedPayload` has `videosCompleted?: number` and `lastVideoIndex?: number` fields
- `SessionSlotData` has `videos?: Array<{ youtubeVideoId: string; title: string; durationMinutes: number }>` field
- `apps/app/src/pages/Home.tsx` constructs `SessionSlotData` at lines 237–249, passing `videos` from `MaterialAdded` event payload
- `apps/app/src/events/EventStore.ts` has `getAll()` returning all events

#### Verification (run BEFORE starting to confirm prereqs are met)

```bash
grep -n "videosCompleted" apps/app/src/session/types.ts  # should exist from Phase 2
grep -n "videos:" apps/app/src/pages/Home.tsx  # should exist from Phase 2
pnpm --filter app test -- --run 2>&1 | tail -5  # should pass
```

If any of these fail, STOP.

#### Steps

1. **Add a `computePlaylistCursor` helper in `apps/app/src/pages/Home.tsx`.** This reads all `SessionLogged` events for a given `materialId` and sums `videosCompleted` to determine the starting video index for the next session. Implements D-05 (roll-forward cursor).

   Add before the `Home` component:

   ```ts
   function computePlaylistCursor(
     events: Array<{ kind: string; payload: Record<string, unknown> }>,
     materialId: string,
   ): number {
     return events
       .filter(e => e.kind === 'SessionLogged' && e.payload.materialId === materialId)
       .reduce((sum, e) => sum + ((e.payload.videosCompleted as number) ?? 0), 0);
   }
   ```

2. **Use the cursor when constructing `SessionSlotData` in Home.tsx.** After building the `videos` array from the `MaterialAdded` event, slice it from the cursor position. This way, `SessionLifecycle.start()` receives only the remaining videos and `currentVideoIndex` starts at 0.

   Update the `SessionSlotData` construction (where `videos` is passed):

   ```ts
   const allVideos = material?.payload.videos as SessionSlotData['videos'];
   const cursor = allVideos
     ? computePlaylistCursor(events, upNextSlot.candidateMaterialIds[0])
     : 0;
   const remainingVideos = allVideos ? allVideos.slice(cursor) : undefined;

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
     videos: remainingVideos,
   };
   ```

#### Tests

- Add test for `computePlaylistCursor`:
  - Returns 0 when no SessionLogged events exist for the material
  - Returns sum of `videosCompleted` across multiple sessions
  - Ignores SessionLogged events for other materials
  - Ignores events without `videosCompleted` (manual logs)
- Run: `pnpm --filter app test -- --run`

#### Verification (DONE — run after implementation)

```bash
pnpm --filter app test -- --run  # all tests pass
pnpm typecheck  # no type errors
```

#### Rollback

Remove `computePlaylistCursor` and revert to passing full `videos` array without slicing.

#### Notes (filled in during implementation)

---

## Out of scope

- **Slot merging for individual short materials** — deferred to issue #012. Requires Roadmap page buildout and separate design pass.
- **Per-video role assignment within a playlist** — user picks one role per playlist (D-06).
- **Roadmap engine changes** — engine stays ignorant of videos (D-02). All changes are app-layer.
- **Playlist splitting by content type** — user can paste twice and curate if needed (D-06).

## References

- `../../specs/issues/011-playlist-as-one-material.md` — full issue with acceptance criteria
- `../../specs/issues/012-slot-merge-drag-drop.md` — deferred follow-up issue
- `design/algo/ROADMAP_ENGINE_GUIDE.md` — roadmap engine algorithm decisions (16 design decisions + Q21 redesign)
- `.claude/rules/roadmap-engine.md` — engine architecture summary
- `.claude/rules/eventstore-architecture.md` — Dexie schema (v3), event shape
- `.claude/rules/sync-architecture.md` — write-ahead queue, snapshot/restore flow
- `packages/roadmap-engine/src/roadmap-engine.ts` — engine source (no changes needed)
- `apps/app/src/session/SessionLifecycle.ts` — session state machine
