import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseMetadataFetcher } from './supabase-metadata-fetcher'

function createFakeSupabase(invokeResult: { data: unknown; error: unknown } | Error) {
  return {
    functions: {
      invoke: vi.fn().mockImplementation(() => {
        if (invokeResult instanceof Error) throw invokeResult
        return Promise.resolve(invokeResult)
      }),
    },
  } as unknown as SupabaseClient
}

describe('SupabaseMetadataFetcher', () => {
  it('returns youtube-video result on success', async () => {
    const data = { type: 'youtube-video', title: 'Test Video', durationMinutes: 10, youtubeVideoId: 'abc' }
    const supabase = createFakeSupabase({ data, error: null })
    const fetcher = new SupabaseMetadataFetcher(supabase)

    const result = await fetcher.fetchMetadata('https://youtube.com/watch?v=abc')

    expect(result).toEqual(data)
    expect(supabase.functions.invoke).toHaveBeenCalledWith('materials-metadata', {
      body: { url: 'https://youtube.com/watch?v=abc' },
    })
  })

  it('returns article result on success', async () => {
    const data = { type: 'article', title: 'Article Title', durationMinutes: 15 }
    const supabase = createFakeSupabase({ data, error: null })
    const fetcher = new SupabaseMetadataFetcher(supabase)

    const result = await fetcher.fetchMetadata('https://example.com/post')

    expect(result).toEqual(data)
  })

  it('returns youtube-playlist result on success', async () => {
    const data = {
      type: 'youtube-playlist', playlistTitle: 'My Playlist', youtubePlaylistId: 'PLxyz',
      videos: [{ youtubeVideoId: 'v1', title: 'V1', author: 'A', durationMinutes: 30 }],
    }
    const supabase = createFakeSupabase({ data, error: null })
    const fetcher = new SupabaseMetadataFetcher(supabase)

    const result = await fetcher.fetchMetadata('https://youtube.com/playlist?list=PLxyz')

    expect(result).toEqual(data)
  })

  it('returns error result when invoke returns error', async () => {
    const supabase = createFakeSupabase({ data: null, error: { message: 'Function failed' } })
    const fetcher = new SupabaseMetadataFetcher(supabase)

    const result = await fetcher.fetchMetadata('https://example.com')

    expect(result).toEqual({ type: 'error', message: 'Function failed' })
  })

  it('returns error result when invoke throws', async () => {
    const supabase = createFakeSupabase(new Error('Network error'))
    const fetcher = new SupabaseMetadataFetcher(supabase)

    const result = await fetcher.fetchMetadata('https://example.com')

    expect(result).toEqual({ type: 'error', message: 'Network error' })
  })
})
