import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '@study-tracker/progress';
import type { RoadmapLifecycleEntry } from '../roadmap/roadmapLifecycle';
import type { RoadmapCreatedPayload } from '../sync/types';
import {
  dailyCapacityForDate,
  demonstratedDailyMinutes,
  demonstratedThroughputFactor,
  recommendedSessionMinutes,
  softCapMinutes,
} from './sessionPlanning';

function entry(payload: Partial<RoadmapCreatedPayload> = {}): RoadmapLifecycleEntry {
  const full: RoadmapCreatedPayload = {
    startDate: '2026-06-01',
    deadline: '2026-07-01',
    weeks: 4,
    selectedStudyDays: ['Mon', 'Wed', 'Sat'],
    weekdayHours: 1,
    weekendHours: 2,
    weeklyHours: 4,
    materialIds: ['mat-1'],
    ...payload,
  };
  return {
    roadmapCreatedAt: '2026-06-01T00:00:00.000Z',
    eventKind: 'RoadmapCreated',
    status: 'active',
    payload: full,
    title: 'Plan',
    startDate: full.startDate,
    deadline: full.deadline,
    weeks: full.weeks,
    totalSlots: 0,
    completedSlots: 0,
    percentComplete: 0,
  };
}

describe('sessionPlanning capacity helpers (D5)', () => {
  it('uses weekday hours on a weekday and weekend hours on a weekend', () => {
    // 2026-06-03 is a Wednesday, 2026-06-06 is a Saturday.
    expect(dailyCapacityForDate(entry(), '2026-06-03')).toBe(60);
    expect(dailyCapacityForDate(entry(), '2026-06-06')).toBe(120);
  });

  it('soft cap subtracts minutes already logged today and floors at zero', () => {
    expect(softCapMinutes(120, 30)).toBe(90);
    expect(softCapMinutes(120, 200)).toBe(0);
    expect(softCapMinutes(0, 0)).toBe(0);
  });

  it('returns zero capacity when there is no active roadmap entry', () => {
    expect(dailyCapacityForDate(undefined, '2026-06-03')).toBe(0);
  });
});

function session(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    date: '2026-06-02',
    source: 'active',
    duration: 40,
    activeMinutes: 40,
    plannedMinutes: 40,
    ...overrides,
  };
}

describe('demonstrated pace helpers (D6/D8)', () => {
  it('throughput factor uses materialConsumedMinutes over plannedMinutes as denominator', () => {
    // 30/20 = 1.5 (consumed override) and 40/40 = 1.0 → mean 1.25.
    const sessions = [
      session({ activeMinutes: 30, plannedMinutes: 60, materialConsumedMinutes: 20 }),
      session({ activeMinutes: 40, plannedMinutes: 40 }),
    ];
    expect(demonstratedThroughputFactor(sessions)).toBeCloseTo(1.25, 5);
  });

  it('throughput factor is 1 with no calibration evidence', () => {
    expect(demonstratedThroughputFactor([])).toBe(1);
    expect(demonstratedThroughputFactor([session({ source: 'manual' })])).toBe(1);
  });

  it('demonstrated daily minutes averages active minutes across active days', () => {
    const sessions = [
      session({ date: '2026-06-02', activeMinutes: 30 }),
      session({ date: '2026-06-02', activeMinutes: 30 }),
      session({ date: '2026-06-04', activeMinutes: 60 }),
    ];
    // day 06-02 = 60, day 06-04 = 60 → mean 60.
    expect(demonstratedDailyMinutes(sessions)).toBe(60);
  });
});

describe('recommendedSessionMinutes — pace-first (D6)', () => {
  it('nudges from demonstrated pace toward the deadline-required rate, clamped to cap', () => {
    // required = 600 * 1 / 10 = 60/day; demonstrated 40 → nudge halfway = 50; within 90 cap.
    const rec = recommendedSessionMinutes({
      remainingMaterialMinutes: 600,
      throughputFactor: 1,
      demonstratedDaily: 40,
      daysToDeadline: 10,
      cap: 90,
    });
    expect(rec).toBe(50);
  });

  it('never recommends past the soft cap even when the deadline is infeasible', () => {
    // required = 1200 * 1 / 4 = 300/day → nudged well past cap; must clamp to cap.
    const rec = recommendedSessionMinutes({
      remainingMaterialMinutes: 1200,
      throughputFactor: 1,
      demonstratedDaily: 60,
      daysToDeadline: 4,
      cap: 90,
    });
    expect(rec).toBe(90);
  });

  it('applies the throughput factor to remaining material minutes', () => {
    // required = 300 * 1.5 / 15 = 30/day; no demonstrated pace → aim at required = 30.
    const rec = recommendedSessionMinutes({
      remainingMaterialMinutes: 300,
      throughputFactor: 1.5,
      demonstratedDaily: 0,
      daysToDeadline: 15,
      cap: 120,
    });
    expect(rec).toBe(30);
  });

  it('honors the booking target within the cap when no material remains', () => {
    const rec = recommendedSessionMinutes({
      bookingTarget: 45,
      remainingMaterialMinutes: 0,
      throughputFactor: 1,
      demonstratedDaily: 30,
      daysToDeadline: 10,
      cap: 60,
    });
    expect(rec).toBe(45);
  });
});
