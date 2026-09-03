/**
 * Typed assessment service client (rule 22).
 *
 * The real client wraps fetch with the intelligence base URL, the Supabase
 * bearer token, a timeout, and one retry for retryable failures. Tests inject
 * a narrow `AssessmentFetchLike` double; error normalization is centralized
 * here so hooks and pages never see raw AbortError/TypeError values.
 */

import { AssessmentServiceError } from './types'
import type {
  Assessment,
  AsyncJob,
  AttemptCreated,
  AttemptRecord,
  AttemptSubmitInput,
  GenerationRequest,
} from './types'

export interface AssessmentFetchLike {
  fetchJson(path: string, init?: RequestInit): Promise<unknown>
}

export interface AssessmentClientLike {
  generateAssessment(input: GenerationRequest): Promise<AsyncJob>
  getAssessment(assessmentId: string): Promise<Assessment>
  getJob(jobId: string): Promise<AsyncJob>
  submitAssessmentAttempt(
    assessmentId: string,
    questionId: string,
    input: AttemptSubmitInput,
  ): Promise<AttemptCreated>
  listAssessmentAttempts(assessmentId: string): Promise<AttemptRecord[]>
  /** AttemptTransport view (attemptFlow's DI seam) — same calls, fewer args. */
  readonly transport: {
    submitAttempt(
      assessmentId: string,
      questionId: string,
      input: Omit<AttemptSubmitInput, 'questionId'>,
    ): Promise<AttemptCreated>
    listAttempts(assessmentId: string): Promise<AttemptRecord[]>
  }
}

const TIMEOUT_MS = 15000
const MAX_RETRIES = 1

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get('retry-after')
  if (!raw) return undefined
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

function isAbortError(err: unknown): boolean {
  return Boolean(
    err && typeof err === 'object' && 'name' in err && err.name === 'AbortError',
  )
}

async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { code?: unknown }
    return typeof body.code === 'string' ? body.code : undefined
  } catch {
    return undefined
  }
}

export function normalizeAssessmentError(err: unknown): AssessmentServiceError {
  if (err instanceof AssessmentServiceError) return err
  if (err instanceof TypeError) {
    return new AssessmentServiceError('network', 'assessment request failed', true)
  }
  if (isAbortError(err)) {
    return new AssessmentServiceError('timeout', 'assessment request timed out', true)
  }
  if (err instanceof Error) {
    return new AssessmentServiceError('unknown', err.message || 'assessment request failed', false)
  }
  return new AssessmentServiceError('unknown', 'assessment request failed', false)
}

/**
 * Default fetch-like: base URL from VITE_INTELLIGENCE_URL, bearer auth, one
 * retry on 5xx/network/timeout with backoff (rule 22), typed errors.
 */
export class HttpAssessmentFetch implements AssessmentFetchLike {
  constructor(
    private readonly tokenProvider: () => Promise<string | null>,
    private readonly baseUrl: string =
      import.meta.env.VITE_INTELLIGENCE_URL ?? 'http://localhost:8000',
  ) {}

  async fetchJson(path: string, init: RequestInit = {}): Promise<unknown> {
    let lastError: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      try {
        const token = await this.tokenProvider()
        const headers: Record<string, string> = {
          ...(init.headers as Record<string, string> | undefined),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers,
          signal: controller.signal,
        })
        if (response.status === 401) {
          throw new AssessmentServiceError('unauthorized', 'not signed in', false)
        }
        if (response.status === 409) {
          // serialization maps validation_failed to 409 too; distinguish the
          // two 409 meanings by the body code.
          const code = await errorCode(response)
          if (code === 'validation_failed') {
            throw new AssessmentServiceError(
              'validation',
              'material is not ready for generation',
              false,
            )
          }
          throw new AssessmentServiceError('conflict', 'assessment already exists', false)
        }
        if (response.status === 429) {
          throw new AssessmentServiceError(
            'quota_exhausted',
            'generation quota exhausted',
            false,
            retryAfterSeconds(response),
          )
        }
        if (response.status >= 500) {
          throw new AssessmentServiceError(
            'service',
            `intelligence service failed (${response.status})`,
            true,
          )
        }
        if (!response.ok) {
          throw new AssessmentServiceError(
            'service',
            `assessment request failed (${response.status})`,
            false,
          )
        }
        return await response.json()
      } catch (err) {
        lastError = err
        if (err instanceof AssessmentServiceError) {
          if (!err.retryable || attempt >= MAX_RETRIES) throw err
        } else if (!isAbortError(err) && !(err instanceof TypeError)) {
          throw normalizeAssessmentError(err)
        }
        if (attempt < MAX_RETRIES) {
          await wait(250 * 2 ** attempt)
          continue
        }
      } finally {
        clearTimeout(timer)
      }
    }
    throw normalizeAssessmentError(lastError)
  }
}

export class AssessmentClient implements AssessmentClientLike {
  constructor(private readonly fetchLike: AssessmentFetchLike) {}

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (err) {
      throw normalizeAssessmentError(err)
    }
  }

  generateAssessment(input: GenerationRequest): Promise<AsyncJob> {
    return this.run(async () => {
      const payload = await this.fetchLike.fetchJson('/v1/assessments/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': crypto.randomUUID(),
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(input),
      })
      return payload as AsyncJob
    })
  }

  getAssessment(assessmentId: string): Promise<Assessment> {
    return this.run(async () => {
      const payload = await this.fetchLike.fetchJson(`/v1/assessments/${assessmentId}`)
      return payload as Assessment
    })
  }

  getJob(jobId: string): Promise<AsyncJob> {
    return this.run(async () => {
      const payload = await this.fetchLike.fetchJson(`/v1/jobs/${jobId}`)
      return payload as AsyncJob
    })
  }

  submitAssessmentAttempt(
    assessmentId: string,
    questionId: string,
    input: AttemptSubmitInput,
  ): Promise<AttemptCreated> {
    return this.run(async () => {
      const payload = await this.fetchLike.fetchJson(
        `/v1/assessments/${assessmentId}/questions/${questionId}/attempts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': crypto.randomUUID(),
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify(input),
        },
      )
      return payload as AttemptCreated
    })
  }

  listAssessmentAttempts(assessmentId: string): Promise<AttemptRecord[]> {
    return this.run(async () => {
      const payload = await this.fetchLike.fetchJson(
        `/v1/assessments/${assessmentId}/attempts`,
      )
      return payload as AttemptRecord[]
    })
  }

  /** AttemptTransport view over the same calls (attemptFlow DI seam). */
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
}