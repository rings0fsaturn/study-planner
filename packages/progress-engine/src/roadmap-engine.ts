/**
 * RoadmapEngine — pure module that generates a slot-based study plan
 * from materials, weeks, and study-day inputs.
 *
 * This module is the canonical algorithm output of the design grilling
 * captured in ROADMAP_ENGINE_GUIDE.md (16 decisions + 21 grilling decisions).
 *
 * Public API:
 *   - generateRoadmap(input, config?)              — initial roadmap generation
 *   - addMaterialToRoadmap(roadmap, newMaterial, pins)  — incremental add (rest-days only)
 *   - removeMaterialFromRoadmap(roadmap, materialId, pins) — incremental remove
 *   - regenerateRoadmap(input, pins, config?)       — full re-plan honoring pins
 *   - inferRole(title, minutes, existing, config?) — title-regex role inference
 *
 * Invariants (asserted by tests):
 *   - Deterministic: same input → same output
 *   - Material totals honored within ±15% (best-effort, warnings on deviation)
 *   - Foundation never appears in last third of timeline (for N ≥ 3)
 *   - Practice never appears in first third of timeline (for N ≥ 3)
 *   - Anchor stride ≤ 2 weeks (or warning emitted)
 *   - Pins preserved byte-identical across regeneration
 *   - No silent material drops
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
export type MaterialRole = 'anchor' | 'foundation' | 'practice'

export interface Material {
  id: string
  title: string
  totalMinutes: number
  role: MaterialRole
  /** Index from MaterialAdded event order; used as tiebreaker. */
  additionOrder: number
}

export interface RoadmapInput {
  materials: Material[]
  weeks: number
  /** ISO date (YYYY-MM-DD) — week 1 begins this date. */
  startDate: string
  selectedStudyDays: DayOfWeek[]
  /** Total weekday hours per week. */
  weekdayHours: number
  /** Total weekend hours per week. */
  weekendHours: number
}

export interface Slot {
  weekIndex: number
  dayOfWeek: DayOfWeek
  date: string
  capacityMinutes: number
  role: MaterialRole | null
  /** 0 = rest, 1 = resolved, 2+ = user must pick. */
  candidateMaterialIds: string[]
  plannedMinutes: number
  sessionTitle: string | null
}

export interface RoadmapWeek {
  weekIndex: number
  startDate: string
  slots: Slot[]
}

export type WarningKind =
  | 'over-capacity'
  | 'under-capacity-buffer'
  | 'anchor-stride-too-wide'
  | 'pin-overflow'
  | 'unresolved-tie-count'
  | 'material-overfilled'
  | 'material-underfilled'

export interface Warning {
  kind: WarningKind
  detail: Record<string, unknown>
}

export interface CapacityCheck {
  totalCapacityMinutes: number
  totalMaterialMinutes: number
  status: 'fits' | 'over-capacity' | 'under-capacity-buffer'
  /** Suggested smaller N if under-capacity-buffer. */
  suggestedWeeks?: number
}

export interface RoadmapOutput {
  weeks: RoadmapWeek[]
  warnings: Warning[]
  capacityCheck: CapacityCheck
}

/** A pinned slot — preserved verbatim across regeneration. */
export interface Pin {
  weekIndex: number
  dayOfWeek: DayOfWeek
  /** Material id to keep, or null for "pin as rest day". */
  materialId: string | null
  sessionTitle: string | null
  plannedMinutes: number
  /** Why this slot is pinned — informs UI ("locked because completed"). */
  reason: 'completed' | 'today' | 'user-edited'
}

export type PinSet = Pin[]

// ─────────────────────────────────────────────────────────────────────────────
// Imports and config
// ─────────────────────────────────────────────────────────────────────────────

import { DEFAULT_ROADMAP_CONFIG, DAY_OFFSETS, WEEKDAY_DAYS, WEEKEND_DAYS, type RoadmapConfig } from './constants'

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point — generateRoadmap
// ─────────────────────────────────────────────────────────────────────────────

export function generateRoadmap(
  input: RoadmapInput,
  config?: Partial<RoadmapConfig>,
): RoadmapOutput {
  const cfg = { ...DEFAULT_ROADMAP_CONFIG, ...config }
  return generateRoadmapCore(input, cfg, new Map())
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal core — supports occupied slots (for regenerateRoadmap)
// ─────────────────────────────────────────────────────────────────────────────

function generateRoadmapCore(
  input: RoadmapInput,
  cfg: RoadmapConfig,
  occupiedSlots: Map<string, { materialId: string; plannedMinutes: number; sessionTitle: string | null }>,
): RoadmapOutput {
  const validation = validateInputs(input)
  const grid = buildSlotGrid(input)
  const totalCapacityMinutes = sumCapacity(grid)
  const totalMaterialMinutes = input.materials.reduce(
    (s, m) => s + m.totalMinutes, 0,
  )

  const capacityCheck = computeCapacityCheck(
    totalCapacityMinutes,
    totalMaterialMinutes,
    input,
    cfg,
  )

  const warnings: Warning[] = []
  if (capacityCheck.status === 'over-capacity') {
    warnings.push({
      kind: 'over-capacity',
      detail: {
        overflowMinutes: totalMaterialMinutes - totalCapacityMinutes,
      },
    })
  }
  if (capacityCheck.status === 'under-capacity-buffer') {
    warnings.push({
      kind: 'under-capacity-buffer',
      detail: {
        bufferMinutes: totalCapacityMinutes - totalMaterialMinutes,
        suggestedWeeks: capacityCheck.suggestedWeeks,
      },
    })
  }

  // Stage 4 (revised): tag slots with role candidates, then resolve
  const tagged = tagRoleCandidates(grid, input.materials, input.weeks, cfg, occupiedSlots)

  // Anchor stride warning
  const anchorStrideWarning = checkAnchorStride(tagged, input.weeks, cfg)
  if (anchorStrideWarning) warnings.push(anchorStrideWarning)

  // Stage 5 (revised): assign materials with partial-slot filling
  const assigned = assignMaterialsToSlots(tagged, input.materials, cfg)

  // Retrofitting session titles with "X of Y" counts
  retrofitSessionTitles(assigned)

  // Material over/under-fill warnings
  for (const m of input.materials) {
    const allocated = sumPlannedForMaterial(assigned, m.id)
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

  // Surface unresolved-tie count for the consumer's commit-disable logic
  const unresolvedTies = assigned.filter(
    (s) => s.candidateMaterialIds.length >= 2,
  ).length
  if (unresolvedTies > 0) {
    warnings.push({
      kind: 'unresolved-tie-count',
      detail: { count: unresolvedTies },
    })
  }

  // Group into weeks for output
  const weeks = groupSlotsIntoWeeks(assigned, input)

  return { weeks, warnings, capacityCheck }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: validateInputs
// ─────────────────────────────────────────────────────────────────────────────

function validateInputs(input: RoadmapInput): { ok: true } {
  if (input.weeks < 1) {
    throw new Error(`weeks must be >= 1, got ${input.weeks}`)
  }
  if (input.materials.length === 0) {
    throw new Error('at least one material required')
  }
  if (input.selectedStudyDays.length === 0) {
    throw new Error('at least one study day must be selected')
  }
  if (input.weekdayHours < 0 || input.weekendHours < 0) {
    throw new Error('hours must be non-negative')
  }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: build slot grid
// ─────────────────────────────────────────────────────────────────────────────

function buildSlotGrid(input: RoadmapInput): Slot[] {
  const slots: Slot[] = []
  const weekdayCount = input.selectedStudyDays.filter(isWeekday).length
  const weekendCount = input.selectedStudyDays.filter(isWeekend).length
  const weekdayPerSlot = weekdayCount > 0
    ? (input.weekdayHours * 60) / weekdayCount
    : 0
  const weekendPerSlot = weekendCount > 0
    ? (input.weekendHours * 60) / weekendCount
    : 0

  for (let w = 0; w < input.weeks; w++) {
    for (const day of input.selectedStudyDays) {
      const capacityMinutes = isWeekend(day) ? weekendPerSlot : weekdayPerSlot
      slots.push({
        weekIndex: w,
        dayOfWeek: day,
        date: addDaysISO(input.startDate, w * 7 + DAY_OFFSETS[day]),
        capacityMinutes: Math.round(capacityMinutes),
        role: null,
        candidateMaterialIds: [],
        plannedMinutes: 0,
        sessionTitle: null,
      })
    }
  }
  return slots
}

function sumCapacity(slots: Slot[]): number {
  return slots.reduce((s, x) => s + x.capacityMinutes, 0)
}

function isWeekend(d: DayOfWeek): boolean {
  return WEEKEND_DAYS.includes(d)
}
function isWeekday(d: DayOfWeek): boolean {
  return WEEKDAY_DAYS.includes(d)
}

// ─────────────────────────────────────────────────────────────────────────────
// Capacity check
// ─────────────────────────────────────────────────────────────────────────────

function computeCapacityCheck(
  totalCapacity: number,
  totalMaterial: number,
  input: RoadmapInput,
  cfg: RoadmapConfig,
): CapacityCheck {
  if (totalMaterial > totalCapacity) {
    return {
      totalCapacityMinutes: totalCapacity,
      totalMaterialMinutes: totalMaterial,
      status: 'over-capacity',
    }
  }
  if (totalCapacity > totalMaterial * cfg.underCapacityBufferThreshold) {
    // Compute the smallest N where materials still fit
    const perWeekCapacity = totalCapacity / input.weeks
    const suggestedWeeks = Math.ceil(totalMaterial / perWeekCapacity)
    return {
      totalCapacityMinutes: totalCapacity,
      totalMaterialMinutes: totalMaterial,
      status: 'under-capacity-buffer',
      suggestedWeeks,
    }
  }
  return {
    totalCapacityMinutes: totalCapacity,
    totalMaterialMinutes: totalMaterial,
    status: 'fits',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4 (revised): tagRoleCandidates
//   - Tags every slot with role candidates based on phase
//   - Resolves conflicts by phase priority
// ─────────────────────────────────────────────────────────────────────────────

function tagRoleCandidates(
  slots: Slot[],
  _materials: Material[],
  weeks: number,
  cfg: RoadmapConfig,
  occupiedSlots: Map<string, { materialId: string; plannedMinutes: number; sessionTitle: string | null }>,
): Slot[] {
  const out = slots.map((s) => {
    const key = `${s.weekIndex}:${s.dayOfWeek}`
    const occupied = occupiedSlots.get(key)
    if (occupied) {
      return {
        ...s,
        role: s.role, // will be set by caller
        candidateMaterialIds: occupied.materialId ? [occupied.materialId] : [],
        plannedMinutes: occupied.plannedMinutes,
        sessionTitle: occupied.sessionTitle,
      }
    }
    return { ...s }
  })

  if (weeks < 3) {
    return tagShortTimeline(out)
  }

  const phase1End = Math.floor(weeks / 3)        // exclusive
  const phase2End = Math.floor((2 * weeks) / 3)  // exclusive

  // Phase 1 (foundation): early weeks [0, phase2End)
  // Phase 2 (anchor + practice): middle weeks [phase1End, phase2End)  
  // Phase 3 (practice + anchor): late weeks [phase2End, weeks)

  // Step 1: Add candidates based on phase
  for (const slot of out) {
    if (slot.role !== null) continue // occupied slot

    const candidates: MaterialRole[] = []

    // Foundation candidate: early phase
    if (slot.weekIndex < phase2End) {
      candidates.push('foundation')
    }

    // Practice candidate: late phase
    if (slot.weekIndex >= phase1End) {
      candidates.push('practice')
    }

    // Anchor candidate: largest slot in week (ties → earliest day)
    const weekSlots = out.filter(s => s.weekIndex === slot.weekIndex && s !== slot)
    const allWeekSlots = [slot, ...weekSlots]
    const maxCapacity = Math.max(...allWeekSlots.map(s => s.capacityMinutes))
    if (slot.capacityMinutes >= maxCapacity) {
      candidates.push('anchor')
    }

    // Resolve to single role by phase priority
    slot.role = resolveRoleCandidate(slot.weekIndex, phase1End, phase2End, candidates)
  }

  return out
}

function resolveRoleCandidate(
  weekIndex: number,
  phase1End: number,
  phase2End: number,
  candidates: MaterialRole[],
): MaterialRole | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  // Anchor always wins when it's a candidate (largest slot in week)
  // This ensures anchors are on the largest-capacity slots consistently
  if (candidates.includes('anchor')) return 'anchor'

  // Priority by phase for non-anchor candidates
  const isEarly = weekIndex < phase1End
  const isLate = weekIndex >= phase2End

  if (isEarly) {
    if (candidates.includes('foundation')) return 'foundation'
    return candidates[0]
  }
  if (isLate) {
    if (candidates.includes('practice')) return 'practice'
    return candidates[0]
  }
  // Middle: anchor already handled above, try practice then foundation
  if (candidates.includes('practice')) return 'practice'
  if (candidates.includes('foundation')) return 'foundation'
  return candidates[0]
}

function tagShortTimeline(slots: Slot[]): Slot[] {
  // Chronological: foundation → anchor → practice
  let i = 0
  const total = slots.length
  const foundationSlots = Math.floor(total / 3)
  const anchorSlots = Math.floor(total / 3)
  // Remaining are practice

  for (let n = 0; n < foundationSlots && i < total; n++, i++) {
    slots[i].role = 'foundation'
  }
  for (let n = 0; n < anchorSlots && i < total; n++, i++) {
    slots[i].role = 'anchor'
  }
  for (; i < total; i++) {
    slots[i].role = 'practice'
  }
  return slots
}

// ─────────────────────────────────────────────────────────────────────────────
// Anchor stride warning
// ─────────────────────────────────────────────────────────────────────────────

function checkAnchorStride(slots: Slot[], weeks: number, cfg: RoadmapConfig): Warning | null {
  const anchorWeeks = new Set<number>()
  for (const s of slots) if (s.role === 'anchor') anchorWeeks.add(s.weekIndex)
  if (anchorWeeks.size === 0) return null
  const sorted = [...anchorWeeks].sort((a, b) => a - b)
  let maxGap = 0
  for (let i = 1; i < sorted.length; i++) {
    maxGap = Math.max(maxGap, sorted[i] - sorted[i - 1])
  }
  if (maxGap > cfg.anchorStrideMax) {
    return {
      kind: 'anchor-stride-too-wide',
      detail: { maxGapWeeks: maxGap, anchorWeeks: sorted },
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 5 (revised): assign materials to role-tagged slots
//   - Partial-slot filling enabled
//   - No dry-run for session counts
// ─────────────────────────────────────────────────────────────────────────────

function assignMaterialsToSlots(
  slots: Slot[],
  materials: Material[],
  cfg: RoadmapConfig,
): Slot[] {
  const out = slots.map((s) => ({ ...s }))
  const byRole: Record<MaterialRole, Material[]> = {
    anchor: [],
    foundation: [],
    practice: [],
  }
  for (const m of materials) byRole[m.role].push(m)
  // Sort by additionOrder for deterministic round-robin
  for (const role of (Object.keys(byRole) as MaterialRole[])) {
    byRole[role].sort((a, b) => a.additionOrder - b.additionOrder)
  }

  // Per-material remaining minutes & session counters
  const remaining = new Map<string, number>(materials.map((m) => [m.id, m.totalMinutes]))
  const sessionCounter = new Map<string, number>(materials.map((m) => [m.id, 0]))

  // For each role, walk role-tagged slots chronologically, popping from queue
  for (const role of ['foundation', 'anchor', 'practice'] as const) {
    const queue = [...byRole[role]]
    if (queue.length === 0) continue

    const roleSlots = out
      .filter((s) => s.role === role)
      .sort(slotChronoCompare)

    for (const slot of roleSlots) {
      if (queue.length === 0) {
        // Queue empty before slots exhausted — emit as multi-candidate
        slot.candidateMaterialIds = byRole[role].map((m) => m.id)
        slot.plannedMinutes = slot.capacityMinutes
        slot.sessionTitle = null
        continue
      }

      // Round-robin: pop, assign, requeue if minutes remain
      const m = queue.shift()!
      slot.candidateMaterialIds = [m.id]

      // Partial-slot filling
      const allocated = Math.min(slot.capacityMinutes, remaining.get(m.id) || 0)
      slot.plannedMinutes = allocated

      const sessionNum = (sessionCounter.get(m.id) || 0) + 1
      sessionCounter.set(m.id, sessionNum)
      slot.sessionTitle = `${m.title} · session ${sessionNum}`

      const left = (remaining.get(m.id) || 0) - allocated
      remaining.set(m.id, left)
      if (left > 0) queue.push(m) // requeue
      // else: drop from queue (material is done)
    }
  }

  // Slots with no role and no assignment remain rest days
  return out
}

/** Retrofit "X of Y" into session titles after assignment. */
function retrofitSessionTitles(slots: Slot[]): void {
  const actualSessionCounts = new Map<string, number>()
  for (const s of slots) {
    if (s.candidateMaterialIds.length === 1) {
      const id = s.candidateMaterialIds[0]
      actualSessionCounts.set(id, (actualSessionCounts.get(id) || 0) + 1)
    }
  }
  for (const s of slots) {
    if (s.candidateMaterialIds.length === 1 && s.sessionTitle) {
      const id = s.candidateMaterialIds[0]
      const total = actualSessionCounts.get(id) || 1
      // Replace "session N" with "session N of Y"
      const match = s.sessionTitle.match(/session (\d+)$/)
      if (match) {
        s.sessionTitle = s.sessionTitle.replace(/session \d+$/, `session ${match[1]} of ${total}`)
      }
    }
  }
}

function sumPlannedForMaterial(slots: Slot[], materialId: string): number {
  return slots
    .filter(s => s.candidateMaterialIds.includes(materialId))
    .reduce((s, x) => s + x.plannedMinutes, 0)
}

function slotChronoCompare(a: Slot, b: Slot): number {
  if (a.weekIndex !== b.weekIndex) return a.weekIndex - b.weekIndex
  return DAY_OFFSETS[a.dayOfWeek] - DAY_OFFSETS[b.dayOfWeek]
}

// ─────────────────────────────────────────────────────────────────────────────
// Group slots into weeks for output
// ─────────────────────────────────────────────────────────────────────────────

function groupSlotsIntoWeeks(slots: Slot[], input: RoadmapInput): RoadmapWeek[] {
  const weeks: RoadmapWeek[] = []
  for (let w = 0; w < input.weeks; w++) {
    weeks.push({
      weekIndex: w,
      startDate: addDaysISO(input.startDate, w * 7),
      slots: slots
        .filter((s) => s.weekIndex === w)
        .sort(slotChronoCompare),
    })
  }
  return weeks
}

// ─────────────────────────────────────────────────────────────────────────────
// Date math (lightweight — inline UTC)
// ─────────────────────────────────────────────────────────────────────────────

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// ─────────────────────────────────────────────────────────────────────────────
// inferRole — title-regex inference with injected config
// ─────────────────────────────────────────────────────────────────────────────

export function inferRole(
  title: string,
  estimatedMinutes: number,
  existingMaterials: Material[],
  config?: Partial<RoadmapConfig>,
): MaterialRole {
  const cfg = { ...DEFAULT_ROADMAP_CONFIG, ...config }
  const rules = cfg.inferenceRules

  // Rule 1: matches practice keywords → practice
  if (rules.practiceKeywords.test(title)) return 'practice'
  // Rule 2: contains "interview" AND total < threshold → practice
  if (rules.interviewKeyword.test(title) && estimatedMinutes < rules.interviewSizeThreshold) return 'practice'
  // Rule 3: largest seen so far → anchor
  const maxExisting = existingMaterials.reduce(
    (max, m) => Math.max(max, m.totalMinutes), 0,
  )
  if (estimatedMinutes >= maxExisting) return 'anchor'
  // Rule 4: otherwise → foundation
  return 'foundation'
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-commit operations — addMaterial, removeMaterial, regenerate
// ─────────────────────────────────────────────────────────────────────────────

export function addMaterialToRoadmap(
  roadmap: RoadmapOutput,
  newMaterial: Material,
  pins: PinSet,
  config?: Partial<RoadmapConfig>,
): RoadmapOutput {
  const cfg = { ...DEFAULT_ROADMAP_CONFIG, ...config }
  const flatSlots: Slot[] = roadmap.weeks.flatMap((w) => w.slots).map((s) => ({ ...s }))
  const pinnedKeys = new Set(pins.map((p) => `${p.weekIndex}:${p.dayOfWeek}`))

  // Find rest-day, unpinned slots
  const candidates = flatSlots.filter(
    (s) =>
      s.role === null &&
      s.candidateMaterialIds.length === 0 &&
      !pinnedKeys.has(`${s.weekIndex}:${s.dayOfWeek}`),
  )

  if (candidates.length === 0) {
    const warnings: Warning[] = [...roadmap.warnings, {
      kind: 'over-capacity' as WarningKind,
      detail: { materialId: newMaterial.id, slotsNeeded: 1, slotsAvailable: 0 },
    }]
    return rebuildRoadmapOutput(flatSlots, warnings, roadmap.capacityCheck)
  }

  // Compute average capacity of candidates
  const avgCapacity = candidates.reduce((sum, s) => sum + s.capacityMinutes, 0) / candidates.length
  const slotsNeeded = avgCapacity > 0 ? Math.ceil(newMaterial.totalMinutes / avgCapacity) : 0

  // Place per role rule
  let toPlace: Slot[] = []
  if (newMaterial.role === 'anchor') {
    toPlace = pickEvenlyAcrossWeeks(candidates, slotsNeeded)
  } else if (newMaterial.role === 'foundation') {
    toPlace = candidates.sort(slotChronoCompare).slice(0, slotsNeeded)
  } else {
    toPlace = candidates.sort((a, b) => slotChronoCompare(b, a)).slice(0, slotsNeeded)
  }

  // Detect overflow
  const warnings: Warning[] = [...roadmap.warnings]
  if (toPlace.length < slotsNeeded) {
    warnings.push({
      kind: 'over-capacity',
      detail: { materialId: newMaterial.id, slotsNeeded, slotsAvailable: toPlace.length },
    })
  }

  // Assign
  let session = 0
  for (const slot of toPlace) {
    session++
    slot.role = newMaterial.role
    slot.candidateMaterialIds = [newMaterial.id]
    slot.plannedMinutes = slot.capacityMinutes
    slot.sessionTitle = `${newMaterial.title} · session ${session} of ${toPlace.length}`
  }

  // Recompute capacityCheck
  const totalCapacity = flatSlots.reduce((s, x) => s + x.capacityMinutes, 0)
  const totalMaterial = flatSlots
    .filter(s => s.candidateMaterialIds.length > 0)
    .reduce((s, x) => s + x.plannedMinutes, 0)
  const newCapacityCheck = computeCapacityCheck(
    totalCapacity,
    totalMaterial,
    { weeks: roadmap.weeks.length, materials: [], startDate: '', selectedStudyDays: [], weekdayHours: 0, weekendHours: 0 },
    cfg,
  )

  return rebuildRoadmapOutput(flatSlots, warnings, newCapacityCheck)
}

export function removeMaterialFromRoadmap(
  roadmap: RoadmapOutput,
  materialId: string,
  pins: PinSet,
  config?: Partial<RoadmapConfig>,
): RoadmapOutput {
  const cfg = { ...DEFAULT_ROADMAP_CONFIG, ...config }
  const pinnedKeys = new Set(pins.map((p) => `${p.weekIndex}:${p.dayOfWeek}`))
  const flatSlots: Slot[] = roadmap.weeks.flatMap((w) => w.slots).map((s) => ({ ...s }))

  for (const s of flatSlots) {
    const key = `${s.weekIndex}:${s.dayOfWeek}`
    if (pinnedKeys.has(key)) continue // immutable
    if (s.candidateMaterialIds.includes(materialId)) {
      s.candidateMaterialIds = s.candidateMaterialIds.filter((id) => id !== materialId)
      if (s.candidateMaterialIds.length === 0) {
        s.role = null
        s.plannedMinutes = 0
        s.sessionTitle = null
      }
    }
  }

  // Recompute capacityCheck
  const totalCapacity = flatSlots.reduce((s, x) => s + x.capacityMinutes, 0)
  const totalMaterial = flatSlots
    .filter(s => s.candidateMaterialIds.length > 0)
    .reduce((s, x) => s + x.plannedMinutes, 0)
  const newCapacityCheck = computeCapacityCheck(
    totalCapacity,
    totalMaterial,
    { weeks: roadmap.weeks.length, materials: [], startDate: '', selectedStudyDays: [], weekdayHours: 0, weekendHours: 0 },
    cfg,
  )

  return rebuildRoadmapOutput(flatSlots, roadmap.warnings, newCapacityCheck)
}

export function regenerateRoadmap(
  input: RoadmapInput,
  pins: PinSet,
  config?: Partial<RoadmapConfig>,
): RoadmapOutput {
  const cfg = { ...DEFAULT_ROADMAP_CONFIG, ...config }

  // Build set of pin keys and compute remaining material minutes
  const pinnedKeys = new Set(pins.map(p => `${p.weekIndex}:${p.dayOfWeek}`))
  const pinnedMinutes = new Map<string, number>()
  for (const p of pins) {
    if (p.materialId) {
      pinnedMinutes.set(p.materialId, (pinnedMinutes.get(p.materialId) || 0) + p.plannedMinutes)
    }
  }

  // Build adjusted materials with reduced totals
  const adjustedMaterials = input.materials.map(m => ({
    ...m,
    totalMinutes: Math.max(0, m.totalMinutes - (pinnedMinutes.get(m.id) || 0)),
  })).filter(m => m.totalMinutes > 0)

  // Build occupied slots from pins
  const occupied = new Map<string, { materialId: string; plannedMinutes: number; sessionTitle: string | null }>()
  for (const p of pins) {
    occupied.set(`${p.weekIndex}:${p.dayOfWeek}`, {
      materialId: p.materialId ?? '',
      plannedMinutes: p.plannedMinutes,
      sessionTitle: p.sessionTitle,
    })
  }

  const adjustedInput = { ...input, materials: adjustedMaterials }
  const result = generateRoadmapCore(adjustedInput, cfg, occupied)

  // Overlay pins (may have sessionTitles the re-gen doesn't know)
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

  // Recompute capacityCheck
  const totalCapacity = flat.reduce((s, x) => s + x.capacityMinutes, 0)
  const totalMaterial = flat
    .filter(s => s.candidateMaterialIds.length > 0)
    .reduce((s, x) => s + x.plannedMinutes, 0)
  const newCapacityCheck = computeCapacityCheck(
    totalCapacity,
    totalMaterial,
    { weeks: input.weeks, materials: [], startDate: '', selectedStudyDays: [], weekdayHours: 0, weekendHours: 0 },
    cfg,
  )

  return rebuildRoadmapOutput(flat, warnings, newCapacityCheck)
}

function rebuildRoadmapOutput(
  flatSlots: Slot[],
  warnings: Warning[],
  _capacityCheck: CapacityCheck,
): RoadmapOutput {
  const weekIndices = new Set(flatSlots.map((s) => s.weekIndex))
  const weeks: RoadmapWeek[] = []
  for (const w of [...weekIndices].sort((a, b) => a - b)) {
    const wSlots = flatSlots
      .filter((s) => s.weekIndex === w)
      .sort(slotChronoCompare)
    weeks.push({
      weekIndex: w,
      startDate: wSlots[0]?.date ?? '',
      slots: wSlots,
    })
  }

  // Recompute capacityCheck from flatSlots
  const totalCapacity = flatSlots.reduce((s, x) => s + x.capacityMinutes, 0)
  const totalMaterial = flatSlots
    .filter(s => s.candidateMaterialIds.length > 0)
    .reduce((s, x) => s + x.plannedMinutes, 0)

  const isOverCapacity = totalMaterial > totalCapacity
  const isUnderCapacityBuffer = totalCapacity > totalMaterial * DEFAULT_ROADMAP_CONFIG.underCapacityBufferThreshold
  const status: CapacityCheck['status'] = isOverCapacity ? 'over-capacity'
    : isUnderCapacityBuffer ? 'under-capacity-buffer'
    : 'fits'

  const capacityCheck: CapacityCheck = {
    totalCapacityMinutes: totalCapacity,
    totalMaterialMinutes: totalMaterial,
    status,
  }

  return { weeks, warnings, capacityCheck }
}

function pickEvenlyAcrossWeeks(slots: Slot[], count: number): Slot[] {
  if (slots.length === 0 || count <= 0) return []
  const byWeek = new Map<number, Slot[]>()
  for (const s of slots) {
    if (!byWeek.has(s.weekIndex)) byWeek.set(s.weekIndex, [])
    byWeek.get(s.weekIndex)!.push(s)
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b)
  const chosenWeeks = pickEvenlySpacedWeeks(Math.min(count, weeks.length), weeks.length)
  const result: Slot[] = []
  for (const idx of chosenWeeks) {
    const w = weeks[idx]
    const slot = byWeek.get(w)?.[0]
    if (slot) result.push(slot)
    if (result.length >= count) break
  }
  return result
}

function pickEvenlySpacedWeeks(count: number, total: number): number[] {
  if (count >= total) {
    return Array.from({ length: total }, (_, i) => i)
  }
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    const w = Math.round((i * total) / count)
    if (!result.includes(w) && w < total) result.push(w)
  }
  let nextProbe = 0
  while (result.length < count && nextProbe < total) {
    if (!result.includes(nextProbe)) result.push(nextProbe)
    nextProbe++
  }
  return result.sort((a, b) => a - b).slice(0, count)
}
