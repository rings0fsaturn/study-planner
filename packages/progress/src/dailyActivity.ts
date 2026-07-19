import type { SessionEvent } from './types'

export interface DailyActivity {
  date: string
  minutes: number
  sessionIds: string[]
}

function sessionMinutes(session: SessionEvent): number {
  return session.activeMinutes ?? session.duration
}

export function buildDailyActivity(sessions: SessionEvent[]): DailyActivity[] {
  const byDate = new Map<string, DailyActivity>()
  sessions.forEach((session, index) => {
    const existing = byDate.get(session.date) ?? {
      date: session.date,
      minutes: 0,
      sessionIds: [],
    }
    existing.minutes += sessionMinutes(session)
    existing.sessionIds.push(session.sessionId ?? `session:${index}`)
    byDate.set(session.date, existing)
  })

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
