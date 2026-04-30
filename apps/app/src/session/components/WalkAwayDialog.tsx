import { useState } from 'react';
import type { WalkAwayResolution } from '../types';

interface WalkAwayDialogProps {
  materialTitle: string;
  elapsedMinutes: number;
  startedAtLabel: string;
  plannedMinutes: number;
  onResolve: (resolution: WalkAwayResolution) => void;
}

export function WalkAwayDialog({
  materialTitle,
  elapsedMinutes,
  startedAtLabel,
  plannedMinutes,
  onResolve,
}: WalkAwayDialogProps) {
  const [selected, setSelected] = useState<WalkAwayResolution>('trim');

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const buttonLabel = selected === 'log_all'
    ? `Log ${formatDuration(elapsedMinutes)}`
    : selected === 'trim'
      ? `Log ${formatDuration(plannedMinutes)}`
      : 'Discard session';

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-eyebrow">Welcome back</div>
        <div className="modal-title">
          Were you still <em className="modal-title-em">studying</em>?
        </div>
        <div className="modal-body">
          A timer for <strong>{materialTitle}</strong> has been running
          for <strong>{formatDuration(elapsedMinutes)}</strong> since {startedAtLabel}.
          That's longer than your usual session — let's get the log right.
        </div>

        <div className="stack-3">
          <button
            className={`choice${selected === 'log_all' ? ' selected' : ''}`}
            onClick={() => setSelected('log_all')}
          >
            <div className="choice-title">Log it as {formatDuration(elapsedMinutes)}</div>
            <div className="choice-desc">If you actually studied that long today.</div>
          </button>
          <button
            className={`choice${selected === 'trim' ? ' selected' : ''}`}
            onClick={() => setSelected('trim')}
          >
            <div className="choice-title">Trim to planned duration</div>
            <div className="choice-desc">
              Most likely — log <strong>{formatDuration(plannedMinutes)}</strong> based
              on your planned session.
            </div>
          </button>
          <button
            className={`choice${selected === 'discard' ? ' selected' : ''}`}
            onClick={() => setSelected('discard')}
          >
            <div className="choice-title">Discard the session</div>
            <div className="choice-desc">If you forgot to end the timer and never came back.</div>
          </button>
        </div>

        <button
          className="btn btn-accent btn-block btn-lg session-walkaway-confirm"
          onClick={() => onResolve(selected)}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
