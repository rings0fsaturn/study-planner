interface PlaylistLoadingPopupProps {
  onClose: () => void
}

export function PlaylistLoadingPopup({ onClose }: PlaylistLoadingPopupProps) {
  return (
    <div className="modal-overlay center" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="processing-dots" style={{ marginBottom: '16px' }}>
          <div className="processing-dot" />
          <div className="processing-dot" />
          <div className="processing-dot" />
        </div>
        <div className="modal-title">Hang tight</div>
        <div className="modal-body">
          We're fetching details from YouTube — grab a cup of tea!
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>OK</button>
      </div>
    </div>
  )
}
