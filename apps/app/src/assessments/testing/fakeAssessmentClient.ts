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
 * A coding question (#42): the visible payload only - starter code + visible
 * tests the advisory runner may execute. The hidden tests and reference
 * solution live server-side in `answer_block` and never appear here.
 */
export function codingQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-coding-1',
    assessmentId: 'assessment-1',
    materialId: 'mat-1',
    format: 'coding',
    subtype: 'implement_fn',
    prompt: 'Write sum_list(nums) that returns the sum of a list of integers.',
    options: [],
    starterCode: 'def sum_list(nums):\n    pass\n',
    visibleTests: [
      { name: 'adds small list', stdin: '[1, 2, 3]', expectedOutput: '6' },
      { name: 'handles empty list', stdin: '[]', expectedOutput: '0' },
    ],
    skillTags: ['Iteration'],
    authoredDifficulty: 2,
    citations: [{ chunkId: 'c1', materialId: 'mat-1', quote: 'loop over the list' }],
    ...overrides,
  }
}

/**
 * A normalized `judge0` grade (#42): the public verdict table only - visible
 * rows are named, hidden rows are veiled (`Hidden test N`), and neither
 * carries stdin or expected content.
 */
export function codingGrade(overrides: Partial<QuestionGradedResult> = {}): QuestionGradedResult {
  return {
    attemptId: 'att-coding-1',
    questionId: 'q-coding-1',
    materialId: 'mat-1',
    score: 0.75,
    correct: true,
    perSkill: [{ skillTag: 'Iteration', score: 0.75, correct: true }],
    explanation: 'Passed 3 of 4 tests. Failed: Hidden test 2.',
    grader: 'judge0',
    gradedAt: '2026-09-16T10:05:00Z',
    testCases: [
      { name: 'adds small list', passed: true, visible: true },
      { name: 'handles empty list', passed: true, visible: true },
      { name: 'Hidden test 1', passed: true, visible: false },
      { name: 'Hidden test 2', passed: false, visible: false },
    ],
    ...overrides,
  }
}

/**
 * An `output_prediction` coding question (#42 D-01): the authored snippet
 * rides `starterCode`, there are no visible tests, and the accepted value
 * stays server-side in `answer_block`.
 */
export function predictionQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-prediction-1',
    assessmentId: 'assessment-1',
    materialId: 'mat-1',
    format: 'coding',
    subtype: 'output_prediction',
    prompt: 'What does this snippet print?',
    options: [],
    starterCode: 'total = 0\nfor n in range(4):\n    total += n\nprint(total)\n',
    skillTags: ['Iteration'],
    authoredDifficulty: 2,
    citations: [{ chunkId: 'c1', materialId: 'mat-1', quote: 'loop over the range' }],
    ...overrides,
  }
}

/**
 * A normalized `objective` grade for an output_prediction answer (#42 D-01):
 * the deterministic numeric match, no sandbox verdict table.
 */
export function predictionGrade(
  overrides: Partial<QuestionGradedResult> = {},
): QuestionGradedResult {
  return {
    attemptId: 'att-prediction-1',
    questionId: 'q-prediction-1',
    materialId: 'mat-1',
    score: 1,
    correct: true,
    perSkill: [{ skillTag: 'Iteration', score: 1, correct: true }],
    grader: 'objective',
    gradedAt: '2026-09-16T10:05:00Z',
    publicFeedback: 'Correct.',
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