import { vi } from 'vitest'
import type { AssessmentClientLike } from '../assessmentClient'
import type {
  Assessment,
  AsyncJob,
  AttemptCreated,
  AttemptRecord,
  AttemptSubmitInput,
  GenerationRequest,
  Question,
  QuestionGradedResult,
} from '../types'

/**
 * In-memory AssessmentClientLike double for provider and page tests.
 * Calls are recorded so tests can assert payloads and navigation inputs.
 */

export class FakeAssessmentClient implements AssessmentClientLike {
  generateAssessment = vi.fn(async (_input: GenerationRequest): Promise<AsyncJob> => {
    throw new Error('generateAssessment not scripted')
  })

  getAssessment = vi.fn(async (_assessmentId: string): Promise<Assessment> => {
    throw new Error('getAssessment not scripted')
  })

  getJob = vi.fn(async (_jobId: string): Promise<AsyncJob> => {
    throw new Error('getJob not scripted')
  })

  regenerateAssessment = vi.fn(async (_assessmentId: string): Promise<AsyncJob> => {
    throw new Error('regenerateAssessment not scripted')
  })

  submitAssessmentAttempt = vi.fn(
    async (
      _assessmentId: string,
      _questionId: string,
      _input: AttemptSubmitInput,
    ): Promise<AttemptCreated> => {
      throw new Error('submitAssessmentAttempt not scripted')
    },
  )

  listAssessmentAttempts = vi.fn(async (_assessmentId: string): Promise<AttemptRecord[]> => {
    throw new Error('listAssessmentAttempts not scripted')
  })

  /** AttemptTransport view over the scripted calls (attemptFlow DI seam). */
  readonly transport = {
    submitAttempt: (
      assessmentId: string,
      questionId: string,
      input: Omit<AttemptSubmitInput, 'questionId'>,
    ): Promise<AttemptCreated> =>
      this.submitAssessmentAttempt(assessmentId, questionId, { ...input, questionId }),
    listAttempts: (assessmentId: string): Promise<AttemptRecord[]> =>
      this.listAssessmentAttempts(assessmentId),
  }

  scriptGenerate(result: AsyncJob | Error): void {
    this.generateAssessment.mockImplementation(async () => {
      if (result instanceof Error) throw result
      return result
    })
  }

  scriptGetAssessment(result: Assessment | Error): void {
    this.getAssessment.mockImplementation(async () => {
      if (result instanceof Error) throw result
      return result
    })
  }

  scriptRegenerate(result: AsyncJob | Error): void {
    this.regenerateAssessment.mockImplementation(async () => {
      if (result instanceof Error) throw result
      return result
    })
  }

  scriptSubmitAttempt(result: AttemptCreated | Error): void {
    this.submitAssessmentAttempt.mockImplementation(async () => {
      if (result instanceof Error) throw result
      return result
    })
  }

  scriptListAttempts(result: AttemptRecord[] | Error): void {
    this.listAssessmentAttempts.mockImplementation(async () => {
      if (result instanceof Error) throw result
      return result
    })
  }
}

/**
 * Answer-bearing attempt record (#40 D-01): the owner-scoped read route
 * echoes the learner's own answer, so scripted listAttempts rows carry it.
 */
export function attemptRecord(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    attemptId: 'att-1',
    clientAttemptId: 'ca-1',
    questionId: 'q1',
    assessmentId: 'assessment-1',
    submittedAt: '2026-09-03T10:00:00Z',
    status: 'queued',
    answer: { index: 0 },
    grade: null,
    ...overrides,
  }
}

export function readyAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 'assessment-1',
    ownerId: 'user-1',
    materialIds: ['mat-1'],
    status: 'ready',
    questions: [
      {
        id: 'q1',
        assessmentId: 'assessment-1',
        materialId: 'mat-1',
        format: 'objective',
        prompt: 'What is the planning gap?',
        options: ['Shortfall', 'Surplus', 'Budget', 'Deadline'],
        skillTags: ['Strategic Planning'],
        authoredDifficulty: 3,
        citations: [{ chunkId: 'c1', materialId: 'mat-1', quote: 'shortfall' }],
      },
    ],
    warnings: [],
    groundingStale: false,
    createdAt: '2026-08-14T00:00:00Z',
    ...overrides,
  }
}

export function queuedJob(overrides: Partial<AsyncJob> = {}): AsyncJob {
  return {
    jobId: 'job-1',
    kind: 'generation',
    status: 'queued',
    ownerId: 'user-1',
    correlationId: 'corr-1',
    attempt: 1,
    resultId: 'assessment-1',
    createdAt: '2026-08-14T00:00:00Z',
    ...overrides,
  }
}

/**
 * A written question (#41): the visible payload only — the authored rubric
 * and reference answer live server-side in `answer_block` and never appear in
 * a client shape.
 */
export function writtenQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-written-1',
    assessmentId: 'assessment-1',
    materialId: 'mat-1',
    format: 'written',
    subtype: 'long_form',
    prompt: 'Explain how bias correction changes the first update steps.',
    options: [],
    skillTags: ['Optimization'],
    authoredDifficulty: 4,
    citations: [
      { chunkId: 'c1', materialId: 'mat-1', quote: 'the first updates are too large' },
    ],
    ...overrides,
  }
}

/**
 * A normalized `llm_rubric` grade (#41): public criterion fields only, with a
 * mixed met/not-met breakdown so a partial score is exercised.
 */
export function writtenGrade(overrides: Partial<QuestionGradedResult> = {}): QuestionGradedResult {
  return {
    attemptId: 'att-written-1',
    questionId: 'q-written-1',
    materialId: 'mat-1',
    score: 0.75,
    correct: true,
    perSkill: [{ skillTag: 'Optimization', score: 0.75, correct: true }],
    explanation: 'You named both running estimates; the early-step mechanism is implied.',
    grader: 'llm_rubric',
    gradedAt: '2026-09-10T10:05:00Z',
    rubricBreakdown: [
      {
        criterion: 'Names both running estimates',
        weight: 0.4,
        score: 1,
        met: true,
        feedback: 'Both averages identified.',
      },
      {
        criterion: 'Explains the early-step effect',
        weight: 0.6,
        score: 0.5833,
        met: false,
        feedback: 'Mechanism not explained.',
      },
    ],
    ...overrides,
  }
}