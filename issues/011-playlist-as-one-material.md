# Fix roadmap engine handling of YouTube playlists — treat playlist as one material

**Labels:** bug, enhancement

## What to build

When a user pastes a YouTube playlist with many short videos (e.g., 30 × 3-min videos), `expandPlaylistsToMaterials()` explodes it into 30 separate `Material` entries. The roadmap engine's "one slot = one material" design means each 3-min video consumes an entire 2-hour slot (wasting 97.5% of capacity), most videos never get scheduled (only ~8 role-tagged slots available for 30 materials), and `inferRole`'s `>=` check assigns all equal-duration videos the `anchor` role — concentrating them in the scarcest slot type. Unscheduled materials produce no warning due to the `allocated > 0` guard on underfill warnings.

**Fix:** Treat a confirmed playlist as **one material** with `totalMinutes = sum of video durations`. The engine schedules it like any other material (partial-slot filling across multiple sessions). The app layer resolves which videos fall in each slot at render time, using a cursor tracked in `SessionLogged` events.

### Key decisions (from grilling session)

| Decision | Resolution |
|---|---|
| Playlist granularity | One playlist = one `Material` (not N separate materials) |
| Video order | Scheduled in playlist order; user can reorder/remove before confirming |
| Engine awareness | Engine stays ignorant of individual videos — app layer computes per-slot video breakdown |
| Video cursor | Persisted in `SessionLogged` event payload; syncs via existing Dexie → Supabase flow |
| Inter-video UX | Auto-advance with 3–5s interstitial ("Up next: Video 8 — Merge Sort") |
| Role selection | One role per playlist, chosen at playlist level after confirming videos |
| Resume behavior | Roll-forward cursor — next session picks up where user left off |
| Split playlists by role | Not supported; user can paste twice and curate if needed |

### Changes required

1. **`expandPlaylistsToMaterials()`** (`OnboardingProvider.tsx`) — return one material per playlist with `totalMinutes = sum`, instead of N materials
2. **`MaterialAdded` event payload** (`sync/types.ts`) — add `videos: Array<{ title, durationMinutes, youtubeVideoId }>` field when `kind === 'youtube-playlist'`
3. **`SessionSlotData`** (`session/types.ts`) — add `videos` array so session page knows which videos to play
4. **`SessionYouTubeLayout`** — support multi-video playback with auto-advance and interstitial between videos
5. **`SessionLogged` event payload** — add `lastVideoIndex` / `videosCompleted` for cursor tracking
6. **Home.tsx "Up Next"** — compute which videos fall in the current slot based on cursor from prior `SessionLogged` events

### Files involved

- `apps/app/src/onboarding/OnboardingProvider.tsx` — `expandPlaylistsToMaterials()`
- `apps/app/src/onboarding/steps/Step3Preview.tsx` — roadmap input construction
- `apps/app/src/sync/types.ts` — `MaterialAddedPayload`, `RoadmapCreatedPayload`
- `apps/app/src/session/types.ts` — `SessionSlotData`
- `apps/app/src/pages/Session.tsx` — session layout selection
- `apps/app/src/session/SessionYouTubeLayout.tsx` (or equivalent) — multi-video playback
- `apps/app/src/pages/Home.tsx` — Up Next slot + video resolution

## Acceptance criteria

- [ ] A confirmed playlist with 30 videos is passed to the roadmap engine as **one** `Material` with `totalMinutes` equal to the sum of all video durations
- [ ] The roadmap engine schedules the playlist across multiple slots via partial-slot filling (e.g., a 900-min playlist across ~8 × 120-min slots)
- [ ] `MaterialAdded` event payload includes `videos` array with title, duration, and YouTube video ID for each video
- [ ] Session page auto-advances through playlist videos with a 3–5s interstitial between videos
- [ ] `SessionLogged` event includes `videosCompleted` field tracking how many videos were watched
- [ ] "Up Next" on Home page shows which videos the user will watch in the next session (computed from cursor)
- [ ] If user ends session early, next session picks up at the correct video (roll-forward cursor)
- [ ] Existing non-playlist materials (books, articles, single videos) are unaffected
- [ ] Unit tests cover: playlist consolidation, cursor computation, multi-video session logging

## Blocked by

None — can start immediately
