import { describe, expect, it } from 'vitest'
import { deriveBookingStatuses, type BookingLike } from '../src/deriveBookingStatuses'
import type { SessionEvent } from '../src/types'

function booking(overrides: Partial<BookingLike> = {}): BookingLike {
  return {
    id: 'booking-1',
    date: '2026-06-10',
    estimatedDuration: 60,
    status: 'booked',
    ...overrides,
  }
}

function session(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    date: '2026-06-10',
    source: 'active',
    duration: 45,
    activeMinutes: 45,
    sessionId: 'session-1',
    ...overrides,
  }
}

describe('deriveBookingStatuses', () => {
  it('marks a booking done only when a matching bookingId has a completing session', () => {
    const result = deriveBookingStatuses(
      [booking()],
      [session({ bookingId: 'booking-1', resolution: 'completed' })],
      '2026-06-10',
    )

    expect(result.bookings[0]).toMatchObject({
      status: 'done',
      loggedMinutes: 45,
      sessionIds: ['session-1'],
    })
  })

  it('keeps interrupted sessions from marking a booking done', () => {
    const result = deriveBookingStatuses(
      [booking({ date: '2026-06-09' })],
      [session({ bookingId: 'booking-1', resolution: 'interrupted' })],
      '2026-06-10',
    )

    expect(result.bookings[0].status).toBe('missed')
    expect(result.bookings[0].loggedMinutes).toBe(45)
  })

  it('marks future unmatched bookings booked and past unmatched bookings missed', () => {
    const result = deriveBookingStatuses(
      [
        booking({ id: 'past', date: '2026-06-09' }),
        booking({ id: 'future', date: '2026-06-11' }),
      ],
      [],
      '2026-06-10',
    )

    expect(result.bookings.map((entry) => [entry.booking.id, entry.status])).toEqual([
      ['past', 'missed'],
      ['future', 'booked'],
    ])
  })

  it('groups sessions without a matching booking as unplanned by date', () => {
    const result = deriveBookingStatuses(
      [booking()],
      [
        session({ sessionId: 'a', bookingId: undefined, duration: 20, activeMinutes: undefined }),
        session({ sessionId: 'b', bookingId: 'missing', duration: 25, activeMinutes: undefined }),
      ],
      '2026-06-10',
    )

    expect(result.unplanned).toEqual([
      { date: '2026-06-10', sessionIds: ['a', 'b'], minutes: 45 },
    ])
  })
})
