import { useState } from 'react';
import type { PromptDetail, PromptSession } from '@study-tracker/progress';
import { format } from 'date-fns';

interface RecalibrationModalProps {
  promptDetail: PromptDetail | null;
  onReplan: () => void;
  onAcknowledge: () => void;
  onTemporary: (sessionIds: string[]) => void;
  onClose: () => void;
}

type View = 'main' | 'checklist';

export function RecalibrationModal({
  promptDetail,
  onReplan,
  onAcknowledge,
  onTemporary,
  onClose,
}: RecalibrationModalProps) {
  const [view, setView] = useState<View>('main');
  const [checkedSessions, setCheckedSessions] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (promptDetail) {
      for (const s of promptDetail.sessions) {
        set.add(s.sessionId);
      }
    }
    return set;
  });

  const paceDirection = promptDetail && promptDetail.currentPace > promptDetail.previousPace
    ? 'faster'
    : 'slower';

  const toggleSession = (id: string) => {
    setCheckedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTemporaryConfirm = () => {
    onTemporary([...checkedSessions]);
  };

  return (
    <div className="modal-overlay center" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-eyebrow">Pace change detected</div>
        <div className="modal-title">Your pace has changed</div>
        <div className="modal-body">
          You've been consistently finishing sessions {paceDirection} than planned.
        </div>

        {view === 'main' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-accent btn-block" onClick={onReplan}>
              Adjust my roadmap
            </button>
            <button className="btn btn-secondary btn-block" onClick={onAcknowledge}>
              This is my pace now
            </button>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => setView('checklist')}
            >
              This was temporary
            </button>
          </div>
        )}

        {view === 'checklist' && promptDetail && (
          <div>
            <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 13 }}>
              Select sessions that were unusual — they'll be excluded from your pace calculation.
            </p>

            <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 16 }}>
              {promptDetail.sessions.map((session: PromptSession) => (
                <SessionChecklistRow
                  key={session.sessionId}
                  session={session}
                  checked={checkedSessions.has(session.sessionId)}
                  onToggle={() => toggleSession(session.sessionId)}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setView('main')}
              >
                Back
              </button>
              <button
                className="btn btn-accent"
                style={{ flex: 1 }}
                onClick={handleTemporaryConfirm}
                disabled={checkedSessions.size === 0}
              >
                Mark as unusual ({checkedSessions.size})
              </button>
            </div>
          </div>
        )}

        {view === 'checklist' && !promptDetail && (
          <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
            Loading session data...
          </p>
        )}
      </div>
    </div>
  );
}

function SessionChecklistRow({
  session,
  checked,
  onToggle,
}: {
  session: PromptSession;
  checked: boolean;
  onToggle: () => void;
}) {
  const dateLabel = format(new Date(session.date + 'T12:00:00'), 'EEE, MMM d');
  const timeLabel = session.timeOfDay.charAt(0).toUpperCase() + session.timeOfDay.slice(1);

  return (
    <div
      className={`checkbox-row${checked ? ' checked' : ''}`}
      style={{ marginBottom: 4, padding: '8px 10px' }}
      onClick={onToggle}
    >
      <span className={`checkbox-box${checked ? ' checked' : ''}`} />
      <div className="checkbox-body">
        <div className="checkbox-title" style={{ fontSize: 13 }}>
          {session.sessionTitle || 'Study session'}
        </div>
        <div className="checkbox-desc">
          {dateLabel} · {timeLabel} · {session.plannedMinutes} min planned → {session.activeMinutes} min actual
        </div>
      </div>
    </div>
  );
}
