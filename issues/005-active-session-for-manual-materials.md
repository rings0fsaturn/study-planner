---
title: Active session for manual-entry materials with walk-away and stale handling
type: AFK
blocked_by: [4]
covers_user_stories: [16, 19, 20, 21, 25, 26, 27, 28, 56, 57]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

A user with a roadmap can start a study session for a manual-entry material. `/study/session` shows the planned end time, a ticking timer, and an End button. On End, a `SessionLogged` event is appended. If the planned end passes and the user hasn't ended, a walk-away dialog appears 10 minutes after the planned end. If the tab is closed and reopened mid-session, the session resumes silently if under 5 minutes have passed, otherwise via a "you have an active session — keep it or end it?" dialog. Sessions older than 6 hours or crossing past midnight are auto-abandoned with a dismissible Home notice.

Manual materials with an associated URL get an "Open material" affordance that opens in a new tab. Live durability hooks (`visibilitychange`, `pagehide`) persist active session state on every transition so recovery is reliable.

## Acceptance criteria

- [ ] A user can start a session for any material in their roadmap from `/study/session`
- [ ] `/study/session` shows the planned end time and a ticking timer
- [ ] Tapping End appends a `SessionLogged` event with actual duration
- [ ] If planned end passes without End being tapped, a walk-away dialog appears 10 minutes later asking the user whether they're still studying
- [ ] Closing and reopening the tab within 5 minutes resumes the session silently
- [ ] Closing and reopening the tab after 5 minutes shows a recovery dialog: "Keep going" or "End now"
- [ ] An active session that is 6+ hours old, or whose start date is before the current calendar date, is automatically abandoned
- [ ] Abandoned sessions surface as a dismissible notice on `/study/home`
- [ ] Manual-entry materials with a URL show an "Open material" button that opens the URL in a new tab
- [ ] DurabilityHooks persist active session state on `visibilitychange` and `pagehide`
- [ ] SessionLifecycle has unit tests for: state transitions (start → tick → end), walk-away timing, recovery dialog thresholds, stale abandonment, durability persistence
- [ ] An end-to-end test covers: start session → tick past planned end → walk-away dialog → end → see logged session on Home

## Blocked by

- Blocked by #4
