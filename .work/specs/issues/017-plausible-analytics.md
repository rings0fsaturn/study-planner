---
title: Plausible Analytics on marketing site and app
type: AFK
blocked_by: [1b]
covers_user_stories: []
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

Wire Plausible Analytics into both surfaces. The marketing Astro site loads the Plausible script for pageview tracking. The React app loads Plausible and emits custom events at key call sites: `session_logged`, `roadmap_created`, `replan_chosen`, `onboarding_completed`. Plausible's cookieless model means no consent banner is needed.

This is operational telemetry to validate the user journey assumptions in the PRD — not user-facing functionality — so it covers no specific user story but earns its place by making every later product decision data-informed.

## Acceptance criteria

- [ ] Plausible script is loaded on every marketing page at apex
- [ ] Plausible script is loaded once at app shell mount on `/study/*`
- [ ] Custom event `onboarding_completed` is emitted when `OnboardingCompleted` is appended (slice 4)
- [ ] Custom event `roadmap_created` is emitted when `RoadmapCreated` is appended (slice 4)
- [ ] Custom event `session_logged` is emitted when `SessionLogged` is appended (slice 2 and onward)
- [ ] Custom event `replan_chosen` is emitted when `RoadmapReplanned` is appended, with the chosen-option as a property (slice 10)
- [ ] No cookie consent banner is added (Plausible is cookieless)
- [ ] No PII is included in any event payload (no email, no user IDs, no material titles)
- [ ] Tests assert events are emitted at the correct call sites using a Plausible client fake
- [ ] Documentation in `TELEMETRY.md` lists every event, its trigger, and its properties

## Blocked by

- Blocked by #1b

## Note on dependencies

This slice depends on #1b for the app surface to exist, but the individual event call sites land naturally as part of slices #2, #4, and #10 — this issue captures the cross-cutting wiring (script load, client setup, documentation, tests) and the bookkeeping for the event call sites. If picked up before slices #4 and #10 are merged, the slices that aren't yet present can be marked as future-call-sites in `TELEMETRY.md` and added when those slices land.
