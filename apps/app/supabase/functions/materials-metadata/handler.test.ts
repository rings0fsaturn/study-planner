import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handleMetadataRequest } from './handler.ts'
import type { YouTubeClient, VideoDetails, PlaylistItem } from './youtube-client.ts'
import type { ArticleExtractor, ArticleData } from './article-extractor.ts'

class FakeYouTubeClient implements YouTubeClient {
  private videos = new Map<string, VideoDetails>()
  private playlists = new Map<string, { playlistTitle: string; items: PlaylistItem[] }>()

  addVideo(videoId: string, details: VideoDetails): void {
    this.videos.set(videoId, details)
  }

  addPlaylist(playlistId: string, data: { playlistTitle: string; items: PlaylistItem[] }): void {
    this.playlists.set(playlistId, data)
  }

  async getVideoDetails(videoId: string): Promise<VideoDetails> {
    const details = this.videos.get(videoId)
    if (!details) throw new Error('Video not found')
    return details
  }

  async getPlaylistItems(playlistId: string): Promise<{ playlistTitle: string; items: PlaylistItem[] }> {
    const data = this.playlists.get(playlistId)
    if (!data) throw new Error('Playlist not found')
    return data
  }
}

class FakeArticleExtractor implements ArticleExtractor {
  private articles = new Map<string, ArticleData>()
  private errors = new Set<string>()

  addArticle(url: string, data: ArticleData): void {
    this.articles.set(url, data)
  }

  addError(url: string): void {
    this.errors.add(url)
  }

  async extract(url: string): Promise<ArticleData> {
    if (this.errors.has(url)) throw new Error('Fetch failed: 403')
    const data = this.articles.get(url)
    if (!data) throw new Error('No canned article data')
    return data
  }
}

function createDeps(): { youtube: FakeYouTubeClient; articles: FakeArticleExtractor } {
  return {
    youtube: new FakeYouTubeClient(),
    articles: new FakeArticleExtractor(),
  }
}

Deno.test('YouTube video URL returns video details', async () => {
  const deps = createDeps()
  deps.youtube.addVideo('dQw4w9WgXcQ', {
    title: 'Rick Astley - Never Gonna Give You Up',
    durationMinutes: 4,
    youtubeVideoId: 'dQw4w9WgXcQ',
  })

  const response = await handleMetadataRequest('https://youtube.com/watch?v=dQw4w9WgXcQ', deps)
  const body = await response.json()

  assertEquals(response.status, 200)
  assertEquals(body.type, 'youtube-video')
  assertEquals(body.title, 'Rick Astley - Never Gonna Give You Up')
  assertEquals(body.durationMinutes, 4)
  assertEquals(body.youtubeVideoId, 'dQw4w9WgXcQ')
})

Deno.test('YouTube playlist URL returns video list', async () => {
  const deps = createDeps()
  deps.youtube.addPlaylist('PLxyz', {
    playlistTitle: 'Study Videos',
    items: [
      { youtubeVideoId: 'v1', title: 'Intro', author: 'Channel A', durationMinutes: 10 },
      { youtubeVideoId: 'v2', title: 'Deep Dive', author: 'Channel B', durationMinutes: 45 },
    ],
  })

  const response = await handleMetadataRequest('https://youtube.com/playlist?list=PLxyz', deps)
  const body = await response.json()

  assertEquals(response.status, 200)
  assertEquals(body.type, 'youtube-playlist')
  assertEquals(body.playlistTitle, 'Study Videos')
  assertEquals(body.youtubePlaylistId, 'PLxyz')
  assertEquals(body.videos.length, 2)
  assertEquals(body.videos[0].title, 'Intro')
  assertEquals(body.videos[1].durationMinutes, 45)
})

Deno.test('Article URL returns title and reading time', async () => {
  const deps = createDeps()
  deps.articles.addArticle('https://example.com/post', {
    title: 'How to Study Effectively',
    wordCount: 2000,
  })

  const response = await handleMetadataRequest('https://example.com/post', deps)
  const body = await response.json()

  assertEquals(response.status, 200)
  assertEquals(body.type, 'article')
  assertEquals(body.title, 'How to Study Effectively')
  assertEquals(body.durationMinutes, 10) // 2000 / 200 wpm
})

Deno.test('Article with Readability failure returns title only (partial)', async () => {
  const deps = createDeps()
  deps.articles.addArticle('https://example.com/paywalled', {
    title: 'Paywalled Article',
    wordCount: null,
  })

  const response = await handleMetadataRequest('https://example.com/paywalled', deps)
  const body = await response.json()

  assertEquals(response.status, 200)
  assertEquals(body.type, 'article')
  assertEquals(body.title, 'Paywalled Article')
  assertEquals(body.durationMinutes, null)
})

Deno.test('Unreachable article URL returns error', async () => {
  const deps = createDeps()
  deps.articles.addError('https://unreachable.example.com')

  const response = await handleMetadataRequest('https://unreachable.example.com', deps)
  const body = await response.json()

  assertEquals(response.status, 500)
  assertEquals(body.type, 'error')
})

Deno.test('Unknown URL format returns 400 error', async () => {
  const deps = createDeps()

  const response = await handleMetadataRequest('ftp://example.com/file', deps)
  const body = await response.json()

  assertEquals(response.status, 400)
  assertEquals(body.type, 'error')
  assertEquals(body.message, 'Unrecognized URL format')
})

Deno.test('YouTube video not found returns 500 error', async () => {
  const deps = createDeps()
  // No video added — getVideoDetails will throw

  const response = await handleMetadataRequest('https://youtube.com/watch?v=nonexistent', deps)
  const body = await response.json()

  assertEquals(response.status, 500)
  assertEquals(body.type, 'error')
})
