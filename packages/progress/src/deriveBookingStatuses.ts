import type { SessionEvent } from './types'

export type BookingDerivedStatus = 'done' | 'booked' | 'missed' | 'unplanned'

export interface BookingLike {
  id: string
  date: string
  estimatedDuration: number
  materialId?: string
  status: 'booked' | 'done' | 'missed' | 'unplanned'
}

export interface DerivedBooking {
  booking: BookingLike
  status: BookingDerivedStatus
  loggedMinutes: number
  sessionIds: string[]
}

export interface BookingStatusDerivation {
  bookings: DerivedBooking[]
  unplanned: { date: string; sessionIds: string[]; minutes: number }[]
}

function sessionMinutes(session: SessionEvent): number {
  return session.activeMinutes ?? session.duration
}

export function deriveBookingStatuses(
  bookings: BookingLike[],
  sessions: SessionEvent[],
  today: string,
): BookingStatusDerivation {
  const bookingIds = new Set(bookings.map((booking) => booking.id))
  const sessionsByBooking = new Map<string, Array<{ session: SessionEvent; id: string }>>()
  const unplannedByDate = new Map<string, { date: string; sessionIds: string[]; minutes: number }>()

  sessions.forEach((session, index) => {
    const sessionId = session.sessionId ?? `session:${index}`
    if (session.bookingId !== undefined && bookingIds.has(session.bookingId)) {
      const group = sessionsByBooking.get(session.bookingId) ?? []
      group.push({ session, id: sessionId })
      sessionsByBooking.set(session.bookingId, group)
      return
    }

    const existing = unplannedByDate.get(session.date) ?? {
      date: session.date,
      sessionIds: [],
      minutes: 0,
    }
    existing.sessionIds.push(sessionId)
    existing.minutes += sessionMinutes(session)
    unplannedByDate.set(session.date, existing)
  })

  return {
    bookings: bookings.map((booking) => {
      const matches = sessionsByBooking.get(booking.id) ?? []
      const hasCompletingSession = matches.some(({ session }) => session.resolution !== 'interrupted')
      const status: BookingDerivedStatus = hasCompletingSession
        ? 'done'
        : booking.date < today
          ? 'missed'
          : 'booked'

      return {
        booking,
        status,
        loggedMinutes: matches.reduce((total, { session }) => total + sessionMinutes(session), 0),
        sessionIds: matches.map(({ id }) => id),
      }
    }),
    unplanned: [...unplannedByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
}
