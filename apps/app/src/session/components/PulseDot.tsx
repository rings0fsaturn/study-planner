import type { SessionState } from '../types';

interface PulseDotProps {
  state: SessionState;
}

const stateClasses: Record<string, string> = {
  active: 'session-pulse-dot',
  walk_away: 'session-pulse-dot attention',
  paused: 'session-pulse-dot paused',
  recovery: 'session-pulse-dot attention',
  idle: 'session-pulse-dot paused',
};

export function PulseDot({ state }: PulseDotProps) {
  return <span className={stateClasses[state] ?? 'session-pulse-dot'} />;
}
