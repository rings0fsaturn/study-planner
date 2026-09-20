import { describe, expect, it } from 'vitest'
import { DEFAULT_BAND, bandGuidanceByMaterial } from './masteryBands'
import { masteryProjection } from './testing/fakeAssessmentClient'

describe('bandGuidanceByMaterial', () => {
  it('moves one band up from the mid reference for a mastered material', () => {
    const guidance = bandGuidanceByMaterial([
      masteryProjection({ materialId: 'mat-1', mastery: 0.95, n: 8 }),
    ])
    expect(guidance.get('mat-1')).toMatchObject({
      materialId: 'mat-1',
      recommendedBand: DEFAULT_BAND + 1,
      observations: 8,
      modelVersion: 'bkt-v1',
    })
  })

  it('moves one band down for a weak material', () => {
    const guidance = bandGuidanceByMaterial([
      masteryProjection({ materialId: 'mat-2', mastery: 0.1, n: 3 }),
    ])
    expect(guidance.get('mat-2')?.recommendedBand).toBe(DEFAULT_BAND - 1)
  })

  it('keeps the mid band when mastery sits near the target', () => {
    const guidance = bandGuidanceByMaterial([
      masteryProjection({ materialId: 'mat-1', mastery: 0.7, n: 5 }),
    ])
    expect(guidance.get('mat-1')?.recommendedBand).toBe(DEFAULT_BAND)
  })

  it('reads the strongest skill projection for a material', () => {
    const guidance = bandGuidanceByMaterial([
      masteryProjection({ materialId: 'mat-1', skillTag: 'weak', mastery: 0.2, n: 2 }),
      masteryProjection({ materialId: 'mat-1', skillTag: 'strong', mastery: 0.9, n: 4 }),
    ])
    expect(guidance.get('mat-1')).toMatchObject({
      recommendedBand: DEFAULT_BAND + 1,
      observations: 6,
      modelVersion: 'bkt-v1',
    })
  })

  it('holds the mid band with zero observations (cold start)', () => {
    const guidance = bandGuidanceByMaterial([
      masteryProjection({ materialId: 'mat-1', mastery: 0.15, n: 0 }),
    ])
    expect(guidance.get('mat-1')).toMatchObject({
      recommendedBand: DEFAULT_BAND,
      observations: 0,
    })
  })

  it('has no guidance for a material with no projections', () => {
    expect(bandGuidanceByMaterial([]).get('mat-1')).toBeUndefined()
  })
})
