import { describe, expect, it } from 'vitest'
import {
  ASSESSMENT_CREATED,
  ASSESSMENT_DELETED,
  PRACTICE_RUN_FINISHED,
  PRACTICE_RUN_STARTED,
  type Event,
} from '../events/EventStore'
import type { Assessment, Question, QuestionGradedResult } from '../assessments/types'
import type { LocalAttemptRow } from '../assessments/attemptFlow'
import type { AssessmentCreatedPayload, PracticeRunStartedPayload } from '../sync/types'
import {
  buildAssessmentRow,
  buildPracticeRunRow,
  deletedAssessmentIds,
  listAssessmentPointers,
  listPracticeRunEntries,
  orderAssessmentRows,
  splitRunRows,
} from './libraryModel'

function event(kind: string, payload: Record<string, unknown>, createdAt: string, id?: number): Event {
  return { ...(id != null ? { id } : {}), kind, payload, createdAt }
}

function assessmentCreated(
  assessmentId: string,
  materialIds: string[],
  createdAt: string,
  id?: number,
): Event {
  const payload = { assessmentId, materialIds } satisfies AssessmentCreatedPayload
  return event(ASSESSMENT_CREATED, payload as unknown as Record<string, unknown>, createdAt, id)
}

function runStarted(payload: PracticeRunStartedPayload, createdAt: string): Event {
  return event(PRACTICE_RUN_STARTED, payload as unknown as Record<string, unknown>, createdAt)
}

function assessmentDeleted(assessmentId: string, createdAt: string): Event {
  return event(ASSESSMENT_DELETED, { assessmentId }, createdAt)
}

function runFinished(runId: string, outcome: 'completed' | 'abandoned', createdAt: string): Event {
  return event(PRACTICE_RUN_FINISHED, { runId, outcome }, createdAt)
}

function question(id: string, assessmentId: string, format: Question['format'] = 'objective'): Question {
  return {
    id,
    assessmentId,
    materialId: 'mat-1',
    format,
    prompt: `Prompt ${id}`,
    options: ['A', 'B'],
    skillTags: [],
    authoredDifficulty: 2,
    citations: [],
  }
}

function readyAssessment(id: string, questions: Question[], overrides: Partial<Assessment> = {}): Assessment {
  return {
    id,
    ownerId: 'user-1',
    materialIds: ['mat-1'],
    status: 'ready',
    questions,
    warnings: [],
    groundingStale: false,
    createdAt: '2026-09-20T10:00:00Z',
    ...overrides,
  }
}

function gradedRow(
  questionId: string,
  assessmentId: string,
  score: number,
  submittedAt = '2026-09-20T11:00:00Z',
): LocalAttemptRow {
  const grade: QuestionGradedResult = {
    attemptId: `att-${questionId}`,
    questionId,
    materialId: 'mat-1',
    score,
    correct: score >= 0.6,
    grader: 'objective',
    gradedAt: submittedAt,
  } as QuestionGradedResult
  return {
    clientAttemptId: `ca-${questionId}`,
    attemptId: `att-${questionId}`,
    questionId,
    assessmentId,
    status: 'graded',
    submittedAt,
    grade,
  }
}

describe('listAssessmentPointers', () => {
  it('returns empty for an empty log', () => {
    expect(listAssessmentPointers([])).toEqual([])
  })

  it('latest AssessmentCreated wins per assessmentId with createdAt then id tie-break', () => {
    const events = [
      assessmentCreated('a-1', ['mat-1'], '2026-09-20T10:00:00Z', 1),
      assessmentCreated('a-1', ['mat-1', 'mat-2'], '2026-09-21T10:00:00Z', 2),
      assessmentCreated('a-1', ['mat-1'], '2026-09-21T10:00:00Z', 3),
    ]
    const pointers = listAssessmentPointers(events)
    expect(pointers).toHaveLength(1)
    expect(pointers[0].assessmentId).toBe('a-1')
    expect(pointers[0].materialIds).toEqual(['mat-1'])
  })

  it('orders newest first and filters by materialId', () => {
    const events = [
      assessmentCreated('a-1', ['mat-1'], '2026-09-20T10:00:00Z', 1),
      assessmentCreated('a-2', ['mat-2'], '2026-09-22T10:00:00Z', 2),
      assessmentCreated('a-3', ['mat-1', 'mat-2'], '2026-09-21T10:00:00Z', 3),
    ]
    const all = listAssessmentPointers(events)
    expect(all.map((p) => p.assessmentId)).toEqual(['a-2', 'a-3', 'a-1'])
    const filtered = listAssessmentPointers(events, { materialId: 'mat-1' })
    expect(filtered.map((p) => p.assessmentId)).toEqual(['a-3', 'a-1'])
  })

  it('masks tombstoned ids and keeps the surviving pointers in order', () => {
    const events = [
      assessmentCreated('a-1', ['mat-1'], '2026-09-20T10:00:00Z', 1),
      assessmentCreated('a-2', ['mat-1'], '2026-09-22T10:00:00Z', 2),
      assessmentCreated('a-3', ['mat-1'], '2026-09-21T10:00:00Z', 3),
      assessmentDeleted('a-2', '2026-09-23T10:00:00Z'),
    ]
    expect(listAssessmentPointers(events).map((p) => p.assessmentId)).toEqual(['a-3', 'a-1'])
    expect(listAssessmentPointers(events, { materialId: 'mat-1' }).map((p) => p.assessmentId)).toEqual([
      'a-3',
      'a-1',
    ])
  })

  it('ignores a tombstone without a usable assessmentId (legacy reader fallback)', () => {
    const events = [
      assessmentCreated('a-1', ['mat-1'], '2026-09-20T10:00:00Z', 1),
      event(ASSESSMENT_DELETED, {}, '2026-09-21T10:00:00Z'),
      event(ASSESSMENT_DELETED, { assessmentId: 7 }, '2026-09-21T11:00:00Z'),
    ]
    expect(listAssessmentPointers(events).map((p) => p.assessmentId)).toEqual(['a-1'])
  })
})

describe('deletedAssessmentIds', () => {
  it('collects the usable tombstoned ids into a set', () => {
    const events = [
      assessmentDeleted('a-1', '2026-09-23T10:00:00Z'),
      assessmentDeleted('a-2', '2026-09-23T11:00:00Z'),
      event(ASSESSMENT_DELETED, { assessmentId: 7 }, '2026-09-23T12:00:00Z'),
      assessmentCreated('a-3', ['mat-1'], '2026-09-20T10:00:00Z', 1),
    ]
    expect(deletedAssessmentIds(events)).toEqual(new Set(['a-1', 'a-2']))
  })

  it('returns an empty set for a log without tombstones', () => {
    expect(deletedAssessmentIds([])).toEqual(new Set())
  })
})

describe('listPracticeRunEntries', () => {
  it('ignores a finished event with no started event', () => {
    const events = [runFinished('run-9', 'completed', '2026-09-21T10:00:00Z')]
    expect(listPracticeRunEntries(events)).toEqual([])
  })

  it('attaches finished and orders newest startedAt first', () => {
    const events = [
      runStarted(
        { runId: 'run-1', materialIds: ['mat-1'], mode: 'written', assessmentIds: ['a-1'], count: 1 },
        '2026-09-20T10:00:00Z',
      ),
      runStarted(
        { runId: 'run-2', materialIds: ['mat-2'], mode: 'coding', assessmentIds: ['a-2'], count: 1 },
        '2026-09-22T10:00:00Z',
      ),
      runFinished('run-1', 'completed', '2026-09-21T10:00:00Z'),
    ]
    const entries = listPracticeRunEntries(events)
    expect(entries.map((e) => e.started.runId)).toEqual(['run-2', 'run-1'])
    expect(entries[1].finished?.outcome).toBe('completed')
    expect(entries[0].finished).toBeNull()
  })

  it('filters by materialId', () => {
    const events = [
      runStarted(
        { runId: 'run-1', materialIds: ['mat-1'], mode: 'written', assessmentIds: ['a-1'], count: 1 },
        '2026-09-20T10:00:00Z',
      ),
      runStarted(
        { runId: 'run-2', materialIds: ['mat-2'], mode: 'written', assessmentIds: ['a-2'], count: 1 },
        '2026-09-21T10:00:00Z',
      ),
    ]
    const entries = listPracticeRunEntries(events, { materialId: 'mat-1' })
    expect(entries.map((e) => e.started.runId)).toEqual(['run-1'])
  })
})

describe('buildAssessmentRow', () => {
  it('marks unreadable uncached envelopes unavailable offline', () => {
    const row = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment: null,
      attempts: [],
    })
    expect(row.state).toBe('unavailable')
    expect(row.score).toBeNull()
  })

  it('maps generating with N of M ready and recipe total', () => {
    const qs = [question('q1', 'a-1'), question('q2', 'a-1')]
    const assessment = readyAssessment('a-1', qs, {
      status: 'generating',
      recipe: { formats: ['objective'], questionCount: 5 },
    })
    const row = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment,
      attempts: [],
    })
    expect(row.state).toBe('generating')
    expect(row.readyCount).toBe(2)
    expect(row.totalCount).toBe(5)
    expect(row.family).toBe('objective')
  })

  it('surfaces failed warnings verbatim as code plus message', () => {
    const assessment = readyAssessment('a-1', [question('q1', 'a-1')], {
      status: 'failed',
      warnings: [{ code: 'code_not_derivable', message: 'no groundable task here' }],
    })
    const row = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment,
      attempts: [],
    })
    expect(row.state).toBe('failed')
    expect(row.warningReason).toBe('code_not_derivable: no groundable task here')
  })

  it('scores ready rows as the mean of latest graded attempts', () => {
    const qs = [question('q1', 'a-1'), question('q2', 'a-1')]
    const assessment = readyAssessment('a-1', qs)
    const row = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment,
      attempts: [gradedRow('q1', 'a-1', 0.8), gradedRow('q2', 'a-1', 0.6)],
    })
    expect(row.state).toBe('ready')
    expect(row.score).toBeCloseTo(0.7)
    expect(row.gradedCount).toBe(2)
    expect(row.totalCount).toBe(2)
  })

  it('marks ready rows with no grades as not started', () => {
    const assessment = readyAssessment('a-1', [question('q1', 'a-1')])
    const row = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment,
      attempts: [],
    })
    expect(row.state).toBe('ready')
    expect(row.score).toBeNull()
    expect(row.gradedCount).toBe(0)
  })

  it('maps partial envelopes to ready rows', () => {
    const assessment = readyAssessment('a-1', [question('q1', 'a-1')], { status: 'partial' })
    const row = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment,
      attempts: [],
    })
    expect(row.state).toBe('ready')
    expect(row.score).toBeNull()
    expect(row.totalCount).toBe(1)
  })

  it('sizes failed rows from recipe.questionCount instead of inventing one', () => {
    const assessment = readyAssessment('a-1', [], {
      status: 'failed',
      recipe: { formats: ['objective'], questionCount: 3 },
      warnings: [{ code: 'provider_unavailable', message: 'try again' }],
    })
    const row = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment,
      attempts: [],
    })
    expect(row.state).toBe('failed')
    expect(row.totalCount).toBe(3)
  })

  it('tolerates envelopes without a warnings array', () => {
    const assessment = readyAssessment('a-1', [question('q1', 'a-1')])
    delete (assessment as Partial<Assessment>).warnings
    const row = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment,
      attempts: [],
    })
    expect(row.state).toBe('ready')
    expect(row.warningReason).toBeNull()
  })

  it('falls back family from recipe to question to null', () => {
    const withRecipe = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment: readyAssessment('a-1', [question('q1', 'a-1', 'written')], {
        recipe: { formats: ['coding'], questionCount: 1 },
      }),
      attempts: [],
    })
    expect(withRecipe.family).toBe('coding')
    const withQuestion = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment: readyAssessment('a-1', [question('q1', 'a-1', 'written')]),
      attempts: [],
    })
    expect(withQuestion.family).toBe('written')
    const empty = buildAssessmentRow({
      pointer: { assessmentId: 'a-1', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
      assessment: readyAssessment('a-1', []),
      attempts: [],
    })
    expect(empty.family).toBeNull()
  })
})

describe('buildPracticeRunRow', () => {
  function started(
    overrides: Partial<PracticeRunStartedPayload> = {},
  ): PracticeRunStartedPayload {
    return {
      runId: 'run-1',
      materialIds: ['mat-1'],
      mode: 'written',
      assessmentIds: ['a-1'],
      count: 1,
      families: ['written'],
      ...overrides,
    }
  }

  it('marks completed runs with graded counts', () => {
    const qs = [question('q1', 'a-1')]
    const row = buildPracticeRunRow({
      entry: { started: started(), finished: { runId: 'run-1', outcome: 'completed' }, startedAt: '2026-09-20T10:00:00Z' },
      assessments: [readyAssessment('a-1', qs)],
      attemptsByAssessment: { 'a-1': [gradedRow('q1', 'a-1', 1)] },
    })
    expect(row.state).toBe('completed')
    expect(row.gradedCount).toBe(1)
  })

  it('marks abandoned runs as history', () => {
    const row = buildPracticeRunRow({
      entry: { started: started(), finished: { runId: 'run-1', outcome: 'abandoned' }, startedAt: '2026-09-20T10:00:00Z' },
      assessments: [readyAssessment('a-1', [question('q1', 'a-1')])],
      attemptsByAssessment: {},
    })
    expect(row.state).toBe('abandoned')
  })

  it('surfaces terminal failure verbatim on unfinished runs', () => {
    const failed = readyAssessment('a-1', [], {
      status: 'failed',
      warnings: [{ code: 'code_not_derivable', message: 'notes ship the solution' }],
    })
    const row = buildPracticeRunRow({
      entry: { started: started(), finished: null, startedAt: '2026-09-20T10:00:00Z' },
      assessments: [failed],
      attemptsByAssessment: {},
    })
    expect(row.state).toBe('failed')
    expect(row.failedReason).toBe('code_not_derivable: notes ship the solution')
  })

  it('marks generating while an ungraded problem generates or is unloaded', () => {
    const generating = readyAssessment('a-1', [question('q1', 'a-1')], { status: 'generating' })
    const row = buildPracticeRunRow({
      entry: {
        started: started({ assessmentIds: ['a-1', 'a-2'], count: 2 }),
        finished: null,
        startedAt: '2026-09-20T10:00:00Z',
      },
      assessments: [generating, null],
      attemptsByAssessment: {},
    })
    expect(row.state).toBe('generating')
    expect(row.readyCount).toBe(1)
  })

  it('marks in-progress with missing-count note', () => {
    const row = buildPracticeRunRow({
      entry: {
        started: started({ assessmentIds: ['a-1'], count: 3 }),
        finished: null,
        startedAt: '2026-09-20T10:00:00Z',
      },
      assessments: [readyAssessment('a-1', [question('q1', 'a-1')])],
      attemptsByAssessment: {},
    })
    expect(row.state).toBe('in-progress')
    expect(row.missingCount).toBe(2)
  })

  it('marks fully unreadable runs unavailable offline without inventing counts', () => {
    const row = buildPracticeRunRow({
      entry: { started: started(), finished: null, startedAt: '2026-09-20T10:00:00Z' },
      assessments: [null],
      attemptsByAssessment: {},
    })
    expect(row.state).toBe('unavailable')
    expect(row.gradedCount).toBe(0)
  })

  it('reads a tombstoned problem as terminal-missing, never generating', () => {
    const row = buildPracticeRunRow({
      entry: {
        started: started({ assessmentIds: ['a-1', 'a-2'], count: 2 }),
        finished: null,
        startedAt: '2026-09-20T10:00:00Z',
      },
      // The hook masks a tombstoned id to null; the sibling problem is readable.
      assessments: [null, readyAssessment('a-2', [question('q2', 'a-2')])],
      attemptsByAssessment: {},
      deletedAssessmentIds: new Set(['a-1']),
    })
    expect(row.state).toBe('unavailable')
  })

  it('still reports generating when a live problem generates beside a tombstoned one', () => {
    const row = buildPracticeRunRow({
      entry: {
        started: started({ assessmentIds: ['a-1', 'a-2'], count: 2 }),
        finished: null,
        startedAt: '2026-09-20T10:00:00Z',
      },
      assessments: [
        null,
        readyAssessment('a-2', [question('q2', 'a-2')], { status: 'generating' }),
      ],
      attemptsByAssessment: {},
      deletedAssessmentIds: new Set(['a-1']),
    })
    expect(row.state).toBe('generating')
  })

  it('falls back to mode for legacy pointers without families', () => {
    const legacy = started({ mode: 'coding' })
    delete (legacy as Partial<PracticeRunStartedPayload>).families
    const row = buildPracticeRunRow({
      entry: { started: legacy, finished: null, startedAt: '2026-09-20T10:00:00Z' },
      assessments: [readyAssessment('a-1', [question('q1', 'a-1', 'coding')])],
      attemptsByAssessment: {},
    })
    expect(row.state).toBe('in-progress')
  })
})

describe('ordering', () => {
  it('orders assessments generating first then newest first', () => {
    const rows = [
      buildAssessmentRow({
        pointer: { assessmentId: 'a-old', materialIds: ['mat-1'], createdAt: '2026-09-20T10:00:00Z' },
        assessment: readyAssessment('a-old', [question('q1', 'a-old')], { createdAt: '2026-09-20T10:00:00Z' }),
        attempts: [],
      }),
      buildAssessmentRow({
        pointer: { assessmentId: 'a-gen', materialIds: ['mat-1'], createdAt: '2026-09-19T10:00:00Z' },
        assessment: readyAssessment('a-gen', [], { status: 'generating', createdAt: '2026-09-19T10:00:00Z' }),
        attempts: [],
      }),
      buildAssessmentRow({
        pointer: { assessmentId: 'a-new', materialIds: ['mat-1'], createdAt: '2026-09-22T10:00:00Z' },
        assessment: readyAssessment('a-new', [question('q1', 'a-new')], { createdAt: '2026-09-22T10:00:00Z' }),
        attempts: [],
      }),
    ]
    expect(orderAssessmentRows(rows).map((r) => r.assessmentId)).toEqual(['a-gen', 'a-new', 'a-old'])
  })

  it('splits runs into resume then history newest first', () => {
    const mk = (
      runId: string,
      startedAt: string,
      state: 'in-progress' | 'generating' | 'completed' | 'abandoned' | 'failed' | 'unavailable',
    ) => {
      if (state === 'completed' || state === 'abandoned') {
        return buildPracticeRunRow({
          entry: {
            started: { runId, materialIds: ['mat-1'], mode: 'written', assessmentIds: ['a-1'], count: 1, families: ['written'] },
            finished: { runId, outcome: state },
            startedAt,
          },
          assessments: [readyAssessment('a-1', [question('q1', 'a-1')])],
          attemptsByAssessment: {},
        })
      }
      if (state === 'failed') {
        return buildPracticeRunRow({
          entry: {
            started: { runId, materialIds: ['mat-1'], mode: 'written', assessmentIds: ['a-1'], count: 1, families: ['written'] },
            finished: null,
            startedAt,
          },
          assessments: [
            readyAssessment('a-1', [], { status: 'failed', warnings: [{ code: 'code_not_derivable', message: 'x' }] }),
          ],
          attemptsByAssessment: {},
        })
      }
      if (state === 'generating') {
        return buildPracticeRunRow({
          entry: {
            started: { runId, materialIds: ['mat-1'], mode: 'written', assessmentIds: ['a-1'], count: 1, families: ['written'] },
            finished: null,
            startedAt,
          },
          assessments: [readyAssessment('a-1', [], { status: 'generating' })],
          attemptsByAssessment: {},
        })
      }
      if (state === 'unavailable') {
        return buildPracticeRunRow({
          entry: {
            started: { runId, materialIds: ['mat-1'], mode: 'written', assessmentIds: ['a-1'], count: 1, families: ['written'] },
            finished: null,
            startedAt,
          },
          assessments: [null],
          attemptsByAssessment: {},
        })
      }
      return buildPracticeRunRow({
        entry: {
          started: { runId, materialIds: ['mat-1'], mode: 'written', assessmentIds: ['a-1'], count: 1, families: ['written'] },
          finished: null,
          startedAt,
        },
        assessments: [readyAssessment('a-1', [question('q1', 'a-1')])],
        attemptsByAssessment: {},
      })
    }
    const rows = [
      mk('run-old-resume', '2026-09-20T10:00:00Z', 'in-progress'),
      mk('run-new-resume', '2026-09-22T10:00:00Z', 'generating'),
      mk('run-old-hist', '2026-09-19T10:00:00Z', 'completed'),
      mk('run-new-hist', '2026-09-23T10:00:00Z', 'abandoned'),
    ]
    const split = splitRunRows(rows)
    expect(split.resume.map((r) => r.runId)).toEqual(['run-new-resume', 'run-old-resume'])
    expect(split.history.map((r) => r.runId)).toEqual(['run-new-hist', 'run-old-hist'])
  })
})
