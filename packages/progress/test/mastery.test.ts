import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PARAMS,
  MODEL_VERSION,
  bktForward,
  projectMastery,
  recommendBand,
  type MasteryObservation,
} from '../src/mastery'

function obs(corrects: boolean[], tag = 's'): MasteryObservation[] {
  return corrects.map((correct) => ({ skillTag: tag, correct }))
}

describe('projectMastery', () => {
  it('cold start is neutral and uncertain', () => {
    const p = projectMastery('mat-1', [])
    expect(p.mastery).toBe(DEFAULT_PARAMS.pInit)
    expect(p.n).toBe(0)
    expect(p.modelVersion).toBe(MODEL_VERSION)
    expect(p.uncertainty).toBeGreaterThan(0.5)
    expect(p.confidence).toBe(1 - p.uncertainty)
  })

  it('single correct does not claim mastery', () => {
    const p = projectMastery('mat-1', obs([true]))
    expect(p.mastery).toBeLessThan(0.6)
    expect(p.n).toBe(1)
    expect(p.uncertainty).toBeGreaterThan(0.8)
  })

  it('sustained correct saturates', () => {
    const p = projectMastery('mat-1', obs([true, true, true, true, true, true, true, true]))
    expect(p.mastery).toBeGreaterThan(0.95)
    expect(p.uncertainty).toBeLessThan(0.05)
  })

  it('incorrect collapses belief', () => {
    const up = projectMastery('mat-1', obs([true, true, true]))
    const down = projectMastery('mat-1', obs([true, true, true, false]))
    expect(down.mastery).toBeLessThan(0.7)
    expect(up.mastery - down.mastery).toBeGreaterThan(0.2)
  })

  it('is rebuildable and stateless', () => {
    const seq = obs([true, true, false, true, true])
    expect(projectMastery('mat-1', seq)).toEqual(projectMastery('mat-1', seq))
  })

  it('bounds hold everywhere', () => {
    for (const seq of [[], [true], [false], Array(12).fill(true), Array(6).fill(false)]) {
      const p = projectMastery('mat-1', obs(seq))
      expect(p.mastery).toBeGreaterThanOrEqual(0)
      expect(p.mastery).toBeLessThanOrEqual(1)
      expect(p.uncertainty).toBeGreaterThanOrEqual(0)
      expect(p.uncertainty).toBeLessThanOrEqual(1)
      expect(p.confidence).toBeGreaterThanOrEqual(0)
      expect(p.confidence).toBeLessThanOrEqual(1)
      expect(p.n).toBe(seq.length)
    }
  })
})

describe('bktForward', () => {
  it('predictions precede updates', () => {
    const { masteryAfter, pCorrectBefore } = bktForward(obs([true, false, true]))
    expect(masteryAfter).toHaveLength(3)
    expect(pCorrectBefore).toHaveLength(3)
    const expectedFirst =
      (1 - DEFAULT_PARAMS.pSlip) * DEFAULT_PARAMS.pInit + DEFAULT_PARAMS.pGuess * (1 - DEFAULT_PARAMS.pInit)
    expect(pCorrectBefore[0]).toBeCloseTo(expectedFirst, 12)
    expect(pCorrectBefore[1]).toBeGreaterThan(pCorrectBefore[0])
    expect(masteryAfter[0]).toBeGreaterThan(DEFAULT_PARAMS.pInit)
    expect(masteryAfter[1]).toBeLessThan(masteryAfter[0])
    expect(masteryAfter[2]).toBeGreaterThan(masteryAfter[1])
  })
})

describe('recommendBand', () => {
  it('moves one band up when mastery is high', () => {
    const p = projectMastery('mat-1', obs([true, true, true, true, true, true]))
    const rec = recommendBand(p, 3)
    expect(rec.recommendedBand).toBe(4)
    expect(rec.currentBand).toBe(3)
    expect(rec.targetExpectedCorrectness).toBe(0.7)
    expect(rec.modelVersion).toBe(MODEL_VERSION)
  })

  it('moves one band down when mastery is low', () => {
    const p = projectMastery('mat-1', obs([false, false, false]))
    expect(recommendBand(p, 3).recommendedBand).toBe(2)
  })

  it('keeps the band near the target', () => {
    const p = projectMastery('mat-1', obs([true, true, true, false]))
    expect(p.mastery).toBeGreaterThanOrEqual(0.65)
    expect(p.mastery).toBeLessThanOrEqual(0.75)
    expect(recommendBand(p, 3).recommendedBand).toBe(3)
  })

  it('cold start keeps the band', () => {
    expect(recommendBand(projectMastery('mat-1', []), 3).recommendedBand).toBe(3)
  })

  it('clamps at the edges', () => {
    const high = projectMastery('mat-1', obs([true, true, true, true, true, true, true, true]))
    expect(recommendBand(high, 5).recommendedBand).toBe(5)
    const low = projectMastery('mat-1', obs([false, false, false, false]))
    expect(recommendBand(low, 1).recommendedBand).toBe(1)
  })
})