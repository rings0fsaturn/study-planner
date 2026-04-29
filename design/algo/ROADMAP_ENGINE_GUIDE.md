# RoadmapEngine — Complete Guide

> A pure module that turns "I have these materials and these weeks" into a slot-based study plan that respects learning-science principles.

This document is the canonical reference for the algorithm. It captures the research foundation, the 16 design decisions made during grilling, a step-by-step walkthrough using the canonical example, and the integration points with each slice that calls the engine.

---

## Table of contents

1. [Research foundation](#research-foundation)
2. [The 16 decisions](#the-16-decisions)
3. [Algorithm structure](#algorithm-structure)
4. [Step-by-step walkthrough](#step-by-step-walkthrough)
5. [Edge cases](#edge-cases)
6. [Slice integration](#slice-integration)
7. [Testing strategy](#testing-strategy)
8. [Tuning & future work](#tuning--future-work)

---

## Research foundation

The algorithm rests on six findings from cognitive-science and educational-psychology research:

**1. Spaced practice beats massed practice — gap = ~10–20% of retention interval.**
Cepeda et al. (2006) meta-analysis of 254 studies found spaced practice improves retention by 10–30% over massed (cramming). Cepeda et al. (2008) showed the optimal gap between sessions on the same material is about 10–20% of how long you want to remember it. For an 8-week prep ending at interview day, that means revisits of the same topic should land roughly every 5–10 days.

**2. Interleaving beats blocking for long-term retention.**
The contextual-interference effect: alternating between tasks/materials during practice impedes performance during training but increases long-term learning. In a typical study (Rohrer, Dedrick & Stershic 2015), interleaved math practice produced ~7% better delayed-test scores than blocked practice. Bjork's "desirable difficulties" framework explains why: the harder retrieval during interleaved practice creates more durable memory traces.

**3. Blocking has one legitimate niche: rule-based learning of dense conceptual material.**
When the task is *finding a rule* (vs memorizing), blocking outperforms interleaving because it allows deeper elaborative encoding within a session. Implication: a dense-theory book like DDIA needs long uninterrupted *sessions* (within-session blocking), even though sessions across the plan should still be interleaved with other materials and spaced.

**4. Students prefer blocking but are wrong about it.**
Research shows learners overwhelmingly judge blocked practice as more effective even when objective tests show interleaving is better. Implication: the algorithm should default to interleaved and not offer "study X all week" as an option just because it feels productive.

**5. Sustainable cognitive effort caps at ~3.5–4 hours/day; one rest day per week beats 7 days at equivalent total hours.**
Anders Ericsson's deliberate-practice research found even world-class performers don't sustain more than ~4 hours of focused work daily, split into two blocks. A medical-student survey on burnout strategies (StatPearls) recommends 50/10 work/break ratios and at least one full rest day per week. Implication: the algorithm should never assume 7-day weeks and should respect the user's chosen study days as a hard cap.

**6. Mock interviews specifically: spread but ramp toward deadline.**
Industry guidance for tech interview prep recommends 3–5 mock interviews spaced over 1–2 weeks before any real interview. But mocks should also start earlier to surface weaknesses; the consensus failure mode is "under-allocating to mocks" and concentrating them only at the end.

These six findings condense into **four design rules** the algorithm enforces:

| Rule | What it implements |
|---|---|
| **Interleave by default** | Multiple materials are mixed within and across weeks. Pure "block all DDIA, then all CAP, then all mocks" is never offered. |
| **Chunk floor by material type** | Anchor (rule-based theory) gets ≥45m chunks. Foundation gets ≥30m. Practice gets natural unit (45–60m). Implemented via slot capacity, not in-engine math. |
| **Phased weighting, not flat** | Foundations front-load (weeks 1–N/3), anchors throughout, practice ramps to deadline (weeks 2N/3–N). |
| **One slack day per week** | The user's `selectedStudyDays` is the constraint. The algorithm never overrides it. Unused days are rest. |

---

## The 16 decisions

Each decision was made deliberately during the grilling session. They're numbered by the order they were resolved, not by importance.

| # | Decision | Where it lives in code |
|---|---|---|
| 1 | One slot = one material (no within-slot mixing) | `assignMaterialsToSlots` — each slot gets one materialId or zero |
| 2 | Pomodoro timer structure (50/10 default) | Slice 005, not the engine — engine only emits slot capacity |
| 3 | Phase-then-fill for slot assignment (was rejected in favor of #9) | Superseded |
| 4 | Algorithm runs once; user can rearrange after | `regenerateRoadmap(pins)` honors pins; never auto-runs |
| 5 | Excess-capacity prompt at preview (1.3× threshold) | `computeCapacityCheck` returns `under-capacity-buffer` |
| 6 | Compress = fewer weeks (not fewer days/week) | UI in slice 4; engine just regenerates with new `weeks` |
| 7 | Empty slots render as "Rest day" rows | Slot with `role: null` and `candidateMaterialIds: []` |
| 8 | Material-to-slot fills slots to natural capacity, then stops | `assignMaterialsToSlots` decrements remaining minutes by `capacityMinutes` |
| 9 | Material-driven slot tagging (compute `slotsNeeded` from material totals) | `slotsNeededByMaterial` map, then `tagSlotsWithRoles` |
| 10 | Default session titles are generated; user can rename inline | `sessionTitle: "{title} · session N of M"` |
| 11 | Onboarding step 3 captures `type` dropdown; `inferRole()` provides defaults | `inferRole()` exported; UI in slice 4 |
| 12 | Round-robin for same-role materials, by `additionOrder` | Queue-based loop in `assignMaterialsToSlots` |
| 13 | Over-capacity hard-blocks commit; v1 routes to onboarding step 1/2/3 | `over-capacity` warning; UI in slice 4 |
| 14 | Material removal post-commit → future slots become rest days | `removeMaterialFromRoadmap()` |
| 15 | Short-timeline (N<3) fallback: chronological role priority, no phasing | `tagShortTimeline()` branch in `tagSlotsWithRoles` |
| 16 | True ties surface as user-resolvable multi-candidate slots | `candidateMaterialIds.length >= 2` in output |

---

## Algorithm structure

The engine runs in five stages:

```
Input
  │
  ▼
┌─────────────────────────────────┐
│ Stage 1: validate inputs        │
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ Stage 2: build slot grid        │  → Creates N × |selectedStudyDays| empty slots
│ (week × day, with capacity)     │    with date and capacityMinutes
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ Stage 3: compute slotsNeeded    │  → For each material:
│ per material                    │    slotsNeeded = ceil(totalMinutes / avgCapacity)
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ Stage 4: tag slots with roles   │  → Anchor: even stride across weeks
│ (anchor / foundation / practice)│    Foundation: front-loaded (weeks 0..N/3)
│                                 │    Practice: back-loaded (weeks 2N/3..N)
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ Stage 5: assign materials       │  → For each role-tagged slot:
│ (round-robin per role)          │    Pop next material from role queue
│                                 │    Assign, decrement remaining, requeue
└─────────────────────────────────┘
  │
  ▼
Output (weeks → slots → candidate materials + warnings)
```

Each stage is a pure function. Output of stage N is input to stage N+1. No shared mutable state.

---

## Step-by-step walkthrough

Using the canonical example from grilling: **DDIA 600m, CAP 200m, Mocks 300m, 8 weeks, Mon/Wed/Sat with 2h weekday + 3h weekend.**

### Stage 1 — validate

Inputs are non-empty, weeks ≥ 1, hours ≥ 0. Pass.

### Stage 2 — build slot grid

```
selectedStudyDays = ['Mon', 'Wed', 'Sat']
weekdayCount = 2 (Mon, Wed)
weekendCount = 1 (Sat)
weekdayPerSlot = 2h × 60 / 2 = 60 min
weekendPerSlot = 3h × 60 / 1 = 180 min

Total slots = 8 weeks × 3 days = 24 slots
Total capacity = 8 × (60 + 60 + 180) = 2400 min
```

Empty grid shape:

```
Week 0: [Mon-60m, Wed-60m, Sat-180m]
Week 1: [Mon-60m, Wed-60m, Sat-180m]
... (× 8 weeks)
```

### Stage 3 — slotsNeeded per material

```
avgCapacity = 2400 / 24 = 100 min/slot

DDIA  (anchor):     ceil(600 / 100) = 6 slots
CAP   (foundation): ceil(200 / 100) = 2 slots
Mocks (practice):   ceil(300 / 100) = 3 slots

Total tagged: 11 slots → 13 slots will become rest days
```

`capacityCheck` runs here:

```
totalMaterial = 1100 min
totalCapacity = 2400 min
1100 / 2400 = 0.46 — well below 1/1.3 = 0.77
Status: under-capacity-buffer
suggestedWeeks = ceil(1100 / 300) = 4   (per-week cap = 300m at this hour layout)
```

So a warning fires: "Your materials need 18.3 hours but you've planned 40 hours. Compress to 4 weeks?"

### Stage 4 — tag slots with roles

**Anchor (DDIA, 6 slots over 8 weeks):**
Stride pattern picks weeks `[0, 1, 3, 4, 6, 7]` (the `pickEvenlySpacedWeeks(6, 8)` output). Within each chosen week, the engine picks the largest-capacity untagged slot. That's Sat-180m every time.

```
Week 0: [Mon, Wed, *Sat → anchor]
Week 1: [Mon, Wed, *Sat → anchor]
Week 2: [Mon, Wed, Sat]                ← skipped
Week 3: [Mon, Wed, *Sat → anchor]
Week 4: [Mon, Wed, *Sat → anchor]
Week 5: [Mon, Wed, Sat]                ← skipped
Week 6: [Mon, Wed, *Sat → anchor]
Week 7: [Mon, Wed, *Sat → anchor]
```

**Foundation (CAP, 2 slots, front-loaded — weeks 0..floor(2*8/3)=5):**
Earliest available untagged slots. Week 0's Mon and Wed are both untagged; the algorithm picks them in chronological order.

```
Week 0: [*Mon → foundation, *Wed → foundation, Sat=anchor]
Week 1: [Mon, Wed, Sat=anchor]
...
```

**Practice (Mocks, 3 slots, back-loaded — weeks floor(8/3)=2..7):**
Latest available untagged slots, walking backward.

```
Week 7: [*Mon → practice (latest available), *Wed → practice, Sat=anchor]
Week 6: [*Mon → practice, Wed, Sat=anchor]
```

After Stage 4 the grid looks like:

```
Week 0: Mon=foundation, Wed=foundation, Sat=anchor
Week 1: Mon=null, Wed=null, Sat=anchor
Week 2: Mon=null, Wed=null, Sat=null
Week 3: Mon=null, Wed=null, Sat=anchor
Week 4: Mon=null, Wed=null, Sat=anchor
Week 5: Mon=null, Wed=null, Sat=null
Week 6: Mon=practice, Wed=null, Sat=anchor
Week 7: Mon=practice, Wed=practice, Sat=anchor
```

Anchor stride check: gaps are at week 2 (between W1 and W3) and week 5 (between W4 and W6). Both are 1-week gaps, well under the 2-week max. No `anchor-stride-too-wide` warning.

### Stage 5 — assign materials

**Foundation queue:** `[CAP]` (only one foundation material).
Walk role-tagged slots chronologically: Week 0 Mon, Week 0 Wed.

```
Week 0 Mon → CAP, plannedMinutes=60, sessionTitle="CAP theorem · session 1 of 2"
  CAP remaining: 200 - 60 = 140 → requeue

Week 0 Wed → CAP, plannedMinutes=60, sessionTitle="CAP theorem · session 2 of 2"
  CAP remaining: 140 - 60 = 80 → requeue (not zero)

(but no more foundation slots — CAP exits role-tagged-slots loop with 80m left)
```

CAP got 120m of its 200m total. The 80m shortfall is acceptable per the ±15% tolerance — actually 40% under, which exceeds tolerance. **This is a real edge case** the algorithm exposes: when capacity (per slot) is smaller than expected vs material total, the material under-fills. The engine could either:

- **Promote unused foundation slots back to available** (current behavior — stays at 120m)
- **Spill into anchor or practice slots** (more complex; not v1)
- **Surface as a warning** (good idea — to add)

For v1, the under-fill is honest: the user's slot capacities just don't have room for CAP's full 200m within the foundation phase, given the 60m weekday slot size. The remaining 80m would either become extra rest days or, in a future enhancement, get redistributed.

**Anchor queue:** `[DDIA]`.
Walk role-tagged slots chronologically: W0 Sat, W1 Sat, W3 Sat, W4 Sat, W6 Sat, W7 Sat — six 180m slots.

```
W0 Sat → DDIA, 180m, "DDIA · session 1 of N"
  DDIA remaining: 600 - 180 = 420
W1 Sat → DDIA, 180m, "DDIA · session 2 of N"
  DDIA remaining: 240
W3 Sat → DDIA, 180m, "DDIA · session 3 of N"
  DDIA remaining: 60
W4 Sat → DDIA, 180m, "DDIA · session 4 of N"
  DDIA remaining: -120 ← OVER (slot capacity exceeded total)
```

DDIA fills 4 of its 6 anchor slots and runs out (4 × 180 = 720, vs 600 total — an over-fill of 120m, which is 20% over, also exceeds the ±15% tolerance).

The two unused anchor slots (W6 Sat, W7 Sat) end up in the **multi-candidate / queue-empty branch (Decision 16)**: the queue empties before all role-tagged slots are filled. Those slots get `candidateMaterialIds: ['DDIA']` (extending DDIA via review) plus implicit "Rest day" candidate. **The user picks** during preview.

> **Important — this exposes a real algorithm tension:** Stage 3 said DDIA needs 6 slots. Stage 5 fills only 4 because slot capacities (180m) are bigger than the avg used in Stage 3 (100m). The engine over-estimated `slotsNeeded` because anchor consistently lands on big Saturday slots. A v1.1 refinement would be to recompute `slotsNeeded` per-role using *actual* role-tagged capacity, not avg overall. For v1, the multi-candidate emission handles this gracefully — the user resolves which mostly-empty slots to keep.

**Practice queue:** `[Mocks]`.
Walk role-tagged slots: W6 Mon (60m), W7 Mon (60m), W7 Wed (60m).

```
W6 Mon → Mocks, 60m, "Mock interviews · session 1 of 5"
  remaining 240
W7 Mon → Mocks, 60m, "Mock interviews · session 2 of 5"
  remaining 180
W7 Wed → Mocks, 60m, "Mock interviews · session 3 of 5"
  remaining 120
```

Mocks ends 120m short — ratio 60% allocated. Surfaces in tests as a tolerance-band failure (the engine should warn here in v1.1).

### Final shape (output)

```
Week 0: CAP-60m, CAP-60m, DDIA-180m
Week 1: rest, rest, DDIA-180m
Week 2: rest, rest, rest
Week 3: rest, rest, DDIA-180m
Week 4: rest, rest, DDIA-180m
Week 5: rest, rest, rest
Week 6: Mocks-60m, rest, [DDIA review or rest day]
Week 7: Mocks-60m, Mocks-60m, [DDIA review or rest day]
```

Plus warnings:

```
[
  { kind: 'under-capacity-buffer', detail: { bufferMinutes: 1300, suggestedWeeks: 4 } },
  { kind: 'unresolved-tie-count',  detail: { count: 2 } }
]
```

The user sees this in the preview, decides what to do with the buffer (compress or accept), resolves the two undecided slots (extend DDIA or rest), and commits.

---

## Edge cases

### Single material

If `materials.length === 1`, the material is auto-assigned its inferred role (largest = anchor by default). All slots tagged for that role get filled until the material runs out. Other slots become rest days. Works.

### N=1 (one-week timeline)

The phasing branch in `tagSlotsWithRoles` skips to `tagShortTimeline` (Decision 15). All slots get role-ordered chronologically: foundation slots first (earliest in the week), anchor middle, practice last. Round-robin still applies if multiple same-role materials.

### N=2 (two-week timeline)

Same as N=1 — short-timeline branch. Foundation slots earliest, practice latest, across both weeks.

### Two materials, same role (DDIA + Alex Xu, both anchor)

`byRole.anchor` = `[DDIA, AlexXu]` sorted by additionOrder. Walk anchor slots chronologically:

```
W0 Sat → DDIA      (queue: [AlexXu, DDIA])  // round-robin
W1 Sat → AlexXu    (queue: [DDIA, AlexXu])
W3 Sat → DDIA      ...
```

True alternation. When one material exhausts, the other fills the rest.

### Material total > total capacity (over-capacity)

`capacityCheck.status = 'over-capacity'`. The engine still produces a best-effort roadmap (fills slots until material runs out). The consumer (slice 4) is expected to read the warning and block commit. The engine does NOT silently truncate.

### All materials < tolerance (severe under-fill)

Possible if every material is much smaller than typical slot capacity. Output is correct but visually bare. The under-capacity-buffer warning fires.

### Pin overlap with new layout

When `regenerateRoadmap(input, pins)` is called and a pin refers to a slot that doesn't exist in the new layout (e.g., the new plan has fewer weeks), the `pin-overflow` warning fires with the overflow minute count. The consumer (slice 10's ReplanEngine) decides what to do — typically prompts the user.

---

## Slice integration

### Slice 4 — onboarding (primary consumer)

```ts
import { generateRoadmap, inferRole, type RoadmapInput } from '@studytracker/progress-engine'

// During step 3, on every form change:
const input: RoadmapInput = {
  materials: formMaterials.map((m, i) => ({
    id: m.id,
    title: m.title,
    totalMinutes: m.estimatedDuration,
    role: m.type === 'Main reading' ? 'anchor'
        : m.type === 'Foundations' ? 'foundation'
        : 'practice',
    additionOrder: i,
  })),
  weeks: computeWeeksFromDeadline(step1.deadline),
  startDate: today(),
  selectedStudyDays: step2.selectedDays,
  weekdayHours: step2.weekdayHours,
  weekendHours: step2.weekendHours,
}

const roadmap = generateRoadmap(input)

// Use roadmap to render preview
// Use roadmap.warnings for prompts:
//   - over-capacity → block commit, show 3-button modal
//   - under-capacity-buffer → soft prompt with Compress / Keep buffer
//   - unresolved-tie-count → disable commit until resolved

// On the type dropdown default, call inferRole:
const defaultRole = inferRole(material.title, material.estimatedDuration, existingMaterials)
```

**Integration tests in slice 4** should mock the engine output for predictability — slice 4's UI tests don't need to re-prove the algorithm.

### Slice 10 — re-plan flow

```ts
import { regenerateRoadmap, type Pin } from '@studytracker/progress-engine'

// Build pins from EventStore: completed sessions + today's slots + RoadmapEdited slots
const pins: Pin[] = buildPinsFromEventStore(eventStore)

// For each of the 3 options, call regenerateRoadmap with adjusted input:
const extendOption = regenerateRoadmap(
  { ...currentInput, weeks: currentInput.weeks + 2 },
  pins,
)
const hoursOption = regenerateRoadmap(
  { ...currentInput, weekdayHours: currentInput.weekdayHours + 1 },
  pins,
)
const trimOption = regenerateRoadmap(
  { ...currentInput, materials: currentInput.materials.filter(m => !cutSet.has(m.id)) },
  pins,
)

// Display option cards with each option's projected outcome
```

### Slice 11 — weekly progress (indirect via ProgressEngine)

ProgressEngine reads the latest `RoadmapCreated` / `RoadmapReplanned` event to get the plan, then compares it to logged sessions. The engine itself isn't called by slice 11 — slice 11 just *reads* the engine's stored output.

### Post-commit material add (future feature)

```ts
import { addMaterialToRoadmap } from '@studytracker/progress-engine'

const updated = addMaterialToRoadmap(currentRoadmap, newMaterial, currentPins)

if (updated.warnings.some(w => w.kind === 'over-capacity')) {
  // Insufficient rest days — trigger re-plan flow
  navigateTo('/study/replan?reason=add-material-overflow')
} else {
  // Emit RoadmapEdited event for the change
  logEvent({ kind: 'RoadmapEdited', roadmap: updated })
}
```

### Post-commit material remove (future feature)

```ts
import { removeMaterialFromRoadmap } from '@studytracker/progress-engine'

const updated = removeMaterialFromRoadmap(currentRoadmap, materialIdToRemove, currentPins)
logEvent({ kind: 'RoadmapEdited', roadmap: updated })
// Home re-renders with new projected finish
```

---

## Testing strategy

The engine is a pure function — testing is straightforward. Three layers:

### 1. Unit tests per stage

Each of the five stages has its own isolated tests:

```
test('Stage 2: buildSlotGrid produces N × |days| slots with correct capacity')
test('Stage 2: weekend slots get weekendHours / weekendCount capacity')
test('Stage 3: slotsNeeded uses ceiling division of totalMinutes / avgCapacity')
test('Stage 4: anchor stride pattern places 6 slots in 8 weeks as [0,1,3,4,6,7]')
test('Stage 4: foundation never tagged in last third for N >= 3')
test('Stage 4: short-timeline branch (N < 3) ignores phase boundaries')
test('Stage 5: round-robin alternates same-role materials by additionOrder')
test('Stage 5: queue-empty case produces multi-candidate slots')
```

### 2. Property-based tests for invariants

Use `fast-check` or equivalent. Generate random valid inputs and assert invariants hold:

```
property('foundation never appears in last third for N >= 3', input => {
  const out = generateRoadmap(input)
  if (input.weeks >= 3) {
    const cutoff = Math.floor(2 * input.weeks / 3)
    for (const w of out.weeks) {
      if (w.weekIndex >= cutoff) {
        expect(w.slots.every(s => s.role !== 'foundation')).toBe(true)
      }
    }
  }
})

property('determinism: same input → equal output', input => {
  expect(generateRoadmap(input)).toEqual(generateRoadmap(input))
})

property('material totals honored within ±15% (when fits)', input => {
  const out = generateRoadmap(input)
  if (out.capacityCheck.status === 'fits') {
    for (const m of input.materials) {
      const allocated = sumPlannedMinutesForMaterial(out, m.id)
      const ratio = allocated / m.totalMinutes
      expect(ratio).toBeGreaterThan(1 - 0.15)
      expect(ratio).toBeLessThan(1 + 0.15)
    }
  }
})
```

### 3. Snapshot tests for representative inputs

Lock in the engine's output for ~10 canonical inputs:

```
test('canonical: DDIA + CAP + Mocks, 8 weeks, Mon/Wed/Sat, 2h+3h')
test('single material, 4 weeks')
test('two anchors round-robin, 6 weeks')
test('N=1 emergency cram')
test('N=2 short prep')
test('over-capacity case')
test('under-capacity-buffer case')
test('all-rest-day case (zero materials — should throw)')
test('regenerate honors pins exactly')
test('addMaterial fits into rest days only')
```

Snapshots make algorithm changes visible — any tweak shows up as a diff in the snapshot file, forcing review.

### 4. Integration tests live in slice 4 and slice 10

Don't re-test the algorithm in those slices — mock the engine output and test the UI behavior. The algorithm's correctness is the engine's responsibility.

---

## Tuning & future work

### Tunable parameters (config block)

Lift these to a runtime config object so they can be adjusted post-launch:

```ts
const ROADMAP_CONFIG = {
  underCapacityBufferThreshold: 1.3,   // Decision 5
  materialTotalTolerance: 0.15,        // ±15% honor band
  anchorStrideMax: 2,                  // Weeks
  phaseBoundary1: 1/3,                 // Foundations end fraction
  phaseBoundary2: 2/3,                 // Build end fraction
  inferenceRules: {
    practiceKeywords: /mock|leetcode|exercise|problem set/i,
    interviewSizeThreshold: 200,       // minutes
  },
}
```

A/B testing different values requires injecting this config into `generateRoadmap` rather than reading from a module constant.

### Known limitations (v1 → v1.1)

1. **`slotsNeeded` over-estimates when anchors land on big slots.** The 4-of-6 DDIA fill in the canonical example exposes this. Fix: compute `slotsNeeded` per role using actual role-tagged slot capacities, not the global average. Worth a v1.1 patch.

2. **Under-fill warning missing.** When a material gets significantly less than its `totalMinutes` (e.g., CAP at 60% in the canonical example), no warning fires. Should add `material-underfilled` warning kind.

3. **No spaced review.** The engine doesn't generate "review" sessions for completed material. Spaced repetition would require chapter-level material structure (which the user doesn't provide). Deferred to v2 with a richer material model.

4. **Pin movement on regeneration.** If `regenerateRoadmap` is called with N reduced, pins beyond the new last week generate `pin-overflow` warnings but aren't placed anywhere. The consumer must handle these. A future enhancement could attempt pin-shifting (move week 8's pin to week 6).

5. **Multi-anchor stride coordination.** Two anchor materials each get their own stride pattern, computed independently. If both happen to choose the same weeks (unlikely with round-robin but possible), one will skip. Fine in practice, worth verifying in property tests.

### v2 ideas

- **Material-role auto-detection from URL** — when slice 6 lands (URL paste with metadata fetch), the engine could infer role from the page content (textbook → foundation, GitHub repo → practice).
- **Adaptive recalibration on completed sessions** — feed actual session times back into `slotsNeeded` so future weeks adjust if the user is consistently faster/slower than estimated. (Already implied by ProgressEngine's PaceCalibration in slice 9.)
- **Per-material chunk floors** — let the user set "I want DDIA chunks to be at least 90 min." Currently floors are inferred from role.

---

## Quick reference card

For implementers in a hurry:

```
// Generate a fresh plan
const roadmap = generateRoadmap({
  materials: [/* ...with role */],
  weeks: 8,
  startDate: '2026-04-29',
  selectedStudyDays: ['Mon', 'Wed', 'Sat'],
  weekdayHours: 2,
  weekendHours: 3,
})

// Check status before showing the user
switch (roadmap.capacityCheck.status) {
  case 'over-capacity':       // BLOCK COMMIT, show 3-option modal
  case 'under-capacity-buffer': // SOFT PROMPT with Compress/Keep
  case 'fits':                  // OK — show preview
}

// Disable commit while ties remain
const tiesUnresolved = roadmap.warnings.find(w => w.kind === 'unresolved-tie-count')

// Re-plan honoring pins
const newPlan = regenerateRoadmap(updatedInput, currentPins)

// Add material later
const withNew = addMaterialToRoadmap(roadmap, newMaterial, currentPins)
if (withNew.warnings.some(w => w.kind === 'over-capacity')) {
  // Trigger re-plan flow
}
```

That's the algorithm.
