/**
 * Typed guide service client (#46, rule 22).
 *
 * `streamHint` POSTs `/v1/guide/stream` and parses the SSE `HintFrame`s as
 * they arrive; `reveal` POSTs the gated-reveal acknowledgement. Both mint one
 * `X-Request-ID` per logical call and normalize failures to `GuideServiceError`
 * so hooks never see raw AbortError/TypeError values.
 */

import {
  GuideServiceError,
  type GuideFrame,
  type GuideRequest,
  type RevealRequest,
  type RevealResponse,
} from './types'

export interface GuideClientLike {
  /**
   * Stream one tier. `onFrame` fires per parsed frame in arrival order; the
   * promise resolves when the stream ends. The caller owns retry-before-`done`
   * (the hook re-issues the request; a `start` frame resets the buffer).
   */
  streamHint(
    request: GuideRequest,
    handlers: {
      onFrame: (frame: GuideFrame) => void
      signal?: AbortSignal
      /** Caller-owned id, so a retried logical call keeps one `X-Request-ID`. */
      requestId?: string
    },
  ): Promise<void>
  reveal(request: RevealRequest): Promise<RevealResponse>
}

const STREAM_TIMEOUT_MS = 60000
const JSON_TIMEOUT_MS = 15000
const MAX_RETRIES = 1

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'name' in err && err.name === 'AbortError')
}

export function normalizeGuideError(err: unknown, requestId?: string): GuideServiceError {
  if (err instanceof GuideServiceError) {
    return err.requestId || !requestId
      ? err
      : new GuideServiceError(
          err.code,
          err.message,
          err.retryable,
          err.retryAfterSeconds,
          requestId,
        )
  }
  if (err instanceof TypeError) {
    return new GuideServiceError('network', 'guide request failed', true, undefined, requestId)
  }
  if (isAbortError(err)) {
    return new GuideServiceError('timeout', 'guide request timed out', true, undefined, requestId)
  }
  if (err instanceof Error) {
    return new GuideServiceError('unknown', err.message || 'guide request failed', false, undefined, requestId)
  }
  return new GuideServiceError('unknown', 'guide request failed', false, undefined, requestId)
}

async function errorBodyCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { code?: unknown }
    return typeof body.code === 'string' ? body.code : undefined
  } catch {
    return undefined
  }
}

async function httpError(response: Response, requestId: string): Promise<GuideServiceError> {
  if (response.status === 401) {
    return new GuideServiceError('unauthorized', 'not signed in', false, undefined, requestId)
  }
  if (response.status === 403) {
    return new GuideServiceError('forbidden', 'reveal gate denied', false, undefined, requestId)
  }
  if (response.status === 404) {
    return new GuideServiceError('not_found', 'question not found', false, undefined, requestId)
  }
  if (response.status === 429) {
    return new GuideServiceError('quota_exhausted', 'guide quota exhausted', false, undefined, requestId)
  }
  const code = await errorBodyCode(response)
  if (code === 'forbidden') {
    return new GuideServiceError('forbidden', 'reveal gate denied', false, undefined, requestId)
  }
  if (response.status >= 500) {
    return new GuideServiceError(
      'service',
      `intelligence service failed (${response.status})`,
      true,
      undefined,
      requestId,
    )
  }
  return new GuideServiceError(
    'service',
    `guide request failed (${response.status})`,
    false,
    undefined,
    requestId,
  )
}

export class HttpGuideClient implements GuideClientLike {
  constructor(
    private readonly tokenProvider: () => Promise<string | null>,
    private readonly baseUrl: string =
      import.meta.env.VITE_INTELLIGENCE_URL ?? 'http://localhost:8000',
  ) {}

  private async authHeaders(requestId: string): Promise<Record<string, string>> {
    const token = await this.tokenProvider()
    return {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'Idempotency-Key': crypto.randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async streamHint(
    request: GuideRequest,
    handlers: {
      onFrame: (frame: GuideFrame) => void
      signal?: AbortSignal
      requestId?: string
    },
  ): Promise<void> {
    const requestId = handlers.requestId ?? crypto.randomUUID()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)
    const onExternalAbort = () => controller.abort()
    handlers.signal?.addEventListener('abort', onExternalAbort)
    try {
      const response = await fetch(`${this.baseUrl}/v1/guide/stream`, {
        method: 'POST',
        headers: await this.authHeaders(requestId),
        body: JSON.stringify(request),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw await httpError(response, requestId)
      }
      if (!response.body) {
        throw new GuideServiceError('service', 'guide stream had no body', true, undefined, requestId)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const chunk = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue
            try {
              handlers.onFrame(JSON.parse(line.slice('data: '.length)) as GuideFrame)
            } catch {
              // A malformed frame is dropped; the stream continues.
            }
          }
          boundary = buffer.indexOf('\n\n')
        }
      }
    } catch (err) {
      throw normalizeGuideError(err, requestId)
    } finally {
      clearTimeout(timer)
      handlers.signal?.removeEventListener('abort', onExternalAbort)
    }
  }

  async reveal(request: RevealRequest): Promise<RevealResponse> {
    const requestId = crypto.randomUUID()
    let lastError: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), JSON_TIMEOUT_MS)
      try {
        const response = await fetch(`${this.baseUrl}/v1/guide/reveal`, {
          method: 'POST',
          headers: await this.authHeaders(requestId),
          body: JSON.stringify(request),
          signal: controller.signal,
        })
        if (!response.ok) {
          throw await httpError(response, requestId)
        }
        return (await response.json()) as RevealResponse
      } catch (err) {
        lastError = err
        const normalized = err instanceof GuideServiceError ? err : undefined
        const retryable = normalized ? normalized.retryable : true
        if (!retryable || attempt >= MAX_RETRIES) {
          throw normalized ?? normalizeGuideError(err, requestId)
        }
        await wait(250 * 2 ** attempt)
      } finally {
        clearTimeout(timer)
      }
    }
    throw normalizeGuideError(lastError, requestId)
  }
}
