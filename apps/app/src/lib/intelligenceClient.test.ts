import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CalibrationAuthError,
  CalibrationServiceError,
  RoadmapServiceError,
  postCalibration,
  postRoadmapRegenerate,
} from './intelligenceClient'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}))

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('postCalibration', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
      error: null,
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    mocks.getSession.mockReset()
  })

  it('attaches the current Supabase access token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await postCalibration({ sessions: [] })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/v1/calibration',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
        }),
      }),
    )
  })

  it('retries a transient server failure and returns the successful response', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('unavailable', { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(postCalibration({ sessions: [] })).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry an auth failure', async () => {
    fetchMock.mockResolvedValue(new Response('unauthorized', { status: 401 }))

    await expect(postCalibration({ sessions: [] })).rejects.toBeInstanceOf(CalibrationAuthError)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborts timed out attempts and reports the final failure once', async () => {
    vi.useFakeTimers()
    class BrowserAbortError extends Error {
      name = 'AbortError'
    }

    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new BrowserAbortError('request aborted'))
        })
      })
    })

    const result = expect(postCalibration({ sessions: [] })).rejects.toBeInstanceOf(
      CalibrationServiceError,
    )

    await vi.advanceTimersByTimeAsync(8000)
    await vi.advanceTimersByTimeAsync(250)
    await vi.advanceTimersByTimeAsync(8000)
    await vi.advanceTimersByTimeAsync(500)
    await vi.advanceTimersByTimeAsync(8000)

    await result
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('normalizes exhausted network TypeError failures', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = expect(postCalibration({ sessions: [] })).rejects.toBeInstanceOf(
      CalibrationServiceError,
    )

    await vi.advanceTimersByTimeAsync(250)
    await vi.advanceTimersByTimeAsync(500)

    await result
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
})

describe('postRoadmapRegenerate', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
      error: null,
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    mocks.getSession.mockReset()
  })

  it('does not retry an auth failure', async () => {
    fetchMock.mockResolvedValue(new Response('unauthorized', { status: 401 }))

    await expect(postRoadmapRegenerate({ input: {}, pins: [] })).rejects.toBeInstanceOf(
      CalibrationAuthError,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a transient server failure and returns the successful response', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ weeks: [], warnings: [], capacityCheck: {} }))

    await expect(postRoadmapRegenerate({ input: {}, pins: [] })).resolves.toEqual({
      weeks: [],
      warnings: [],
      capacityCheck: {},
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/v1/roadmap/regenerate',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
        }),
      }),
    )
  })

  it('aborts timed out attempts and reports the final roadmap failure once', async () => {
    vi.useFakeTimers()
    class BrowserAbortError extends Error {
      name = 'AbortError'
    }

    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new BrowserAbortError('request aborted'))
        })
      })
    })

    const result = expect(postRoadmapRegenerate({ input: {}, pins: [] })).rejects.toBeInstanceOf(
      RoadmapServiceError,
    )

    await vi.advanceTimersByTimeAsync(8000)
    await vi.advanceTimersByTimeAsync(250)
    await vi.advanceTimersByTimeAsync(8000)
    await vi.advanceTimersByTimeAsync(500)
    await vi.advanceTimersByTimeAsync(8000)

    await result
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('normalizes exhausted roadmap network TypeError failures', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = expect(postRoadmapRegenerate({ input: {}, pins: [] })).rejects.toBeInstanceOf(
      RoadmapServiceError,
    )

    await vi.advanceTimersByTimeAsync(250)
    await vi.advanceTimersByTimeAsync(500)

    await result
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
})
