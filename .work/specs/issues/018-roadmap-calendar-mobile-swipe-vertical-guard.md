---
title: Roadmap calendar — guard mobile month-swipe against vertical scroll intent
type: AFK
blocked_by: []
covers_user_stories: []
---

## Parent

PRD: `PRD-study-tracker-web.md` · Plan: `.work/plans/active/2026-06-26-roadmap-calendar/PLAN.md` (Phase 5) · Found in review: `VERIFICATION.md` Phase 5 reviewer findings (2026-06-26).

## What to build

The roadmap calendar's mobile month-swipe (added in roadmap-calendar Phase 5, commit `3967553`) decides to page the month from the horizontal touch delta alone. `handleTouchStart` records only `clientX`; `handleTouchEnd` triggers a month change when `Math.abs(deltaX) >= 48`, without comparing horizontal vs vertical movement. As a result a mostly-vertical scroll that happens to drift >48px horizontally can spuriously change the month.

Fix: capture `clientY` on touch start and require horizontal dominance before paging — only change month when `Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY)`. Keep the existing clamp + slide behavior (Phase 3) unchanged.

Touch point: `apps/app/src/roadmap/RoadmapCalendar.tsx` (`handleTouchStart` / `handleTouchEnd`).

## Acceptance criteria

- [ ] `handleTouchStart` records both `clientX` and `clientY`.
- [ ] A month change fires only when `|deltaX| >= 48` **and** `|deltaX| > |deltaY|`.
- [ ] A predominantly vertical swipe (e.g. `deltaY` 120px, `deltaX` 60px) does **not** change the month.
- [ ] A predominantly horizontal swipe still pages and reuses the existing clamp + slide direction.
- [ ] The mobile-viewport walkthrough step `14-mobile-month-change` is updated/extended to cover the vertical-swipe negative case (written only — not run, per the repo E2E constraint).
- [ ] `pnpm --filter app test` + `pnpm --filter app typecheck` pass (run in a `node >=20` env).

## Notes

Low severity — a robustness fix, not a correctness failure of the shipped feature. Surfaced by the Phase 5 verification pass.
