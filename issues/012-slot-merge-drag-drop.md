# Support merging individual short materials into shared slots via drag-and-drop on Roadmap page

**Labels:** enhancement  
**Type:** HITL (needs design pass for merge UX)

## What to build

Individual short materials (e.g., 10 separate 5-min YouTube videos added manually) still hit the "one slot = one material" limitation — each wastes most of a 2-hour slot. The playlist fix (issue #011) doesn't cover this case because individually-added materials are separate intentionally.

On the Roadmap page (currently a stub), allow users to drag an individual material into an already-occupied slot to **merge** them. This creates a composite slot with multiple materials scheduled back-to-back within the same time block. This is fundamentally different from the current swap-only drag-drop in onboarding preview, which exchanges slot contents bidirectionally via `computeSwapEdits`.

### Open design questions

- What happens to the merged material's original slot? (becomes rest day? redistributed?)
- How does the user split a merged slot back apart?
- How does the session page handle a composite slot with materials of different kinds (e.g., a video + a book chapter)?
- Should composite slots have a maximum material count?
- How do composite slots interact with `regenerateRoadmap` and pins?

### Potential approach

- Leverage the currently-unused `addMaterialToRoadmap` / `removeMaterialFromRoadmap` APIs from the roadmap engine
- Extend the `Slot` type to support multiple `candidateMaterialIds` with resolved (non-tie) semantics
- Build merge UX on the Roadmap page rather than the onboarding preview (which is already complex)

## Acceptance criteria

- [ ] User can drag a material from one slot into another occupied slot on the Roadmap page
- [ ] Merged slot shows all materials with their individual durations within the slot's capacity
- [ ] Session page handles composite slots (plays/tracks each material sequentially)
- [ ] User can undo a merge (split materials back to separate slots)
- [ ] Engine's `addMaterialToRoadmap` / `removeMaterialFromRoadmap` APIs are used or extended

## Blocked by

- Blocked by #011 (playlist-as-one-material fix)
- Blocked by Roadmap page buildout (currently a stub returning "Coming soon")
