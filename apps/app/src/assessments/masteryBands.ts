/**
 * Adaptive difficulty reader (#43, #44 AC3).
 *
 * One place decides the band the next Adaptive run requests for a material:
 * the learner's strongest skill projection against the mid-band reference, via
 * `recommendBand` in `@study-tracker/progress` (never a second band model).
 *
 * Advisory and rebuildable: the same durable grades always produce the same
 * guidance, and no observation means the mid band.
 */

import { recommendBand } from '@study-tracker/progress'
import type { MasteryProjection } from './types'

/** The band assumed before any evidence (no attempts yet, #43). */
export const DEFAULT_BAND = 3

export interface MaterialBandGuidance {
  materialId: string
  /** The band the next Adaptive run will request for this material. */
  recommendedBand: number
  /** Graded observations behind the guidance (0 = cold start). */
  observations: number
  /** BKT parameter set the projection carries. */
  modelVersion: string
}

export function bandGuidanceByMaterial(
  projections: MasteryProjection[],
): Map<string, MaterialBandGuidance> {
  const byMaterial = new Map<string, MasteryProjection[]>()
  for (const projection of projections) {
    const list = byMaterial.get(projection.materialId) ?? []
    list.push(projection)
    byMaterial.set(projection.materialId, list)
  }

  const guidance = new Map<string, MaterialBandGuidance>()
  for (const [materialId, list] of byMaterial) {
    const highest = list.reduce((best, p) => (p.mastery > best.mastery ? p : best))
    guidance.set(materialId, {
      materialId,
      recommendedBand: recommendBand(highest, DEFAULT_BAND).recommendedBand,
      observations: list.reduce((sum, projection) => sum + projection.n, 0),
      modelVersion: highest.modelVersion,
    })
  }
  return guidance
}
