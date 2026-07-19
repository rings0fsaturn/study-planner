interface EscapeConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function EscapeConfirmModal({ onConfirm, onCancel }: EscapeConfirmModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="End session confirmation">
      <div className="modal-card">
        <h2 className="modal-title">End this session?</h2>
        <p className="modal-desc">Your progress will be logged.</p>
        <div className="session-recovery-actions">
          <button className="btn btn-accent" onClick={onConfirm}>
            End session
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
