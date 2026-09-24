import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuideServiceError } from './types'
import { HttpGuideClient, normalizeGuideError } from './guideClient'
import type { GuideFrame } from './types'

function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, { status })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function client(): HttpGuideClient {
  return new HttpGuideClient(async () => 'token')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HttpGuideClient.streamHint', () => {
  it('parses SSE frames in arrival order', async () => {
    const frames: GuideFrame[] = [
      { frame: 'start', sequence: 0, correlationId: 'c', text: 'Hel' },
      { frame: 'delta', sequence: 1, correlationId: 'c', text: 'lo' },
      { frame: 'done', sequence: 2, correlationId: 'c' },
    ]
    const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('')
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse([body.slice(0, 20), body.slice(20)])))
    const received: GuideFrame[] = []
    await client().streamHint(
      { questionId: 'q1', learnerWork: '', tier: 'nudge', correlationId: 'c' },
      { onFrame: (frame) => received.push(frame) },
    )
    expect(received).toEqual(frames)
  })

  it('drops a malformed frame but keeps the stream', async () => {
    const good: GuideFrame = { frame: 'done', sequence: 0, correlationId: 'c' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamResponse(['data: {not json}\n\n', `data: ${JSON.stringify(good)}\n\n`])),
    )
    const received: GuideFrame[] = []
    await client().streamHint(
      { questionId: 'q1', learnerWork: '', tier: 'nudge', correlationId: 'c' },
      { onFrame: (frame) => received.push(frame) },
    )
    expect(received).toEqual([good])
  })

  it('throws a typed error on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ code: 'not_found' }, 404)),
    )
    await expect(
      client().streamHint(
        { questionId: 'q1', learnerWork: '', tier: 'nudge', correlationId: 'c' },
        { onFrame: () => {} },
      ),
    ).rejects.toMatchObject({ code: 'not_found' })
  })

  it('sends the caller-owned X-Request-ID so a retried call stays joinable', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      streamResponse([`data: ${JSON.stringify({ frame: 'done', sequence: 0, correlationId: 'c' })}\n\n`]),
    )
    vi.stubGlobal('fetch', fetchMock)
    await client().streamHint(
      { questionId: 'q1', learnerWork: '', tier: 'nudge', correlationId: 'c' },
      { onFrame: () => {}, requestId: 'rid-1' },
    )
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['X-Request-ID']).toBe('rid-1')
  })
})

describe('HttpGuideClient.reveal', () => {
  it('returns the acknowledgement', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          questionId: 'q1',
          attemptId: 'a1',
          gateSatisfied: true,
          explanation: 'ok',
        }),
      ),
    )
    await expect(
      client().reveal({ questionId: 'q1', attemptId: 'a1', confirmation: true, correlationId: 'c' }),
    ).resolves.toMatchObject({ gateSatisfied: true })
  })

  it('maps a 403 to a non-retryable forbidden error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 'forbidden' }, 403)))
    await expect(
      client().reveal({ questionId: 'q1', attemptId: 'a1', confirmation: true, correlationId: 'c' }),
    ).rejects.toMatchObject({ code: 'forbidden', retryable: false })
  })
})

describe('normalizeGuideError', () => {
  it('maps a rejected TypeError to network', () => {
    expect(normalizeGuideError(new TypeError('failed'))).toMatchObject({ code: 'network' })
  })

  it('maps an abort-shaped error to timeout', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    expect(normalizeGuideError(err)).toMatchObject({ code: 'timeout' })
  })

  it('passes through a GuideServiceError', () => {
    const err = new GuideServiceError('forbidden', 'denied', false)
    expect(normalizeGuideError(err)).toBe(err)
  })

  it('maps an unknown non-Error value to unknown', () => {
    expect(normalizeGuideError('boom')).toMatchObject({ code: 'unknown' })
  })
})
