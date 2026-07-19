---
name: onboarding-flow
description: Preserve guarded, re-entrant onboarding and the event contracts created by plan confirmation.
---

# Onboarding Flow

Keep onboarding state and draft persistence inside `apps/app/src/onboarding/`.
Use the existing gate components to prevent unauthenticated access and invalid step skipping.
Preserve `?new=1` and router state across the re-entrant new-roadmap flow.

Use the roadmap engine to derive booking previews and capacity checks.
Do not reimplement booking allocation in React components.
Keep new roadmap payloads on the no-slot model and preserve readers for legacy slot-bearing events.

Treat the confirmation event order as a contract.
Create valid materials, the roadmap, its `SessionBooked` events, and the first-time onboarding completion marker through the existing sync boundary.
Clear the draft only after the event commit succeeds.

Do not create a second active roadmap for an overlapping period without going through the lifecycle rules already enforced by the flow.
Cover first-time onboarding, re-entrant onboarding, over-capacity blocking, refresh restoration, and event order when this flow changes.
