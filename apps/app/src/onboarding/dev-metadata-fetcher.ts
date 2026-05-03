import type { SupabaseClient } from '@supabase/supabase-js'
import type { MetadataFetcher, MetadataResult } from './metadata-fetcher'

export class DevMetadataFetcher implements MetadataFetcher {
  constructor(private readonly supabase: SupabaseClient) {}

  async fetchMetadata(url: string): Promise<MetadataResult> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const resp = await fetch('/supabase-fn/materials-metadata', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url }),
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => null)
        return {
          type: 'error',
          message: body?.message ?? `Edge function returned ${resp.status}`,
        }
      }
      return await resp.json() as MetadataResult
    } catch (err) {
      console.warn('[DevMetadataFetcher] Fetch failed, edge function may not be deployed:', err)
      return {
        type: 'error',
        message: 'Metadata fetch unavailable in dev mode. Deploy the edge function or use `supabase functions serve`.',
      }
    }
  }
}
