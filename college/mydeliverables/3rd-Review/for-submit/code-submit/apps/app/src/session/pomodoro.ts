import type { PomodoroConfig } from './types';

export interface PomodoroPhase {
  /** Current phase: work, break, overtime (past planned), or none (slot too short) */
  phase: 'work' | 'break' | 'overtime' | 'none';
  /** Current interval number (1-indexed). 0 when phase is 'none' or 'overtime'. */
  current: number;
  /** Total number of intervals (work blocks only). 0 when phase is 'none'. */
  total: number;
  /** Milliseconds remaining in the current interval. 0 for 'overtime' and 'none'. */
  remainingMs: number;
}

/**
 * Build the interval schedule for a given planned duration and Pomodoro config.
 * Returns an array of { type, durationMs } entries in order.
 *
 * Algorithm:
 *   1. Full cycles = floor(planned / (work + break))
 *   2. Remaining = planned - (fullCycles * (work + break))
 *   3. Each full cycle = work block + break
 *   4. If remaining > 0, append a final work block of that duration
 */
export function buildIntervals(
  plannedMinutes: number,
  config: PomodoroConfig
): Array<{ type: 'work' | 'break'; durationMs: number }> {
  const workMs = config.workMinutes * 60_000;
  const breakMs = config.breakMinutes * 60_000;
  const cycleMs = workMs + breakMs;
  const plannedMs = plannedMinutes * 60_000;

  if (plannedMs < workMs) return [];

  const fullCycles = Math.floor(plannedMs / cycleMs);
  const remainingMs = plannedMs - fullCycles * cycleMs;

  const intervals: Array<{ type: 'work' | 'break'; durationMs: number }> = [];

  for (let i = 0; i < fullCycles; i++) {
    intervals.push({ type: 'work', durationMs: workMs });
    intervals.push({ type: 'break', durationMs: breakMs });
  }

  if (remainingMs > 0) {
    intervals.push({ type: 'work', durationMs: remainingMs });
  }

  return intervals;
}

/**
 * Compute the current Pomodoro phase given wall-clock elapsed time.
 *
 * Wall-clock based: elapsed is measured from session start, ignoring pauses.
 * This means the Pomodoro phase advances even while the user is paused.
 */
export function getPomodoroPhase(
  elapsedMs: number,
  plannedMinutes: number,
  config: PomodoroConfig
): PomodoroPhase {
  const intervals = buildIntervals(plannedMinutes, config);

  if (intervals.length === 0) {
    return { phase: 'none', current: 0, total: 0, remainingMs: 0 };
  }

  const totalWorkBlocks = intervals.filter(i => i.type === 'work').length;

  if (elapsedMs >= plannedMinutes * 60_000) {
    return { phase: 'overtime', current: 0, total: totalWorkBlocks, remainingMs: 0 };
  }

  let accumulated = 0;
  let workBlockIndex = 0;

  for (const interval of intervals) {
    if (interval.type === 'work') workBlockIndex++;
    const end = accumulated + interval.durationMs;

    if (elapsedMs < end) {
      const remainingMs = end - elapsedMs;
      return {
        phase: interval.type,
        current: workBlockIndex,
        total: totalWorkBlocks,
        remainingMs,
      };
    }

    accumulated = end;
  }

  return { phase: 'overtime', current: 0, total: totalWorkBlocks, remainingMs: 0 };
}
