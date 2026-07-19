import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { deriveSlotStatuses } from '../src/deriveSlotStatuses'
import type { RoadmapInput, RoadmapSlot, SessionEvent } from '../src/types'

function makeSlot(overrides: Partial<RoadmapSlot> = {}): RoadmapSlot {
  return {
    date: '2026-02-10',
    dayOfWeek: 'Tuesday',
    weekIndex: 0,
    plannedMinutes: 60,
    candidateMaterialIds: ['mat-1'],
    role: 'anchor',
    sessionTitle: 'Linear algebra · session 1',
    ...overrides,
  }
}

function makeRoadmap(slots: RoadmapSlot[]): RoadmapInput {
  const dates = slots.map((slot) => slot.date).sort()
  return {
    startDate: dates[0] ?? '2026-02-01',
    deadline: dates[dates.length - 1] ?? '2026-02-28',
    weeks: 4,
    weeklyHours: 6,
    slots,
  }
}

function makeSession(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    date: '2026-02-10',
    source: 'manual',
    duration: 45,
    materialId: 'mat-1',
    sessionId: 'session-1',
    ...overrides,
  }
}

describe('deriveSlotStatuses', () => {
  it('marks a matched slot done with logged minutes and session id', () => {
    const roadmap = makeRoadmap([makeSlot()])
    const result = deriveSlotStatuses(
      roadmap,
      [makeSession({ duration: 55, sessionId: 'session-a' })],
      '2026-02-10',
    )

    expect(result.slots).toHaveLength(1)
    expect(result.slots[0]).toMatchObject({
      status: 'done',
      loggedMinutes: 55,
      sessionIds: ['session-a'],
    })
    expect(result.unplanned).toEqual([])
  })

  it('sends duplicate same-day same-material sessions beyond matching slots to unplanned', () => {
    const roadmap = makeRoadmap([makeSlot()])
    const result = deriveSlotStatuses(
      roadmap,
      [
        makeSession({ duration: 40, sessionId: 'session-a' }),
        makeSession({ duration: 35, sessionId: 'session-b' }),
      ],
      '2026-02-10',
    )

    expect(result.slots[0].sessionIds).toEqual(['session-a'])
    expect(result.slots[0].loggedMinutes).toBe(40)
    expect(result.unplanned).toEqual([
      {
        date: '2026-02-10',
        materialId: 'mat-1',
        minutes: 35,
        sessionId: 'session-b',
      },
    ])
  })

  it('marks a past unmatched slot skipped', () => {
    const result = deriveSlotStatuses(
      makeRoadmap([makeSlot({ date: '2026-02-09' })]),
      [],
      '2026-02-10',
    )

    expect(result.slots[0].status).toBe('skipped')
  })

  it('marks a today or future unmatched slot pending', () => {
    const result = deriveSlotStatuses(
      makeRoadmap([
        makeSlot({ date: '2026-02-10' }),
        makeSlot({ date: '2026-02-11' }),
      ]),
      [],
      '2026-02-10',
    )

    expect(result.slots.map((slot) => slot.status)).toEqual([
      'pending',
      'pending',
    ])
  })

  it('returns off-plan material sessions as unplanned', () => {
    const result = deriveSlotStatuses(
      makeRoadmap([makeSlot()]),
      [makeSession({ materialId: 'mat-2', sessionId: 'session-off-plan' })],
      '2026-02-10',
    )

    expect(result.slots[0].status).toBe('pending')
    expect(result.unplanned).toEqual([
      {
        date: '2026-02-10',
        materialId: 'mat-2',
        minutes: 45,
        sessionId: 'session-off-plan',
      },
    ])
  })

  it('handles an empty roadmap without dropping sessions', () => {
    const result = deriveSlotStatuses(
      makeRoadmap([]),
      [makeSession({ sessionId: 'session-orphan' })],
      '2026-02-10',
    )

    expect(result.slots).toEqual([])
    expect(result.unplanned).toEqual([
      {
        date: '2026-02-10',
        materialId: 'mat-1',
        minutes: 45,
        sessionId: 'session-orphan',
      },
    ])
  })

  it('marks every slot in an all-done week done', () => {
    const slots = [
      makeSlot({ date: '2026-02-09', dayOfWeek: 'Monday' }),
      makeSlot({ date: '2026-02-10', dayOfWeek: 'Tuesday' }),
      makeSlot({ date: '2026-02-11', dayOfWeek: 'Wednesday' }),
    ]
    const sessions = slots.map((slot, index) =>
      makeSession({
        date: slot.date,
        sessionId: `session-${index}`,
        duration: 30 + index,
      }),
    )

    const result = deriveSlotStatuses(makeRoadmap(slots), sessions, '2026-02-12')

    expect(result.slots.map((slot) => slot.status)).toEqual([
      'done',
      'done',
      'done',
    ])
    expect(result.unplanned).toEqual([])
  })

  it('accounts for every session exactly once across derived slots and unplanned', () => {
    const slots = [
      makeSlot({ date: '2026-02-09', candidateMaterialIds: ['mat-1'] }),
      makeSlot({ date: '2026-02-10', candidateMaterialIds: ['mat-2'] }),
      makeSlot({ date: '2026-02-11', candidateMaterialIds: ['mat-3'] }),
    ]
    const roadmap = makeRoadmap(slots)

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: fc.constantFrom(
              '2026-02-09',
              '2026-02-10',
              '2026-02-11',
              '2026-02-12',
            ),
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3', 'mat-x'),
            duration: fc.integer({ min: 1, max: 240 }),
          }),
          { maxLength: 30 },
        ),
        (generated) => {
          const sessions = generated.map((session, index) =>
            makeSession({
              ...session,
              sessionId: `session-${index}`,
            }),
          )

          const result = deriveSlotStatuses(roadmap, sessions, '2026-02-10')
          const attributedIds = result.slots.flatMap((slot) => slot.sessionIds)
          const unplannedIds = result.unplanned.map((session) => session.sessionId)
          const allIds = [...attributedIds, ...unplannedIds]

          expect(allIds).toHaveLength(sessions.length)
          expect(new Set(allIds).size).toBe(sessions.length)
        },
      ),
    )
  })
})
