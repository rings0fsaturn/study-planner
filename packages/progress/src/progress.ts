import type {
  SessionEvent,
  RoadmapInput,
  CalibrationState,
  ProgressSnapshot,
  CumulativePoint,
  BurnUpData,
  Verdict,
  WeeklyStats,
  WeekSummaryForNarrative,
  ReplanContext,
  RoadmapSlot,
} from './types'
import { calculateStreak, buildStreakGrid } from './streak'
import { fitBurnUpGP } from './gp'

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getISOWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function buildPlannedCumulative(slots: RoadmapSlot[]): CumulativePoint[] {
  const dailyPlanned = new Map<string, number>()
  for (const slot of slots) {
    dailyPlanned.set(
      slot.date,
      (dailyPlanned.get(slot.date) ?? 0) + slot.plannedMinutes,
    )
  }

  const sortedDates = [...dailyPlanned.keys()].sort()
  let cumulative = 0
  return sortedDates.map((date) => {
    cumulative += dailyPlanned.get(date)!
    return { date, minutes: cumulative }
  })
}

function buildActualCumulative(sessions: SessionEvent[]): CumulativePoint[] {
  const dailyActual = new Map<string, number>()
  for (const session of sessions) {
    dailyActual.set(
      session.date,
      (dailyActual.get(session.date) ?? 0) + session.duration,
    )
  }

  const sortedDates = [...dailyActual.keys()].sort()
  let cumulative = 0
  return sortedDates.map((date) => {
    cumulative += dailyActual.get(date)!
    return { date, minutes: cumulative }
  })
}

function findProjectedFinish(
  gpCurve: { date: string; mean: number; lower: number; upper: number }[],
  totalPlanned: number,
): { finishDate: string | null; confidenceInterval: [string, string] | null } {
  if (gpCurve.length === 0 || totalPlanned <= 0) {
    return { finishDate: null, confidenceInterval: null }
  }

  let finishDate: string | null = null
  let ciLower: string | null = null
  let ciUpper: string | null = null

  for (const point of gpCurve) {
    if (ciUpper === null && point.upper >= totalPlanned) {
      ciUpper = point.date
    }
    if (finishDate === null && point.mean >= totalPlanned) {
      finishDate = point.date
    }
    if (ciLower === null && point.lower >= totalPlanned) {
      ciLower = point.date
    }
  }

  const confidenceInterval: [string, string] | null =
    ciUpper && ciLower ? [ciUpper, ciLower] : null

  return { finishDate, confidenceInterval }
}

function computeVerdict(
  gpCurve: { date: string; mean: number; lower: number }[],
  plannedCumulative: CumulativePoint[],
  today: string,
): Verdict {
  const todayGP = gpCurve.find((p) => p.date === today)
  const todayPlanned = plannedCumulative.find((p) => p.date <= today)

  if (!todayGP || !todayPlanned) return 'on-track'

  const plannedAtToday = plannedCumulative
    .filter((p) => p.date <= today)
    .reduce((max, p) => (p.minutes > max ? p.minutes : max), 0)

  if (todayGP.lower >= plannedAtToday) return 'ahead'
  if (todayGP.mean >= plannedAtToday) return 'on-track'
  return 'slipping'
}

function findUpNext(
  slots: RoadmapSlot[],
  sessions: SessionEvent[],
  today: string,
): RoadmapSlot | null {
  const sessionDates = new Set(sessions.map((s) => s.date))
  return (
    slots.find((slot) => slot.date >= today && !sessionDates.has(slot.date)) ??
    null
  )
}

function computeWeeklyStats(
  sessions: SessionEvent[],
  slots: RoadmapSlot[],
  today: string,
): WeeklyStats {
  const weekStart = getISOWeekStart(today)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndStr = toDateStr(weekEnd)

  const weekSessions = sessions.filter(
    (s) => s.date >= weekStart && s.date <= weekEndStr,
  )
  const weekSlots = slots.filter(
    (s) => s.date >= weekStart && s.date <= weekEndStr,
  )

  const minutesByDay: Record<string, number> = {}
  const materialsTouched = new Set<string>()

  for (const s of weekSessions) {
    minutesByDay[s.date] = (minutesByDay[s.date] ?? 0) + s.duration
    if (s.sessionId) materialsTouched.add(s.sessionId)
  }

  const weekIndex = Math.floor(
    (new Date(today).getTime() - new Date(weekStart).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  )

  return {
    weekIndex,
    weekStartDate: weekStart,
    sessionsThisWeek: weekSessions.length,
    minutesThisWeek: weekSessions.reduce((s, sess) => s + sess.duration, 0),
    plannedMinutesThisWeek: weekSlots.reduce(
      (s, slot) => s + slot.plannedMinutes,
      0,
    ),
    minutesByDay,
    materialsTouched: [...materialsTouched],
  }
}

export function computeProgress(
  sessions: SessionEvent[],
  roadmap: RoadmapInput,
  _calibration: CalibrationState,
  today: string,
): ProgressSnapshot {
  const totalPlannedMinutes = roadmap.slots.reduce(
    (s, slot) => s + slot.plannedMinutes,
    0,
  )
  const totalMinutes = sessions.reduce((s, sess) => s + sess.duration, 0)
  const completionPercentage =
    totalPlannedMinutes > 0
      ? Math.min((totalMinutes / totalPlannedMinutes) * 100, 100)
      : 0

  // Streak
  const streakResult = calculateStreak(sessions, today)

  const dailyPlannedMinutes: Record<string, number> = {}
  for (const slot of roadmap.slots) {
    dailyPlannedMinutes[slot.date] =
      (dailyPlannedMinutes[slot.date] ?? 0) + slot.plannedMinutes
  }
  const plannedValues = Object.values(dailyPlannedMinutes)
  const globalAvgDaily =
    plannedValues.length > 0
      ? plannedValues.reduce((s, v) => s + v, 0) / plannedValues.length
      : 60

  const streakGrid = buildStreakGrid(
    sessions,
    today,
    dailyPlannedMinutes,
    globalAvgDaily,
  )

  // Burn-up
  const plannedCumulative = buildPlannedCumulative(roadmap.slots)
  const actualCumulative = buildActualCumulative(sessions)

  const gpCurve = fitBurnUpGP(
    actualCumulative,
    roadmap.startDate,
    roadmap.deadline,
    today,
  )

  const lastActual =
    actualCumulative.length > 0
      ? actualCumulative[actualCumulative.length - 1].minutes
      : 0
  const lastPlanned =
    plannedCumulative.length > 0
      ? plannedCumulative
          .filter((p) => p.date <= today)
          .reduce((max, p) => Math.max(max, p.minutes), 0)
      : 0

  const startDate = new Date(roadmap.startDate)
  const endDate = new Date(roadmap.deadline)
  const todayDate = new Date(today)
  const totalDays = Math.max(
    1,
    Math.round(
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    ),
  )
  const dayNumber = Math.max(
    0,
    Math.round(
      (todayDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    ),
  )

  const burnUp: BurnUpData = {
    planned: plannedCumulative,
    actual: actualCumulative,
    gpCurve,
    today,
    deficit: lastActual - lastPlanned,
    dayNumber,
    totalDays,
  }

  // Projection
  const { finishDate, confidenceInterval } = findProjectedFinish(
    gpCurve,
    totalPlannedMinutes,
  )

  // Verdict
  const verdict = computeVerdict(gpCurve, plannedCumulative, today)

  // Drift
  const driftPastDeadline = finishDate
    ? finishDate > roadmap.deadline
    : false

  // Up next
  const upNext = findUpNext(roadmap.slots, sessions, today)

  // Weekly stats
  const weeklyStats = computeWeeklyStats(sessions, roadmap.slots, today)

  // Week summary for narrative
  const weekSummary: WeekSummaryForNarrative = {
    weekStartDate: weeklyStats.weekStartDate,
    sessionsLogged: weeklyStats.sessionsThisWeek,
    hoursLogged: Math.round((weeklyStats.minutesThisWeek / 60) * 10) / 10,
    verdict,
    daysWithActivity: Object.keys(weeklyStats.minutesByDay).length,
    materialsTouched: weeklyStats.materialsTouched,
  }

  // Replan context
  const replanContext: ReplanContext = {
    isPlanDrifted: driftPastDeadline,
    daysOverDeadline: finishDate
      ? Math.max(
          0,
          Math.round(
            (new Date(finishDate).getTime() -
              new Date(roadmap.deadline).getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        )
      : null,
    pinnedSlotCount: 0,
    editableSlotCount: roadmap.slots.filter((s) => s.date >= today).length,
  }

  return {
    streak: {
      current: streakResult.current,
      longest: streakResult.longest,
      grid: streakGrid,
    },
    burnUp,
    projection: { finishDate, confidenceInterval },
    totalMinutes,
    totalPlannedMinutes,
    completionPercentage,
    verdict,
    driftPastDeadline,
    upNext,
    weeklyStats,
    weekSummaryForNarrative: weekSummary,
    replanContext,
  }
}
