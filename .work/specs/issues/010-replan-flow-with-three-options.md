---
title: Re-plan flow with three options, slot-pin awareness, and richer scope picker
type: AFK
blocked_by: [9]
covers_user_stories: [30, 31, 32, 71, 72]
---

## Parent

PRD: `PRD-study-tracker-web.md`

> **Update 2026-06-26 — the regenerate seam now exists (built + Cowork-verified in roadmap-calendar Phase 7, commit `84abbd2`).** Per plan decision D-12, replan **routes to the Python intelligence service**, not the in-browser TS engine. This slice should build the `/replan` UI on top of the existing seam rather than re-deriving it:
> - `apps/app/src/roadmap/replan/replanRoadmap.ts` — typed boundary `replanRoadmap(events, opts): Promise<RoadmapOutput>` (default transport = Python; opt-in TS `offlineReplan` fallback behind the same signature).
> - `apps/app/src/roadmap/replan/mapToRegenerateRequest.ts` — pure mapper to the Python `RoadmapRegenerateRequest` shape (`materials[{id,title,totalMinutes,role,additionOrder}]`, capacity fields, `pins[]` with `reason ∈ {completed,today,user-edited}`).
> - `apps/app/src/lib/intelligenceClient.ts::postRoadmapRegenerate` — POST `/v1/roadmap/regenerate` (mirrors `postCalibration`: auth, timeout, retry, typed errors).
> - `/replan` route is **reserved as a stub** in `App.tsx` (under `ProtectedRoute + RequireOnboarding`); this slice replaces the stub with the real flow.
>
> So "ReplanEngine" below = compose option deltas (new deadline / hours / material set) + pin set, then call `replanRoadmap(...)` per option. The pin categories below are already represented in `mapToRegenerateRequest` (completed/today; `user-edited` reserved pending the Edit feature, D-11). **Open dependency:** OQ-03 (Intelligence Service deploy + auth + CORS for production) must be resolved for replan to work outside local dev.

## What to build

When the projection drifts past the deadline, the user can re-plan. `/study/replan` presents three options side-by-side on desktop (stacked on mobile): extend the deadline, increase weekly hours, or trim scope. Trim-scope opens a two-column to-cut/to-keep picker so the user can drag materials between buckets and see the impact on the projection.

A pure `ReplanEngine` module computes each option's projected outcome from the current EventStore state. ReplanEngine **delegates the actual plan generation to `RoadmapEngine` (slice 4a)** — its job is to compute the deltas (new deadline, new hours, new material set) and call `RoadmapEngine.regenerate()` for each option to get the projected outcome. Choosing an option emits a `RoadmapReplanned` event capturing which option was chosen and the resulting roadmap. Subsequent ProgressEngine derivations operate against the new roadmap.

**Slot-pin awareness (resolves Open Q1 from the algorithm grilling):** when re-plan regenerates the roadmap, it must respect three categories of pinned slots:

1. **Completed slots** — sessions already logged. Immutable. Never touched.
2. **Today's slots** — already in progress or imminent. Immutable for today; re-plan only affects future days.
3. **User-edited slots** — slots the user has manually renamed, retagged, or resolved (via `RoadmapEdited` events). Preserved verbatim across re-plan.

Future, unedited, algorithm-generated slots are fair game. The `ReplanEngine` passes the pin set into `RoadmapEngine.regenerate(input, pins)` and the engine treats pinned slots as fixed scaffolding to plan around.

**Onboarding-time fallback also lives here (Decision 13):** slice 4 ships a "dumb" three-button modal that routes back to onboarding step 1/2/3 when over-capacity is detected at preview time. **Slice 10 upgrades this to the live-recompute version** with full deadline/hours/scope cards. The onboarding-time over-capacity fallback should detect when slice 10's component is available and use it; otherwise fall back to the dumb buttons. (Implementation: feature-detect at runtime via component registry, not a build flag.)

## Acceptance criteria

- [ ] `/study/replan` shows three side-by-side option cards on desktop, stacked on mobile: extend deadline, increase weekly hours, trim scope
- [ ] Each option card shows the projected outcome (new finish date or required pace) computed by ReplanEngine
- [ ] Selecting "trim scope" opens a two-column to-cut / to-keep picker with materials draggable between columns
- [ ] As the user moves materials, the projected outcome updates live
- [ ] Confirming an option emits a `RoadmapReplanned` event with option-chosen and resulting-roadmap
- [ ] **The Python regenerate response is validated at runtime before use** (replace the current unchecked `as RoadmapOutput` cast in `replanRoadmap.ts::parseRoadmapOutput` with a real shape check; reject/handle a malformed response rather than committing a bad `RoadmapReplanned`) — follow-up flagged in roadmap-calendar Phase 7 verification
- [ ] After replanning, `/study/home` reflects the new roadmap (projection, burn-up, "Up next")
- [ ] **Re-plan respects all three pin categories: completed slots are immutable, today's slots are immutable, user-edited slots are preserved verbatim**
- [ ] **Re-plan regenerates only future, unedited, algorithm-generated slots**
- [ ] **A pinned slot count is visible in the re-plan UI ("12 sessions locked, 14 will be re-planned")** so the user understands what will change
- [ ] **The same component is reused at onboarding preview time** when over-capacity is detected — same three options, same live recompute, but anchored to the pre-commit context (no `RoadmapReplanned` event yet, just `RoadmapCreated` with new inputs)
- [ ] ReplanEngine tests cover: each option across varied roadmap shapes (empty, partially complete, near-deadline, post-deadline)
- [ ] **ReplanEngine tests cover: pin preservation (verify pinned slots unchanged across all three options), pin invalidation (verify removed materials' pins are dropped), pin overflow (verify warning when pins alone exceed new capacity)**
- [ ] Tests cover: trim-scope picker drag-and-drop semantics, projection recomputation on material move
- [ ] An end-to-end test covers: trigger replan → choose each option in turn → verify Home updates and pinned slots are preserved

## New user stories covered

- **User story 71:** As a user re-planning my roadmap, I want my completed sessions and the slots I've edited to be preserved exactly, so that re-planning never feels like it's destroying my progress or my own decisions.
- **User story 72:** As a user trimming scope during re-plan, I want to see the projected new finish date update live as I move materials between cut and keep, so that I can find a combination I'm comfortable with before committing.

## Blocked by

- Blocked by #9
- Soft dependency on #4a (RoadmapEngine) — slice 10's ReplanEngine wraps it
