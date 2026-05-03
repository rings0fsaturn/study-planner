import { useState, useMemo, useEffect } from 'react'
import type { PlaylistVideo } from '../OnboardingProvider'

interface PlaylistPickerPopupProps {
  playlistTitle: string
  videos: PlaylistVideo[]
  onConfirm: (selectedVideoIds: string[]) => void
  onCancel: () => void
}

const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

function ThumbFallback() {
  return (
    <div className="playlist-picker-thumb-fallback" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <polygon points="3,2 12,7 3,12" fill="currentColor" />
      </svg>
    </div>
  )
}

export function PlaylistPickerPopup({
  playlistTitle,
  videos,
  onConfirm,
  onCancel,
}: PlaylistPickerPopupProps) {
  const [localSelection, setLocalSelection] = useState<Set<string>>(
    () => new Set(videos.filter(v => v.selected).map(v => v.youtubeVideoId)),
  )
  const [query, setQuery] = useState('')
  const [thumbErrors, setThumbErrors] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 10

  const normalizedQuery = query.trim().toLowerCase()
  const isFiltered = normalizedQuery.length > 0

  const filteredVideos = useMemo(() => {
    if (!isFiltered) return videos
    return videos.filter(
      v =>
        v.title.toLowerCase().includes(normalizedQuery) ||
        v.author.toLowerCase().includes(normalizedQuery),
    )
  }, [videos, isFiltered, normalizedQuery])

  useEffect(() => {
    setPage(0)
  }, [normalizedQuery])

  const filteredVideoIds = useMemo(
    () => filteredVideos.map(v => v.youtubeVideoId),
    [filteredVideos],
  )

  const totalPages = Math.ceil(filteredVideos.length / PAGE_SIZE)
  const paginatedVideos = filteredVideos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const allFilteredSelected =
    filteredVideoIds.length > 0 &&
    filteredVideoIds.every(id => localSelection.has(id))

  const bulkActionLabel = isFiltered
    ? allFilteredSelected
      ? `Deselect ${filteredVideos.length} matching`
      : `Select ${filteredVideos.length} matching`
    : allFilteredSelected
    ? 'Deselect all'
    : 'Select all'

  const toggleVideo = (videoId: string) => {
    setLocalSelection(prev => {
      const next = new Set(prev)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      return next
    })
  }

  const onBulkAction = () => {
    setLocalSelection(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredVideoIds.forEach(id => next.delete(id))
      } else {
        filteredVideoIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const onThumbError = (videoId: string) => {
    setThumbErrors(prev => {
      if (prev.has(videoId)) return prev
      const next = new Set(prev)
      next.add(videoId)
      return next
    })
  }

  // Footer total reflects the FULL selection across the entire playlist,
  // not just whatever's currently filtered.
  const selectedCount = localSelection.size
  const totalMinutes = useMemo(
    () =>
      videos
        .filter(v => localSelection.has(v.youtubeVideoId))
        .reduce((s, v) => s + v.durationMinutes, 0),
    [videos, localSelection],
  )
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const durationLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`

  const handleConfirm = () => onConfirm(Array.from(localSelection))

  return (
    <div className="modal-overlay playlist-picker-overlay" onClick={onCancel}>
      <div
        className="modal-card playlist-picker-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="playlist-picker-header">
          <div className="modal-eyebrow">Playlist</div>
          <div className="modal-title">{playlistTitle}</div>

          <input
            type="text"
            className="field playlist-picker-search"
            placeholder="Search videos…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          <div className="playlist-picker-toolbar">
            <button
              className="btn btn-secondary btn-sm"
              onClick={onBulkAction}
              disabled={filteredVideos.length === 0}
            >
              {bulkActionLabel}
            </button>
            <span className="playlist-picker-count">
              {videos.length} in playlist
            </span>
          </div>
        </div>

        <div className="playlist-picker-list-wrap">
          <div className="playlist-picker-list">
            {filteredVideos.length === 0 ? (
              <div className="playlist-picker-empty">
                <div>No videos match "{query}"</div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setQuery('')}
                >
                  Clear search
                </button>
              </div>
            ) : (
              paginatedVideos.map(v => {
                const isSelected = localSelection.has(v.youtubeVideoId)
                const hasThumbError = thumbErrors.has(v.youtubeVideoId)
                return (
                  <div
                    key={v.youtubeVideoId}
                    className={`playlist-picker-row${
                      !isSelected ? ' deselected' : ''
                    }`}
                    onClick={() => toggleVideo(v.youtubeVideoId)}
                  >
                    <div
                      className={`checkbox-box${isSelected ? ' checked' : ''}`}
                    />
                    {hasThumbError ? (
                      <ThumbFallback />
                    ) : (
                      <img
                        className="playlist-picker-thumb"
                        src={ytThumb(v.youtubeVideoId)}
                        alt=""
                        loading="lazy"
                        onError={() => onThumbError(v.youtubeVideoId)}
                      />
                    )}
                    <div className="playlist-picker-content">
                      <div className="playlist-picker-title">{v.title}</div>
                      <div className="playlist-picker-author">{v.author}</div>
                    </div>
                    <span className="playlist-picker-duration">
                      {v.durationMinutes} min
                    </span>
                  </div>
                )
              })
            )}
          </div>
          {totalPages > 1 && (
            <div className="playlist-picker-pagination">
              <button
                className="btn btn-ghost btn-sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                Back
              </button>
              <span className="playlist-picker-page-indicator">
                {page + 1} of {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="playlist-picker-footer">
          <span className="playlist-picker-summary">
            {selectedCount} selected · {durationLabel}
          </span>
          <div className="playlist-picker-actions">
            <button className="btn btn-secondary btn-sm" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleConfirm}
              disabled={selectedCount === 0}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
