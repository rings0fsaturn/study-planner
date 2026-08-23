import { describe, expect, it, vi } from 'vitest'
import {
  AssessmentClient,
  HttpAssessmentFetch,
  type AssessmentFetchLike,
} from './assessmentClient'
import {
  AssessmentServiceError,
  type Assessment,
  type AsyncJob,
  type GenerationRequest,
} from './types'

function request(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    clientId: 'client-1',
    materialIds: ['mat-1'],
    recipe: { formats: ['objective'], questionCount: 1, difficulty: 3, skillTags: ['core'] },
    correlationId: 'corr-1',
    ...overrides,
  }
}

function asyncJob(overrides: Partial<AsyncJob> = {}): AsyncJob {
  return {
    jobId: 'job-1',
    kind: 'generation',
    status: 'queued',
    ownerId: 'user-1',
    correlationId: 'corr-1',
    resultId: 'assessment-1',
    createdAt: '2026-08-14T00:00:00Z',
    ...overrides,
  }
}

function assessment(overrides: Partial<Assessment> = {}): Assessment {
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
        prompt: 'Stem?',
        options: ['a', 'b', 'c', 'd'],
        skillTags: ['core'],
        authoredDifficulty: 3,
        citations: [],
      },
    ],
    warnings: [],
    groundingStale: false,
    createdAt: '2026-08-14T00:00:00Z',
    ...overrides,
  }
}

class FakeFetch implements AssessmentFetchLike {
  calls: Array<{ path: string; init?: RequestInit }> = []
  constructor(private readonly respond: () => Promise<unknown>) {}

  async fetchJson(path: string, init?: RequestInit): Promise<unknown> {
    this.calls.push({ path, init })
    return this.respond()
  }
}

describe('AssessmentClient', () => {
  it('generateAssessment posts the request and returns the AsyncJob', async () => {
    const job = asyncJob()
    const fetchLike = new FakeFetch(async () => job)
    const client = new AssessmentClient(fetchLike)

    await expect(client.generateAssessment(request())).resolves.toEqual(job)
    expect(fetchLike.calls[0].path).toBe('/v1/assessments/generate')
    const init = fetchLike.calls[0].init!
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBeDefined()
    expect(headers['Idempotency-Key']!.length).toBeGreaterThanOrEqual(16)
    expect(headers['X-Request-ID']).toBeDefined()
    expect(JSON.parse(String(init.body)).materialIds).toEqual(['mat-1'])
  })

  it('getAssessment returns the redacted assessment', async () => {
    const result = assessment()
    const client = new AssessmentClient(new FakeFetch(async () => result))

    await expect(client.getAssessment('assessment-1')).resolves.toEqual(result)
  })

  it('getJob returns the job', async () => {
    const job = asyncJob()
    const client = new AssessmentClient(new FakeFetch(async () => job))

    await expect(client.getJob('job-1')).resolves.toEqual(job)
  })

  it('normalizes a 401 into unauthorized', async () => {
    const client = new AssessmentClient(
      new FakeFetch(async () => {
        throw new AssessmentServiceError('unauthorized', 'not signed in', false)
      }),
    )
    await expect(client.generateAssessment(request())).rejects.toMatchObject({
      code: 'unauthorized',
      retryable: false,
    })
  })

  it('normalizes a 409 into conflict', async () => {
    const client = new AssessmentClient(
      new FakeFetch(async () => {
        throw new AssessmentServiceError('conflict', 'assessment already exists', false)
      }),
    )
    await expect(client.generateAssessment(request())).rejects.toMatchObject({
      code: 'conflict',
    })
  })

  it('normalizes a 429 into quota_exhausted with retryAfterSeconds', async () => {
    const client = new AssessmentClient(
      new FakeFetch(async () => {
        throw new AssessmentServiceError('quota_exhausted', 'quota', false, 60)
      }),
    )
    const error = await client.generateAssessment(request()).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(AssessmentServiceError)
    expect((error as AssessmentServiceError).code).toBe('quota_exhausted')
    expect((error as AssessmentServiceError).retryAfterSeconds).toBe(60)
  })

  it('normalizes an AbortError into a retryable timeout', async () => {
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    const client = new AssessmentClient(
      new FakeFetch(async () => {
        throw abortError
      }),
    )
    await expect(client.getAssessment('a1')).rejects.toMatchObject({
      code: 'timeout',
      retryable: true,
    })
  })

  it('normalizes a TypeError into a retryable network error', async () => {
    const client = new AssessmentClient(
      new FakeFetch(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    await expect(client.getAssessment('a1')).rejects.toMatchObject({
      code: 'network',
      retryable: true,
    })
  })

  it('passes through typed errors owned by the client', async () => {
    const typed = new AssessmentServiceError('service', 'boom', true)
    const client = new AssessmentClient(
      new FakeFetch(async () => {
        throw typed
      }),
    )
    await expect(client.getJob('j1')).rejects.toBe(typed)
  })

  it('classifies an unknown non-Error value as unknown', async () => {
    const client = new AssessmentClient(
      new FakeFetch(async () => {
        throw 'string failure'
      }),
    )
    await expect(client.getJob('j1')).rejects.toMatchObject({ code: 'unknown' })
  })
})

describe('HttpAssessmentFetch', () => {
  it('adds the bearer token and retries 5xx once before failing', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const fetchLike = new HttpAssessmentFetch(async () => 'token-1', 'http://intel')
    await expect(fetchLike.fetchJson('/v1/jobs/j1')).rejects.toMatchObject({
      code: 'service',
      retryable: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer token-1')
    vi.unstubAllGlobals()
  })

  it('recovers on the retry when the second attempt succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response('{"jobId":"j1"}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const fetchLike = new HttpAssessmentFetch(async () => null, 'http://intel')
    await expect(fetchLike.fetchJson('/v1/jobs/j1')).resolves.toEqual({ jobId: 'j1' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })

  it('does not retry 429 and surfaces retryAfterSeconds', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response('{}', { status: 429, headers: { 'retry-after': '45' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const fetchLike = new HttpAssessmentFetch(async () => null, 'http://intel')
    const error = await fetchLike.fetchJson('/v1/assessments/generate', {}).catch((err: unknown) => err)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((error as AssessmentServiceError).code).toBe('quota_exhausted')
    expect((error as AssessmentServiceError).retryAfterSeconds).toBe(45)
    vi.unstubAllGlobals()
  })

  it('turns an AbortError into a retryable timeout', async () => {
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    const fetchMock = vi.fn().mockRejectedValueOnce(abortError).mockRejectedValueOnce(abortError)
    vi.stubGlobal('fetch', fetchMock)

    const fetchLike = new HttpAssessmentFetch(async () => null, 'http://intel')
    await expect(fetchLike.fetchJson('/v1/jobs/j1')).rejects.toMatchObject({
      code: 'timeout',
      retryable: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })
})