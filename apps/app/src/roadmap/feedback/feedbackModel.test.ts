import { describe, expect, it } from 'vitest'
import {
  buildEvidence,
  projectionsEqual,
  readFor,
  selectHeadline,
} from './feedbackModel'
import { staticFeedbackCopy } from './feedbackCopy'
import type { FeedbackCopyInput, FeedbackState } from './types'
import { masteryProjection } from '../../assessments/testing/fakeAssessmentClient'
import type { DifficultyRecommendation } from '../../assessments/types'

function recommendation(
  overrides: Partial<DifficultyRecommendation> = {},
): DifficultyRecommendation {
  return {
    materialId: 'mat-1',
    skillTag: 'core',
    currentBand: 3,
    recommendedBand: 3,
    targetExpectedCorrectness: 0.7,
    modelVersion: 'bkt-v1',
    ...overrides,
  }
}

function copyInput(
  state: FeedbackState,
  projections = [masteryProjection()],
  rec: DifficultyRecommendation | null = recommendation(),
): FeedbackCopyInput {
  return {
    state,
    materialTitles: ['Operating Systems'],
    projections,
    recommendation: rec,
    evidence: buildEvidence(projections, 0.7),
  }
}

describe('readFor', () => {
  it('reads clear above the target band and revisit below it', () => {
    expect(readFor(0.9, 0.7)).toBe('clear')
    expect(readFor(0.7, 0.7)).toBe('mixed')
    expect(readFor(0.4, 0.7)).toBe('revisit')
  })
})

describe('selectHeadline', () => {
  it('picks the strongest observed projection', () => {
    const headline = selectHeadline([
      masteryProjection({ skillTag: 'weak', mastery: 0.2, n: 2 }),
      masteryProjection({ skillTag: 'strong', mastery: 0.9, n: 4 }),
    ])
    expect(headline?.skillTag).toBe('strong')
  })

  it('ignores unobserved projections and returns null when none exist', () => {
    expect(selectHeadline([masteryProjection({ n: 0 })])).toBeNull()
    expect(selectHeadline([])).toBeNull()
  })
})

describe('buildEvidence', () => {
  it('keeps only observed rows, most-evidenced first, with a plain-language read', () => {
    const evidence = buildEvidence(
      [
        masteryProjection({ skillTag: 'light', mastery: 0.9, n: 1 }),
        masteryProjection({ skillTag: 'heavy', mastery: 0.3, n: 6 }),
        masteryProjection({ skillTag: 'cold', n: 0 }),
      ],
      0.7,
    )
    expect(evidence.map((row) => row.skillTag)).toEqual(['heavy', 'light'])
    expect(evidence[0]).toMatchObject({ observations: 6, read: 'revisit' })
    expect(evidence[1]).toMatchObject({ observations: 1, read: 'clear' })
  })

  it('collapses case-variant skill tags to the most-evidenced row', () => {
    const evidence = buildEvidence(
      [
        masteryProjection({ skillTag: 'Exam structure', mastery: 0.9, n: 15 }),
        masteryProjection({ skillTag: 'exam structure', mastery: 0.2, n: 7 }),
      ],
      0.7,
    )
    expect(evidence).toHaveLength(1)
    expect(evidence[0]).toMatchObject({ skillTag: 'Exam structure', observations: 15, read: 'clear' })
  })
})

describe('projectionsEqual', () => {
  it('is true for the same durable grades and false when an observation lands', () => {
    const before = [masteryProjection({ n: 4, mastery: 0.5 })]
    const same = [masteryProjection({ n: 4, mastery: 0.5 })]
    const after = [masteryProjection({ n: 5, mastery: 0.6 })]
    expect(projectionsEqual(before, same)).toBe(true)
    expect(projectionsEqual(before, after)).toBe(false)
  })
})

describe('staticFeedbackCopy', () => {
  it('leads with plain language and never leaks a raw decimal', () => {
    const states: FeedbackState[] = ['cold', 'updated', 'stale', 'rebuilding']
    for (const state of states) {
      const copy = staticFeedbackCopy(copyInput(state))
      const text = [copy.summary, copy.knowBody, copy.watchBody, copy.advisory].join(' ')
      expect(text).not.toMatch(/\d+\.\d+/)
      expect(copy.summary.length).toBeGreaterThan(0)
      expect(copy.source).toBe('static')
    }
  })

  it('suggests a harder challenge when the band moves up', () => {
    const copy = staticFeedbackCopy(
      copyInput('updated', [masteryProjection({ mastery: 0.95, n: 8 })], recommendation({ recommendedBand: 4 })),
    )
    expect(copy.advisory).toMatch(/harder challenge/)
  })

  it('suggests a gentler step when the band moves down', () => {
    const copy = staticFeedbackCopy(
      copyInput('updated', [masteryProjection({ mastery: 0.1, n: 8 })], recommendation({ recommendedBand: 2 })),
    )
    expect(copy.advisory).toMatch(/gentler step/)
  })

  it('names the strongest and weakest skills from the evidence', () => {
    const copy = staticFeedbackCopy(
      copyInput('updated', [
        masteryProjection({ skillTag: 'Stable skill', mastery: 0.95, n: 4 }),
        masteryProjection({ skillTag: 'Shaky skill', mastery: 0.2, n: 3 }),
      ]),
    )
    expect(copy.knowTitle).toContain('Stable skill')
    expect(copy.watchTitle).toContain('Shaky skill')
  })

  it('pauses the recommendation while stale', () => {
    const copy = staticFeedbackCopy(copyInput('stale'))
    expect(copy.advisoryNote).toMatch(/paused/)
  })
})
