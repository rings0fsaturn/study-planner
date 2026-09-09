// #40 Phase 3: review view-model matrix — five states, family stats, verdict,
// retried emergence, answer helpers, timeline seed. Pure derivation tests.

import { describe, expect, it } from 'vitest'
import type { LocalAttemptRow } from '../../../assessments/attemptFlow'
import type { Assessment, Question } from '../../../assessments/types'
import {
  buildReviewModel,
  deriveTimelineSeed,
  describeAnswer,
  displayStatusOf,
  pickedOptionIndexes,
} from './reviewModel'

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    assessmentId: 'ass-1',
    materialId: 'mat-1',
    format: 'objective',
    prompt: 'Which?',
    options: ['A', 'B', 'C'],
    skillTags: ['Caching'],
    authoredDifficulty: 2,
    citations: [],
    ...overrides,
  }
}

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 'ass-1',
    ownerId: 'user-1',
    materialIds: ['mat-1'],
    status: 'ready',
    questions: [question()],
    warnings: [],
    groundingStale: false,
    createdAt: '2026-09-03T09:00:00Z',
    ...overrides,
  }
}

function row(overrides: Partial<LocalAttemptRow> = {}): LocalAttemptRow {
  return {
    clientAttemptId: 'ca-1',
    attemptId: 'att-1',
    questionId: 'q1',
    assessmentId: 'ass-1',
    status: 'graded',
    submittedAt: '2026-09-03T10:00:00Z',
    ...overrides,
  }
}

function graded(score: number, correct: boolean) {
  return {
    attemptId: 'att-1',
    questionId: 'q1',
    materialId: 'mat-1',
    score,
    correct,
    grader: 'objective' as const,
    gradedAt: '2026-09-03T10:05:00Z',
  }
}

describe('displayStatusOf', () => {
  it('maps latest attempt to the five display states', () => {
    expect(displayStatusOf(null)).toBe('pending')
    expect(displayStatusOf(row({ status: 'queued', grade: null }))).toBe('processing')
    expect(displayStatusOf(row({ grade: graded(1, true) }))).toBe('correct')
    expect(displayStatusOf(row({ grade: graded(0.6, false) }))).toBe('partial')
    expect(displayStatusOf(row({ grade: graded(0, false) }))).toBe('incorrect')
  })
})

describe('buildReviewModel five states', () => {
  it('ready: all graded, verdict counts correct', () => {
    const model = buildReviewModel(
      assessment({ questions: [question({ id: 'q1' }), question({ id: 'q2' })] }),
      [row({ clientAttemptId: 'ca-1', questionId: 'q1', grade: graded(1, true) }),
        row({ clientAttemptId: 'ca-2', questionId: 'q2', grade: graded(0, false) })],
    )
    expect(model.state).toBe('ready')
    expect(model.retried).toBe(false)
    expect(model.gradedCount).toBe(2)
    expect(model.verdict).toBe('1 of 2 questions correct · score 0.50')
  })

  it('partial: some in flight, verdict shows graded count + score so far', () => {
    const model = buildReviewModel(
      assessment({ status: 'partial', questions: [question({ id: 'q1' }), question({ id: 'q2' })] }),
      [row({ clientAttemptId: 'ca-1', questionId: 'q1', grade: graded(1, true) }),
        row({ clientAttemptId: 'ca-2', questionId: 'q2', status: 'queued', grade: null })],
    )
    expect(model.state).toBe('partial')
    expect(model.verdict).toBe('1 of 2 graded · score so far 1.00')
  })

  it('processing: nothing graded yet', () => {
    const model = buildReviewModel(
      assessment({ status: 'ready', questions: [question({ id: 'q1' })] }),
      [row({ status: 'queued', grade: null })],
    )
    expect(model.state).toBe('processing')
    expect(model.verdict).toBe('0 of 1 graded · scores pending')
  })

  it('failed: assessment failed keeps the failed state with warnings-driven copy', () => {
    const model = buildReviewModel(
      assessment({
        status: 'failed',
        questions: [],
        warnings: [{ code: 'safety_block', message: 'blocked' }],
      }),
      [],
    )
    expect(model.state).toBe('failed')
    expect(model.verdict).toBe('Grading blocked · no questions scored')
  })

  it('retried: more than one attempt on a question flags history + timeline', () => {
    const model = buildReviewModel(assessment(), [
      row({ clientAttemptId: 'ca-1', grade: graded(0.33, false) }),
      row({ clientAttemptId: 'ca-2', grade: graded(1, true) }),
    ])
    expect(model.state).toBe('ready')
    expect(model.retried).toBe(true)
    expect(model.groups[0].attempts.map((attempt) => attempt.clientAttemptId)).toEqual([
      'ca-1',
      'ca-2',
    ])
    expect(model.groups[0].latest?.clientAttemptId).toBe('ca-2')
  })

  it('groups sort attempts oldest first and carry family stats', () => {
    const model = buildReviewModel(
      assessment({
        questions: [
          question({ id: 'q1', format: 'objective' }),
          question({ id: 'q2', format: 'written', options: [] }),
        ],
      }),
      [
        row({ clientAttemptId: 'ca-late', questionId: 'q1', submittedAt: '2026-09-03T10:02:00Z', grade: graded(1, true) }),
        row({ clientAttemptId: 'ca-early', questionId: 'q1', submittedAt: '2026-09-03T10:00:00Z', grade: graded(0, false) }),
      ],
    )
    expect(model.groups[0].attempts[0].clientAttemptId).toBe('ca-early')
    expect(model.families).toEqual([
      { format: 'objective', total: 1, correct: 1 },
      { format: 'written', total: 1, correct: 0 },
    ])
  })
})

describe('answer helpers', () => {
  it('pickedOptionIndexes marks mcq and multi_select picks only', () => {
    expect(pickedOptionIndexes({ index: 2 })).toEqual([2])
    expect(pickedOptionIndexes({ indices: [0, 2] })).toEqual([0, 2])
    expect(pickedOptionIndexes({ value: 'gap' })).toEqual([])
    expect(pickedOptionIndexes(undefined)).toEqual([])
  })

  it('describeAnswer voices cloze/numeric and true_false restores', () => {
    expect(describeAnswer({ value: '42' })).toBe('42')
    expect(describeAnswer({ flag: true })).toBe('True')
    expect(describeAnswer({ flag: false })).toBe('False')
    expect(describeAnswer({ index: 1 })).toBeNull()
    expect(describeAnswer(undefined)).toBeNull()
  })
})

describe('deriveTimelineSeed', () => {
  it('seeds one entry and reports the aggregate', () => {
    const model = buildReviewModel(assessment(), [row({ grade: graded(1, true) })])
    const timeline = deriveTimelineSeed(model.groups)
    expect(timeline).toHaveLength(1)
    expect(timeline[0].status).toBe('graded')
    expect(timeline[0].score).toBe(1)
    expect(timeline[0].correctCount).toBe(1)
  })

  it('returns no entries when nothing was attempted', () => {
    const model = buildReviewModel(assessment(), [])
    expect(deriveTimelineSeed(model.groups)).toEqual([])
  })
})
