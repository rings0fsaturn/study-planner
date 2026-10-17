import { describe, expect, it } from 'vitest'
import { computeProgress, type CalibrationState } from '@study-tracker/progress'
import { adherenceTable, assertTraceable, collectTraceIds, masteryTable, verdictTable } from './synthExtract'
import { buildSynthHistory } from './synthSeed'
import { findRoadmap, mapSessions } from '../progress/mapEvents'

const now = new Date('2026-09-14T12:00:00Z')

describe('assertTraceable', () => {
  it('passes when every row id is present in the events', () => {
    const events = buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', now)
    const booked = events.find((e) => e.kind === 'SessionBooked')
    const bookingId = booked?.payload['bookingId'] as string
    expect(typeof bookingId).toBe('string')
    expect(() => assertTraceable([{ traceIds: [bookingId] }], events)).not.toThrow()
  })
  it('throws on a fabricated id that no event carries', () => {
    const events = buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', now)
    expect(() => assertTraceable([{ traceIds: ['fabricated-attempt-id'] }], events)).toThrow(
      /not traceable/,
    )
  })
  it('throws fail-closed on a row that references nothing', () => {
    const events = buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', now)
    expect(() => assertTraceable([{ traceIds: [] }], events)).toThrow(/not traceable/)
  })
  it('accepts an explicit server-id set for grades that live outside local events', () => {
    const serverAttemptIds = new Set(['server-attempt-1', 'server-attempt-2'])
    expect(() =>
      assertTraceable([{ traceIds: ['server-attempt-1'] }], serverAttemptIds),
    ).not.toThrow()
    expect(() =>
      assertTraceable([{ traceIds: ['server-attempt-9'] }], serverAttemptIds),
    ).toThrow(/not traceable/)
  })
})

describe('collectTraceIds', () => {
  it('gathers string payload values from events', () => {
    const events = buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', now)
    const ids = collectTraceIds(events)
    expect(ids.has('m1')).toBe(true)
    expect(ids.has('fabricated-attempt-id')).toBe(false)
  })
})

describe('adherenceTable', () => {
  it('steady: one row per week with planned 390 and actual near pace', () => {
    const events = buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', now)
    const rows = adherenceTable('steady', events)
    expect(rows.map((r) => r.week)).toEqual([0, 1, 2, 3, 4])
    for (const row of rows) {
      expect(row.user).toBe('steady')
      // Mon/Wed/Fri 90 min + Sat 120 min from plannedMinutesForDate.
      expect(row.planned).toBe(390)
      expect(row.actual).toBeGreaterThan(0)
      expect(row.rate).toBeCloseTo(row.actual / row.planned, 10)
    }
  })
  it('returning: gap weeks keep planned minutes but log zero actual', () => {
    const events = buildSynthHistory('returning', ['m1', 'm2', 'm3'], '2026-08-10', now)
    const rows = adherenceTable('returning', events)
    expect(rows).toHaveLength(5)
    for (const week of [1, 2]) {
      const row = rows.find((r) => r.week === week)
      expect(row?.planned).toBeGreaterThan(0)
      expect(row?.actual).toBe(0)
      expect(row?.rate).toBe(0)
    }
  })
  it('every row traces back to booking and session ids in the same events', () => {
    const events = buildSynthHistory('crammer', ['m1', 'm2', 'm3'], '2026-08-10', now)
    const rows = adherenceTable('crammer', events)
    expect(rows.length).toBeGreaterThan(0)
    expect(() => assertTraceable(rows, events)).not.toThrow()
  })
  it('returns no rows without a roadmap', () => {
    expect(adherenceTable('steady', [])).toEqual([])
  })
  it('throws on a session date that parses to no week', () => {
    const events = buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', now)
    const donor = events.find((e) => e.kind === 'SessionLogged')
    if (!donor) throw new Error('expected a logged session to corrupt')
    const bad = {
      kind: 'SessionLogged',
      payload: {
        ...donor.payload,
        sessionId: 'bad-date-session',
        date: 'not-a-date',
        bookingId: undefined,
      },
      createdAt: donor.createdAt,
    }
    expect(() => adherenceTable('steady', [...events, bad])).toThrow(/invalid session date/)
  })
})

describe('engine parity', () => {
  const calibration: CalibrationState = {
    globalMultiplier: 1,
    globalPosterior: { mean: 1, variance: 0.1, sessionCount: 1 },
    roleMultipliers: {},
    trend: { phases: [], currentPhase: null, projectionSlope: 0, projectionUncertainty: 1 },
    promptNeeded: false,
    insightsByContext: [],
  }
  it('table sums reconcile with computeProgress over the same mapped inputs', () => {
    const events = buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', now)
    const rows = adherenceTable('steady', events)
    const roadmap = findRoadmap(events)
    expect(roadmap).not.toBeNull()
    if (!roadmap) throw new Error('expected roadmap for parity check')
    const snapshot = computeProgress(mapSessions(events), roadmap, calibration, '2026-09-14')
    const actual = rows.reduce((sum, row) => sum + row.actual, 0)
    const planned = rows.reduce((sum, row) => sum + row.planned, 0)
    expect(snapshot.totalMinutes).toBe(actual)
    // findRoadmap carries no material-ledger totals, so the package denominator
    // here is the booked slots themselves: full reconciliation, no second math.
    expect(planned).toBe(1950)
    expect(snapshot.totalPlannedMinutes).toBe(planned)
    expect(snapshot.completionPercentage).toBeCloseTo((actual / planned) * 100, 10)
  })
  it('table actuals follow the same activeMinutes-first read as the package readers', () => {
    const events = buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', now)
    const donor = events.find((e) => e.kind === 'SessionLogged')
    if (!donor) throw new Error('expected a logged session to diverge from')
    const extra = {
      kind: 'SessionLogged',
      payload: { ...donor.payload, sessionId: 'divergent-session', activeMinutes: 60, duration: 90 },
      createdAt: donor.createdAt,
    }
    const withExtra = [...events, extra]
    const rows = adherenceTable('steady', withExtra)
    const expected = mapSessions(withExtra).reduce(
      (sum, sess) => sum + (sess.activeMinutes ?? sess.duration),
      0,
    )
    expect(rows.reduce((sum, row) => sum + row.actual, 0)).toBe(expected)
    // computeProgress totals duration (wall clock) while the table and three of
    // four package readers total activeMinutes (study time net of pauses):
    // pinned divergence of exactly duration - activeMinutes, not a mask.
    const roadmap = findRoadmap(withExtra)
    if (!roadmap) throw new Error('expected roadmap for divergence check')
    const snapshot = computeProgress(mapSessions(withExtra), roadmap, calibration, '2026-09-14')
    expect(snapshot.totalMinutes - expected).toBe(30)
  })
})

describe('masteryTable', () => {
  const correct3 = [
    { attemptId: 'a1', correct: true },
    { attemptId: 'a2', correct: true },
    { attemptId: 'a3', correct: true },
  ]
  it('projects movement from server observations without reimplementing BKT', () => {
    const rows = masteryTable('steady', 'book', correct3)
    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row?.user).toBe('steady')
    expect(row?.materialId).toBe('book')
    expect(row?.n).toBe(3)
    expect(row?.after).toBeGreaterThan(row?.before ?? 0)
    expect(row?.delta).toBeCloseTo((row?.after ?? 0) - (row?.before ?? 0), 10)
  })
  it('mostly-incorrect weeks move mastery down', () => {
    const rows = masteryTable('struggling', 'talk', [
      { attemptId: 'b1', correct: false },
      { attemptId: 'b2', correct: false },
      { attemptId: 'b3', correct: false },
    ])
    expect(rows[0]?.after).toBeLessThan(rows[0]?.before ?? 1)
  })
  it('rows trace to the server attempt ids that produced them', () => {
    const rows = masteryTable('steady', 'book', correct3)
    expect(() =>
      assertTraceable(rows, new Set(['a1', 'a2', 'a3'])),
    ).not.toThrow()
    expect(() => assertTraceable(rows, new Set(['a1', 'a2']))).toThrow(/not traceable/)
  })
  it('emits no row without observations: no grades, no mastery claim', () => {
    expect(masteryTable('returning', 'book', [])).toEqual([])
  })
})

describe('verdictTable', () => {
  const histories = {
    steady: buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', now),
    struggling: buildSynthHistory('struggling', ['m1', 'm2', 'm3'], '2026-08-10', now),
  }
  it('hold verdicts never convert, with or without a replan', () => {
    const rows = verdictTable(
      [
        { user: 'steady', verdict: 'hold' },
        { user: 'struggling', verdict: 'hold' },
      ],
      histories,
    )
    expect(rows.map((r) => r.converted)).toEqual([false, false])
  })
  it('suggest_replan converts only where a RoadmapReplanned exists', () => {
    const rows = verdictTable(
      [
        { user: 'steady', verdict: 'suggest_replan' },
        { user: 'struggling', verdict: 'suggest_replan' },
      ],
      histories,
    )
    expect(rows.find((r) => r.user === 'steady')?.converted).toBe(false)
    expect(rows.find((r) => r.user === 'struggling')?.converted).toBe(true)
  })
  it('reprioritize never converts: the D-02 proof covers suggest_replan only', () => {
    const rows = verdictTable(
      [
        { user: 'steady', verdict: 'reprioritize' },
        { user: 'struggling', verdict: 'reprioritize' },
      ],
      histories,
    )
    expect(rows.map((r) => r.converted)).toEqual([false, false])
  })
  it('a converted row traces to both the plan and the replan evidence', () => {
    const rows = verdictTable([{ user: 'struggling', verdict: 'suggest_replan' }], histories)
    const replannedAt = histories.struggling.find((e) => e.kind === 'RoadmapReplanned')?.createdAt
    expect(replannedAt).toBeDefined()
    expect(rows[0]?.traceIds).toContain(replannedAt)
    expect(() => assertTraceable(rows, histories.struggling)).not.toThrow()
  })
  it('every verdict row traces to its roadmap identity in the same events', () => {
    const rows = verdictTable([{ user: 'struggling', verdict: 'hold' }], histories)
    expect(rows[0]?.traceIds.length).toBeGreaterThan(0)
    expect(() => assertTraceable(rows, histories.struggling)).not.toThrow()
  })
  it('throws fail-closed for a verdict with no roadmap to judge', () => {
    expect(() => verdictTable([{ user: 'ghost', verdict: 'hold' }], histories)).toThrow(
      /no roadmap/,
    )
  })
})
