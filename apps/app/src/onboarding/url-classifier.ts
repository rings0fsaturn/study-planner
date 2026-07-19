export type UrlKind = 'youtube-video' | 'youtube-playlist' | 'article' | 'unknown'

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']

export function classifyUrl(raw: string): UrlKind {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'unknown'
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'unknown'

  const host = url.hostname.toLowerCase()

  if (!YOUTUBE_HOSTS.includes(host)) return 'article'

  if (host === 'youtu.be') return 'youtube-video'

  const path = url.pathname.toLowerCase()

  if (path === '/playlist') return 'youtube-playlist'
  if (path.startsWith('/embed/') || path.startsWith('/shorts/') || path.startsWith('/v/')) return 'youtube-video'

  const hasVideoId = url.searchParams.has('v')
  const hasListId = url.searchParams.has('list')

  if (hasVideoId) return 'youtube-video'
  if (hasListId) return 'youtube-playlist'

  return 'article'
}

export function extractYouTubeVideoId(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  if (!YOUTUBE_HOSTS.includes(host)) return null

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    return id || null
  }

  const path = url.pathname.toLowerCase()
  if (path.startsWith('/embed/') || path.startsWith('/v/')) {
    const id = url.pathname.split('/')[2]
    return id || null
  }
  if (path.startsWith('/shorts/')) {
    const id = url.pathname.split('/')[2]
    return id || null
  }

  return url.searchParams.get('v') || null
}

export function extractYouTubePlaylistId(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  return url.searchParams.get('list') || null
}
