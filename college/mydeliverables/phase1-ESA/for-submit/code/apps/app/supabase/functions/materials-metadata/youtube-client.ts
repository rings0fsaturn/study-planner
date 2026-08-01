export interface VideoDetails {
  title: string
  durationMinutes: number
  youtubeVideoId: string
}

export interface PlaylistItem {
  youtubeVideoId: string
  title: string
  author: string
  durationMinutes: number
}

export interface YouTubeClient {
  getVideoDetails(videoId: string): Promise<VideoDetails>
  getPlaylistItems(playlistId: string): Promise<{ playlistTitle: string; items: PlaylistItem[] }>
}

export function parseISO8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 60 + minutes + Math.ceil(seconds / 60)
}

export class YouTubeDataApiClient implements YouTubeClient {
  constructor(private readonly apiKey: string) {}

  async getVideoDetails(videoId: string): Promise<VideoDetails> {
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}&part=snippet,contentDetails&key=${this.apiKey}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
    const data = await res.json()
    if (!data.items?.length) throw new Error('Video not found')
    const item = data.items[0]
    return {
      title: item.snippet.title,
      durationMinutes: parseISO8601Duration(item.contentDetails.duration),
      youtubeVideoId: videoId,
    }
  }

  async getPlaylistItems(playlistId: string): Promise<{ playlistTitle: string; items: PlaylistItem[] }> {
    const allVideoIds: string[] = []
    const snippetMap = new Map<string, { title: string; author: string }>()
    let pageToken: string | undefined
    let playlistTitle = `Playlist ${playlistId}`

    // Fetch playlist title
    const plUrl = `https://www.googleapis.com/youtube/v3/playlists?id=${encodeURIComponent(playlistId)}&part=snippet&key=${this.apiKey}`
    const plRes = await fetch(plUrl)
    if (plRes.ok) {
      const plData = await plRes.json()
      if (plData.items?.length) {
        playlistTitle = plData.items[0].snippet.title
      }
    }

    // Paginate through playlist items (50 per page)
    do {
      const params = new URLSearchParams({
        playlistId,
        part: 'snippet',
        maxResults: '50',
        key: this.apiKey,
      })
      if (pageToken) params.set('pageToken', pageToken)

      const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`)
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
      const data = await res.json()

      for (const item of data.items ?? []) {
        const videoId = item.snippet?.resourceId?.videoId
        if (!videoId) continue
        allVideoIds.push(videoId)
        snippetMap.set(videoId, {
          title: item.snippet.title,
          author: item.snippet.videoOwnerChannelTitle ?? '',
        })
      }

      pageToken = data.nextPageToken
    } while (pageToken)

    // Batch-fetch durations (50 IDs per call)
    const durationMap = new Map<string, number>()
    for (let i = 0; i < allVideoIds.length; i += 50) {
      const batch = allVideoIds.slice(i, i + 50)
      const params = new URLSearchParams({
        id: batch.join(','),
        part: 'contentDetails',
        key: this.apiKey,
      })
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
      if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
      const data = await res.json()
      for (const item of data.items ?? []) {
        durationMap.set(item.id, parseISO8601Duration(item.contentDetails.duration))
      }
    }

    const items: PlaylistItem[] = allVideoIds
      .filter(id => snippetMap.has(id))
      .map(id => ({
        youtubeVideoId: id,
        title: snippetMap.get(id)!.title,
        author: snippetMap.get(id)!.author,
        durationMinutes: durationMap.get(id) ?? 0,
      }))

    return { playlistTitle, items }
  }
}
