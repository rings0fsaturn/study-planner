import { describe, it, expect } from 'vitest'
import { expandPlaylistsToMaterials, type PlaylistEntry } from './OnboardingProvider'

function makePlaylist(overrides: Partial<PlaylistEntry> = {}): PlaylistEntry {
  return {
    id: 'pl-1',
    title: 'React Tutorial Playlist',
    fetchStatus: 'success',
    youtubePlaylistId: 'PLxyz123',
    confirmed: true,
    additionOrder: 0,
    role: 'foundation',
    videos: [
      { youtubeVideoId: 'v1', title: 'Intro', author: 'Author', durationMinutes: 5, selected: true },
      { youtubeVideoId: 'v2', title: 'Components', author: 'Author', durationMinutes: 10, selected: true },
      { youtubeVideoId: 'v3', title: 'Hooks', author: 'Author', durationMinutes: 8, selected: true },
    ],
    ...overrides,
  }
}

describe('expandPlaylistsToMaterials', () => {
  it('returns one material per confirmed playlist', () => {
    const result = expandPlaylistsToMaterials([makePlaylist()])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('pl-1')
    expect(result[0].title).toBe('React Tutorial Playlist')
  })

  it('sets estimatedDuration to sum of selected video durations', () => {
    const result = expandPlaylistsToMaterials([makePlaylist()])
    expect(result[0].estimatedDuration).toBe(23) // 5 + 10 + 8
  })

  it('includes only selected videos in playlistVideos', () => {
    const playlist = makePlaylist({
      videos: [
        { youtubeVideoId: 'v1', title: 'Intro', author: 'Author', durationMinutes: 5, selected: true },
        { youtubeVideoId: 'v2', title: 'Components', author: 'Author', durationMinutes: 10, selected: false },
        { youtubeVideoId: 'v3', title: 'Hooks', author: 'Author', durationMinutes: 8, selected: true },
      ],
    })
    const result = expandPlaylistsToMaterials([playlist])
    expect(result[0].estimatedDuration).toBe(13) // 5 + 8
    expect(result[0].playlistVideos).toHaveLength(2)
    expect(result[0].playlistVideos![0].youtubeVideoId).toBe('v1')
    expect(result[0].playlistVideos![1].youtubeVideoId).toBe('v3')
  })

  it('preserves video order in playlistVideos', () => {
    const result = expandPlaylistsToMaterials([makePlaylist()])
    expect(result[0].playlistVideos!.map(v => v.youtubeVideoId)).toEqual(['v1', 'v2', 'v3'])
  })

  it('excludes unconfirmed playlists', () => {
    const result = expandPlaylistsToMaterials([makePlaylist({ confirmed: false })])
    expect(result).toHaveLength(0)
  })

  it('excludes playlists with zero selected videos', () => {
    const playlist = makePlaylist({
      videos: [
        { youtubeVideoId: 'v1', title: 'Intro', author: 'Author', durationMinutes: 5, selected: false },
      ],
    })
    const result = expandPlaylistsToMaterials([playlist])
    expect(result).toHaveLength(0)
  })

  it('inherits role from playlist', () => {
    const result = expandPlaylistsToMaterials([makePlaylist({ role: 'practice' })])
    expect(result[0].role).toBe('practice')
  })

  it('sets kind to youtube', () => {
    const result = expandPlaylistsToMaterials([makePlaylist()])
    expect(result[0].kind).toBe('youtube')
  })

  it('sets url to playlist URL', () => {
    const result = expandPlaylistsToMaterials([makePlaylist()])
    expect(result[0].url).toBe('https://youtube.com/playlist?list=PLxyz123')
  })

  it('uses playlist additionOrder', () => {
    const result = expandPlaylistsToMaterials([makePlaylist({ additionOrder: 5 })])
    expect(result[0].additionOrder).toBe(5)
  })

  it('handles multiple playlists', () => {
    const playlists = [
      makePlaylist({ id: 'pl-1', title: 'Playlist A', additionOrder: 0 }),
      makePlaylist({ id: 'pl-2', title: 'Playlist B', additionOrder: 1 }),
    ]
    const result = expandPlaylistsToMaterials(playlists)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('pl-1')
    expect(result[1].id).toBe('pl-2')
  })
})
