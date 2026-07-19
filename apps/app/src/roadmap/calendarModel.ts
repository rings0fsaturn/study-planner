import {
  addDays,
  addMonths,
  endOfMonth,
  endOfISOWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfISOWeek,
} from 'date-fns'
import type {
  BookingStatusDerivation,
  DailyActivity,
  DerivedBooking,
} from '@study-tracker/progress'

export interface CalendarDay {
  date: string
  dayOfMonth: number
  isInMonth: boolean
}

export interface MonthGrid {
  monthLabel: string
  monthKey: string
  weeks: CalendarDay[][]
}

export interface MonthBounds {
  startMonth: string
  endMonth: string
}

export type CalendarBubbleStatus = 'done' | 'booked' | 'missed' | 'unplanned'

export interface CalendarMaterial {
  title: string
  url?: string
}

export interface CalendarBubble {
  id: string
  date: string
  status: CalendarBubbleStatus
  label: string
  materialTitle?: string
  materialUrl?: string
  materialId?: string
  sessionTitle?: string | null
  minutes: number
  plannedMinutes?: number
  loggedMinutes?: number
  sessionIds: string[]
  sessionId?: string
  bookingId?: string
  kind: 'booking' | 'activity'
}

export interface BoundCalendarDay extends CalendarDay {
  bubbles: CalendarBubble[]
}

export interface BoundMonthGrid {
  monthLabel: string
  monthKey: string
  weeks: BoundCalendarDay[][]
}

const STUDY_DAY_BY_INDEX = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function dayOfWeekForISODate(dateISO: string): string {
  return STUDY_DAY_BY_INDEX[new Date(`${dateISO}T00:00:00.000Z`).getUTCDay()]
}

export function isStudyDay(dateISO: string, studyDays: readonly string[] | undefined): boolean {
  if (!studyDays?.length) return false
  return studyDays.includes(dayOfWeekForISODate(dateISO))
}

function toDate(monthDate: string | Date): Date {
  return typeof monthDate === 'string' ? parseISO(monthDate) : monthDate
}

function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function monthKeyForDate(monthDate: string | Date): string {
  return format(startOfMonth(toDate(monthDate)), 'yyyy-MM')
}

export function monthKeyToDate(monthKey: string): Date {
  return parseISO(`${monthKey}-01`)
}

export function calendarMonthBounds(startDate: string, deadline: string): MonthBounds {
  const startMonth = monthKeyForDate(startDate)
  const endMonth = monthKeyForDate(deadline)

  if (startMonth > endMonth) {
    return { startMonth: endMonth, endMonth: startMonth }
  }

  return { startMonth, endMonth }
}

export function clampMonth(monthDate: string | Date, bounds: MonthBounds): string {
  const monthKey = monthKeyForDate(monthDate)
  if (monthKey < bounds.startMonth) return bounds.startMonth
  if (monthKey > bounds.endMonth) return bounds.endMonth
  return monthKey
}

export function shiftMonth(monthKey: string, offset: number, bounds: MonthBounds): string {
  return clampMonth(addMonths(monthKeyToDate(monthKey), offset), bounds)
}

export function buildMonthGrid(monthDate: string | Date): MonthGrid {
  const date = toDate(monthDate)
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const gridStart = startOfISOWeek(monthStart)
  const gridEnd = endOfISOWeek(monthEnd)
  const weeks: CalendarDay[][] = []

  let cursor = gridStart
  while (cursor <= gridEnd) {
    const week: CalendarDay[] = []
    for (let day = 0; day < 7; day += 1) {
      week.push({
        date: toISODate(cursor),
        dayOfMonth: Number(format(cursor, 'd')),
        isInMonth: isSameMonth(cursor, monthStart),
      })
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
  }

  return {
    monthLabel: format(monthStart, 'MMMM yyyy'),
    monthKey: format(monthStart, 'yyyy-MM'),
    weeks,
  }
}

function materialInfoById(
  materialId: string | undefined,
  materialsById: Map<string, string | CalendarMaterial>,
): CalendarMaterial | undefined {
  if (!materialId) return undefined
  const material = materialsById.get(materialId)
  if (!material) return undefined
  if (typeof material === 'string') return { title: material }
  return material
}

function bubbleForBooking(
  derived: DerivedBooking,
  materialsById: Map<string, string | CalendarMaterial>,
): CalendarBubble {
  const materialId = derived.booking.materialId
  const materialInfo = materialInfoById(materialId, materialsById)
  const materialTitle = materialInfo?.title
  const label = materialTitle ?? 'Session · pick at start'

  return {
    id: `booking:${derived.booking.id}`,
    date: derived.booking.date,
    status: derived.status,
    label,
    materialTitle,
    materialUrl: materialInfo?.url,
    materialId,
    sessionTitle: null,
    minutes: derived.loggedMinutes > 0 ? derived.loggedMinutes : derived.booking.estimatedDuration,
    plannedMinutes: derived.booking.estimatedDuration,
    loggedMinutes: derived.loggedMinutes,
    sessionIds: derived.sessionIds,
    bookingId: derived.booking.id,
    kind: 'booking',
  }
}

function bubbleForActivity(
  activity: DailyActivity,
  index: number,
): CalendarBubble {
  return {
    id: `activity:${activity.date}:${index}`,
    date: activity.date,
    status: 'unplanned',
    label: 'Unplanned activity',
    minutes: activity.minutes,
    loggedMinutes: activity.minutes,
    sessionIds: activity.sessionIds,
    sessionId: activity.sessionIds[0],
    kind: 'activity',
  }
}

export function bindCells(
  grid: MonthGrid,
  derivedBookings: DerivedBooking[],
  unplannedActivity: BookingStatusDerivation['unplanned'] | DailyActivity[],
  materialsById: Map<string, string | CalendarMaterial>,
): BoundMonthGrid {
  const bubblesByDate = new Map<string, CalendarBubble[]>()

  for (const derived of derivedBookings) {
    const bubbles = bubblesByDate.get(derived.booking.date) ?? []
    bubbles.push(bubbleForBooking(derived, materialsById))
    bubblesByDate.set(derived.booking.date, bubbles)
  }

  unplannedActivity.forEach((activity, index) => {
    const bubbles = bubblesByDate.get(activity.date) ?? []
    bubbles.push(bubbleForActivity(activity, index))
    bubblesByDate.set(activity.date, bubbles)
  })

  return {
    monthLabel: grid.monthLabel,
    monthKey: grid.monthKey,
    weeks: grid.weeks.map((week) =>
      week.map((day) => ({
        ...day,
        bubbles: bubblesByDate.get(day.date) ?? [],
      })),
    ),
  }
}
