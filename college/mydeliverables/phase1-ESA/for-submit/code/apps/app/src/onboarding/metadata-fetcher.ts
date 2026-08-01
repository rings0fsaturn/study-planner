export interface YouTubeVideoResult {
  type: 'youtube-video'
  title: string
  durationMinutes: number
  youtubeVideoId: string
}

export interface YouTubePlaylistResult {
  type: 'youtube-playlist'
  playlistTitle: string
  youtubePlaylistId: string
  videos: Array<{
    youtubeVideoId: string
    title: string
    author: string
    durationMinutes: number
  }>
}

export interface ArticleResult {
  type: 'article'
  title: string
  durationMinutes: number | null
}

export interface MetadataError {
  type: 'error'
  message: string
}

export type MetadataResult =
  | YouTubeVideoResult
  | YouTubePlaylistResult
  | ArticleResult
  | MetadataError

export interface MetadataFetcher {
  fetchMetadata(url: string): Promise<MetadataResult>
}
