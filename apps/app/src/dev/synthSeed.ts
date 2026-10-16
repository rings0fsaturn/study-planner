import type { Event } from '../events/EventStore'
import type {
  MaterialAddedPayload,
  PracticeRunFinishedPayload,
  PracticeRunStartedPayload,
  RoadmapCreatedPayload,
  SessionBookedPayload,
} from '../sync/types'
import type { SessionLoggedPayload } from '../session/types'

export interface ArchetypeParams {
  key: 'steady' | 'crammer' | 'struggling' | 'returning'
  weeklyPace: number[]
  skipProbability: number
  gapWeeks?: number[]
}

export const ARCHETYPES: Record<ArchetypeParams['key'], ArchetypeParams> = {
  steady: { key: 'steady', weeklyPace: [0.9, 0.92, 0.88, 0.95, 0.93], skipProbability: 0.05 },
  crammer: { key: 'crammer', weeklyPace: [0.4, 0.45, 0.5, 1.1, 1.2], skipProbability: 0.25 },
  struggling: { key: 'struggling', weeklyPace: [0.6, 0.55, 0.5, 0.62, 0.8], skipProbability: 0.3 },
  returning: { key: 'returning', weeklyPace: [0.85, 0.0, 0.0, 0.7, 0.9], skipProbability: 0.05, gapWeeks: [1, 2] },
}

type OmitId = Omit<Event, 'id'>

let seed = 42

// Seeded determinism note: rand() is reseeded per build so logged counts and
// timings are stable across calls, while uuid() stays random so repeated
// appends never collide on booking/session/run identity. Safe on module-level
// mutable seed only because the builder is fully synchronous (no awaits).

function rand(): number {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

function randInt(min: number, max: number): number {
  return Math.round(min + rand() * (max - min))
}

function uuid(): string {
  return crypto.randomUUID()
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function iso(d: Date): string {
  return d.toISOString()
}

function dateStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromDateStr(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function localDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

function localDayDiff(start: Date, end: Date): number {
  return localDayNumber(end) - localDayNumber(start)
}

const STUDY_DAY_NUMS = new Set([1, 3, 5, 6])

function plannedMinutesForDate(d: Date): number {
  const day = d.getDay()
  return day === 0 || day === 6 ? 120 : 90
}

const RUN_MODES = ['written', 'coding', 'mixed', 'written', 'coding'] as const

export function buildSynthHistory(
  archetype: ArchetypeParams['key'],
  materialIds: string[],
  startDate: string,
  now = new Date(),
): OmitId[] {
  seed = 42
  const params = ARCHETYPES[archetype]
  if (materialIds.length === 0) {
    throw new Error('[synthSeed] materialIds must be non-empty')
  }
  const start = dateFromDateStr(startDate)
  if (Number.isNaN(start.getTime())) {
    throw new Error(`[synthSeed] invalid startDate: ${startDate}`)
  }
  const todayStr = dateStr(startOfLocalDay(now))
  const roadmapCreatedAt = iso(addDays(start, -1))
  const events: OmitId[] = []

  const titles = ['React 19 Deep Dive', 'learningreact.pdf', 'Code-bearing React article']
  const kinds = ['youtube', 'file', 'article'] as const
  const roles = ['anchor', 'foundation', 'practice'] as const
  const durations = [1080, 780, 540]
  const materials = materialIds.map((id, i) => ({
    id,
    title: titles[i % titles.length],
    kind: kinds[i % kinds.length],
    role: roles[i % roles.length],
    duration: durations[i % durations.length],
  }))
  const materialById = new Map(materials.map((m) => [m.id, m]))

  for (const m of materials) {
    const payload: MaterialAddedPayload = {
      materialId: m.id,
      title: m.title,
      estimatedDuration: m.duration,
      kind: m.kind,
      role: m.role,
    }
    events.push({
      kind: 'MaterialAdded',
      payload: payload as unknown as Record<string, unknown>,
      createdAt: roadmapCreatedAt,
    })
  }

  const deadline = dateStr(addDays(start, 34))
  const roadmapPayload: RoadmapCreatedPayload = {
    startDate,
    deadline,
    weeks: 5,
    purpose: `Synthetic ${archetype} history`,
    selectedStudyDays: ['Mon', 'Wed', 'Fri', 'Sat'],
    weekdayHours: 1.5,
    weekendHours: 2,
    weeklyHours: 6.5,
    materialIds: [...materialIds],
  }
  events.push({
    kind: 'RoadmapCreated',
    payload: roadmapPayload as unknown as Record<string, unknown>,
    createdAt: roadmapCreatedAt,
  })

  const bookings: Array<{
    bookingId: string
    date: string
    estimatedDuration: number
    materialId: string
    weekIndex: number
  }> = []
  let walked = 0
  for (let cur = new Date(start); bookings.length < 20; cur = addDays(cur, 1)) {
    walked += 1
    if (walked > 366) {
      throw new Error('[synthSeed] no 20 study days within a year of startDate')
    }
    if (!STUDY_DAY_NUMS.has(cur.getDay())) continue
    const estimatedDuration = plannedMinutesForDate(cur)
    bookings.push({
      bookingId: uuid(),
      date: dateStr(cur),
      estimatedDuration,
      materialId: materialIds[bookings.length % materialIds.length],
      weekIndex: Math.max(0, Math.floor(localDayDiff(start, cur) / 7)),
    })
  }

  for (const b of bookings) {
    const payload: SessionBookedPayload = {
      roadmapCreatedAt,
      bookingId: b.bookingId,
      date: b.date,
      estimatedDuration: b.estimatedDuration,
      materialId: b.materialId,
    }
    events.push({
      kind: 'SessionBooked',
      payload: payload as unknown as Record<string, unknown>,
      createdAt: roadmapCreatedAt,
    })
  }

  const gapWeeks = new Set(params.gapWeeks ?? [])
  for (const b of bookings) {
    if (b.date >= todayStr) continue
    if (gapWeeks.has(b.weekIndex)) continue
    if (rand() < params.skipProbability) continue
    const pace = params.weeklyPace[b.weekIndex] ?? 1
    if (pace <= 0) continue
    const activeMinutes = Math.max(20, Math.round(b.estimatedDuration * pace))
    const material = materialById.get(b.materialId)
    if (!material) {
      throw new Error(`[synthSeed] unknown materialId on booking: ${b.materialId}`)
    }
    const slotDate = dateFromDateStr(b.date)
    const startedAt = new Date(slotDate)
    startedAt.setHours(9, randInt(0, 50), 0, 0)
    const endedAt = new Date(startedAt.getTime() + activeMinutes * 60_000)
    const payload: SessionLoggedPayload = {
      sessionId: uuid(),
      materialId: b.materialId,
      sessionTitle: material.title,
      slotDate: b.date,
      weekIndex: b.weekIndex,
      plannedMinutes: b.estimatedDuration,
      bookingId: b.bookingId,
      plannedSessionMinutes: b.estimatedDuration,
      materialConsumedMinutes: activeMinutes,
      startedAt: iso(startedAt),
      endedAt: iso(endedAt),
      activeMinutes,
      pauseCount: randInt(0, 2),
      totalPauseMinutes: randInt(0, 5),
      pomodorosCompleted: Math.floor(activeMinutes / 25),
      source: 'active',
      resolution: 'completed',
      duration: activeMinutes,
      description: material.title,
      date: b.date,
    }
    events.push({
      kind: 'SessionLogged',
      payload: payload as unknown as Record<string, unknown>,
      createdAt: iso(endedAt),
    })
  }

  for (let week = 0; week < 5; week += 1) {
    if (gapWeeks.has(week)) continue
    const weekBookings = bookings.filter((b) => b.weekIndex === week)
    if (weekBookings.length === 0) continue
    const anchorDateStr = weekBookings[weekBookings.length - 1].date
    if (anchorDateStr >= todayStr) continue
    const anchorDate = dateFromDateStr(anchorDateStr)
    const startedAt = new Date(anchorDate)
    startedAt.setHours(20, 0, 0, 0)
    const finishedAt = new Date(anchorDate)
    finishedAt.setHours(21, 0, 0, 0)
    const runId = uuid()
    const mode = RUN_MODES[week % RUN_MODES.length]
    const startedPayload: PracticeRunStartedPayload = {
      runId,
      materialIds: [...materialIds],
      mode,
      assessmentIds: [],
      count: 3,
    }
    const finishedPayload: PracticeRunFinishedPayload = {
      runId,
      outcome: 'completed',
    }
    events.push({
      kind: 'PracticeRunStarted',
      payload: startedPayload as unknown as Record<string, unknown>,
      createdAt: iso(startedAt),
    })
    events.push({
      kind: 'PracticeRunFinished',
      payload: finishedPayload as unknown as Record<string, unknown>,
      createdAt: iso(finishedAt),
    })
  }

  events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  return events
}

export function countAnalyzable(events: OmitId[]): { logged: number; runs: number; graded: number } {
  return {
    logged: events.filter((e) => e.kind === 'SessionLogged').length,
    runs: events.filter((e) => e.kind === 'PracticeRunFinished').length,
    graded: events.filter((e) => e.kind === 'QuestionGraded').length,
  }
}
