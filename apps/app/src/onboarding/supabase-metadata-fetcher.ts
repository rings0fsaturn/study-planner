import type { SupabaseClient } from '@supabase/supabase-js'
import type { MetadataFetcher, MetadataResult } from './metadata-fetcher'

export class SupabaseMetadataFetcher implements MetadataFetcher {
  constructor(private readonly supabase: SupabaseClient) {}

  async fetchMetadata(url: string): Promise<MetadataResult> {
    try {
      const { data, error } = await this.supabase.functions.invoke(
        'materials-metadata',
        { body: { url } },
      )
      if (error) {
        return { type: 'error', message: error.message ?? 'Metadata fetch failed' }
      }
      return data as MetadataResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Metadata fetch failed'
      const isCorsOrNetwork = message.includes('Failed to fetch') || message.includes('NetworkError')
      return {
        type: 'error',
        message: isCorsOrNetwork
          ? 'Could not reach the metadata service. The edge function may not be deployed.'
          : message,
      }
    }
  }
}
