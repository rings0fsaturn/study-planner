export function formatElapsedTime(ms: number): string {
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

interface TimerDisplayProps {
  elapsedMs: number;
  overrun?: boolean;
  large?: boolean;
  sizeClass?: string;
}

export function TimerDisplay({ elapsedMs, overrun, large, sizeClass }: TimerDisplayProps) {
  const className = [
    'session-timer-time',
    overrun && 'is-overrun',
    sizeClass || (large && 'session-timer-large'),
  ].filter(Boolean).join(' ');

  return <div className={className}>{formatElapsedTime(elapsedMs)}</div>;
}
