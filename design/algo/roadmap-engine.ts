/**
 * RoadmapEngine — pure module that generates a slot-based study plan
 * from materials, weeks, and study-day inputs.
 *
 * This module is the canonical algorithm output of the design grilling
 * captured in ROADMAP_ENGINE_GUIDE.md (16 decisions, summarized inline).
 *
 * Public API:
 *   - generateRoadmap(input)              — initial roadmap generation
 *   - addMaterialToRoadmap(roadmap, ...)  — incremental add (rest-days only)
 *   - removeMaterialFromRoadmap(...)      — incremental remove (slots → rest)
 *   - regenerateRoadmap(input, pins)      — full re-plan honoring pins
 *   - inferRole(title, minutes, existing) — title-regex role inference
 *
 * Invariants (asserted by tests):
 *   - Deterministic: same input → same output
 *   - Material totals honored within ±15%
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
  /** Index from MaterialAdded event order; used as tiebreaker (Decision 14). */
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
  /** 0 = rest, 1 = resolved, 2+ = user must pick (Decision 16). */
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
// Constants — tunable post-launch via config; hardcoded here for v1
// ─────────────────────────────────────────────────────────────────────────────

const WEEKEND_DAYS: ReadonlyArray<DayOfWeek> = ['Sat', 'Sun']
const WEEKDAY_DAYS: ReadonlyArray<DayOfWeek> = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAY_OFFSETS: Record<DayOfWeek, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
}

const UNDER_CAPACITY_BUFFER_THRESHOLD = 1.3 // Decision 5
const MATERIAL_TOTAL_TOLERANCE = 0.15        // Material totals honored within ±15%
const ANCHOR_STRIDE_MAX = 2                  // Weeks; warn if exceeded

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point — generateRoadmap
// ─────────────────────────────────────────────────────────────────────────────

export function generateRoadmap(input: RoadmapInput): RoadmapOutput {
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

  // Compute slots needed per material (Stage 3)
  const avgSlotCapacity = grid.length > 0 ? totalCapacityMinutes / grid.length : 0
  const slotsNeededByMaterial = new Map<string, number>()
  for (const m of input.materials) {
    const needed = avgSlotCapacity > 0
      ? Math.ceil(m.totalMinutes / avgSlotCapacity)
      : 0
    slotsNeededByMaterial.set(m.id, needed)
  }

  // Stage 4: tag slots with roles
  const tagged = tagSlotsWithRoles(
    grid,
    input.materials,
    slotsNeededByMaterial,
    input.weeks,
  )

  // Anchor stride warning
  const anchorStrideWarning = checkAnchorStride(tagged, input.weeks)
  if (anchorStrideWarning) warnings.push(anchorStrideWarning)

  // Stage 5: assign materials to role-tagged slots (round-robin per Decision 12)
  const assigned = assignMaterialsToSlots(tagged, input.materials)

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
): CapacityCheck {
  if (totalMaterial > totalCapacity) {
    return {
      totalCapacityMinutes: totalCapacity,
      totalMaterialMinutes: totalMaterial,
      status: 'over-capacity',
    }
  }
  if (totalCapacity > totalMaterial * UNDER_CAPACITY_BUFFER_THRESHOLD) {
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
// Stage 4: tag slots with roles
//   - Anchor: spread evenly across weeks (stride pattern)
//   - Foundation: front-loaded — fill earliest weeks first
//   - Practice: back-loaded — fill latest weeks first
//   - For N < 3: phasing collapses to chronological slot ordering (Decision 15)
// ─────────────────────────────────────────────────────────────────────────────

function tagSlotsWithRoles(
  slots: Slot[],
  materials: Material[],
  slotsNeeded: Map<string, number>,
  weeks: number,
): Slot[] {
  const out = slots.map((s) => ({ ...s }))

  // Aggregate slots-needed by role
  const needed = { anchor: 0, foundation: 0, practice: 0 }
  for (const m of materials) {
    needed[m.role] += slotsNeeded.get(m.id) || 0
  }

  if (weeks < 3) {
    // Decision 15: chronological slot order, role priority
    return tagShortTimeline(out, needed)
  }

  // Phase boundaries (Decision: phase split at floor(N/3) and floor(2N/3))
  const phase1End = Math.floor(weeks / 3)        // exclusive
  const phase2End = Math.floor((2 * weeks) / 3)  // exclusive

  // Anchor: spread evenly across all weeks using stride pattern
  tagAnchor(out, needed.anchor, weeks)

  // Foundation: earliest available slots in weeks [0, phase2End)
  tagFoundation(out, needed.foundation, phase2End)

  // Practice: latest available slots in weeks [phase1End, weeks)
  tagPractice(out, needed.practice, weeks, phase1End)

  return out
}

function tagShortTimeline(slots: Slot[], needed: { anchor: number; foundation: number; practice: number }): Slot[] {
  // Order chronologically (already in that order from buildSlotGrid)
  let i = 0
  // Foundations earliest
  for (let n = 0; n < needed.foundation && i < slots.length; n++, i++) {
    slots[i].role = 'foundation'
  }
  // Anchor middle
  for (let n = 0; n < needed.anchor && i < slots.length; n++, i++) {
    slots[i].role = 'anchor'
  }
  // Practice latest
  for (let n = 0; n < needed.practice && i < slots.length; n++, i++) {
    slots[i].role = 'practice'
  }
  return slots
}

/**
 * Spread `count` anchor tags evenly across `weeks` weeks.
 * For 6 anchors over 8 weeks → pattern [1,1,0,1,1,0,1,1].
 * Within a chosen week, picks the largest-capacity available slot.
 */
function tagAnchor(slots: Slot[], count: number, weeks: number): void {
  if (count <= 0) return
  if (count >= weeks) {
    // One per week — try to place in every week
    for (let w = 0; w < weeks; w++) {
      const slot = pickLargestUntaggedSlotInWeek(slots, w)
      if (slot) slot.role = 'anchor'
    }
    // Any extras pile into the largest-capacity slots not yet anchored
    const extras = count - weeks
    for (let i = 0; i < extras; i++) {
      const slot = pickLargestUntaggedSlot(slots)
      if (slot) slot.role = 'anchor'
    }
    return
  }
  // Even distribution across weeks: pick `count` weeks evenly spaced
  const chosenWeeks = pickEvenlySpacedWeeks(count, weeks)
  for (const w of chosenWeeks) {
    const slot = pickLargestUntaggedSlotInWeek(slots, w)
    if (slot) slot.role = 'anchor'
  }
}

/**
 * Pick `count` weeks from [0, total) as evenly distributed as possible.
 * For (count=6, total=8): returns [0, 1, 3, 4, 6, 7] — gaps at W2 and W5.
 */
function pickEvenlySpacedWeeks(count: number, total: number): number[] {
  if (count >= total) {
    return Array.from({ length: total }, (_, i) => i)
  }
  const result: number[] = []
  // Distribute by ratio: position = round(i * total / count)
  for (let i = 0; i < count; i++) {
    const w = Math.round((i * total) / count)
    if (!result.includes(w) && w < total) result.push(w)
  }
  // Fill any gaps if rounding lost slots
  let nextProbe = 0
  while (result.length < count && nextProbe < total) {
    if (!result.includes(nextProbe)) result.push(nextProbe)
    nextProbe++
  }
  return result.sort((a, b) => a - b).slice(0, count)
}

function tagFoundation(slots: Slot[], count: number, phaseEnd: number): void {
  if (count <= 0) return
  let placed = 0
  for (const s of slots) {
    if (placed >= count) break
    if (s.weekIndex >= phaseEnd) break
    if (s.role !== null) continue
    s.role = 'foundation'
    placed++
  }
}

function tagPractice(slots: Slot[], count: number, weeks: number, phaseStart: number): void {
  if (count <= 0) return
  // Walk slots in reverse chronological order, placing practice tags
  let placed = 0
  for (let i = slots.length - 1; i >= 0; i--) {
    if (placed >= count) break
    const s = slots[i]
    if (s.weekIndex < phaseStart) break
    if (s.role !== null) continue
    s.role = 'practice'
    placed++
  }
}

function pickLargestUntaggedSlotInWeek(slots: Slot[], weekIndex: number): Slot | null {
  let best: Slot | null = null
  for (const s of slots) {
    if (s.weekIndex !== weekIndex) continue
    if (s.role !== null) continue
    if (!best || s.capacityMinutes > best.capacityMinutes) best = s
  }
  return best
}

function pickLargestUntaggedSlot(slots: Slot[]): Slot | null {
  let best: Slot | null = null
  for (const s of slots) {
    if (s.role !== null) continue
    if (!best || s.capacityMinutes > best.capacityMinutes) best = s
  }
  return best
}

// ─────────────────────────────────────────────────────────────────────────────
// Anchor stride warning
// ─────────────────────────────────────────────────────────────────────────────

function checkAnchorStride(slots: Slot[], weeks: number): Warning | null {
  const anchorWeeks = new Set<number>()
  for (const s of slots) if (s.role === 'anchor') anchorWeeks.add(s.weekIndex)
  if (anchorWeeks.size === 0) return null
  const sorted = [...anchorWeeks].sort((a, b) => a - b)
  let maxGap = 0
  for (let i = 1; i < sorted.length; i++) {
    maxGap = Math.max(maxGap, sorted[i] - sorted[i - 1])
  }
  if (maxGap > ANCHOR_STRIDE_MAX) {
    return {
      kind: 'anchor-stride-too-wide',
      detail: { maxGapWeeks: maxGap, anchorWeeks: sorted },
    }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 5: assign materials to role-tagged slots (round-robin per Decision 12)
// ─────────────────────────────────────────────────────────────────────────────

function assignMaterialsToSlots(slots: Slot[], materials: Material[]): Slot[] {
  const out = slots.map((s) => ({ ...s }))
  const byRole: Record<MaterialRole, Material[]> = {
    anchor: [],
    foundation: [],
    practice: [],
  }
  for (const m of materials) byRole[m.role].push(m)
  // Sort by additionOrder for deterministic round-robin
  for (const role of Object.keys(byRole) as MaterialRole[]) {
    byRole[role].sort((a, b) => a.additionOrder - b.additionOrder)
  }

  // Per-material remaining minutes & session counters
  const remaining = new Map<string, number>(materials.map((m) => [m.id, m.totalMinutes]))
  const sessionCounter = new Map<string, number>(materials.map((m) => [m.id, 0]))
  const sessionTotals = countAnticipatedSessions(out, byRole, remaining)

  // For each role, walk role-tagged slots chronologically, popping from queue
  for (const role of ['foundation', 'anchor', 'practice'] as const) {
    const queue = [...byRole[role]]
    if (queue.length === 0) continue

    const roleSlots = out
      .filter((s) => s.role === role)
      .sort(slotChronoCompare)

    for (const slot of roleSlots) {
      if (queue.length === 0) {
        // Decision 16: queue empty before slots exhausted — emit as multi-candidate
        slot.candidateMaterialIds = byRole[role].map((m) => m.id)
        // Special: include 'rest' as implicit candidate (consumer renders + Rest day option)
        slot.plannedMinutes = slot.capacityMinutes
        slot.sessionTitle = null
        continue
      }

      // Round-robin: pop, assign, requeue if minutes remain
      const m = queue.shift()!
      slot.candidateMaterialIds = [m.id]
      slot.plannedMinutes = slot.capacityMinutes
      const sessionNum = (sessionCounter.get(m.id) || 0) + 1
      sessionCounter.set(m.id, sessionNum)
      slot.sessionTitle = `${m.title} · session ${sessionNum} of ${sessionTotals.get(m.id)}`

      const left = (remaining.get(m.id) || 0) - slot.capacityMinutes
      remaining.set(m.id, left)
      if (left > 0) queue.push(m) // requeue
      // else: drop from queue (material is done)
    }
  }

  // Slots with no role and no assignment remain rest days
  return out
}

/** Count how many sessions each material is anticipated to have, for "X of Y" titles. */
function countAnticipatedSessions(
  slots: Slot[],
  byRole: Record<MaterialRole, Material[]>,
  remaining: Map<string, number>,
): Map<string, number> {
  // Simulate the round-robin without mutation to count sessions per material
  const result = new Map<string, number>()
  const remainingCopy = new Map(remaining)
  for (const role of ['foundation', 'anchor', 'practice'] as const) {
    const queue = [...byRole[role]].sort((a, b) => a.additionOrder - b.additionOrder)
    if (queue.length === 0) continue
    const roleSlots = slots
      .filter((s) => s.role === role)
      .sort(slotChronoCompare)
    for (const slot of roleSlots) {
      if (queue.length === 0) break
      const m = queue.shift()!
      result.set(m.id, (result.get(m.id) || 0) + 1)
      const left = (remainingCopy.get(m.id) || 0) - slot.capacityMinutes
      remainingCopy.set(m.id, left)
      if (left > 0) queue.push(m)
    }
  }
  return result
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
// Date math (lightweight — replace with date-fns in production)
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
// inferRole — title-regex inference for onboarding form defaults (Decision 11)
// ─────────────────────────────────────────────────────────────────────────────

const PRACTICE_KEYWORDS = /mock|leetcode|exercise|problem set/i
const INTERVIEW_KEYWORD = /interview/i

export function inferRole(
  title: string,
  estimatedMinutes: number,
  existingMaterials: Material[],
): MaterialRole {
  // Rule 1: matches practice keywords → practice
  if (PRACTICE_KEYWORDS.test(title)) return 'practice'
  // Rule 2: contains "interview" AND total < 200m → practice
  if (INTERVIEW_KEYWORD.test(title) && estimatedMinutes < 200) return 'practice'
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

/**
 * Decision 11 / Question 7: pure incremental add.
 * Fits new material into existing rest-day slots only.
 * Never touches assigned or pinned slots.
 */
export function addMaterialToRoadmap(
  roadmap: RoadmapOutput,
  newMaterial: Material,
  pins: PinSet,
): RoadmapOutput {
  const flatSlots: Slot[] = roadmap.weeks.flatMap((w) => w.slots).map((s) => ({ ...s }))
  const pinnedKeys = new Set(pins.map((p) => `${p.weekIndex}:${p.dayOfWeek}`))

  // Find rest-day, unpinned slots
  const candidates = flatSlots.filter(
    (s) =>
      s.role === null &&
      s.candidateMaterialIds.length === 0 &&
      !pinnedKeys.has(`${s.weekIndex}:${s.dayOfWeek}`),
  )

  // Compute slots needed for the new material
  const avgCapacity = candidates.reduce((sum, s) => sum + s.capacityMinutes, 0) / Math.max(candidates.length, 1)
  const slotsNeeded = avgCapacity > 0 ? Math.ceil(newMaterial.totalMinutes / avgCapacity) : 0

  // Place per role rule
  let toPlace: Slot[] = []
  if (newMaterial.role === 'anchor') {
    // Pick from spread across weeks
    toPlace = pickEvenlyAcrossWeeks(candidates, slotsNeeded)
  } else if (newMaterial.role === 'foundation') {
    toPlace = candidates
      .sort(slotChronoCompare)
      .slice(0, slotsNeeded)
  } else {
    // practice — back-loaded
    toPlace = candidates
      .sort((a, b) => slotChronoCompare(b, a))
      .slice(0, slotsNeeded)
  }

  // Detect overflow (insufficient rest days)
  const warnings: Warning[] = [...roadmap.warnings]
  if (toPlace.length < slotsNeeded) {
    warnings.push({
      kind: 'over-capacity',
      detail: {
        materialId: newMaterial.id,
        slotsNeeded,
        slotsAvailable: toPlace.length,
      },
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

  return rebuildRoadmapOutput(flatSlots, warnings, roadmap.capacityCheck)
}

/**
 * Decision 14: future, unstarted slots of a removed material → rest days.
 * Past/completed slots (in `pins`) are immutable and remain.
 */
export function removeMaterialFromRoadmap(
  roadmap: RoadmapOutput,
  materialId: string,
  pins: PinSet,
): RoadmapOutput {
  const pinnedKeys = new Set(pins.map((p) => `${p.weekIndex}:${p.dayOfWeek}`))
  const flatSlots: Slot[] = roadmap.weeks.flatMap((w) => w.slots).map((s) => ({ ...s }))

  for (const s of flatSlots) {
    const key = `${s.weekIndex}:${s.dayOfWeek}`
    if (pinnedKeys.has(key)) continue // immutable
    if (s.candidateMaterialIds.includes(materialId)) {
      // Drop the material from candidates
      s.candidateMaterialIds = s.candidateMaterialIds.filter((id) => id !== materialId)
      if (s.candidateMaterialIds.length === 0) {
        // Becomes a rest day
        s.role = null
        s.plannedMinutes = 0
        s.sessionTitle = null
      }
    }
  }

  return rebuildRoadmapOutput(flatSlots, roadmap.warnings, roadmap.capacityCheck)
}

/**
 * Open Q1: full re-plan honoring pins.
 * Pins are placed as fixed scaffolding; the rest of the schedule is regenerated.
 */
export function regenerateRoadmap(
  input: RoadmapInput,
  pins: PinSet,
): RoadmapOutput {
  // Generate a fresh roadmap, then overlay pins on top.
  const fresh = generateRoadmap(input)
  const flat = fresh.weeks.flatMap((w) => w.slots).map((s) => ({ ...s }))
  const pinnedKeys = new Set(pins.map((p) => `${p.weekIndex}:${p.dayOfWeek}`))

  // Apply pins (overwrite generated assignments)
  let pinOverflowMinutes = 0
  for (const pin of pins) {
    const slot = flat.find(
      (s) => s.weekIndex === pin.weekIndex && s.dayOfWeek === pin.dayOfWeek,
    )
    if (!slot) {
      // Pin refers to a slot that doesn't exist in the new layout
      pinOverflowMinutes += pin.plannedMinutes
      continue
    }
    slot.candidateMaterialIds = pin.materialId ? [pin.materialId] : []
    slot.plannedMinutes = pin.plannedMinutes
    slot.sessionTitle = pin.sessionTitle
    // Preserve role if material exists in input
    const m = input.materials.find((x) => x.id === pin.materialId)
    slot.role = m?.role ?? null
  }

  const warnings = [...fresh.warnings]
  if (pinOverflowMinutes > 0) {
    warnings.push({
      kind: 'pin-overflow',
      detail: { overflowMinutes: pinOverflowMinutes },
    })
  }

  // Mark pinned-key slots as pin-locked is up to UI; engine just preserves their content

  return rebuildRoadmapOutput(flat, warnings, fresh.capacityCheck)
}

function rebuildRoadmapOutput(
  flatSlots: Slot[],
  warnings: Warning[],
  capacityCheck: CapacityCheck,
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

// Re-export tolerance constant for tests
export const _TEST_CONSTANTS = {
  UNDER_CAPACITY_BUFFER_THRESHOLD,
  MATERIAL_TOTAL_TOLERANCE,
  ANCHOR_STRIDE_MAX,
}
