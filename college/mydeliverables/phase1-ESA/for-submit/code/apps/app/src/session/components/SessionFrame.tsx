import type { ReactNode } from 'react';

interface SessionFrameProps {
  overrun?: boolean;
  isBreak?: boolean;
  isPaused?: boolean;
  children: ReactNode;
}

export function SessionFrame({ overrun, isBreak, isPaused, children }: SessionFrameProps) {
  const className = [
    'session-frame',
    overrun && 'is-overrun',
    isBreak && 'is-break',
    isPaused && 'is-paused',
  ].filter(Boolean).join(' ');

  return <div className={className}>{children}</div>;
}
