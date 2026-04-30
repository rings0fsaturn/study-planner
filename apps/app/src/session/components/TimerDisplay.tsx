interface TimerDisplayProps {
  elapsedMs: number;
  overrun?: boolean;
  large?: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

export function TimerDisplay({ elapsedMs, overrun, large }: TimerDisplayProps) {
  const className = [
    'session-timer-time',
    overrun && 'overrun',
    large && 'session-timer-large',
  ].filter(Boolean).join(' ');

  return (
    <div className="session-timer-display">
      <div className={className}>{formatTime(elapsedMs)}</div>
    </div>
  );
}
