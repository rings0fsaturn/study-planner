import { describe, it, expect } from 'vitest'
import { classifyUrl, extractYouTubeVideoId, extractYouTubePlaylistId } from './url-classifier'

describe('classifyUrl', () => {
  describe('youtube video URLs', () => {
    it('classifies youtube.com/watch?v=', () => {
      expect(classifyUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube-video')
    })

    it('classifies www.youtube.com/watch?v=', () => {
      expect(classifyUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube-video')
    })

    it('classifies youtu.be/ short links', () => {
      expect(classifyUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube-video')
    })

    it('classifies youtube.com/embed/', () => {
      expect(classifyUrl('https://youtube.com/embed/dQw4w9WgXcQ')).toBe('youtube-video')
    })

    it('classifies youtube.com/shorts/', () => {
      expect(classifyUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube-video')
    })

    it('classifies youtube.com/v/', () => {
      expect(classifyUrl('https://youtube.com/v/dQw4w9WgXcQ')).toBe('youtube-video')
    })

    it('classifies m.youtube.com/watch?v=', () => {
      expect(classifyUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube-video')
    })

    it('prioritizes video over playlist when both v= and list= are present', () => {
      expect(classifyUrl('https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('youtube-video')
    })

    it('handles extra query parameters', () => {
      expect(classifyUrl('https://youtube.com/watch?v=dQw4w9WgXcQ&t=120&feature=shared')).toBe('youtube-video')
    })
  })

  describe('youtube playlist URLs', () => {
    it('classifies youtube.com/playlist?list=', () => {
      expect(classifyUrl('https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('youtube-playlist')
    })

    it('classifies www.youtube.com/playlist?list=', () => {
      expect(classifyUrl('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('youtube-playlist')
    })

    it('classifies watch URL with list= but no v= as playlist', () => {
      expect(classifyUrl('https://youtube.com/watch?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('youtube-playlist')
    })
  })

  describe('article URLs', () => {
    it('classifies medium.com articles', () => {
      expect(classifyUrl('https://medium.com/some-article')).toBe('article')
    })

    it('classifies arxiv URLs', () => {
      expect(classifyUrl('https://arxiv.org/abs/2301.12345')).toBe('article')
    })

    it('classifies generic https URLs', () => {
      expect(classifyUrl('https://example.com/blog/post')).toBe('article')
    })

    it('classifies http URLs', () => {
      expect(classifyUrl('http://example.com/article')).toBe('article')
    })

    it('classifies youtube URLs with no recognized path as article', () => {
      expect(classifyUrl('https://youtube.com/about')).toBe('article')
    })
  })

  describe('unknown URLs', () => {
    it('returns unknown for empty string', () => {
      expect(classifyUrl('')).toBe('unknown')
    })

    it('returns unknown for plain text', () => {
      expect(classifyUrl('not a url')).toBe('unknown')
    })

    it('returns unknown for ftp URLs', () => {
      expect(classifyUrl('ftp://example.com/file')).toBe('unknown')
    })

    it('returns unknown for mailto', () => {
      expect(classifyUrl('mailto:user@example.com')).toBe('unknown')
    })

    it('returns unknown for javascript: protocol', () => {
      expect(classifyUrl('javascript:alert(1)')).toBe('unknown')
    })
  })
})

describe('extractYouTubeVideoId', () => {
  it('extracts from youtube.com/watch?v=', () => {
    expect(extractYouTubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from youtu.be/', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from embed URL', () => {
    expect(extractYouTubeVideoId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from shorts URL', () => {
    expect(extractYouTubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for non-YouTube URL', () => {
    expect(extractYouTubeVideoId('https://example.com')).toBeNull()
  })

  it('returns null for invalid URL', () => {
    expect(extractYouTubeVideoId('not a url')).toBeNull()
  })

  it('returns null for playlist URL without video', () => {
    expect(extractYouTubeVideoId('https://youtube.com/playlist?list=PLxyz')).toBeNull()
  })
})

describe('extractYouTubePlaylistId', () => {
  it('extracts from playlist URL', () => {
    expect(extractYouTubePlaylistId('https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
  })

  it('extracts from watch URL with list param', () => {
    expect(extractYouTubePlaylistId('https://youtube.com/watch?v=abc&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
  })

  it('returns null when no list param', () => {
    expect(extractYouTubePlaylistId('https://youtube.com/watch?v=abc')).toBeNull()
  })

  it('returns null for invalid URL', () => {
    expect(extractYouTubePlaylistId('not a url')).toBeNull()
  })
})
