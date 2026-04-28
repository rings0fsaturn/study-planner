---
title: Log a past session manually; see it on Home; account-switch wipes local
type: AFK
blocked_by: [1b]
covers_user_stories: [14, 15, 24, 29, 47]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

The first feature loop. A signed-in user can navigate to `/study/log`, fill in a past session (duration, date, what they studied), submit it, and immediately see it appear in a "recent activity" list on `/study/home`. Sessions persist locally in IndexedDB via Dexie and survive a refresh.

This slice also introduces account-switch local-wipe: signing out and signing in as a different user wipes the previous user's local store. Without an EventStore there's nothing to wipe, which is why this rides with slice 2 rather than slice 1.

ProgressEngine is stubbed at this slice — Home shows total minutes logged and the activity list, nothing more. Streaks, projections, and burn-up come in slice 9.

## Acceptance criteria

- [ ] A signed-in user can open `/study/log` and submit a past session with duration, date, and a free-text "what" field
- [ ] On submit, a `SessionLogged` event is appended to the local Dexie EventStore
- [ ] `/study/home` shows a "recent activity" list driven by a Dexie liveQuery against the EventStore
- [ ] A newly logged session appears in the activity list without a manual refresh
- [ ] Logged sessions survive a browser refresh
- [ ] `/study/home` shows total time logged (sum of session durations) — minimal ProgressEngine stub
- [ ] Signing out and signing in as a different user wipes the local EventStore: the previous user's sessions are not visible to the new user
- [ ] EventStore has tests for: append + replay round-trip, liveQuery emission on append, account-switch wipe
- [ ] ProgressEngine stub has a test for total-time aggregation
- [ ] An end-to-end test covers: sign in → log session → see it on Home → refresh → still there → sign out → sign in as different user → not visible

## Blocked by

- Blocked by #1b
