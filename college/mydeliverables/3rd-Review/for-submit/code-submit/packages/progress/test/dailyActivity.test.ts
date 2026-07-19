import { describe, expect, it } from 'vitest'
import { buildDailyActivity } from '../src/dailyActivity'

describe('buildDailyActivity', () => {
  it('groups logged minutes by date', () => {
    expect(buildDailyActivity([
      {
        date: '2026-06-10',
        source: 'active',
        duration: 50,
        activeMinutes: 45,
        sessionId: 's-1',
      },
      {
        date: '2026-06-10',
        source: 'manual',
        duration: 30,
        sessionId: 's-2',
      },
      {
        date: '2026-06-11',
        source: 'manual',
        duration: 20,
        sessionId: 's-3',
      },
    ])).toEqual([
      { date: '2026-06-10', minutes: 75, sessionIds: ['s-1', 's-2'] },
      { date: '2026-06-11', minutes: 20, sessionIds: ['s-3'] },
    ])
  })
})
