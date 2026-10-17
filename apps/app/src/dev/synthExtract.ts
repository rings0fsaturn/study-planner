import type { Event } from '../events/EventStore'
import { DEFAULT_PARAMS, projectMastery } from '@study-tracker/progress'
import { findRoadmap, mapBookings, mapSessions } from '../progress/mapEvents'

export interface TraceableRow {
  traceIds: string[]
}

export function collectTraceIds(events: Event[]): Set<string> {
  const ids = new Set<string>()
  for (const event of events) {
    // createdAt is an anchor: SessionBooked.roadmapCreatedAt and the
    // RoadmapReplanned back-pointer are creation timestamps by construction.
    ids.add(event.createdAt)
    collectStrings(event.payload, ids)
  }
  return ids
}

function collectStrings(value: unknown, ids: Set<string>): void {
  if (typeof value === 'string') {
    ids.add(value)
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, ids)
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const entry of Object.values(value as Record<string, unknown>)) collectStrings(entry, ids)
  }
}

export function assertTraceable(rows: TraceableRow[], evidence: Event[] | Set<string>): void {
  const known = Array.isArray(evidence) ? collectTraceIds(evidence) : evidence
  for (const row of rows) {
    if (row.traceIds.length === 0) {
      throw new Error('[synthExtract] row references nothing and is not traceable')
    }
    for (const id of row.traceIds) {
      if (!known.has(id)) {
        throw new Error(`[synthExtract] id is not traceable to evidence: ${id}`)
      }
    }
  }
}

export interface AdherenceRow extends TraceableRow {
  user: string
  week: number
  planned: number
  actual: number
  rate: number
}

function weekIndexForDate(startDate: string, date: string): number {
  const ms = Date.parse(`${date}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)
  if (Number.isNaN(ms)) {
    throw new Error(`[synthExtract] invalid session date: ${date}`)
  }
  // Agreement invariant: UTC-noon diff here matches the UTC-midnight dayDiff/7
  // behind slot weekIndexes (mapEvents slotFromBooking) on date-only strings;
  // the fallback only fires for sessions on unbooked dates.
  return Math.max(0, Math.floor(ms / 604_800_000))
}

export function adherenceTable(user: string, events: Event[]): AdherenceRow[] {
  // Planned-week scope: only weeks with booked slots emit rows; sessions on
  // unbooked dates join their date's week, sessions outside all planned weeks
  // are excluded from the totals. Single-roadmap precondition: bookings read
  // from the first RoadmapCreated, the plan from the latest Created/Replanned
  // (identical bookings for synth; multi-roadmap histories belong to
  // deriveRoadmapLifecycle, not this module).
  const roadmap = findRoadmap(events)
  if (!roadmap) return []
  const weekByDate = new Map(roadmap.slots.map((slot) => [slot.date, slot.weekIndex]))
  const plannedByWeek = new Map<number, number>()
  for (const slot of roadmap.slots) {
    plannedByWeek.set(slot.weekIndex, (plannedByWeek.get(slot.weekIndex) ?? 0) + slot.plannedMinutes)
  }
  const createdAt = events.find((e) => e.kind === 'RoadmapCreated')?.createdAt
  const bookings = createdAt ? mapBookings(events, createdAt) : []
  const weekByBooking = new Map(
    bookings.map((booking) => [
      booking.id,
      weekByDate.get(booking.date) ?? weekIndexForDate(roadmap.startDate, booking.date),
    ]),
  )
  const actualByWeek = new Map<number, number>()
  const traceByWeek = new Map<number, Set<string>>()
  const trace = (week: number, id: string | undefined): void => {
    if (!id) return
    const set = traceByWeek.get(week) ?? new Set<string>()
    set.add(id)
    traceByWeek.set(week, set)
  }
  for (const [bookingId, week] of weekByBooking) trace(week, bookingId)
  for (const session of mapSessions(events)) {
    const week =
      (session.bookingId ? weekByBooking.get(session.bookingId) : undefined) ??
      weekByDate.get(session.date) ??
      weekIndexForDate(roadmap.startDate, session.date)
    actualByWeek.set(week, (actualByWeek.get(week) ?? 0) + (session.activeMinutes ?? session.duration))
    trace(week, session.sessionId)
  }
  return [...plannedByWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, planned]) => {
      const actual = actualByWeek.get(week) ?? 0
      return {
        user,
        week,
        planned,
        actual,
        rate: planned > 0 ? actual / planned : 0,
        traceIds: [...(traceByWeek.get(week) ?? [])],
      }
    })
}

export interface GradedObservation {
  attemptId: string
  correct: boolean
  score?: number
}

export interface MasteryRow extends TraceableRow {
  user: string
  materialId: string
  before: number
  after: number
  delta: number
  n: number
}

export function masteryTable(
  user: string,
  materialId: string,
  observations: GradedObservation[],
): MasteryRow[] {
  // before is always the cold-start DEFAULT_PARAMS.pInit and delta is
  // after - before: callers needing week-over-week movement slice observations
  // per window themselves, since stacked per-call deltas are not additive.
  if (observations.length === 0) return []
  const projection = projectMastery(
    materialId,
    observations.map((o) => ({ skillTag: materialId, correct: o.correct, score: o.score })),
  )
  const before = DEFAULT_PARAMS.pInit
  return [
    {
      user,
      materialId,
      before,
      after: projection.mastery,
      delta: projection.mastery - before,
      n: projection.n,
      traceIds: observations.map((o) => o.attemptId),
    },
  ]
}

export type LoopVerdict = 'hold' | 'reprioritize' | 'suggest_replan'

export interface VerdictRow extends TraceableRow {
  user: string
  verdict: LoopVerdict
  converted: boolean
}

export function verdictTable(
  entries: Array<{ user: string; verdict: LoopVerdict }>,
  eventsByUser: Record<string, Event[]>,
): VerdictRow[] {
  // One verdict per user; order between verdict and replan is assumed, not checked.
  return entries.map(({ user, verdict }) => {
    const events = eventsByUser[user] ?? []
    const roadmapCreatedAt = events.find((e) => e.kind === 'RoadmapCreated')?.createdAt
    if (!roadmapCreatedAt) {
      throw new Error(`[synthExtract] no roadmap for verdict user: ${user}`)
    }
    const replannedAt = events.find((e) => e.kind === 'RoadmapReplanned')?.createdAt
    const converted = verdict === 'suggest_replan' && replannedAt !== undefined
    return {
      user,
      verdict,
      converted,
      traceIds: replannedAt && converted ? [roadmapCreatedAt, replannedAt] : [roadmapCreatedAt],
    }
  })
}
