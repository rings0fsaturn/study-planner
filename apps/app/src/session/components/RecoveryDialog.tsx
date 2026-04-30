import type { RecoveryResolution } from '../types';

interface RecoveryDialogProps {
  materialTitle: string;
  elapsedMinutes: number;
  awayMinutes: number;
  onResolve: (resolution: RecoveryResolution) => void;
}

export function RecoveryDialog({
  materialTitle,
  elapsedMinutes,
  awayMinutes,
  onResolve,
}: RecoveryDialogProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-eyebrow">Welcome back</div>
        <div className="modal-title">You left a session running</div>
        <div className="modal-body">
          "{materialTitle}" has been running
          for <strong>{elapsedMinutes} min</strong>.
          You were away for about {awayMinutes} minutes.
        </div>

        <div className="session-recovery-actions">
          <button
            className="btn btn-accent btn-block btn-lg"
            onClick={() => onResolve('keep_going')}
          >
            Keep going
          </button>
          <button
            className="btn btn-secondary btn-block"
            onClick={() => onResolve('end_now')}
          >
            End &amp; log {elapsedMinutes} min
          </button>
        </div>
      </div>
    </div>
  );
}
