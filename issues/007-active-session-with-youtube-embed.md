---
title: Active session with YouTube embed and article new-tab fallback
type: AFK
blocked_by: [5, 6]
covers_user_stories: [17, 18, 22, 23]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

`/study/session` learns to render different surfaces depending on the material's `kind`. YouTube materials embed the video using the YouTube IFrame Player API directly inside the session screen, with the timer panel above the embed. Article materials open in a new tab with a "come back here when you're done" banner remaining on the session tab. Manual materials with a URL keep the "Open material" affordance from slice 5; manual materials without a URL stay text-only.

Desktop layout puts the YouTube embed centered at ~880px wide with a fixed bottom-right End affordance so it doesn't disappear below the fold during long videos. On resume of an interrupted YouTube session, a hint explains that the embed re-loads from zero and to scrub forward.

## Acceptance criteria

- [ ] Starting a session for a YouTube material renders the YouTube IFrame Player embed inside `/study/session`
- [ ] The timer panel sits above the embed; the End affordance is fixed bottom-right on desktop and remains reachable on mobile
- [ ] Desktop embed width is approximately 880px and centered
- [ ] Starting a session for an article material opens the article URL in a new tab and shows a "come back here when you're done" banner on the session tab
- [ ] Starting a session for a manual material with a URL shows the "Open material" button (from slice 5)
- [ ] Starting a session for a manual material without a URL renders the text-only session view (from slice 5)
- [ ] On resume of an interrupted YouTube session, the embed re-loads and a hint explains scrubbing forward
- [ ] Tests cover: per-kind branching at session start, layout assertions per kind, resume hint for YouTube
- [ ] An end-to-end test covers starting and ending a session for each kind (YouTube, article, manual-with-URL, manual)

## Blocked by

- Blocked by #5
- Blocked by #6
