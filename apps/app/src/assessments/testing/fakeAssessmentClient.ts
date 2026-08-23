import { vi } from 'vitest'
import type { AssessmentClientLike } from '../assessmentClient'
import type { Assessment, AsyncJob, GenerationRequest } from '../types'

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