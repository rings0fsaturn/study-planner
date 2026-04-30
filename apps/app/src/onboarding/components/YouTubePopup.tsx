import type { OnboardingMaterial } from '../OnboardingProvider'

interface YouTubePopupProps {
  material: OnboardingMaterial
  onUpdate: (updates: Partial<OnboardingMaterial>) => void
  onClose: () => void
}

export function YouTubePopup({ material, onUpdate, onClose }: YouTubePopupProps) {
  const videoId = material.youtubeVideoId
  if (!videoId) return null

  return (
    <div className="modal-overlay center" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-eyebrow">YouTube Video</div>

        <div style={{
          position: 'relative',
          paddingBottom: '56.25%',
          height: 0,
          overflow: 'hidden',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-4)',
        }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={material.title || 'YouTube video'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="field-group">
          <label className="field-label">Title</label>
          <input
            className="field"
            type="text"
            value={material.title}
            onChange={e => onUpdate({ title: e.target.value })}
          />
        </div>

        <div className="field-group">
          <label className="field-label">Duration</label>
          <div className="field-with-suffix">
            <input
              className="field"
              type="number"
              min={1}
              value={material.estimatedDuration || ''}
              onChange={e => onUpdate({ estimatedDuration: Number(e.target.value) })}
            />
            <span className="field-with-suffix-text">min</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
