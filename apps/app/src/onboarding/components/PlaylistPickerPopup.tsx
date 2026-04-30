import { useState, useMemo } from 'react'
import type { PlaylistVideo } from '../OnboardingProvider'

const PAGE_SIZE = 10

interface PlaylistPickerPopupProps {
  playlistTitle: string
  videos: PlaylistVideo[]
  onConfirm: (selectedVideoIds: string[]) => void
  onCancel: () => void
}

export function PlaylistPickerPopup({ playlistTitle, videos, onConfirm, onCancel }: PlaylistPickerPopupProps) {
  const [localSelection, setLocalSelection] = useState<Set<string>>(
    () => new Set(videos.filter(v => v.selected).map(v => v.youtubeVideoId))
  )
  const [page, setPage] = useState(0)

  const totalPages = Math.ceil(videos.length / PAGE_SIZE)
  const pageVideos = videos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleVideo = (videoId: string) => {
    setLocalSelection(prev => {
      const next = new Set(prev)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      return next
    })
  }

  const toggleAll = () => {
    if (localSelection.size === videos.length) {
      setLocalSelection(new Set())
    } else {
      setLocalSelection(new Set(videos.map(v => v.youtubeVideoId)))
    }
  }

  const selectedCount = localSelection.size
  const totalMinutes = useMemo(
    () => videos.filter(v => localSelection.has(v.youtubeVideoId)).reduce((s, v) => s + v.durationMinutes, 0),
    [videos, localSelection],
  )
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  const handleConfirm = () => {
    onConfirm(Array.from(localSelection))
  }

  return (
    <div className="modal-overlay center" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-eyebrow">Playlist</div>
        <div className="modal-title">{playlistTitle}</div>
        <div className="modal-body">Select videos to include in your study plan.</div>

        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
            {localSelection.size === videos.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div>
          {pageVideos.map(v => {
            const isSelected = localSelection.has(v.youtubeVideoId)
            return (
              <div
                key={v.youtubeVideoId}
                className={`playlist-picker-row${!isSelected ? ' deselected' : ''}`}
                onClick={() => toggleVideo(v.youtubeVideoId)}
                style={{ cursor: 'pointer' }}
              >
                <div className={`checkbox-box${isSelected ? ' checked' : ''}`} />
                <span className="playlist-picker-title">{v.title}</span>
                <span className="playlist-picker-author">{v.author}</span>
                <span className="playlist-picker-duration">{v.durationMinutes}m</span>
              </div>
            )
          })}
        </div>

        {totalPages > 1 && (
          <div className="playlist-picker-nav" style={{ justifyContent: 'center' }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Back</button>
            <span className="playlist-picker-page-info">{page + 1} of {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}

        <div className="playlist-picker-footer">
          <span className="playlist-picker-summary">
            {selectedCount} selected · {hours}h {mins}m
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={selectedCount === 0}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
