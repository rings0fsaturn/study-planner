---
title: Re-plan flow with three options
type: AFK
blocked_by: [9]
covers_user_stories: [30, 31, 32]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

When the projection drifts past the deadline, the user can re-plan. `/study/replan` presents three options side-by-side on desktop (stacked on mobile): extend the deadline, increase weekly hours, or trim scope. Trim-scope opens a two-column to-cut/to-keep picker so the user can drag materials between buckets and see the impact on the projection.

A pure `ReplanEngine` module computes each option's projected outcome from the current EventStore state. Choosing an option emits a `RoadmapReplanned` event capturing which option was chosen and the resulting roadmap. Subsequent ProgressEngine derivations operate against the new roadmap.

## Acceptance criteria

- [ ] `/study/replan` shows three side-by-side option cards on desktop, stacked on mobile: extend deadline, increase weekly hours, trim scope
- [ ] Each option card shows the projected outcome (new finish date or required pace) computed by ReplanEngine
- [ ] Selecting "trim scope" opens a two-column to-cut / to-keep picker with materials draggable between columns
- [ ] As the user moves materials, the projected outcome updates live
- [ ] Confirming an option emits a `RoadmapReplanned` event with option-chosen and resulting-roadmap
- [ ] After replanning, `/study/home` reflects the new roadmap (projection, burn-up, "Up next")
- [ ] ReplanEngine tests cover: each option across varied roadmap shapes (empty, partially complete, near-deadline, post-deadline)
- [ ] Tests cover: trim-scope picker drag-and-drop semantics, projection recomputation on material move
- [ ] An end-to-end test covers: trigger replan → choose each option in turn → verify Home updates

## Blocked by

- Blocked by #9
