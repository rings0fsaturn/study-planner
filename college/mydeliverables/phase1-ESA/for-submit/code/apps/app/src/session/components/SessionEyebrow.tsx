import type { SessionState } from '../types';

interface SessionEyebrowProps {
  state: SessionState;
  weekIndex: number;
  overrunMinutes?: number;
  isBreak?: boolean;
}

export function getEyebrowColorClass(
  state: SessionState,
  overrunMinutes: number,
  isBreak: boolean,
): string {
  if (state === 'paused') return 'eyebrow-faint';
  if (isBreak) return 'eyebrow-clay';
  if (overrunMinutes > 0) return 'eyebrow-terracotta';
  return 'eyebrow-moss';
}

export function SessionEyebrow({ state, weekIndex, overrunMinutes, isBreak }: SessionEyebrowProps) {
  let text: string;

  if (state === 'paused') {
    text = `Paused · Week ${weekIndex + 1}`;
  } else if (isBreak) {
    text = `On break · Week ${weekIndex + 1}`;
  } else if (overrunMinutes && overrunMinutes > 0) {
    text = `${overrunMinutes} min over plan`;
  } else {
    text = `In session · Week ${weekIndex + 1}`;
  }

  return <span>{text}</span>;
}
