import {
  calibrationDenominator,
  isCalibrationSession,
  type SessionEvent,
} from '@study-tracker/progress'
import type { DayOfWeek } from '@study-tracker/roadmap-engine'

export type PaceDeltaMinutes = 0 | 15 | 30 | 45 | 60

export interface CapacityScenarioInput {
  remainingEstimatedMinutes: number
  sessions: SessionEvent[]
  today: string
  hoursPerStudyDay: number
  selectedStudyDays: DayOfWeek[]
  paceDeltaMinutes: PaceDeltaMinutes
  actualCumulativeMinutes: number
  finalPlannedCumulativeMinutes: number
}

export interface CapacityScenarioResult {
  finishDate: string | null
  points: { date: string; minutes: number }[]
}

const SUPPORTED_PACE_DELTAS: readonly PaceDeltaMinutes[] = [0, 15, 30, 45, 60]

function addDaysISO(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function dayOfWeekForISO(iso: string): DayOfWeek {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay()
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const)[day]
}

export function parsePaceDeltaMinutes(value: string | null): PaceDeltaMinutes {
  if (value === null || !/^(0|15|30|45|60)$/.test(value)) return 0
  const parsed = Number(value) as PaceDeltaMinutes
  return SUPPORTED_PACE_DELTAS.includes(parsed) ? parsed : 0
}

export function demonstratedThroughputFactor(sessions: SessionEvent[]): number {
  const ratios: number[] = []
  for (const session of sessions) {
    if (!isCalibrationSession(session)) continue
    const denominator = calibrationDenominator(session)
    if (!denominator || session.activeMinutes == null) continue
    ratios.push(session.activeMinutes / denominator)
  }
  if (ratios.length === 0) return 1
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length
}

export function computeCapacityScenario(input: CapacityScenarioInput): CapacityScenarioResult {
  const startMinutes = Math.max(0, input.actualCumulativeMinutes)
  const finalMinutes = Math.max(startMinutes, input.finalPlannedCumulativeMinutes)
  if (input.remainingEstimatedMinutes <= 0) {
    return {
      finishDate: input.today,
      points: [{ date: input.today, minutes: finalMinutes }],
    }
  }

  const dailyCapacity = input.hoursPerStudyDay * 60 + input.paceDeltaMinutes
  if (dailyCapacity <= 0 || input.selectedStudyDays.length === 0) {
    return { finishDate: null, points: [] }
  }

  const daySet = new Set(input.selectedStudyDays)
  const requiredActiveMinutes = input.remainingEstimatedMinutes * Math.max(
    0.1,
    demonstratedThroughputFactor(input.sessions),
  )
  const points: CapacityScenarioResult['points'] = [
    { date: input.today, minutes: startMinutes },
  ]
  let accumulatedCapacity = 0

  for (let offset = 0; offset <= 3650; offset += 1) {
    const date = addDaysISO(input.today, offset)
    if (!daySet.has(dayOfWeekForISO(date))) continue
    accumulatedCapacity += dailyCapacity
    const progress = Math.min(1, accumulatedCapacity / requiredActiveMinutes)
    const minutes = progress >= 1
      ? finalMinutes
      : Math.round(startMinutes + (finalMinutes - startMinutes) * progress)

    if (date !== input.today || progress >= 1) {
      points.push({ date, minutes })
    }
    if (progress >= 1) return { finishDate: date, points }
  }

  return { finishDate: null, points: [] }
}
