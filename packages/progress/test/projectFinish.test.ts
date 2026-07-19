import { describe, expect, it } from 'vitest'
import { projectFinish } from '../src/projectFinish'

const baseArgs = {
  sessionCount: 6,
  consumedActualMin: 120,
  remainingActualMin: 120,
  startDate: '2026-01-01',
  today: '2026-01-05',
  horizonEnd: '2026-01-31',
  totalPlanned: 240,
  gpCurve: [
    { date: '2026-01-05', mean: 120, lower: 110, upper: 130 },
    { date: '2026-01-06', mean: 180, lower: 150, upper: 240 },
    { date: '2026-01-07', mean: 240, lower: 210, upper: 260 },
    { date: '2026-01-08', mean: 260, lower: 240, upper: 280 },
  ],
}

describe('projectFinish', () => {
  it('returns no ETA before there is evidence', () => {
    expect(projectFinish({
      ...baseArgs,
      sessionCount: 0,
      consumedActualMin: 0,
      gpCurve: [],
    })).toEqual({
      finishDate: null,
      confidenceInterval: null,
      basis: 'analytic',
      provisional: true,
    })
  })

  it('uses analytic projection for cold start plans', () => {
    expect(projectFinish({
      ...baseArgs,
      sessionCount: 4,
      consumedActualMin: 60,
      remainingActualMin: 180,
      startDate: '2026-01-01',
      today: '2026-01-03',
    })).toMatchObject({
      finishDate: '2026-01-09',
      confidenceInterval: null,
      basis: 'analytic',
      provisional: true,
    })
  })

  it('uses actual minutes directly without multiplying by pace again', () => {
    expect(projectFinish({
      ...baseArgs,
      sessionCount: 4,
      consumedActualMin: 50,
      remainingActualMin: 100,
      startDate: '2026-01-01',
      today: '2026-01-06',
    }).finishDate).toBe('2026-01-16')
  })

  it('rescues GP non-crossing or deadline-crossing forecasts with analytic projection', () => {
    expect(projectFinish({
      ...baseArgs,
      sessionCount: 5,
      consumedActualMin: 100,
      remainingActualMin: 100,
      startDate: '2026-01-01',
      today: '2026-01-06',
      horizonEnd: '2026-01-10',
      gpCurve: [
        { date: '2026-01-09', mean: 180, lower: 120, upper: 220 },
        { date: '2026-01-10', mean: 240, lower: 200, upper: 260 },
      ],
    })).toMatchObject({
      finishDate: '2026-01-11',
      confidenceInterval: null,
      basis: 'analytic',
    })
  })

  it('uses GP point and CI when the GP crosses before the horizon', () => {
    expect(projectFinish(baseArgs)).toEqual({
      finishDate: '2026-01-07',
      confidenceInterval: ['2026-01-06', '2026-01-08'],
      basis: 'gp',
      provisional: true,
    })
  })
})
