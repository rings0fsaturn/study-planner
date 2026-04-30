import type { SessionState } from '../types';

interface SessionEyebrowProps {
  state: SessionState;
  weekIndex: number;
  overrunMinutes?: number;
  isBreak?: boolean;
}

export function SessionEyebrow({ state, weekIndex, overrunMinutes, isBreak }: SessionEyebrowProps) {
  let text: string;
  let colorClass = 'eyebrow-moss';

  if (state === 'paused') {
    text = `Paused · Week ${weekIndex + 1}`;
    colorClass = 'eyebrow-faint';
  } else if (isBreak) {
    text = `On break · Week ${weekIndex + 1}`;
    colorClass = 'eyebrow-clay';
  } else if (overrunMinutes && overrunMinutes > 0) {
    text = `${overrunMinutes} min over plan`;
    colorClass = 'eyebrow-terracotta';
  } else {
    text = `In session · Week ${weekIndex + 1}`;
  }

  return (
    <div className="session-eyebrow-row">
      <span className={`mono-caps ${colorClass}`}>{text}</span>
    </div>
  );
}
