import { useState, useMemo } from 'react'
import type { PlaylistEntry } from '../OnboardingProvider'
import { PlaylistPickerPopup } from './PlaylistPickerPopup'
import { PlaylistLoadingPopup } from './PlaylistLoadingPopup'

interface PlaylistCardProps {
  playlist: PlaylistEntry
  onConfirm: (playlistId: string, selectedVideoIds: string[]) => void
  onRemove: (playlistId: string) => void
}

export function PlaylistCard({ playlist, onConfirm, onRemove }: PlaylistCardProps) {
  const [popupOpen, setPopupOpen] = useState(false)
  const [loadingPopupOpen, setLoadingPopupOpen] = useState(false)

  const selectedCount = useMemo(
    () => playlist.videos.filter(v => v.selected).length,
    [playlist.videos],
  )
  const totalMinutes = useMemo(
    () => playlist.videos.filter(v => v.selected).reduce((s, v) => s + v.durationMinutes, 0),
    [playlist.videos],
  )
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  const handleClick = () => {
    if (playlist.fetchStatus === 'loading') {
      setLoadingPopupOpen(true)
    } else if (playlist.fetchStatus === 'success') {
      setPopupOpen(true)
    }
  }

  const handleConfirm = (selectedVideoIds: string[]) => {
    setPopupOpen(false)
    onConfirm(playlist.id, selectedVideoIds)
  }

  return (
    <>
      <div className="material-row" onClick={handleClick} style={{ cursor: 'pointer' }}>
        <div className="material-icon pl">PL</div>
        <div className="material-body">
          <div className="material-title">
            {playlist.title || 'Loading playlist…'}
          </div>
          {playlist.fetchStatus === 'success' && (
            <div className="material-meta">
              {selectedCount} of {playlist.videos.length} videos · {hours}h {mins}m
            </div>
          )}
          {playlist.fetchStatus === 'loading' && (
            <div style={{ marginTop: '6px' }}>
              <div className="shimmer-line short" />
            </div>
          )}
          {playlist.fetchStatus === 'error' && (
            <div className="field-helper error" style={{ marginTop: '4px' }}>
              Failed to load playlist details.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {playlist.fetchStatus === 'success' && (
            <span className="material-badge-attention">Needs attention</span>
          )}
          <button
            className="material-row-action"
            onClick={e => { e.stopPropagation(); onRemove(playlist.id) }}
            title="Remove playlist"
          >
            <svg className="icon icon-sm" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {popupOpen && (
        <PlaylistPickerPopup
          playlistTitle={playlist.title}
          videos={playlist.videos}
          onConfirm={handleConfirm}
          onCancel={() => setPopupOpen(false)}
        />
      )}

      {loadingPopupOpen && (
        <PlaylistLoadingPopup onClose={() => setLoadingPopupOpen(false)} />
      )}
    </>
  )
}
