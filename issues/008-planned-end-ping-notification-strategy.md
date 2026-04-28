---
title: Planned-end ping via tab title flash, favicon dot, and in-app banner
type: AFK
blocked_by: [5]
covers_user_stories: [22, 23]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

When an active session reaches its planned end time, the user should know — even if the tab is in the background. v1 delivers this without Web Push: a `NotificationStrategy` module schedules a planned-end signal that flashes the tab title, places a dot on the favicon, and shows an in-app banner if the tab is visible. The strategy module is abstracted so v1.1 can swap in Web Push without touching call sites.

The tab-title flash auto-restores after 60 seconds so it doesn't permanently mangle the title. The favicon dot persists until the user acknowledges (ends the session or dismisses). On a tab regaining focus after the planned end has passed, the in-app banner appears.

`visibilitychange` triggers a recompute so a session that crosses planned-end while the tab was hidden still flashes correctly when the tab comes back.

## Acceptance criteria

- [ ] A `NotificationStrategy` module abstracts planned-end delivery so v1.1 can swap to Web Push without changing call sites in SessionLifecycle
- [ ] At session start, a planned-end ping is scheduled via `setTimeout`
- [ ] At planned end, if the tab is hidden, the tab title flashes (alternates with an attention-getting variant)
- [ ] At planned end, if the tab is hidden, a dot is overlaid on the favicon
- [ ] The tab title flash auto-restores to its original value after 60 seconds
- [ ] The favicon dot persists until the session ends or the user explicitly dismisses
- [ ] At planned end, if the tab is visible, an in-app banner appears
- [ ] On `visibilitychange` to visible after planned end has passed, the in-app banner appears
- [ ] NotificationStrategy has tests for: visible-at-planned-end, hidden-at-planned-end, hidden-then-revisible, title-restore-timer, favicon-dot-lifecycle
- [ ] An end-to-end test covers: start session → background tab → wait past planned end → return to tab → see banner

## Blocked by

- Blocked by #5
