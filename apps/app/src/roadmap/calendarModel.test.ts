import { describe, expect, it } from 'vitest'
import type { DerivedBooking } from '@study-tracker/progress'
import {
  bindCells,
  buildMonthGrid,
  calendarMonthBounds,
  clampMonth,
  dayOfWeekForISODate,
  isStudyDay,
  shiftMonth,
} from './calendarModel'

function makeDerivedBooking(overrides: Partial<DerivedBooking> = {}): DerivedBooking {
  return {
    booking: {
      id: 'booking-1',
      date: '2026-03-10',
      estimatedDuration: 60,
      materialId: 'mat-1',
      status: 'booked',
    },
    status: 'booked',
    loggedMinutes: 0,
    sessionIds: [],
    ...overrides,
  }
}

describe('calendarModel', () => {
  it('builds a Monday-start grid around a 31-day month that spills into six rows', () => {
    const grid = buildMonthGrid('2026-03-15')

    expect(grid.monthLabel).toBe('March 2026')
    expect(grid.weeks).toHaveLength(6)
    expect(grid.weeks[0][0]).toMatchObject({
      date: '2026-02-23',
      isInMonth: false,
    })
    expect(grid.weeks[0][6].date).toBe('2026-03-01')
    expect(grid.weeks[5][6]).toMatchObject({
      date: '2026-04-05',
      isInMonth: false,
    })
  })

  it('builds February without exceeding the calendar month boundary rows', () => {
    const grid = buildMonthGrid('2026-02-10')
    const dates = grid.weeks.flat().map((day) => day.date)

    expect(grid.monthLabel).toBe('February 2026')
    expect(grid.weeks.length).toBeLessThanOrEqual(6)
    expect(dates).toContain('2026-02-01')
    expect(dates).toContain('2026-02-28')
  })

  it('binds booking statuses to their day cells with material titles', () => {
    const grid = buildMonthGrid('2026-03-10')
    const bound = bindCells(
      grid,
      [
        makeDerivedBooking({
          status: 'done',
          loggedMinutes: 52,
          sessionIds: ['session-1'],
        }),
      ],
      [],
      new Map([['mat-1', 'Distributed Systems']]),
    )

    const day = bound.weeks.flat().find((cell) => cell.date === '2026-03-10')

    expect(day?.bubbles).toHaveLength(1)
    expect(day?.bubbles[0]).toMatchObject({
      status: 'done',
      label: 'Distributed Systems',
      materialTitle: 'Distributed Systems',
      minutes: 52,
      plannedMinutes: 60,
      materialId: 'mat-1',
      bookingId: 'booking-1',
      kind: 'booking',
    })
  })

  it('labels blank bookings as pick-at-start sessions', () => {
    const grid = buildMonthGrid('2026-03-10')
    const bound = bindCells(
      grid,
      [makeDerivedBooking({ booking: { id: 'booking-blank', date: '2026-03-10', estimatedDuration: 45, status: 'booked' } })],
      [],
      new Map(),
    )

    const bubble = bound.weeks.flat().find((cell) => cell.date === '2026-03-10')
      ?.bubbles[0]

    expect(bubble).toMatchObject({
      status: 'booked',
      label: 'Session · pick at start',
      minutes: 45,
      bookingId: 'booking-blank',
    })
  })

  it('binds unplanned activity as its own bubble', () => {
    const grid = buildMonthGrid('2026-03-10')
    const bound = bindCells(
      grid,
      [],
      [
        {
          date: '2026-03-10',
          sessionIds: ['session-unplanned'],
          minutes: 35,
        },
      ],
      new Map(),
    )

    const bubble = bound.weeks.flat().find((cell) => cell.date === '2026-03-10')
      ?.bubbles[0]

    expect(bubble).toMatchObject({
      status: 'unplanned',
      label: 'Unplanned activity',
      minutes: 35,
      sessionId: 'session-unplanned',
      kind: 'activity',
    })
  })

  it('derives inclusive roadmap month bounds from start and deadline dates', () => {
    expect(calendarMonthBounds('2026-03-10', '2026-05-02')).toEqual({
      startMonth: '2026-03',
      endMonth: '2026-05',
    })
  })

  it('clamps view months before start and after deadline', () => {
    const bounds = calendarMonthBounds('2026-03-10', '2026-05-02')

    expect(clampMonth('2026-02-01', bounds)).toBe('2026-03')
    expect(clampMonth('2026-04-15', bounds)).toBe('2026-04')
    expect(clampMonth('2026-06-01', bounds)).toBe('2026-05')
  })

  it('shifts month navigation without paging past roadmap bounds', () => {
    const bounds = calendarMonthBounds('2026-03-10', '2026-05-02')

    expect(shiftMonth('2026-03', -1, bounds)).toBe('2026-03')
    expect(shiftMonth('2026-03', 1, bounds)).toBe('2026-04')
    expect(shiftMonth('2026-05', 1, bounds)).toBe('2026-05')
  })

  it('maps ISO dates to UTC study-day names', () => {
    expect(dayOfWeekForISODate('2026-07-06')).toBe('Mon')
    expect(dayOfWeekForISODate('2026-07-07')).toBe('Tue')
    expect(dayOfWeekForISODate('2026-07-12')).toBe('Sun')
  })

  it('matches selected study days without local-time drift', () => {
    expect(isStudyDay('2026-07-06', ['Mon', 'Wed'])).toBe(true)
    expect(isStudyDay('2026-07-07', ['Mon', 'Wed'])).toBe(false)
    expect(isStudyDay('2026-07-12', undefined)).toBe(false)
  })
})
