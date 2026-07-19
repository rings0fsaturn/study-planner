import type { PomodoroPhase } from '../pomodoro';

interface PomodoroIndicatorProps {
  phase: PomodoroPhase;
}

function formatRemaining(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return `${minutes} min left`;
}

export function PomodoroIndicator({ phase }: PomodoroIndicatorProps) {
  if (phase.phase === 'none') return null;

  let text: string;
  let colorClass: string;

  switch (phase.phase) {
    case 'work':
      text = phase.total > 1
        ? `Work ${phase.current} of ${phase.total} · ${formatRemaining(phase.remainingMs)}`
        : `Work · ${formatRemaining(phase.remainingMs)}`;
      colorClass = 'pomo-work';
      break;
    case 'break':
      text = `Break · ${formatRemaining(phase.remainingMs)}`;
      colorClass = 'pomo-break';
      break;
    case 'overtime':
      text = 'Great focus — beyond your plan';
      colorClass = 'pomo-overtime';
      break;
  }

  return (
    <div className={`session-pomo-indicator ${colorClass}`}>
      {text}
    </div>
  );
}
