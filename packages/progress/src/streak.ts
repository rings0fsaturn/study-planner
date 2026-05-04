import type { SessionEvent, DayCell } from './types'

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

    grid.push({
      date: dateStr,
      level,
      minutes: totalMinutes,
      isToday: dateStr === today,
    })
  }

  return grid
}
