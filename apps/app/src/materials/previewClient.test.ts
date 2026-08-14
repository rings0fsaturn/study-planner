import { describe, expect, it, vi, afterEach } from 'vitest'
import { fetchMaterialContentPreview } from './previewClient'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
  },
}))

const mockedGetSession = vi.mocked(supabase.auth.getSession)

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function previewBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    materialId: 'mat-1',
    state: 'chunking',
    previewText: 'partial content',
    chunkCount: 3,
    ready: false,
    updatedAt: '2026-08-14T00:00:00Z',
    ...overrides,
  }
}

function capture(fetchImpl: FetchImpl) {
  const seen: Array<{ url: string; init?: RequestInit }> = []
  const impl: FetchImpl = async (input, init) => {
    seen.push({ url: String(input), init })
    return fetchImpl(input, init)
  }
  return { impl, seen }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('fetchMaterialContentPreview', () => {
  it('sends the bearer token and an X-Request-ID header', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    } as never)
    const { impl, seen } = capture(async () => okJson(previewBody()))

    const body = await fetchMaterialContentPreview('mat-1', impl)

    expect(body.previewText).toBe('partial content')
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toContain('/v1/materials/mat-1/content')
    const headers = seen[0].init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-1')
    expect(headers['X-Request-ID']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('proceeds without Authorization when there is no session', async () => {
    mockedGetSession.mockResolvedValue({
      data: { session: null },
    } as never)
    const { impl, seen } = capture(async () => okJson(previewBody()))

    await fetchMaterialContentPreview('mat-1', impl)

    const headers = seen[0].init?.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('maps 401 and 404 to not_found', async () => {
    mockedGetSession.mockResolvedValue({ data: { session: null } } as never)
    for (const status of [401, 404]) {
      const { impl } = capture(async () => new Response('{}', { status }))
      await expect(fetchMaterialContentPreview('mat-1', impl)).rejects.toMatchObject({
        code: 'not_found',
        retryable: false,
      })
    }
  })

  it('maps other non-OK responses to unknown', async () => {
    mockedGetSession.mockResolvedValue({ data: { session: null } } as never)
    const { impl } = capture(async () => new Response('{}', { status: 500 }))
    await expect(fetchMaterialContentPreview('mat-1', impl)).rejects.toMatchObject({
      code: 'unknown',
    })
  })

  it('maps malformed JSON to unknown', async () => {
    mockedGetSession.mockResolvedValue({ data: { session: null } } as never)
    const { impl } = capture(async () => new Response('not json at all', { status: 200 }))
    await expect(fetchMaterialContentPreview('mat-1', impl)).rejects.toMatchObject({
      code: 'unknown',
    })
  })

  it('maps a body without previewText to unknown', async () => {
    mockedGetSession.mockResolvedValue({ data: { session: null } } as never)
    const { impl } = capture(async () => okJson({ materialId: 'mat-1' }))
    await expect(fetchMaterialContentPreview('mat-1', impl)).rejects.toMatchObject({
      code: 'unknown',
    })
  })

  it('maps network-shaped TypeError to retryable network', async () => {
    mockedGetSession.mockResolvedValue({ data: { session: null } } as never)
    const { impl } = capture(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(fetchMaterialContentPreview('mat-1', impl)).rejects.toMatchObject({
      code: 'network',
      retryable: true,
    })
  })

  it('maps abort-shaped failures to timeout', async () => {
    mockedGetSession.mockResolvedValue({ data: { session: null } } as never)
    class AbortLike extends Error {
      constructor() {
        super('aborted')
        this.name = 'AbortError'
      }
    }
    const { impl } = capture(async () => {
      throw new AbortLike()
    })
    await expect(fetchMaterialContentPreview('mat-1', impl)).rejects.toMatchObject({
      code: 'timeout',
      retryable: true,
    })
  })

  it('times out after 8 seconds and aborts the in-flight request', async () => {
    vi.useFakeTimers()
    mockedGetSession.mockResolvedValue({ data: { session: null } } as never)
    let aborted = false
    const impl: FetchImpl = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          aborted = true
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })

    const pending = fetchMaterialContentPreview('mat-1', impl)
    const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout', retryable: true })

    await vi.advanceTimersByTimeAsync(8000)
    await assertion
    expect(aborted).toBe(true)
  })
})
