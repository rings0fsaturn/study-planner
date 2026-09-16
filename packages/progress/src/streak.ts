import type { SessionEvent, DayCell, YearStreakCell } from './types'

export function calculateStreak(
  sessions: SessionEvent[],
  today: string,
): { current: number; longest: number } {
  if (sessions.length === 0) return { current: 0, longest: 0 }

  const uniqueDates = new Set(sessions.map((s) => s.date))
  const sortedDates = [...uniqueDates].sort()

  if (sortedDates.length === 0) return { current: 0, longest: 0 }

  let longest = 1
  let currentRun = 1

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1])
    const curr = new Date(sortedDates[i])
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
    )
    if (diffDays === 1) {
      currentRun++
    } else {
      longest = Math.max(longest, currentRun)
      currentRun = 1
    }
  }
  longest = Math.max(longest, currentRun)

  // Current streak: count backwards from today (or most recent session date)
  const lastDate = sortedDates[sortedDates.length - 1]
  const todayDate = new Date(today)
  const lastSessionDate = new Date(lastDate)
  const daysSinceLast = Math.round(
    (todayDate.getTime() - lastSessionDate.getTime()) / (24 * 60 * 60 * 1000),
  )

  if (daysSinceLast > 1) return { current: 0, longest }

  let current = 1
  for (let i = sortedDates.length - 2; i >= 0; i--) {
    const curr = new Date(sortedDates[i + 1])
    const prev = new Date(sortedDates[i])
    const diff = Math.round(
      (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
    )
    if (diff === 1) {
      current++
    } else {
      break
    }
  }

  return { current, longest }
}

export function buildStreakGrid(
  sessions: SessionEvent[],
  today: string,
  dailyPlannedMinutes: Record<string, number>,
  globalAvgDailyMinutes: number,
): DayCell[] {
  const todayDate = new Date(today + 'T12:00:00Z')
  const dayOfWeek = todayDate.getUTCDay()
  // Monday = start of week (ISO)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(todayDate)
  monday.setUTCDate(todayDate.getUTCDate() + mondayOffset)

  const grid: DayCell[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    const dateStr = d.toISOString().slice(0, 10)

    const daySessions = sessions.filter((s) => s.date === dateStr)
    const totalMinutes = daySessions.reduce((s, sess) => {
      if (sess.duration > 0) return s + sess.duration
      if (sess.source === 'manual') return s + 1
      return s
    }, 0)

    const planned = dailyPlannedMinutes[dateStr] ?? globalAvgDailyMinutes
    const ratio = planned > 0 ? totalMinutes / planned : 0

    let level: 0 | 1 | 2 | 3
    if (totalMinutes === 0 && daySessions.length === 0) {
      level = 0
    } else if (daySessions.length > 0 && totalMinutes === 0) {
      level = 1
    } else if (ratio < 0.50) {
      level = 1
    } else if (ratio < 1.00) {
      level = 2
    } else {
      level = 3
    }

    if (dateStr > today) level = 0

    grid.push({
      date: dateStr,
      level,
      minutes: totalMinutes,
      isToday: dateStr === today,
    })
  }

  return grid
}

// Five-level minutes buckets for the year calendar (cream → moss):
// 0 / under 15 / 15-45 / 45-90 / 90+ minutes. Manual zero-duration logs
// count as "showed up" (level 1), mirroring the mini-week behaviour.
function yearLevel(totalMinutes: number, hasSessions: boolean): 0 | 1 | 2 | 3 | 4 {
  if (!hasSessions) return 0
  if (totalMinutes === 0) return 1
  if (totalMinutes < 15) return 1
  if (totalMinutes < 45) return 2
  if (totalMinutes < 90) return 3
  return 4
}

export function buildYearStreakGrid(
  sessions: Array<{ date: string; source?: string; duration?: number }>,
  today: string,
): YearStreakCell[] {
  const todayDate = new Date(today + 'T12:00:00Z')

  // Window: first of the month 11 months back, aligned to its Monday,
  // through the Sunday of today's week. Up to 53 columns.
  const start = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - 11, 1))
  const startDow = start.getUTCDay()
  const monday = new Date(start)
  monday.setUTCDate(start.getUTCDate() + (startDow === 0 ? -6 : 1 - startDow))

  const endDow = todayDate.getUTCDay()
  const end = new Date(todayDate)
  end.setUTCDate(todayDate.getUTCDate() + (endDow === 0 ? 0 : 7 - endDow))

  const byDate = new Map<string, { total: number; count: number }>()
  for (const s of sessions) {
    if (!s.date) continue
    const minutes = (s.duration ?? 0) > 0 ? s.duration! : s.source === 'manual' ? 1 : 0
    const entry = byDate.get(s.date) ?? { total: 0, count: 0 }
    entry.total += minutes
    entry.count += 1
    byDate.set(s.date, entry)
  }

  const cells: YearStreakCell[] = []
  for (let d = new Date(monday); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    const entry = byDate.get(dateStr)
    const level = dateStr > today ? 0 : yearLevel(entry?.total ?? 0, entry !== undefined)
    cells.push({
      date: dateStr,
      level,
      minutes: entry?.total ?? 0,
      isToday: dateStr === today,
    })
  }

  return cells
}
