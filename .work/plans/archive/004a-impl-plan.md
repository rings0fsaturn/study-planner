# 004a — RoadmapEngine Implementation Plan

> Based on the reference algorithm at `design/algo/roadmap-engine.ts` (821 lines).
> This plan describes **changes on top of** the reference, not a rewrite.
> All decisions numbered [#N] reference the 21 grilling decisions.

---

## 1. Package Infrastructure

### 1.1 Create `packages/progress-engine/`

| File | Source | Notes |
|---|---|---|
| `package.json` | Mirror `packages/design-tokens/package.json` | Name: `@study-tracker/progress-engine` [#2] |
| `tsconfig.json` | Copy `packages/design-tokens/tsconfig.json` | Identical settings |
| `vitest.config.ts` | New | `environment: 'node'`, no jsdom/React plugins [#8] |
| `eslint.config.js` | New | Flat config, `@typescript-eslint` parser [#15] |
| `src/index.ts` | New barrel | Re-exports public types + 5 public functions [#11] |

**package.json scripts** [#14]:
```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint ."
  }
}
```

### 1.2 Dependencies

- **devDependencies**: `vitest ^1.6.1`, `fast-check` [#10], `typescript ^5.4.0`, `eslint ^8.57.0`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`
- **Runtime dependencies**: none (zero deps) [#3]
- **do NOT add**: `date-fns` — use inline `addDaysISO` [#3]

---

## 2. Extract Constants → `src/constants.ts` [#5, #18]

**Remove from `roadmap-engine.ts`** (lines 121-123):
```ts
const UNDER_CAPACITY_BUFFER_THRESHOLD = 1.3
const MATERIAL_TOTAL_TOLERANCE = 0.15
const ANCHOR_STRIDE_MAX = 2
```

**Remove from end of file** (lines 817-821):
```ts
export const _TEST_CONSTANTS = { ... }
```

**New file `src/constants.ts`:**
```ts
export interface RoadmapConfig {
  underCapacityBufferThreshold: number
  materialTotalTolerance: number
  anchorStrideMax: number
  inferenceRules: {
    practiceKeywords: RegExp
    interviewKeyword: RegExp
    interviewSizeThreshold: number
  }
}

export const DEFAULT_ROADMAP_CONFIG: RoadmapConfig = {
  underCapacityBufferThreshold: 1.3,
  materialTotalTolerance: 0.15,
  anchorStrideMax: 2,
  inferenceRules: {
    practiceKeywords: /mock|leetcode|exercise|problem set/i,
    interviewKeyword: /interview/i,
    interviewSizeThreshold: 200,
  },
}
```

Also move `WEEKEND_DAYS`, `WEEKDAY_DAYS`, `DAY_OFFSETS` to `constants.ts` as they are non-tunable infrastructure (keep them unexported).

---

## 3. Algorithm Revision: Drop Stage 3, Revise 4+5 [#21]

### 3.1 Delete: Stage 3 (`slotsNeeded`)

**Remove lines 162-170** from `generateRoadmap`:
```ts
const avgSlotCapacity = grid.length > 0 ? totalCapacityMinutes / grid.length : 0
const slotsNeededByMaterial = new Map<string, number>()
...
```

### 3.2 Delete: `tagSlotsWithRoles` (old signature)

**Remove entire old function** (lines 310-343). It accepted `slotsNeeded: Map<string, number>` and used per-role counts to limit how many slots get tagged. The new design tags ALL slots in a phase with role candidates — no count limits.

### 3.3 Delete: `tagAnchor`, `tagFoundation`, `tagPractice` (old counting variants)

**Remove lines 368-439**. These placed `count` tags and stopped. The new design tags all eligible slots.

### 3.4 Delete: `tagShortTimeline` (old counting variant)

**Remove lines 345-361**. Replace with new non-counting version.

### 3.5 New: `tagRoleCandidates` (revised Stage 4)

Replaces the entire old Stage 4. Tags every slot with one or more role candidates, then resolves conflicts by phase-priority.

```
Phase boundaries: phase1End = floor(N/3), phase2End = floor(2N/3)

For each slot in chronological order:
  1. Foundation candidate tag:
     if N < 3 → always eligible (short-timeline: chronological priority)
     if N ≥ 3 AND slot.weekIndex < phase2End → add 'foundation' candidate
  
  2. Anchor candidate tag:
     if slot is the largest-capacity slot in its week (ties → earliest day [#Q21c]):
       add 'anchor' candidate
  
  3. Practice candidate tag:
     if N < 3 → always eligible (short-timeline: chronological priority)
     if N ≥ 3 AND slot.weekIndex >= phase1End → add 'practice' candidate

Conflict resolution (one slot → one role):
  Early  weeks (weekIndex < phase1End):  anchor > foundation > practice
  Middle weeks (phase1End ≤ weekIndex < phase2End): anchor > practice > foundation
  Late   weeks (weekIndex ≥ phase2End):  practice > anchor > foundation

Short-timeline (N < 3): chronological role priority
  foundation earliest slots, anchor middle, practice latest
```

**Implementation note:** `pickLargestUntaggedSlotInWeek` already does "largest, ties go to chronological first" — this is the documented rule for uniform-capacity anchor placement [#Q21c].

### 3.6 New: `assignMaterialsToSlots` (revised Stage 5)

The existing function (lines 486-540) works but needs two changes:

**Change A — Partial-slot filling [#21]**:
```ts
// BEFORE (line 526):
slot.plannedMinutes = slot.capacityMinutes
const left = (remaining.get(m.id) || 0) - slot.capacityMinutes

// AFTER:
const allocated = Math.min(slot.capacityMinutes, remaining.get(m.id) || 0)
slot.plannedMinutes = allocated
const left = (remaining.get(m.id) || 0) - allocated
```

**Change B — Remove `sessionTotals` [#6]** (lines 502, 529):
```ts
// DELETE line 502:
const sessionTotals = countAnticipatedSessions(out, byRole, remaining)

// DELETE line 529 (the "X of Y" title):
slot.sessionTitle = `${m.title} · session ${sessionNum} of ${sessionTotals.get(m.id)}`

// REPLACE line 529 with title without Y:
slot.sessionTitle = `${m.title} · session ${sessionNum}`
```

**After the assignment loops**, add a second pass to compute Y from actual assignments and retrofit titles [#6]:
```ts
// Second pass: count actual sessions per material
const actualSessionCounts = new Map<string, number>()
for (const s of out) {
  if (s.candidateMaterialIds.length === 1) {
    const id = s.candidateMaterialIds[0]
    actualSessionCounts.set(id, (actualSessionCounts.get(id) || 0) + 1)
  }
}
// Retrofit "of Y" into titles
for (const s of out) {
  if (s.candidateMaterialIds.length === 1 && s.sessionTitle) {
    const id = s.candidateMaterialIds[0]
    const total = actualSessionCounts.get(id) || 1
    s.sessionTitle = s.sessionTitle.replace(/ · session \d+$/, ` · session ${extractSessionNum(s.sessionTitle)} of ${total}`)
  }
}
```

### 3.7 Delete: `countAnticipatedSessions`

**Remove lines 543-567**. No longer needed [#6].

---

## 4. `generateRoadmap` Signature Change [#20]

Add optional config parameter:
```ts
export function generateRoadmap(
  input: RoadmapInput,
  config?: Partial<RoadmapConfig>,
): RoadmapOutput
```

Internally merge with `DEFAULT_ROADMAP_CONFIG`:
```ts
const cfg = { ...DEFAULT_ROADMAP_CONFIG, ...config }
```

This flows through to `computeCapacityCheck` (uses `underCapacityBufferThreshold`), `checkAnchorStride` (uses `anchorStrideMax`), and the new material over/under-fill warnings (use `materialTotalTolerance`).

---

## 5. Shared Core for Re-plan [#19]

Extract internal function:
```ts
function generateRoadmapCore(
  input: RoadmapInput,
  config: RoadmapConfig,
  occupiedSlots: Map<string, { materialId: string; plannedMinutes: number; sessionTitle: string | null }>,
): RoadmapOutput
```

- `occupiedSlots` keys are `"weekIndex:dayOfWeek"`.
- Stages 4+5 skip occupied slots entirely — they remain as-is.
- `generateRoadmap(input, config?)` calls `generateRoadmapCore(input, cfg, new Map())`.
- `regenerateRoadmap(input, pins)` calls `generateRoadmapCore(adjustedInput, cfg, occupiedFromPins(pins))`.

---

## 6. `regenerateRoadmap` — Full Re-algorithm [#9]

Current reference (lines 736-775) just overlays pins on a fresh plan. Replace:
```ts
export function regenerateRoadmap(
  input: RoadmapInput,
  pins: PinSet,
  config?: Partial<RoadmapConfig>,
): RoadmapOutput {
  const cfg = { ...DEFAULT_ROADMAP_CONFIG, ...config }

  // 1. Build set of pin keys
  const pinnedKeys = new Set(pins.map(p => `${p.weekIndex}:${p.dayOfWeek}`))

  // 2. Compute remaining material minutes (subtract pinned minutes)
  const pinnedMinutes = new Map<string, number>()
  for (const p of pins) {
    if (p.materialId) {
      pinnedMinutes.set(p.materialId, (pinnedMinutes.get(p.materialId) || 0) + p.plannedMinutes)
    }
  }

  // 3. Build adjusted materials with reduced totals
  const adjustedMaterials = input.materials.map(m => ({
    ...m,
    totalMinutes: Math.max(0, m.totalMinutes - (pinnedMinutes.get(m.id) || 0)),
  })).filter(m => m.totalMinutes > 0)

  // 4. Run core with occupied slots = pinned slots
  const adjustedInput = { ...input, materials: adjustedMaterials }
  const occupied = new Map<string, { materialId: string; plannedMinutes: number; sessionTitle: string | null }>()
  for (const p of pins) {
    occupied.set(`${p.weekIndex}:${p.dayOfWeek}`, {
      materialId: p.materialId ?? '',
      plannedMinutes: p.plannedMinutes,
      sessionTitle: p.sessionTitle,
    })
  }

  const result = generateRoadmapCore(adjustedInput, cfg, occupied)

  // 5. Overlay pins (they may have sessionTitles/plannedMinutes the re-gen doesn't know)
  const flat = result.weeks.flatMap(w => w.slots).map(s => ({ ...s }))
  let pinOverflowMinutes = 0
  for (const pin of pins) {
    const slot = flat.find(s => s.weekIndex === pin.weekIndex && s.dayOfWeek === pin.dayOfWeek)
    if (!slot) {
      pinOverflowMinutes += pin.plannedMinutes
      continue
    }
    slot.candidateMaterialIds = pin.materialId ? [pin.materialId] : []
    slot.plannedMinutes = pin.plannedMinutes
    slot.sessionTitle = pin.sessionTitle
    const m = input.materials.find(x => x.id === pin.materialId)
    slot.role = m?.role ?? null
  }

  const warnings = [...result.warnings]
  if (pinOverflowMinutes > 0) {
    warnings.push({ kind: 'pin-overflow', detail: { overflowMinutes: pinOverflowMinutes } })
  }
  return rebuildRoadmapOutput(flat, warnings, result.capacityCheck)
}
```

---

## 7. `addMaterialToRoadmap` — Recompute CapacityCheck [#16]

Current reference (lines 699) passes original `roadmap.capacityCheck` unchanged:
```ts
return rebuildRoadmapOutput(flatSlots, warnings, roadmap.capacityCheck)
```

Replace with recomputed:
```ts
const totalCapacity = flatSlots.reduce((s, x) => s + x.capacityMinutes, 0)
const totalMaterial = flatSlots
  .filter(s => s.candidateMaterialIds.length > 0)
  .reduce((s, x) => s + x.plannedMinutes, 0)
const newCapacityCheck = computeCapacityCheck(totalCapacity, totalMaterial, { weeks: roadmap.weeks.length } as RoadmapInput)
return rebuildRoadmapOutput(flatSlots, warnings, newCapacityCheck)
```

**Same change in `removeMaterialFromRoadmap`** (line 729).

---

## 8. New Warning Kinds [#7]

Add to `WarningKind` union type (line 71):
```ts
| 'material-overfilled'
| 'material-underfilled'
```

In `assignMaterialsToSlots`, after all roles are processed, compare each material's allocated minutes to its `totalMinutes`:
```ts
for (const m of materials) {
  const allocated = sumPlannedForMaterial(out, m.id)
  const ratio = allocated / m.totalMinutes
  if (ratio > 1 + cfg.materialTotalTolerance) {
    warnings.push({
      kind: 'material-overfilled',
      detail: { materialId: m.id, allocated, total: m.totalMinutes },
    })
  } else if (ratio < 1 - cfg.materialTotalTolerance && allocated > 0) {
    warnings.push({
      kind: 'material-underfilled',
      detail: { materialId: m.id, allocated, total: m.totalMinutes },
    })
  }
}
```

---

## 9. `inferRole` — Move to Use Injected Config [#18]

Pass `config` to `inferRole` (instead of hardcoded constants):
```ts
export function inferRole(
  title: string,
  estimatedMinutes: number,
  existingMaterials: Material[],
  config?: Partial<RoadmapConfig>,
): MaterialRole {
  const rules = { ...DEFAULT_ROADMAP_CONFIG.inferenceRules, ...config?.inferenceRules }
  if (rules.practiceKeywords.test(title)) return 'practice'
  if (rules.interviewKeyword.test(title) && estimatedMinutes < rules.interviewSizeThreshold) return 'practice'
  const maxExisting = existingMaterials.reduce((max, m) => Math.max(max, m.totalMinutes), 0)
  if (estimatedMinutes >= maxExisting) return 'anchor'
  return 'foundation'
}
```

Also move `PRACTICE_KEYWORDS` and `INTERVIEW_KEYWORD` constants out of `roadmap-engine.ts` — they now live in `DEFAULT_ROADMAP_CONFIG.inferenceRules` in `constants.ts`.

---

## 10. `src/index.ts` Barrel [#11]

```ts
export {
  generateRoadmap,
  inferRole,
  addMaterialToRoadmap,
  removeMaterialFromRoadmap,
  regenerateRoadmap,
} from './roadmap-engine'

export {
  DEFAULT_ROADMAP_CONFIG,
  type RoadmapConfig,
} from './constants'

export type {
  DayOfWeek,
  MaterialRole,
  Material,
  RoadmapInput,
  Slot,
  RoadmapWeek,
  RoadmapOutput,
  Pin,
  PinSet,
  Warning,
  WarningKind,
  CapacityCheck,
} from './roadmap-engine'
```

---

## 11. Test Plan (TDD vertical slices)

Follow red-green-refactor, one test at a time.

### Tracer bullet (test 1)
Test: `buildSlotGrid` produces correct grid shape for canonical input.
Code: Stage 1 + Stage 2 (unchanged from reference, ~80 lines preserved).

### Vertical slices

| # | Test | Code change |
|---|---|---|
| 1 | Grid shape correct (N weeks × D days, correct dates) | Stage 1+2 (preserve reference) |
| 2 | Simple single-material assignment (1 anchor, 4 weeks) | Stage 4 (new) + Stage 5 (partial-slot) |
| 3 | Phase boundaries: foundation in early, practice in late | Stage 4 conflict resolution |
| 4 | Short timeline (N=1, N=2): chronological role ordering | `tagShortTimeline` (rewritten non-counting) |
| 5 | Round-robin: two anchors alternate by additionOrder | Stage 5 round-robin |
| 6 | Partial-slot: material exhausts mid-slot | `plannedMinutes = min(capacity, remaining)` |
| 7 | Queue-empty → multi-candidate (Decision 16) | Queue-empty branch in Stage 5 |
| 8 | Session titles: "X of Y" retrofitted correctly (Q6) | Second-pass title retrofitting |
| 9 | Anchor stride warning fires on gap > 2 weeks | `checkAnchorStride` |
| 10 | Material over/under-filled warnings (Q7) | Warning emission after assignment |
| 11 | `regenerateRoadmap`: pins preserved, remaining redistributed (Q9) | `generateRoadmapCore` + `regenerateRoadmap` |
| 12 | `addMaterialToRoadmap`: rest-day only, new capacityCheck (Q16) | `addMaterialToRoadmap` revised |
| 13 | `removeMaterialFromRoadmap`: clears non-pinned, preserves pins | `removeMaterialFromRoadmap` revised |
| 14 | `inferRole`: keyword rules and size thresholds | `inferRole` with config |

### Property tests (fast-check)

| # | Invariant |
|---|---|
| 15 | Determinism: `generateRoadmap(x)` = `generateRoadmap(x)` for any valid x |
| 16 | Foundation phasing: for N ≥ 3, no foundation at weekIndex ≥ floor(2N/3) |
| 17 | Practice phasing: for N ≥ 3, no practice at weekIndex < floor(N/3) |
| 18 | Config injection: different tolerance → different warnings |

### Snapshot tests

| # | Scenario |
|---|---|
| 19 | Canonical: DDIA 600m + CAP 200m + Mocks 300m, 8w, Mon/Wed/Sat, 2h+3h |
| 20 | Single material, 4 weeks |
| 21 | Two anchors round-robin, 6 weeks |
| 22 | N=1 emergency cram |
| 23 | N=2 short prep |
| 24 | Over-capacity |
| 25 | Under-capacity-buffer |
| 26 | Regenerate with pins |
| 27 | addMaterial fits into rest days |
| 28 | removeMaterial clears rest days |

---

## Summary of Lines Changed

| Section | Reference lines | Action |
|---|---|---|
| Constants (121-123) | ~3 | MOVE to `src/constants.ts` |
| `_TEST_CONSTANTS` (817-821) | ~5 | DELETE |
| `PRACTICE_KEYWORDS`, `INTERVIEW_KEYWORD` (610-611) | ~2 | MOVE to `DEFAULT_ROADMAP_CONFIG` |
| `generateRoadmap` Stage 3 (162-170) | ~9 | DELETE |
| `generateRoadmap` Stage 4 call (172-178) | ~7 | REPLACE with new `tagRoleCandidates` call |
| `tagSlotsWithRoles` (310-343) | ~34 | DELETE |
| `tagAnchor` (368-390) | ~23 | DELETE |
| `tagFoundation` (415-425) | ~11 | DELETE |
| `tagPractice` (427-439) | ~13 | DELETE |
| `tagShortTimeline` (345-361) | ~17 | REPLACE (rewrite non-counting) |
| `assignMaterialsToSlots` partial-slot (526, 531) | ~2 | CHANGE |
| `sessionTotals` (502, 529) | ~2 | DELETE reference |
| `countAnticipatedSessions` (543-567) | ~25 | DELETE |
| Session title retrofitting | — | ADD ~15 lines |
| Material over/under-fill warnings | — | ADD ~15 lines |
| `generateRoadmapCore` + config injection | — | ADD ~30 lines |
| `regenerateRoadmap` re-algorithm (736-775) | ~40 | REPLACE |
| `addMaterialToRoadmap` capacityCheck (699) | ~1 | CHANGE |
| `removeMaterialFromRoadmap` capacityCheck (729) | ~1 | CHANGE |
| `inferRole` config injection (613-629) | ~17 | CHANGE |
| New WarningKind union members (71) | +2 | ADD |
| New Stage 4 (`tagRoleCandidates`) | — | ADD ~60 lines |
| **Total reference preserved** | | **~680 of 821 lines** |

---

## File list (final state)

```
packages/progress-engine/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── src/
│   ├── index.ts              # Barrel exports
│   ├── constants.ts           # ROADMAP_CONFIG + day/weekend constants
│   ├── roadmap-engine.ts     # ~700 lines (down from 821)
│   ├── roadmap-engine.test.ts
│   ├── __snapshots__/
│   │   └── roadmap-engine.test.ts.snap
│   └── inferRole.test.ts
└── node_modules/
```
