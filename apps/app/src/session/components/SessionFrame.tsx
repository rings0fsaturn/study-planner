import type { ReactNode } from 'react';

interface SessionFrameProps {
  overrun?: boolean;
  isBreak?: boolean;
  children: ReactNode;
}

export function SessionFrame({ overrun, isBreak, children }: SessionFrameProps) {
  const className = [
    'session-frame',
    overrun && 'overrun',
    isBreak && 'session-frame-break',
  ].filter(Boolean).join(' ');

  return <div className={className}>{children}</div>;
}
