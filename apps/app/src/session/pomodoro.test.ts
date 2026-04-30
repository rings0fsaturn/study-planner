import { describe, it, expect } from 'vitest';
import { getPomodoroPhase, buildIntervals } from './pomodoro';
import type { PomodoroConfig } from './types';

const config: PomodoroConfig = { workMinutes: 50, breakMinutes: 10 };
const min = (m: number) => m * 60_000;

describe('buildIntervals', () => {
  it('returns empty for slots shorter than one work block', () => {
    expect(buildIntervals(30, config)).toEqual([]);
    expect(buildIntervals(45, config)).toEqual([]);
    expect(buildIntervals(49, config)).toEqual([]);
  });

  it('60 min = 50 work + 10 break', () => {
    const intervals = buildIntervals(60, config);
    expect(intervals).toEqual([
      { type: 'work', durationMs: min(50) },
      { type: 'break', durationMs: min(10) },
    ]);
  });

  it('90 min = 50 work + 10 break + 30 work', () => {
    const intervals = buildIntervals(90, config);
    expect(intervals).toEqual([
      { type: 'work', durationMs: min(50) },
      { type: 'break', durationMs: min(10) },
      { type: 'work', durationMs: min(30) },
    ]);
  });

  it('120 min = 2 × (50 work + 10 break)', () => {
    const intervals = buildIntervals(120, config);
    expect(intervals).toEqual([
      { type: 'work', durationMs: min(50) },
      { type: 'break', durationMs: min(10) },
      { type: 'work', durationMs: min(50) },
      { type: 'break', durationMs: min(10) },
    ]);
  });

  it('180 min = 3 × (50 work + 10 break)', () => {
    const intervals = buildIntervals(180, config);
    expect(intervals).toHaveLength(6);
    expect(intervals.filter(i => i.type === 'work')).toHaveLength(3);
    expect(intervals.filter(i => i.type === 'break')).toHaveLength(3);
  });

  it('150 min = 2 × (50 work + 10 break) + 30 work', () => {
    const intervals = buildIntervals(150, config);
    expect(intervals).toEqual([
      { type: 'work', durationMs: min(50) },
      { type: 'break', durationMs: min(10) },
      { type: 'work', durationMs: min(50) },
      { type: 'break', durationMs: min(10) },
      { type: 'work', durationMs: min(30) },
    ]);
  });

  it('50 min = exactly one work block, no break', () => {
    const intervals = buildIntervals(50, config);
    expect(intervals).toEqual([
      { type: 'work', durationMs: min(50) },
    ]);
  });
});

describe('getPomodoroPhase', () => {
  describe('no Pomodoro for short slots', () => {
    it('returns none for 30 min slot', () => {
      const result = getPomodoroPhase(0, 30, config);
      expect(result.phase).toBe('none');
      expect(result.total).toBe(0);
    });

    it('returns none for 45 min slot', () => {
      const result = getPomodoroPhase(min(20), 45, config);
      expect(result.phase).toBe('none');
    });
  });

  describe('60 min slot (50 work + 10 break)', () => {
    it('at 0 min: work block 1, 50 min remaining', () => {
      const result = getPomodoroPhase(0, 60, config);
      expect(result.phase).toBe('work');
      expect(result.current).toBe(1);
      expect(result.total).toBe(1);
      expect(result.remainingMs).toBe(min(50));
    });

    it('at 38 min: work block 1, 12 min remaining', () => {
      const result = getPomodoroPhase(min(38), 60, config);
      expect(result.phase).toBe('work');
      expect(result.current).toBe(1);
      expect(result.remainingMs).toBe(min(12));
    });

    it('at 50 min: break, 10 min remaining', () => {
      const result = getPomodoroPhase(min(50), 60, config);
      expect(result.phase).toBe('break');
      expect(result.current).toBe(1);
      expect(result.remainingMs).toBe(min(10));
    });

    it('at 55 min: break, 5 min remaining', () => {
      const result = getPomodoroPhase(min(55), 60, config);
      expect(result.phase).toBe('break');
      expect(result.remainingMs).toBe(min(5));
    });

    it('at 60 min: overtime', () => {
      const result = getPomodoroPhase(min(60), 60, config);
      expect(result.phase).toBe('overtime');
      expect(result.total).toBe(1);
    });

    it('at 75 min: still overtime', () => {
      const result = getPomodoroPhase(min(75), 60, config);
      expect(result.phase).toBe('overtime');
    });
  });

  describe('90 min slot (50 work + 10 break + 30 work)', () => {
    it('at 0: work 1 of 2', () => {
      const result = getPomodoroPhase(0, 90, config);
      expect(result.phase).toBe('work');
      expect(result.current).toBe(1);
      expect(result.total).toBe(2);
    });

    it('at 50 min: break', () => {
      const result = getPomodoroPhase(min(50), 90, config);
      expect(result.phase).toBe('break');
    });

    it('at 60 min: work 2 of 2', () => {
      const result = getPomodoroPhase(min(60), 90, config);
      expect(result.phase).toBe('work');
      expect(result.current).toBe(2);
      expect(result.total).toBe(2);
      expect(result.remainingMs).toBe(min(30));
    });

    it('at 80 min: work 2, 10 min remaining', () => {
      const result = getPomodoroPhase(min(80), 90, config);
      expect(result.phase).toBe('work');
      expect(result.current).toBe(2);
      expect(result.remainingMs).toBe(min(10));
    });

    it('at 90 min: overtime', () => {
      const result = getPomodoroPhase(min(90), 90, config);
      expect(result.phase).toBe('overtime');
    });
  });

  describe('180 min slot (3 × 50/10)', () => {
    it('at 0: work 1 of 3', () => {
      const result = getPomodoroPhase(0, 180, config);
      expect(result.phase).toBe('work');
      expect(result.current).toBe(1);
      expect(result.total).toBe(3);
    });

    it('at 110 min: break (second break)', () => {
      const result = getPomodoroPhase(min(110), 180, config);
      expect(result.phase).toBe('break');
      expect(result.current).toBe(2);
    });

    it('at 120 min: work 3 of 3', () => {
      const result = getPomodoroPhase(min(120), 180, config);
      expect(result.phase).toBe('work');
      expect(result.current).toBe(3);
      expect(result.total).toBe(3);
    });
  });

  describe('custom config', () => {
    const custom: PomodoroConfig = { workMinutes: 25, breakMinutes: 5 };

    it('30 min with 25/5 = work + break', () => {
      const result = getPomodoroPhase(0, 30, custom);
      expect(result.phase).toBe('work');
      expect(result.total).toBe(1);
    });

    it('at 25 min: break', () => {
      const result = getPomodoroPhase(min(25), 30, custom);
      expect(result.phase).toBe('break');
    });
  });

  describe('50 min slot = one work block, no break', () => {
    it('at 0: work 1 of 1', () => {
      const result = getPomodoroPhase(0, 50, config);
      expect(result.phase).toBe('work');
      expect(result.current).toBe(1);
      expect(result.total).toBe(1);
      expect(result.remainingMs).toBe(min(50));
    });

    it('at 50 min: overtime', () => {
      const result = getPomodoroPhase(min(50), 50, config);
      expect(result.phase).toBe('overtime');
    });
  });
});
