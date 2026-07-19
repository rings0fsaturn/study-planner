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
import { projectFinish } from './projectFinish'

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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function hasCapacityFields(roadmap: RoadmapInput): roadmap is RoadmapInput & {
  selectedStudyDays: string[]
  weekdayHours: number
  weekendHours: number
} {
  return Array.isArray(roadmap.selectedStudyDays) &&
    roadmap.selectedStudyDays.length > 0 &&
    typeof roadmap.weekdayHours === 'number' &&
    typeof roadmap.weekendHours === 'number'
}

function capacityForStudyDay(day: string, roadmap: { weekdayHours: number; weekendHours: number }): number {
  const hours = day === 'Sat' || day === 'Sun' ? roadmap.weekendHours : roadmap.weekdayHours
  return Math.round(Math.max(0, hours) * 60)
}

function buildPlannedCumulativeFromCapacity(roadmap: RoadmapInput): CumulativePoint[] {
  if (!hasCapacityFields(roadmap)) return buildPlannedCumulative(roadmap.slots)

  let cumulative = 0
  const planned: CumulativePoint[] = []
  for (let date = roadmap.startDate; date <= roadmap.deadline; date = addDaysISO(date, 1)) {
    const day = DAY_NAMES[new Date(`${date}T00:00:00.000Z`).getUTCDay()]
    if (!roadmap.selectedStudyDays.includes(day)) continue

    cumulative += capacityForStudyDay(day, roadmap)
    planned.push({ date, minutes: cumulative })
  }

  return planned.length > 0 ? planned : buildPlannedCumulative(roadmap.slots)
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
  roadmapStartDate: string,
  roadmap?: RoadmapInput,
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

  const planStartWeek = getISOWeekStart(roadmapStartDate)
  const weekIndex = Math.floor(
    (new Date(weekStart).getTime() - new Date(planStartWeek).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  )

  const plannedMinutesThisWeek = roadmap
    ? capacityWeeklyTarget(roadmap, weekStart, weekSlots)
    : weekSlots.reduce((s, slot) => s + slot.plannedMinutes, 0)

  return {
    weekIndex,
    weekStartDate: weekStart,
    sessionsThisWeek: weekSessions.length,
    minutesThisWeek: weekSessions.reduce((s, sess) => s + sess.duration, 0),
    plannedMinutesThisWeek,
    minutesByDay,
    materialsTouched: [...materialsTouched],
  }
}

function dayNameForISO(date: string): string {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay()
  return DAY_NAMES[day]
}

function addDaysISO(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function capacityWeeklyTarget(
  roadmap: RoadmapInput,
  weekStart: string,
  fallbackSlots: RoadmapSlot[],
): number {
  if (
    roadmap.selectedStudyDays === undefined ||
    roadmap.weekdayHours === undefined ||
    roadmap.weekendHours === undefined
  ) {
    return fallbackSlots.reduce((s, slot) => s + slot.plannedMinutes, 0)
  }

  let total = 0
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDaysISO(weekStart, offset)
    const day = dayNameForISO(date)
    if (!roadmap.selectedStudyDays.includes(day)) continue
    total += (day === 'Sat' || day === 'Sun' ? roadmap.weekendHours : roadmap.weekdayHours) * 60
  }
  return Math.round(total)
}

export function computeProgress(
  sessions: SessionEvent[],
  roadmap: RoadmapInput,
  _calibration: CalibrationState,
  today: string,
): ProgressSnapshot {
  const slotPlannedMinutes = roadmap.slots.reduce(
    (s, slot) => s + slot.plannedMinutes,
    0,
  )
  const totalPlannedMinutes = roadmap.materialTotalMinutes ?? slotPlannedMinutes
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
  const plannedCumulative = buildPlannedCumulativeFromCapacity(roadmap)
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
    startDate: roadmap.startDate,
    deadline: roadmap.deadline,
    deficit: lastActual - lastPlanned,
    dayNumber,
    totalDays,
  }

  // Projection
  const projection = projectFinish({
    sessionCount: sessions.length,
    consumedActualMin: totalMinutes,
    remainingActualMin: roadmap.materialRemainingMinutes ??
      Math.max(0, totalPlannedMinutes - totalMinutes),
    startDate: roadmap.startDate,
    today,
    horizonEnd: roadmap.deadline,
    gpCurve,
    totalPlanned: totalPlannedMinutes,
  })
  const { finishDate } = projection

  // Verdict
  const verdict = computeVerdict(gpCurve, plannedCumulative, today)

  // Drift
  const driftPastDeadline = finishDate
    ? finishDate > roadmap.deadline
    : false

  // Up next
  const upNext = findUpNext(roadmap.slots, sessions, today)

  // Weekly stats
  const weeklyStats = computeWeeklyStats(sessions, roadmap.slots, today, roadmap.startDate, roadmap)

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
    projection,
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
