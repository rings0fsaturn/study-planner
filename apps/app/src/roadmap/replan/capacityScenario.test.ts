import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@study-tracker/progress'
import {
  computeCapacityScenario,
  demonstratedThroughputFactor,
  parsePaceDeltaMinutes,
} from './capacityScenario'

function activeSession(activeMinutes: number, plannedMinutes: number): SessionEvent {
  return {
    date: '2026-07-01',
    source: 'active',
    plannedMinutes,
    activeMinutes,
    duration: activeMinutes,
  }
}

describe('capacityScenario', () => {
  it('filters to study days and applies the selected pace delta to every study day', () => {
    const base = computeCapacityScenario({
      remainingEstimatedMinutes: 180,
      sessions: [],
      today: '2026-07-06',
      hoursPerStudyDay: 1,
      selectedStudyDays: ['Mon', 'Wed'],
      paceDeltaMinutes: 0,
      actualCumulativeMinutes: 120,
      finalPlannedCumulativeMinutes: 600,
    })
    const faster = computeCapacityScenario({
      remainingEstimatedMinutes: 180,
      sessions: [],
      today: '2026-07-06',
      hoursPerStudyDay: 1,
      selectedStudyDays: ['Mon', 'Wed'],
      paceDeltaMinutes: 30,
      actualCumulativeMinutes: 120,
      finalPlannedCumulativeMinutes: 600,
    })

    expect(base.finishDate).toBe('2026-07-13')
    expect(faster.finishDate).toBe('2026-07-08')
    expect(base.points[0]).toEqual({ date: '2026-07-06', minutes: 120 })
    expect(base.points[base.points.length - 1]).toEqual({ date: '2026-07-13', minutes: 600 })
  })

  it('uses demonstrated calibration throughput and ignores manual sessions', () => {
    const manual: SessionEvent = {
      ...activeSession(120, 60),
      source: 'manual',
    }
    const sessions = [activeSession(30, 60), manual]

    expect(demonstratedThroughputFactor(sessions)).toBe(0.5)
    expect(computeCapacityScenario({
      remainingEstimatedMinutes: 180,
      sessions,
      today: '2026-07-06',
      hoursPerStudyDay: 1,
      selectedStudyDays: ['Mon', 'Wed'],
      paceDeltaMinutes: 0,
      actualCumulativeMinutes: 120,
      finalPlannedCumulativeMinutes: 600,
    }).finishDate).toBe('2026-07-08')
  })

  it('handles zero remaining work and invalid capacity', () => {
    expect(computeCapacityScenario({
      remainingEstimatedMinutes: 0,
      sessions: [],
      today: '2026-07-06',
      hoursPerStudyDay: 0,
      selectedStudyDays: [],
      paceDeltaMinutes: 0,
      actualCumulativeMinutes: 600,
      finalPlannedCumulativeMinutes: 600,
    })).toEqual({
      finishDate: '2026-07-06',
      points: [{ date: '2026-07-06', minutes: 600 }],
    })

    expect(computeCapacityScenario({
      remainingEstimatedMinutes: 120,
      sessions: [],
      today: '2026-07-06',
      hoursPerStudyDay: 0,
      selectedStudyDays: ['Mon'],
      paceDeltaMinutes: 0,
      actualCumulativeMinutes: 120,
      finalPlannedCumulativeMinutes: 600,
    })).toEqual({ finishDate: null, points: [] })
  })

  it('accepts only the five supported pace increments', () => {
    expect(parsePaceDeltaMinutes('0')).toBe(0)
    expect(parsePaceDeltaMinutes('15')).toBe(15)
    expect(parsePaceDeltaMinutes('60')).toBe(60)
    expect(parsePaceDeltaMinutes('10')).toBe(0)
    expect(parsePaceDeltaMinutes('60.0')).toBe(0)
    expect(parsePaceDeltaMinutes(null)).toBe(0)
  })
})
