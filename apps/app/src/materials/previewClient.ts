import type { MaterialContentPreview } from './types'
import { MaterialServiceError } from './types'
import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_INTELLIGENCE_URL ?? 'http://localhost:8000'
const TIMEOUT_MS = 8000

/**
 * Fetches the partial extracted-content preview from the Intelligence Service.
 * The service resolves the material through the caller's own token (RLS),
 * so the preview is automatically owner-scoped.
 */
export async function fetchMaterialContentPreview(
  materialId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MaterialContentPreview> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const headers: Record<string, string> = {
      'X-Request-ID': crypto.randomUUID(),
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetchImpl(`${BASE}/v1/materials/${materialId}/content`, {
      headers,
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 404) {
      throw new MaterialServiceError('not_found', 'content preview unavailable')
    }
    if (!response.ok) {
      throw new MaterialServiceError('unknown', `content preview ${response.status}`)
    }
    const body = (await response.json()) as MaterialContentPreview
    if (!body || typeof body.previewText !== 'string') {
      throw new MaterialServiceError('unknown', 'content preview malformed')
    }
    return body
  } catch (err) {
    if (err instanceof MaterialServiceError) throw err
    if (err instanceof TypeError) {
      throw new MaterialServiceError('network', 'content preview failed', true)
    }
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      throw new MaterialServiceError('timeout', 'content preview timed out', true)
    }
    throw new MaterialServiceError('unknown', 'content preview failed')
  } finally {
    clearTimeout(timer)
  }
}
