# RoadmapEngine — Complete Guide

> A pure module that turns "I have these materials and these weeks" into a slot-based study plan that respects learning-science principles.

This document is the canonical reference for the algorithm. It captures the research foundation, the 16 design decisions made during grilling, a step-by-step walkthrough using the canonical example, and the integration points with each slice that calls the engine.

> **Revision note (2026-04-29).** This guide reflects the post-grilling Q21 redesign of the algorithm. If you're reading older code that still computes `slotsNeeded` per material in a Stage 3, that's the pre-Q21 design — see *Algorithm structure* and *Known limitations* for what changed and why. The public API (function signatures and type shapes) is unchanged across the redesign; only the internal stages and a few output details (multi-candidate `'__rest__'` sentinel, two new warning kinds) are new.

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
| 8 | Material-to-slot fills slots to natural capacity, then stops (partial-slot when material runs out) | `assignMaterialsToSlots` uses `Math.min(slot.capacityMinutes, remaining)` |
| 9 | Material-driven slot tagging (compute `slotsNeeded` per material, then tag) | **Superseded by Q21 redesign.** Replaced by candidate-based tagging — see Stage 4. |
| 10 | Default session titles are generated; user can rename inline | `sessionTitle: "{title} · session N of M"` (M counted post-fill via `retrofitSessionTitles`) |
| 11 | Onboarding step 3 captures `type` dropdown; `inferRole()` provides defaults | `inferRole()` exported; UI in slice 4 |
| 12 | Round-robin for same-role materials, by `additionOrder` | Queue-based loop in `assignMaterialsToSlots` |
| 13 | Over-capacity hard-blocks commit; v1 routes to onboarding step 1/2/3 | `over-capacity` warning; UI in slice 4 |
| 14 | Material removal post-commit → future slots become rest days | `removeMaterialFromRoadmap()` |
| 15 | Short-timeline (N<3) fallback: chronological role priority, no phasing | `tagShortTimeline()` branch in `tagRoleCandidates` |
| 16 | Boundary tie surfaces as one user-resolvable multi-candidate slot per role | First slot encountered after queue-empty: `candidateMaterialIds: [...materialIds, '__rest__']`. All later leftover slots are plain rest days. |

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
│ Stage 3: compute capacity check │  → Sum totals, classify status:
│                                 │    fits / over-capacity / under-capacity-buffer
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ Stage 4: tag role candidates    │  → For each slot, gather plausible roles
│ (phase-based, viability-filter) │    by phase (early/middle/late), filter to
│                                 │    roles with materials, then resolve to one
│                                 │    role via the phase priority table
└─────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────┐
│ Stage 5: assign materials       │  → For each role, walk role-tagged slots
│ (round-robin + partial-slot     │    chronologically. Pop next material from
│  fill + Decision 16 boundary)   │    queue, allocate min(capacity, remaining),
│                                 │    requeue if more remains. First slot after
│                                 │    queue-empty becomes multi-candidate.
└─────────────────────────────────┘
  │
  ▼
Output (weeks → slots → candidate materials + warnings)
```

Each stage is a pure function. Output of stage N is input to stage N+1. No shared mutable state.

**Note on the Q21 redesign.** An earlier version of the algorithm (Decision 9) computed a global `slotsNeeded` per material from `totalMinutes / globalAvgCapacity`, then placed exactly that many slots. This over-estimated the count whenever anchor consistently landed on big slots and foundation/practice on small slots — the global average is a fiction in non-uniform week shapes. The current design tags candidates first, then lets Stage 5 fill until the material exhausts, dropping the `slotsNeeded` step entirely. Decision 9 in the table above is marked superseded for this reason.

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

### Stage 3 — capacity check

```
totalMaterial = 600 + 200 + 300 = 1100 min
totalCapacity = 8 × (60 + 60 + 180) = 2400 min
1100 / 2400 = 0.46 — well below 1/1.3 = 0.77
Status: under-capacity-buffer
suggestedWeeks = ceil(1100 / (2400/8)) = ceil(1100 / 300) = 4
```

A warning fires: "Your materials need ~18 hours but you've planned ~40 hours. Compress to 4 weeks?"

The capacity check produces three statuses: `fits`, `over-capacity`, `under-capacity-buffer`. There is no `slotsNeeded` computation in this stage anymore — that step from the original v1 design is gone (see the Q21 note in *Algorithm structure*).

### Stage 4 — tag role candidates

This stage walks every slot and gathers a set of *role candidates* based on phase, then resolves each set to exactly one role. The phase boundaries (for N=8) are:

```
phase1End = floor(8 / 3) = 2     // weeks 0, 1 are "early"
phase2End = floor(2 × 8 / 3) = 5 // weeks 5, 6, 7 are "late"
                                 // weeks 2, 3, 4 are "middle"
```

**Candidate gathering rules:**
- Foundation candidate when `weekIndex < phase2End` (weeks 0–4)
- Practice candidate when `weekIndex >= phase1End` (weeks 2–7)
- Anchor candidate when slot is the largest-capacity slot in its week. Two refinements:
  - *Non-uniform week:* strictly-largest slot wins; ties broken by chronological order. For Mon/Wed/Sat with 60/60/180m, that's always Sat.
  - *Uniform week* (capacities within 10% of each other): the chronologically-first selected day of the week wins, for habit-formation consistency (Lally et al. 2010 — habit automaticity depends on consistent timing).

**Viability filter:** before resolving, the engine drops any candidate role whose set of input materials is empty. Without this, a DDIA-only input with no practice material would have late-week slots tagged `practice` (per phase rules) and then immediately cleared to rest days, leaving DDIA underfilled even though those slots were available.

**Phase priority table** for resolving multi-candidate slots:

| Phase | Priority order |
|---|---|
| Early (`week < phase1End`) | anchor > foundation > practice |
| Middle (`phase1End <= week < phase2End`) | anchor > practice > foundation |
| Late (`week >= phase2End`) | **practice > anchor** > foundation |

The late-weeks `practice > anchor` rule is research-backed (Finding 6 — mocks ramp toward the deadline). When practice has materials, late-week largest-capacity slots go to practice rather than anchor.

For the canonical example (all three roles have materials, no viability filtering needed):

```
Week 0 (early):   Mon=foundation,        Wed=foundation,        Sat=anchor
Week 1 (early):   Mon=foundation,        Wed=foundation,        Sat=anchor
Week 2 (middle):  Mon=practice,          Wed=practice,          Sat=anchor
Week 3 (middle):  Mon=practice,          Wed=practice,          Sat=anchor
Week 4 (middle):  Mon=practice,          Wed=practice,          Sat=anchor
Week 5 (late):    Mon=practice,          Wed=practice,          Sat=practice
Week 6 (late):    Mon=practice,          Wed=practice,          Sat=practice
Week 7 (late):    Mon=practice,          Wed=practice,          Sat=practice
```

Anchor stride check: anchor weeks are `[0,1,2,3,4]` — contiguous, so max gap is 1 week, well under the 2-week threshold. No `anchor-stride-too-wide` warning.

### Stage 5 — assign materials

For each role, the engine walks the role-tagged slots chronologically with a round-robin queue. Per-slot allocation uses partial-slot filling: `min(slot.capacityMinutes, material.remainingMinutes)`. When the queue empties before all role-tagged slots are exhausted, the **first** leftover slot becomes a multi-candidate boundary slot (Decision 16); subsequent leftover slots become plain rest days.

**Foundation queue:** `[CAP @ 200m]`. Walks W0-Mon, W0-Wed, W1-Mon, W1-Wed, W2-Mon, W2-Wed, W3-Mon, W3-Wed, W4-Mon, W4-Wed.

```
W0-Mon → CAP 60m, remaining 140m, requeue
W0-Wed → CAP 60m, remaining  80m, requeue
W1-Mon → CAP 60m, remaining  20m, requeue
W1-Wed → CAP min(60, 20) = 20m, remaining 0m, drop from queue
W2-Mon → queue empty → BOUNDARY slot? No — but weeks 2–4 weekday slots are tagged `practice`, not `foundation`, so they're not in this queue's walk. Foundation walk ends here cleanly.
```

CAP fills exactly 200m across 4 sessions (60+60+60+20). No multi-candidate boundary because the queue empties exactly at the end of the foundation-tagged slot list.

**Anchor queue:** `[DDIA @ 600m]`. Walks W0-Sat, W1-Sat, W2-Sat, W3-Sat, W4-Sat.

```
W0-Sat → DDIA 180m, remaining 420m
W1-Sat → DDIA 180m, remaining 240m
W2-Sat → DDIA 180m, remaining  60m
W3-Sat → DDIA min(180, 60) = 60m, remaining 0m, drop
W4-Sat → queue empty → BOUNDARY slot:
         candidateMaterialIds = ['ddia', '__rest__']
         plannedMinutes = 0
         role = 'anchor' (preserved)
         sessionTitle = null (user hasn't picked yet)
```

DDIA fills exactly 600m across 4 sessions. W4-Sat is the boundary multi-candidate — the user resolves it during preview.

**Practice queue:** `[Mocks @ 300m]`. Walks W2-Mon, W2-Wed, W3-Mon, W3-Wed, W4-Mon, W4-Wed, then weeks 5–7 (all 9 slots there since late-phase is all practice).

```
W2-Mon → Mocks 60m, remaining 240m
W2-Wed → Mocks 60m, remaining 180m
W3-Mon → Mocks 60m, remaining 120m
W3-Wed → Mocks 60m, remaining  60m
W4-Mon → Mocks 60m, remaining   0m, drop
W4-Wed → queue empty → BOUNDARY slot:
         candidateMaterialIds = ['mocks', '__rest__']
         plannedMinutes = 0
         role = 'practice'
W4-Sat → already filled by anchor walk above
W5-Mon..W7-Sat → queue empty AND boundary already emitted → plain rest days
                 (role cleared to null, candidateMaterialIds = [])
```

Mocks fills exactly 300m across 5 sessions. W4-Wed is the boundary multi-candidate. All other practice-tagged slots in weeks 5–7 become rest days.

**Session-title retrofit.** Each session is initially titled `"DDIA · session 1"`, `"… session 2"`, etc. — the total count isn't known until the role's queue finishes. After Stage 5, `retrofitSessionTitles` walks the slots, counts actual sessions per material, and rewrites titles to `"DDIA · session 1 of 4"`, `"… session 2 of 4"`, etc.

### Final shape (output)

```
Week 0: CAP-60m,    CAP-60m,                  DDIA-180m
Week 1: CAP-60m,    CAP-20m,                  DDIA-180m
Week 2: Mocks-60m,  Mocks-60m,                DDIA-180m
Week 3: Mocks-60m,  Mocks-60m,                DDIA-60m
Week 4: Mocks-60m,  MULTI[mocks, __rest__],   MULTI[ddia, __rest__]
Week 5: rest,       rest,                     rest
Week 6: rest,       rest,                     rest
Week 7: rest,       rest,                     rest
```

Material totals are exact:
- DDIA: 180+180+180+60 = 600m of 600m declared ✓
- CAP: 60+60+60+20 = 200m of 200m declared ✓
- Mocks: 60×5 = 300m of 300m declared ✓

Plus warnings:

```
[
  { kind: 'under-capacity-buffer', detail: { bufferMinutes: 1300, suggestedWeeks: 4 } },
  { kind: 'unresolved-tie-count',  detail: { count: 2 } }
]
```

The user sees this in the preview, decides what to do with the buffer (compress to 4 weeks or keep as a buffer), resolves the two boundary slots (extend material via review or rest), and commits.

---

## Edge cases

### Single material

If `materials.length === 1`, the material is auto-assigned its inferred role (largest = anchor by default). All slots tagged for that role get filled until the material runs out. Other slots become rest days. Works.

### N=1 (one-week timeline)

The phasing branch in `tagRoleCandidates` skips to `tagShortTimeline` (Decision 15). All slots get role-ordered chronologically: foundation slots first (earliest in the week), anchor middle, practice last. Round-robin still applies if multiple same-role materials.

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

### Material under-fill or over-fill (±15% tolerance)

When a material's allocated minutes diverge from its declared `totalMinutes` by more than `cfg.materialTotalTolerance` (default ±15%), the engine emits a warning rather than silently distorting the plan:

- `material-overfilled` — allocated > total × 1.15. Rare with partial-slot filling, but possible when the algorithm puts more sessions on a material than its declared budget supports (e.g., very small total in a large-capacity slot).
- `material-underfilled` — allocated < total × 0.85 AND allocated > 0. Common when the available role-tagged slots can't accommodate the full material total — e.g., a 600m anchor in 4 weeks with only 2h Sat sessions has nowhere to put the last 120m.

These warnings let slice 4 surface honest math to the user ("DDIA is allocated 480m of its declared 600m — consider extending the timeline or reducing scope") rather than pretending the plan fits.

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

// Use roadmap to render preview.
// Warning kinds slice 4 should handle:
//   - over-capacity            → block commit, show 3-button modal (extend / hours / trim)
//   - under-capacity-buffer    → soft prompt with Compress / Keep buffer
//   - unresolved-tie-count     → disable commit until every multi-candidate slot is resolved
//   - material-overfilled      → soft warning ("DDIA is allocated more than its declared total")
//   - material-underfilled     → soft warning ("DDIA is short by 120m — consider extending")
//   - anchor-stride-too-wide   → soft warning ("Some weeks have no anchor session")

// On the type dropdown default, call inferRole:
const defaultRole = inferRole(material.title, material.estimatedDuration, existingMaterials)
```

**Multi-candidate slot rendering.** A slot with `candidateMaterialIds.length >= 2` is a Decision 16 boundary slot — the engine couldn't decide on its own and is asking the user. The array contains material IDs the user can pick (representing "extend this material via review") plus the special string `'__rest__'` representing "leave this as a rest day." Slice 4 must render these as tap-to-pick rows with one entry per candidate, treating `'__rest__'` as the rest-day option:

```ts
function renderSlot(slot: Slot, materials: Material[]) {
  if (slot.candidateMaterialIds.length === 0) return <RestDayRow />
  if (slot.candidateMaterialIds.length === 1) return <SessionRow slot={slot} />
  // Multi-candidate — Decision 16 boundary
  return (
    <PickerRow>
      {slot.candidateMaterialIds.map((id) => {
        if (id === '__rest__') return <Option label="Rest day" onPick={() => resolve(slot, null)} />
        const m = materials.find((mm) => mm.id === id)!
        return <Option label={`Review ${m.title}`} onPick={() => resolve(slot, m.id)} />
      })}
    </PickerRow>
  )
}
```

The commit button is disabled while any `unresolved-tie-count` warning is present.

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

Each stage has its own isolated tests:

```
test('Stage 2: buildSlotGrid produces N × |days| slots with correct capacity')
test('Stage 2: weekend slots get weekendHours / weekendCount capacity')
test('Stage 3: capacityCheck reports under-capacity-buffer with suggestedWeeks')
test('Stage 3: capacityCheck reports over-capacity when material > capacity')
test('Stage 4: foundation never tagged when weekIndex >= phase2End')
test('Stage 4: practice never tagged when weekIndex < phase1End')
test('Stage 4: anchor lands on largest-capacity slot (non-uniform week)')
test('Stage 4: uniform-capacity week tags anchor on first selected day only')
test('Stage 4: late-week priority gives practice over anchor when both candidates present')
test('Stage 4: short-timeline branch (N < 3) ignores phase boundaries')
test('Stage 4: viability filter — role with no materials is dropped from candidates')
test('Stage 5: round-robin alternates same-role materials by additionOrder')
test('Stage 5: partial-slot fill uses min(capacity, remaining)')
test('Stage 5: queue-empty produces one boundary multi-candidate slot per role')
test('Stage 5: subsequent leftover slots become plain rest days')
test('retrofitSessionTitles updates "of N" counts after assignment')
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

These are exposed as `RoadmapConfig` in `constants.ts`. Each public engine function accepts an optional `config?: Partial<RoadmapConfig>` argument that deep-merges over `DEFAULT_ROADMAP_CONFIG`:

```ts
export interface RoadmapConfig {
  underCapacityBufferThreshold: number   // 1.3 — Decision 5
  materialTotalTolerance: number         // 0.15 — emit material-overfilled / -underfilled outside band
  anchorStrideMax: number                // 2 — emit anchor-stride-too-wide above this
  inferenceRules: {
    practiceKeywords: RegExp             // /mock|leetcode|exercise|problem set/i
    interviewKeyword: RegExp             // /interview/i
    interviewSizeThreshold: number       // 200 — minutes; "interview" + < this = practice
  }
}
```

A/B testing different values requires injecting `config` into each call site that participates in the test. The `phaseBoundary1` and `phaseBoundary2` fractions (1/3 and 2/3) are currently **hardcoded** in `tagRoleCandidates` and not exposed as tunables — promoting them to `RoadmapConfig` is a deliberate future step.

### Known limitations

1. ~~`slotsNeeded` over-estimates when anchors land on big slots.~~ **Resolved by the Q21 redesign.** The engine no longer computes `slotsNeeded`; it tags candidates first and lets Stage 5 fill until the material exhausts, eliminating the global-average fiction.

2. ~~Under-fill warning missing.~~ **Resolved.** The engine now emits `material-underfilled` and `material-overfilled` warnings when a material's allocated total falls outside the ±15% tolerance band. Slice 4 surfaces these as soft warnings.

3. **Practice fills chronologically, not toward the deadline.** Stage 5 walks practice-tagged slots in chronological order, so a small practice material lands in the *earliest* late-phase weeks and leaves later weeks as rest days. In the canonical example, Mocks (300m) fills weeks 2–4 entirely and weeks 5–7 are rest days — the opposite of "ramp toward the deadline" (Finding 6). Pure reverse-chronological fill would over-correct (everything in week 7). A proper fix needs interleaved/round-robin distribution across the practice phase, which is a real design decision worth taking separately. The under-capacity-buffer prompt mitigates this in practice — it suggests compressing to a tighter timeline where the layout is naturally close-to-deadline.

4. **No spaced review.** The engine doesn't generate "review" sessions for completed material. Spaced repetition would require chapter-level material structure (which the user doesn't provide). Deferred to v2 with a richer material model.

5. **Pin movement on regeneration.** If `regenerateRoadmap` is called with N reduced, pins beyond the new last week generate `pin-overflow` warnings but aren't placed anywhere. The consumer must handle these. A future enhancement could attempt pin-shifting (move week 8's pin to week 6).

6. **Phase boundaries hardcoded.** `phaseBoundary1` (1/3) and `phaseBoundary2` (2/3) are baked into `tagRoleCandidates`. Promoting them to `RoadmapConfig` is straightforward; left for a follow-up because no current consumer needs to adjust them.

7. **Multi-anchor stride coordination.** Two anchor materials each go through the same role-tagged slot list with round-robin. With non-uniform weeks the largest slot per week is anchor, so both materials interleave naturally. Worth verifying in property tests for unusual capacity layouts.

### v2 ideas

- **Material-role auto-detection from URL** — when slice 6 lands (URL paste with metadata fetch), the engine could infer role from the page content (textbook → foundation, GitHub repo → practice).
- **Adaptive recalibration on completed sessions** — feed actual session times back into `slotsNeeded` so future weeks adjust if the user is consistently faster/slower than estimated. (Already implied by ProgressEngine's PaceCalibration in slice 9.)
- **Per-material chunk floors** — let the user set "I want DDIA chunks to be at least 90 min." Currently floors are inferred from role.

---

## Quick reference card

For implementers in a hurry:

```ts
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
  case 'over-capacity':         // BLOCK COMMIT, show 3-option modal
  case 'under-capacity-buffer': // SOFT PROMPT with Compress/Keep
  case 'fits':                  // OK — show preview
}

// Disable commit while ties remain
const tiesUnresolved = roadmap.warnings.find(w => w.kind === 'unresolved-tie-count')

// Multi-candidate slot detection
const isMultiCandidate = (s: Slot) => s.candidateMaterialIds.length >= 2
const isRestOption = (id: string) => id === '__rest__'

// Re-plan honoring pins
const newPlan = regenerateRoadmap(updatedInput, currentPins)

// Add material later
const withNew = addMaterialToRoadmap(roadmap, newMaterial, currentPins)
if (withNew.warnings.some(w => w.kind === 'over-capacity')) {
  // Trigger re-plan flow
}
```

That's the algorithm.
