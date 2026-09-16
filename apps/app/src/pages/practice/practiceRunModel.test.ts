import { describe, expect, it } from 'vitest'
import type { Event } from '../../events/EventStore'
import type { LocalAttemptRow } from '../../assessments/attemptFlow'
import type {
  Assessment,
  AssessmentStatus,
  Question,
  QuestionGradedResult,
} from '../../assessments/types'
import type { PracticeRunFinishedPayload, PracticeRunStartedPayload } from '../../sync/types'
import {
  buildPracticeRunModel,
  findPracticeRun,
  isSummaryEligible,
  mergeEnvelopes,
  problemStatus,
} from './practiceRunModel'

/**
 * Pure run-state derivation (rule 32: no Dexie, no React, no clock). Every
 * case feeds the model the three things the run screen actually has — the
 * pointer event, the loaded assessment envelopes, and the local attempt rows.
 */

function question(id: string, materialId: string): Question {
  return {
    id,
    assessmentId: `a-${id}`,
    materialId,
    format: 'written',
    subtype: 'short_answer',
    prompt: `Question ${id}`,
    options: [],
    skillTags: ['core'],
    authoredDifficulty: 3,
    citations: [],
  }
}

function assessmentRecord(
  id: string,
  materialId: string,
  status: AssessmentStatus = 'ready',
  questions: Question[] = [],
): Assessment {
  return {
    id,
    ownerId: 'user-a',
    materialIds: [materialId],
    status,
    questions,
    warnings: [],
    groundingStale: false,
    createdAt: '2026-09-15T10:00:00Z',
  }
}

function grade(score: number): QuestionGradedResult {
  return {
    attemptId: 'att-1',
    questionId: 'q',
    materialId: 'mat-1',
    score,
    correct: score >= 0.6,
    perSkill: [],
    grader: 'llm_rubric',
    gradedAt: '2026-09-15T10:05:00Z',
  }
}

function row(
  questionId: string,
  graded: QuestionGradedResult | null,
  status: LocalAttemptRow['status'] = graded ? 'graded' : 'submitted',
): LocalAttemptRow {
  return {
    clientAttemptId: `ca-${questionId}-${Math.random().toString(36).slice(2, 8)}`,
    attemptId: 'att-1',
    questionId,
    assessmentId: 'a-1',
    status,
    submittedAt: '2026-09-15T10:00:00Z',
    grade: graded,
  }
}

function startedEvent(
  payload: Partial<PracticeRunStartedPayload> = {},
  id = 1,
): Event {
  return {
    id,
    kind: 'PracticeRunStarted',
    createdAt: '2026-09-15T10:00:00Z',
    payload: {
      runId: 'run-1',
      materialIds: ['mat-1'],
      mode: 'written',
      assessmentIds: ['a-1'],
      count: 1,
      ...payload,
    },
  }
}

function finishedEvent(
  payload: Partial<PracticeRunFinishedPayload> = {},
  id = 2,
): Event {
  return {
    id,
    kind: 'PracticeRunFinished',
    createdAt: '2026-09-15T10:30:00Z',
    payload: { runId: 'run-1', outcome: 'completed', ...payload },
  }
}

function model(input: {
  started?: Partial<PracticeRunStartedPayload>
  finished?: Partial<PracticeRunFinishedPayload>
  assessments: Array<Assessment | null>
  attemptsByAssessment?: Record<string, LocalAttemptRow[]>
}) {
  return buildPracticeRunModel({
    started: startedEvent(input.started).payload as unknown as PracticeRunStartedPayload,
    finished: input.finished
      ? (finishedEvent(input.finished).payload as unknown as PracticeRunFinishedPayload)
      : null,
    assessments: input.assessments,
    attemptsByAssessment: input.attemptsByAssessment ?? {},
  })
}

describe('mergeEnvelopes', () => {
  const loaded = assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')])

  it('returns the same reference when nothing changed', () => {
    const previous = { 'a-1': loaded }
    expect(mergeEnvelopes(previous, { 'a-1': { ...loaded } })).toBe(previous)
  })

  it('adopts a new id and keeps existing entries unchanged', () => {
    const previous = { 'a-1': loaded }
    const next = { 'a-1': loaded, 'a-2': assessmentRecord('a-2', 'mat-1', 'generating') }
    const merged = mergeEnvelopes(previous, next)
    expect(merged).not.toBe(previous)
    expect(merged['a-1']).toBe(previous['a-1'])
    expect(merged['a-2']).toBe(next['a-2'])
  })

  it('replaces the record when the status changes', () => {
    const previous = { 'a-1': assessmentRecord('a-1', 'mat-1', 'generating') }
    const fresh = assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')])
    const merged = mergeEnvelopes(previous, { 'a-1': fresh })
    expect(merged).not.toBe(previous)
    expect(merged['a-1']).toBe(fresh)
  })

  it('replaces the record when warnings change', () => {
    const previous = { 'a-1': assessmentRecord('a-1', 'mat-1', 'generating') }
    const fresh = assessmentRecord('a-1', 'mat-1', 'generating')
    fresh.warnings = [{ code: 'provider_error', message: 'interrupted' }]
    const merged = mergeEnvelopes(previous, { 'a-1': fresh })
    expect(merged['a-1']).toBe(fresh)
  })

  it('returns an empty previous unchanged', () => {
    const previous = {}
    expect(mergeEnvelopes(previous, { 'a-1': loaded })).not.toBe(previous)
  })
})

describe('findPracticeRun', () => {
  it('resolves the pointer and its terminal event by runId', () => {
    const events = [
      startedEvent({}, 1),
      startedEvent({ runId: 'run-2', assessmentIds: ['a-9'] }, 2),
      finishedEvent({ runId: 'run-2', outcome: 'abandoned' }, 3),
    ]

    expect(findPracticeRun(events, 'run-1')).toEqual({
      started: expect.objectContaining({ runId: 'run-1' }),
      finished: null,
    })
    expect(findPracticeRun(events, 'run-2')).toEqual({
      started: expect.objectContaining({ runId: 'run-2' }),
      finished: expect.objectContaining({ outcome: 'abandoned' }),
    })
  })

  it('returns null for an unknown runId rather than an empty run', () => {
    expect(findPracticeRun([startedEvent()], 'run-nope')).toBeNull()
    expect(findPracticeRun([], 'run-1')).toBeNull()
  })

  it('ignores unrelated event kinds that happen to carry a runId', () => {
    const events: Event[] = [
      { id: 1, kind: 'QuestionAttempted', createdAt: 'x', payload: { runId: 'run-1' } },
      startedEvent({}, 2),
    ]
    expect(findPracticeRun(events, 'run-1')?.started.assessmentIds).toEqual(['a-1'])
  })
})

describe('buildPracticeRunModel', () => {
  it('orders problems by the pointer and numbers them from one', () => {
    const result = model({
      started: { assessmentIds: ['a-1', 'a-2', 'a-3'], count: 3 },
      assessments: [
        assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')]),
        assessmentRecord('a-2', 'mat-1', 'ready', [question('q2', 'mat-1')]),
        assessmentRecord('a-3', 'mat-1', 'ready', [question('q3', 'mat-1')]),
      ],
    })

    expect(result.problems.map((problem) => problem.number)).toEqual([1, 2, 3])
    expect(result.problems.map((problem) => problem.assessmentId)).toEqual(['a-1', 'a-2', 'a-3'])
    expect(result.problems.map((problem) => problem.group?.question.id)).toEqual(['q1', 'q2', 'q3'])
    expect(result.missingCount).toBe(0)
  })

  it('reports the problems the run never generated as a shortfall', () => {
    const result = model({
      started: { assessmentIds: ['a-1'], count: 3 },
      assessments: [assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')])],
    })

    expect(result.problems).toHaveLength(1)
    expect(result.missingCount).toBe(2)
  })

  it('derives per-problem status from mixed graded, queued and unstarted rows', () => {
    const result = model({
      started: { assessmentIds: ['a-1', 'a-2', 'a-3'], count: 3 },
      assessments: [
        assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')]),
        assessmentRecord('a-2', 'mat-1', 'ready', [question('q2', 'mat-1')]),
        assessmentRecord('a-3', 'mat-1', 'ready', [question('q3', 'mat-1')]),
      ],
      attemptsByAssessment: {
        'a-1': [row('q1', grade(1))],
        'a-2': [row('q2', null, 'submitted')],
      },
    })

    expect(result.problems.map((problem) => problem.group?.display)).toEqual([
      'correct',
      'processing',
      'pending',
    ])
    expect(result.completedCount).toBe(1)
  })

  it('resumes on the first problem without a grade', () => {
    const result = model({
      started: { assessmentIds: ['a-1', 'a-2', 'a-3'], count: 3 },
      assessments: [
        assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')]),
        assessmentRecord('a-2', 'mat-1', 'ready', [question('q2', 'mat-1')]),
        assessmentRecord('a-3', 'mat-1', 'ready', [question('q3', 'mat-1')]),
      ],
      attemptsByAssessment: { 'a-1': [row('q1', grade(1))] },
    })

    expect(result.resumeIndex).toBe(1)
  })

  it('stays on the last problem once every problem is graded', () => {
    const result = model({
      started: { assessmentIds: ['a-1', 'a-2'], count: 2 },
      assessments: [
        assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')]),
        assessmentRecord('a-2', 'mat-1', 'ready', [question('q2', 'mat-1')]),
      ],
      attemptsByAssessment: {
        'a-1': [row('q1', grade(1))],
        'a-2': [row('q2', grade(0))],
      },
    })

    expect(result.resumeIndex).toBe(1)
    expect(result.completedCount).toBe(2)
  })

  it('treats a queued retry as the latest attempt, not the old grade', () => {
    const result = model({
      started: { assessmentIds: ['a-1'], count: 1 },
      assessments: [assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')])],
      attemptsByAssessment: {
        'a-1': [
          { ...row('q1', grade(1)), submittedAt: '2026-09-15T10:00:00Z' },
          { ...row('q1', null, 'queued'), submittedAt: '2026-09-15T10:10:00Z' },
        ],
      },
    })

    expect(result.problems[0].group?.display).toBe('processing')
    expect(result.completedCount).toBe(0)
    expect(result.resumeIndex).toBe(0)
  })

  it('holds a problem at processing until its assessment is ready', () => {
    const result = model({
      started: { assessmentIds: ['a-1'], count: 1 },
      assessments: [assessmentRecord('a-1', 'mat-1', 'generating')],
    })

    expect(result.problems[0].assessmentStatus).toBe('generating')
    expect(result.problems[0].group).toBeNull()
    expect(result.resumeIndex).toBe(0)
  })

  it('reports an unloaded assessment as unknown rather than ready', () => {
    const result = model({
      started: { assessmentIds: ['a-1'], count: 1 },
      assessments: [null],
    })

    expect(result.problems[0].assessmentStatus).toBeNull()
    expect(result.problems[0].group).toBeNull()
  })

  it('keeps a finished run terminal, completed or abandoned', () => {
    const assessments = [assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')])]

    const open = model({ assessments })
    expect(open.isFinished).toBe(false)
    expect(open.outcome).toBeNull()

    const completed = model({
      finished: { outcome: 'completed' },
      assessments,
      attemptsByAssessment: { 'a-1': [row('q1', grade(1))] },
    })
    expect(completed.isFinished).toBe(true)
    expect(completed.outcome).toBe('completed')

    const abandoned = model({ finished: { outcome: 'abandoned' }, assessments })
    expect(abandoned.isFinished).toBe(true)
    expect(abandoned.outcome).toBe('abandoned')
    expect(abandoned.completedCount).toBe(0)
  })

  describe('problemStatus / isSummaryEligible (#44 Phase 3)', () => {
    it('classifies a graded problem as graded', () => {
      const result = model({
        assessments: [assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')])],
        attemptsByAssessment: { 'a-1': [row('q1', grade(1))] },
      })

      expect(problemStatus(result.problems[0])).toBe('graded')
      expect(isSummaryEligible(result.problems[0])).toBe(true)
    })

    it('classifies an ungradable attempt as failed, not as the review model’s processing', () => {
      const result = model({
        assessments: [assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')])],
        attemptsByAssessment: { 'a-1': [row('q1', null, 'failed')] },
      })

      expect(result.problems[0].group?.display).toBe('processing')
      expect(problemStatus(result.problems[0])).toBe('failed')
      expect(isSummaryEligible(result.problems[0])).toBe(true)
    })

    it('treats queued, submitted and never-attempted problems as open', () => {
      const result = model({
        started: { assessmentIds: ['a-1', 'a-2', 'a-3'], count: 3 },
        assessments: [
          assessmentRecord('a-1', 'mat-1', 'ready', [question('q1', 'mat-1')]),
          assessmentRecord('a-2', 'mat-1', 'ready', [question('q2', 'mat-1')]),
          assessmentRecord('a-3', 'mat-1', 'ready', [question('q3', 'mat-1')]),
        ],
        attemptsByAssessment: {
          'a-1': [row('q1', null, 'queued')],
          'a-2': [row('q2', null, 'submitted')],
        },
      })

      expect(result.problems.map((problem) => problemStatus(problem))).toEqual([
        'open',
        'open',
        'open',
      ])
      expect(result.problems.map((problem) => isSummaryEligible(problem))).toEqual([
        false,
        false,
        false,
      ])
    })

    it('treats a problem with no loaded assessment as open', () => {
      const result = model({ assessments: [null] })
      expect(problemStatus(result.problems[0])).toBe('open')
    })
  })

  describe('per-problem material attribution (D-10)', () => {
    it('alternates across the chosen materials when they match the problems', () => {
      const result = model({
        started: { materialIds: ['mat-1', 'mat-2'], assessmentIds: ['a-1', 'a-2', 'a-3', 'a-4'], count: 4 },
        assessments: [
          assessmentRecord('a-1', 'mat-1', 'generating'),
          assessmentRecord('a-2', 'mat-2', 'generating'),
          assessmentRecord('a-3', 'mat-1', 'generating'),
          assessmentRecord('a-4', 'mat-2', 'generating'),
        ],
      })

      expect(result.problems.map((problem) => problem.materialId)).toEqual([
        'mat-1',
        'mat-2',
        'mat-1',
        'mat-2',
      ])
    })

    it('uses only the first N materials when there are more materials than problems', () => {
      const result = model({
        started: { materialIds: ['mat-1', 'mat-2', 'mat-3'], assessmentIds: ['a-1', 'a-2'], count: 2 },
        assessments: [
          assessmentRecord('a-1', 'mat-1', 'generating'),
          assessmentRecord('a-2', 'mat-2', 'generating'),
        ],
      })

      expect(result.problems.map((problem) => problem.materialId)).toEqual(['mat-1', 'mat-2'])
    })

    it('is the degenerate single-material case when the run has one material', () => {
      const result = model({
        started: { materialIds: ['mat-1'], assessmentIds: ['a-1', 'a-2'], count: 2 },
        assessments: [
          assessmentRecord('a-1', 'mat-1', 'generating'),
          assessmentRecord('a-2', 'mat-1', 'generating'),
        ],
      })

      expect(result.problems.map((problem) => problem.materialId)).toEqual(['mat-1', 'mat-1'])
    })

    it('prefers the grounded question’s own material once it exists', () => {
      const result = model({
        started: { materialIds: ['mat-1', 'mat-2'], assessmentIds: ['a-1', 'a-2'], count: 2 },
        assessments: [
          assessmentRecord('a-1', 'mat-2', 'ready', [question('q1', 'mat-2')]),
          assessmentRecord('a-2', 'mat-1', 'ready', [question('q2', 'mat-1')]),
        ],
      })

      // The pointer formula would say mat-1/mat-2 — the server's own
      // attribution is authoritative and wins.
      expect(result.problems.map((problem) => problem.materialId)).toEqual(['mat-2', 'mat-1'])
    })

    it('survives a pointer that carries no materials at all', () => {
      const result = model({
        started: { materialIds: [], assessmentIds: ['a-1'], count: 1 },
        assessments: [assessmentRecord('a-1', 'mat-1', 'generating')],
      })

      expect(result.problems[0].materialId).toBe('')
    })
  })
})
