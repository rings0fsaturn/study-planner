/**
 * Pure derivation for the roadmap feedback section (#47).
 *
 * Everything here is deterministic and side-effect free so the UI and the
 * copy provider share one model. No BKT and no band arithmetic: the band comes
 * from `recommendBand` in `@study-tracker/progress` (rule 41).
 */

import type { MasteryProjection } from '../../assessments/types'
import type { FeedbackEvidence, FeedbackRead } from './types'

/** Matches the one-band rule's margin in `recommendBand`. */
const BAND_MARGIN = 0.05

/** Plain-language read of one projection against the recommendation target. */
export function readFor(mastery: number, target: number): FeedbackRead {
  if (mastery >= target + BAND_MARGIN) return 'clear'
  if (mastery <= target - BAND_MARGIN) return 'revisit'
  return 'mixed'
}

/**
 * The headline projection: the strongest observed one, mirroring the
 * "highest mastery per material" choice in `bandGuidanceByMaterial`.
 * Returns null when there is no observation (cold start).
 */
export function selectHeadline(projections: MasteryProjection[]): MasteryProjection | null {
  let best: MasteryProjection | null = null
  for (const projection of projections) {
    if (projection.n <= 0) continue
    if (!best || projection.mastery > best.mastery) best = projection
  }
  return best
}

/** One evidence row per observed skill, most-evidenced first. */
export function buildEvidence(
  projections: MasteryProjection[],
  target: number,
): FeedbackEvidence[] {
  // Skill tags are free text and appear in mixed case ("Exam structure" vs
  // "exam structure"); collapse them so the trail never contradicts itself.
  const bySkill = new Map<string, FeedbackEvidence>()
  for (const projection of projections) {
    if (projection.n <= 0) continue
    const key = projection.skillTag.trim().toLowerCase()
    const row: FeedbackEvidence = {
      materialId: projection.materialId,
      skillTag: projection.skillTag,
      observations: projection.n,
      read: readFor(projection.mastery, target),
      ...(projection.recentTrend !== undefined ? { trend: projection.recentTrend } : {}),
    }
    const existing = bySkill.get(key)
    if (!existing || row.observations > existing.observations) bySkill.set(key, row)
  }
  return [...bySkill.values()].sort((a, b) => b.observations - a.observations)
}

function fingerprint(projections: MasteryProjection[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const projection of projections) {
    map.set(
      `${projection.materialId}\u0000${projection.skillTag}`,
      `${projection.n}|${projection.mastery.toFixed(6)}|${projection.modelVersion}`,
    )
  }
  return map
}

/**
 * True when two projection sets carry the same durable grades. Used for the
 * stale check: the cached snapshot versus a fresh server fetch.
 */
export function projectionsEqual(
  a: MasteryProjection[],
  b: MasteryProjection[],
): boolean {
  const left = fingerprint(a)
  const right = fingerprint(b)
  if (left.size !== right.size) return false
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false
  }
  return true
}
