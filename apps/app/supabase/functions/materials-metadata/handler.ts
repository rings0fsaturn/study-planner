import { classifyUrl, extractYouTubeVideoId, extractYouTubePlaylistId } from './url-classifier.ts'
import type { YouTubeClient } from './youtube-client.ts'
import type { ArticleExtractor } from './article-extractor.ts'

const WPM = 200

export interface HandlerDeps {
  youtube: YouTubeClient
  articles: ArticleExtractor
}

export async function handleMetadataRequest(
  url: string,
  deps: HandlerDeps,
): Promise<Response> {
  const kind = classifyUrl(url)

  try {
    switch (kind) {
      case 'youtube-video': {
        const videoId = extractYouTubeVideoId(url)
        if (!videoId) {
          return Response.json({ type: 'error', message: 'Could not extract video ID' }, { status: 400 })
        }
        const details = await deps.youtube.getVideoDetails(videoId)
        return Response.json({
          type: 'youtube-video',
          title: details.title,
          durationMinutes: details.durationMinutes,
          youtubeVideoId: details.youtubeVideoId,
        })
      }
      case 'youtube-playlist': {
        const playlistId = extractYouTubePlaylistId(url)
        if (!playlistId) {
          return Response.json({ type: 'error', message: 'Could not extract playlist ID' }, { status: 400 })
        }
        const { playlistTitle, items } = await deps.youtube.getPlaylistItems(playlistId)
        return Response.json({
          type: 'youtube-playlist',
          playlistTitle,
          youtubePlaylistId: playlistId,
          videos: items.map(item => ({
            youtubeVideoId: item.youtubeVideoId,
            title: item.title,
            author: item.author,
            durationMinutes: item.durationMinutes,
          })),
        })
      }
      case 'article': {
        const data = await deps.articles.extract(url)
        const durationMinutes = data.wordCount ? Math.ceil(data.wordCount / WPM) : null
        return Response.json({
          type: 'article',
          title: data.title,
          durationMinutes,
        })
      }
      default:
        return Response.json({ type: 'error', message: 'Unrecognized URL format' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ type: 'error', message }, { status: 500 })
  }
}
