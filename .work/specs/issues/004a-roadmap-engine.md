---
title: RoadmapEngine — pure module that generates a slot-based study plan from materials, weeks, and study-day inputs
type: AFK
blocked_by: [1a]
covers_user_stories: [67, 68, 69]
---

## Parent

PRD: `PRD-study-tracker-web.md`
Algorithm grilling output: `ROADMAP_ENGINE_GUIDE.md`

## What to build

A **pure, side-effect-free TypeScript module** that takes a study plan's inputs (materials, weeks, hours, selected days) and returns a fully-structured roadmap output (weeks, slots, candidate material assignments, warnings).

This module is **algorithmic**, not UI. It has no React, no Dexie, no event-store, no dates-as-Date-objects (only ISO strings or week indices). It is callable identically from:

- **Slice 4** (onboarding preview) — initial roadmap generation
- **Slice 10** (re-plan flow) — re-generation with pinned slots
- **Slice 11** (weekly progress, indirectly via ProgressEngine) — comparing plan vs. actuals

Splitting it out as its own slice means one engineer can grab the engine while another grabs the slice 4 UI; they integrate via a fixed contract.

### Public API

```ts
// Main generation
function generateRoadmap(input: RoadmapInput): RoadmapOutput

// Post-commit: append a new material into an existing roadmap (rest-days only)
function addMaterialToRoadmap(
  roadmap: RoadmapOutput,
  newMaterial: Material,
  pins: PinSet,
): RoadmapOutput

// Post-commit: remove a material's future slots (turn them into rest days)
function removeMaterialFromRoadmap(
  roadmap: RoadmapOutput,
  materialId: string,
  pins: PinSet,
): RoadmapOutput

// Re-plan: regenerate honoring pinned slots
function regenerateRoadmap(
  input: RoadmapInput,
  pins: PinSet,
): RoadmapOutput

// Inference helper used by slice 4's onboarding form
function inferRole(
  title: string,
  estimatedMinutes: number,
  existingMaterials: Material[],
): MaterialRole
```

### Key contracts (full types in `roadmap-engine.ts`)

```ts
type MaterialRole = 'anchor' | 'foundation' | 'practice'

interface Material {
  id: string
  title: string
  totalMinutes: number
  role: MaterialRole
  additionOrder: number  // index from MaterialAdded event order; tiebreaker
}

interface RoadmapInput {
  materials: Material[]
  weeks: number              // N
  startDate: string          // ISO date — week 1 begins this date
  selectedStudyDays: DayOfWeek[]  // e.g. ['Mon', 'Wed', 'Sat']
  weekdayHours: number       // total weekday hours per week
  weekendHours: number       // total weekend hours per week
}

interface Slot {
  weekIndex: number
  dayOfWeek: DayOfWeek
  date: string              // ISO date
  capacityMinutes: number
  role: MaterialRole | null  // null = rest day
  candidateMaterialIds: string[]  // 0=rest, 1=resolved, 2+=user picks
  plannedMinutes: number     // = capacityMinutes if assigned, 0 if rest
  sessionTitle: string | null  // default "{Material.title} · session N of M", null if rest
}

interface RoadmapOutput {
  weeks: Array<{ weekIndex: number; startDate: string; slots: Slot[] }>
  warnings: Warning[]
  capacityCheck: {
    totalCapacityMinutes: number
    totalMaterialMinutes: number
    status: 'fits' | 'over-capacity' | 'under-capacity-buffer'
  }
}
```

### Algorithmic invariants the engine guarantees

- **Determinism:** `generateRoadmap(x)` returns the same output for the same input. No randomness, no clock reads, no I/O.
- **Material totals honored within ±15%:** the sum of `plannedMinutes` for a material's slots is within ±15% of its `totalMinutes` (slot-based filling can produce small rounding).
- **Foundation never appears late:** for `weeks ≥ 3`, no foundation slot exists at `weekIndex ≥ floor(2 * weeks / 3)`.
- **Practice never appears early:** for `weeks ≥ 3`, no practice slot exists at `weekIndex < floor(weeks / 3)`.
- **Anchor stride bounded:** anchor slots are never further than 2 weeks apart, OR the engine emits an `anchor-stride-too-wide` warning.
- **Pin fidelity:** when `regenerateRoadmap(input, pins)` is called, every pinned slot in the output is byte-identical to its pin (modulo `plannedMinutes` if material totalMinutes changed).
- **No silent material drops:** if a material can't fit, it triggers an `over-capacity` status — never silently truncated.

## Acceptance criteria

### Module structure

- [ ] Module lives at `packages/progress-engine/src/roadmap-engine.ts` (under the existing `ProgressEngine` package per Decision 4 of the onboarding plan)
- [ ] All public types are exported from `packages/progress-engine/src/index.ts`
- [ ] Module has zero runtime dependencies outside `date-fns` (or equivalent date math library) — no React, Dexie, Supabase, or other framework code
- [ ] Module is fully typed; no `any`s except in tightly-scoped tests

### `generateRoadmap` correctness

- [ ] Returns a roadmap with `weeks.length === input.weeks`
- [ ] Every week has `slots.length === input.selectedStudyDays.length`
- [ ] Slot `date` correctly computed from `startDate + weekIndex × 7 + dayOfWeekOffset`
- [ ] Slot `capacityMinutes` reflects per-day budget: `weekdayHours / weekdayCount` for weekday slots, `weekendHours / weekendCount` for weekend slots (in minutes)
- [ ] Sum of all `plannedMinutes` per material equals that material's `totalMinutes` within ±15%
- [ ] Warnings array contains `over-capacity` if `totalMaterialMinutes > totalCapacityMinutes`
- [ ] Warnings array contains `under-capacity-buffer` if `totalCapacityMinutes > totalMaterialMinutes × 1.3`
- [ ] Warnings array contains `anchor-stride-too-wide` if any consecutive anchor slots are >2 weeks apart

### Phasing & role placement

- [ ] For `weeks ≥ 3`: foundation slots only appear in `weekIndex < floor(2*weeks/3)`
- [ ] For `weeks ≥ 3`: practice slots only appear in `weekIndex >= floor(weeks/3)`
- [ ] For `weeks < 3`: phasing is by chronological slot order, not week index (foundation slots come first, anchor middle, practice last)
- [ ] Anchor slots are spread evenly using stride pattern; gaps follow the `[1,1,0,1,1,0,1,1]` style for 6-of-8 cases

### Round-robin

- [ ] When two materials share a role, slots alternate between them in `additionOrder` priority
- [ ] When one material exhausts before the other, remaining slots go to the other material solo
- [ ] When the role queue empties before all role-tagged slots are filled, the remaining slots are emitted as **multi-candidate** (`candidateMaterialIds.length >= 2`) for user resolution

### Capacity checks

- [ ] When `totalMaterial > totalCapacity`: `capacityCheck.status === 'over-capacity'`, the engine still produces a "best-effort" roadmap (filling slots until material runs out) but the consumer (slice 4) is expected to block commit
- [ ] When `totalCapacity > totalMaterial × 1.3`: `capacityCheck.status === 'under-capacity-buffer'`, with a hint indicating the smallest N (weeks) that would still fit
- [ ] Otherwise: `capacityCheck.status === 'fits'`

### Inference helper

- [ ] `inferRole("Mock interviews", 300, [...])` returns `'practice'`
- [ ] `inferRole("LeetCode patterns", 600, [...])` returns `'practice'`
- [ ] `inferRole("Cracking the Coding Interview", 1200, [...])` returns `'anchor'` or `'foundation'` (NOT practice — the >200m guard)
- [ ] `inferRole("DDIA", 600, [])` returns `'anchor'` (largest seen)
- [ ] `inferRole("CAP theorem", 200, [DDIA at 600m])` returns `'foundation'` (smaller than existing anchor)

### Post-commit operations

- [ ] `addMaterialToRoadmap(roadmap, newMaterial, pins)` only fills rest-day slots; never touches pinned or assigned slots
- [ ] `addMaterialToRoadmap` returns a new `over-capacity` warning if the new material can't fit into available rest days
- [ ] `removeMaterialFromRoadmap(roadmap, materialId, pins)` clears all future, non-pinned slots of that material to rest days
- [ ] `removeMaterialFromRoadmap` does NOT touch pinned slots even if they reference the removed material — the consumer (slice 10) handles that case explicitly with a separate flow

### Re-plan with pins

- [ ] `regenerateRoadmap(input, pins)` returns a roadmap where every slot in `pins` is preserved verbatim (same materialId, same sessionTitle, same plannedMinutes)
- [ ] Non-pinned slots are regenerated by the standard algorithm against the constraint that pinned slots are "already placed"
- [ ] If pins alone exceed the new capacity, `capacityCheck.status === 'over-capacity'` and a `pin-overflow` warning is included

### Determinism

- [ ] Calling `generateRoadmap(input)` twice with identical input returns deeply-equal output
- [ ] Calling `generateRoadmap(input)` with `additionOrder` reversed for two same-role materials produces a deterministically different output (the round-robin order flips)

### Tests

- [ ] Unit tests for each of the 5 stages (validate, build grid, compute slotsNeeded, tag roles, assign materials)
- [ ] Property-based tests asserting the algorithmic invariants above (e.g., for any input, foundation never appears late)
- [ ] Snapshot tests for ~10 representative inputs covering: single material, two materials, three materials with one anchor + one foundation + one practice, multiple same-role materials, N=1, N=2, N=8, N=16, over-capacity, under-capacity-buffer
- [ ] Test for the canonical example from grilling: DDIA 600m + CAP 200m + Mocks 300m, 8 weeks, Mon/Wed/Sat, 2h weekday + 3h weekend — verify the expected slot layout

### Documentation

- [ ] Module has a top-of-file JSDoc comment summarizing the contract and pointing to `ROADMAP_ENGINE_GUIDE.md` for the algorithm walkthrough
- [ ] Each public function has a JSDoc comment with example invocation and expected output shape
- [ ] `ROADMAP_ENGINE_GUIDE.md` lives in `docs/` and is linked from the module's README

## New user stories covered

These are infrastructure-level user stories — the algorithm itself doesn't have a UI surface, but its outputs power experiences across the app.

- **User story 67:** As any user with a roadmap, I want my plan to follow learning-science principles (foundations first, practice last, anchor evenly distributed, spaced repetition) so that the time I invest produces durable retention, not just feel-good completion.
- **User story 68:** As any user, I want my plan to be deterministic and inspectable — same inputs give the same plan — so that I can trust the schedule isn't randomly shifting under me.
- **User story 69:** As any user with edited slots, I want re-planning operations (add material, remove material, re-plan) to preserve my edits exactly, so that the algorithm never overrules my own decisions about my study plan.

## Blocked by

- Blocked by #1a (design system + tooling — needs the monorepo structure and TS tooling to exist)
- Not blocked by #2 — this slice has zero runtime dependency on the event store or sync. It's a pure module.

## Parallelizable with

- Slice #4 (onboarding UI) — once this slice's contract is approved (the types in `roadmap-engine.ts`), slice 4's UI work can proceed against a stub implementation. They integrate when both land.
- Slice #11 (weekly progress) — same reasoning. ProgressEngine consumes the roadmap output but doesn't need the engine's internals.
