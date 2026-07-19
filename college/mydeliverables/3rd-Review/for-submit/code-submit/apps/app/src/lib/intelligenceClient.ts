import { supabase } from './supabase'

const BASE = import.meta.env.VITE_INTELLIGENCE_URL ?? 'http://localhost:8000'
const TIMEOUT_MS = 8000
const MAX_RETRIES = 2

export class CalibrationAuthError extends Error {}
export class CalibrationServiceError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message)
  }
}

export class RoadmapServiceError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message)
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetry(err: unknown): boolean {
  if (err instanceof CalibrationAuthError) return false
  if (err instanceof CalibrationServiceError) return err.retryable
  return true
}

function normalizedError(err: unknown): Error {
  if (err instanceof CalibrationAuthError) return err
  if (err instanceof CalibrationServiceError) return err
  if (err instanceof Error) {
    const message = err.name === 'AbortError' ? 'calibration timed out' : err.message
    return new CalibrationServiceError(message || 'calibration failed')
  }
  return new CalibrationServiceError('calibration failed')
}

function shouldRetryRoadmap(err: unknown): boolean {
  if (err instanceof CalibrationAuthError) return false
  if (err instanceof RoadmapServiceError) return err.retryable
  return true
}

function normalizedRoadmapError(err: unknown): Error {
  if (err instanceof CalibrationAuthError) return err
  if (err instanceof RoadmapServiceError) return err
  if (err instanceof Error) {
    const message = err.name === 'AbortError' ? 'roadmap regenerate timed out' : err.message
    return new RoadmapServiceError(message || 'roadmap regenerate failed')
  }
  return new RoadmapServiceError('roadmap regenerate failed')
}

export async function postCalibration(body: unknown): Promise<unknown> {
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const resp = await fetch(`${BASE}/v1/calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (resp.status === 401) throw new CalibrationAuthError('unauthorized')
      if (resp.status >= 500) {
        throw new CalibrationServiceError(`calibration ${resp.status}`, true)
      }
      if (!resp.ok) throw new CalibrationServiceError(`calibration ${resp.status}`)
      return await resp.json()
    } catch (err) {
      lastError = err
      if (!shouldRetry(err)) {
        if (!(err instanceof CalibrationAuthError)) {
          console.warn('[intelligence] calibration failed after retries', lastError)
        }
        throw normalizedError(err)
      }
      if (attempt < MAX_RETRIES) {
        await wait(250 * 2 ** attempt)
        continue
      }
    } finally {
      clearTimeout(timer)
    }
  }

  console.warn('[intelligence] calibration failed after retries', lastError)
  throw normalizedError(lastError)
}

export async function postRoadmapRegenerate(body: unknown): Promise<unknown> {
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const resp = await fetch(`${BASE}/v1/roadmap/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (resp.status === 401) throw new CalibrationAuthError('unauthorized')
      if (resp.status >= 500) {
        throw new RoadmapServiceError(`roadmap regenerate ${resp.status}`, true)
      }
      if (!resp.ok) throw new RoadmapServiceError(`roadmap regenerate ${resp.status}`)
      return await resp.json()
    } catch (err) {
      lastError = err
      if (!shouldRetryRoadmap(err)) {
        if (!(err instanceof CalibrationAuthError)) {
          console.warn('[intelligence] roadmap regenerate failed after retries', lastError)
        }
        throw normalizedRoadmapError(err)
      }
      if (attempt < MAX_RETRIES) {
        await wait(250 * 2 ** attempt)
        continue
      }
    } finally {
      clearTimeout(timer)
    }
  }

  console.warn('[intelligence] roadmap regenerate failed after retries', lastError)
  throw normalizedRoadmapError(lastError)
}
