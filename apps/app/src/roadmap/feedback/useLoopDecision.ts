/**
 * Closed-loop verdict hook (#49 Slice 2).
 *
 * Fires `POST /v1/loop/decision` on entering the `updated` feedback state
 * only (cold/stale/rebuilding stay static, no call); the stale-to-updated
 * transition after Rebuild refires without a remount because the effect
 * subscribes to the state, not the mount.
 *
 * This file owns the loop input-builder: the pure `buildLoopInput`
 * returns the canonical Jev state (signals + code-computed evidence
 * totals + posture), and the session memo hashes exactly that object plus
 * the projection modelVersion. Failures resolve to null so the static
 * copy renders; the hook never throws and failed calls are never cached.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Event } from '../../events/EventStore'
import type { AssessmentClientLike } from '../../assessments/assessmentClient'
import type {
  LoopDecision,
  LoopDecisionInput,
  LoopPosture,
  MasteryProjection,
} from '../../assessments/types'
import { logger } from '../../lib/logger'
import type { FeedbackEvidence, FeedbackState } from './types'

/** Mirrors the server ceiling caps so one client envelope stays bounded. */
const MAX_SIGNALS = 200
const MAX_MATERIALS = 50
/** Per-string ceilings mirror the server prompt bounds (untrusted data). */
const TITLE_MAX_CHARS = 200
const SKILL_MAX_CHARS = 120
/** Session memo stays small: distinct inputs accumulate, failures never do. */
const MEMO_MAX_ENTRIES = 50

const VERDICTS = ['hold', 'reprioritize', 'suggest_replan'] as const

/** Session memo: canonical-input hash to the in-flight or settled verdict. */
const memo = new Map<string, Promise<DecidedLoopVerdict | null>>()

/**
 * A settled loop verdict: the server decision plus client-side identity.
 * `verdictId` is the canonical-input hash and `decidedAt` the settle time;
 * together they are the D-04 join/ordering keys a replan mirrors.
 */
export interface DecidedLoopVerdict extends LoopDecision {
  verdictId: string
  decidedAt: string
}

/** Test-only reset for the session memo (each test owns its materials). */
export function __clearLoopDecisionMemo(): void {
  memo.clear()
}

/**
 * The durable study dates behind the observed signals: `SessionLogged` events
 * scoped to the roadmap's materials by `payload.materialId`, using the
 * always-present `payload.date` (the learner's calendar day). Grade timestamps
 * are capture times, not engagement dates, so a run that grades a multi-week
 * history in one sitting must not read as a single sitting. Unlinked manual
 * logs carry no material-scoped evidence and are dropped; a missing source
 * degrades to an empty list, and `days_span` then stays 0 (fail-closed,
 * never fabricated).
 */
export function observedSessionDates(events: Event[], materialIds: string[]): string[] {
  const ids = new Set(materialIds)
  const dates: string[] = []
  for (const event of events) {
    if (event.kind !== 'SessionLogged') continue
    const materialId = event.payload.materialId
    if (typeof materialId !== 'string' || !ids.has(materialId)) continue
    const date = event.payload.date
    if (typeof date !== 'string' || date.length === 0) continue
    dates.push(date)
  }
  return dates
}

/**
 * Keep the live query's previous result from leaking into a new roadmap:
 * `useLiveQuery` can serve the old value while the next query is in flight,
 * so a date list tagged with a different material key is treated as not yet
 * loaded (the hook holds instead of posting a stale span).
 */
export function currentSessionDates(
  result: { key: string; dates: string[] } | undefined,
  materialKey: string,
): string[] | undefined {
  return result?.key === materialKey ? result.dates : undefined
}

/**
 * Build the canonical loop-decision input. Signals cover the observed
 * (material, skill) pairs the evidence trail shows, sorted for a stable
 * hash; the evidence summary is code-computed totals over those rows.
 * `observedDates` are the durable session dates behind the material-scoped
 * signals (see `observedSessionDates`); `days_span` is their calendar-day
 * spread, so a multi-week history reads as spread across days, a single
 * sitting as 0.
 */
export function buildLoopInput(
  projections: MasteryProjection[],
  evidence: FeedbackEvidence[],
  posture: LoopPosture,
  ids: { materialIds: string[]; materialTitles: string[] },
  observedDates: string[] = [],
): LoopDecisionInput {
  const observed = new Set(
    evidence.map(
      (row) => `${row.materialId}\u0000${row.skillTag.trim().toLowerCase()}`,
    ),
  )
  const signals = projections
    .filter(
      (projection) =>
        projection.n > 0 &&
        observed.has(
          `${projection.materialId}\u0000${projection.skillTag.trim().toLowerCase()}`,
        ),
    )
    .sort(
      (a, b) =>
        a.materialId.localeCompare(b.materialId) || a.skillTag.localeCompare(b.skillTag),
    )
    .slice(0, MAX_SIGNALS)
    .map((projection) => ({
      material: projection.materialId,
      skill: projection.skillTag.trim().slice(0, SKILL_MAX_CHARS),
      mastery: projection.mastery,
      confidence: projection.confidence,
      observations: projection.n,
      trend: projection.recentTrend ?? 0,
    }))
  const counts = signals.map((signal) => signal.observations)
  return {
    materialIds: ids.materialIds.slice(0, MAX_MATERIALS),
    materialTitles: ids.materialTitles
      .map((title) => title.slice(0, TITLE_MAX_CHARS))
      .slice(0, MAX_MATERIALS),
    signals,
    evidence_summary: {
      total_attempts: counts.reduce((sum, n) => sum + n, 0),
      skills_observed: signals.length,
      min_obs_per_skill: counts.length > 0 ? Math.min(...counts) : 0,
      max_obs_per_skill: counts.length > 0 ? Math.max(...counts) : 0,
      days_span: observedSpanDays(observedDates),
    },
    posture,
  }
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * One strict `YYYY-MM-DD` day, or null when the value is not a real calendar
 * day. `Date.parse` alone is too lenient ('2026' becomes Jan 1, '2026-02-30'
 * rolls to Mar 2), and a rolled day would fabricate a span.
 */
function parseDay(value: string): string | null {
  const day = value.slice(0, 10)
  if (!DAY_PATTERN.test(day)) return null
  const parsed = Date.parse(`${day}T00:00:00.000Z`)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 10) === day ? day : null
}

/**
 * Calendar-day spread of the observed session dates (date-only discipline,
 * the same as `buildLoopPosture`'s `daysBetween`). Malformed dates are
 * dropped; a single sitting (fewer than two days) yields 0.
 */
function observedSpanDays(dates: string[]): number {
  const days = dates
    .filter((date): date is string => typeof date === 'string')
    .map(parseDay)
    .filter((day): day is string => day !== null)
    .sort()
  if (days.length < 2) return 0
  return clampDays(daysBetween(days[0], days[days.length - 1]))
}

function daysBetween(from: string, to: string): number {
  // Calendar-day diff: inputs may be date-only or datetime-shaped, so compare
  // the first 10 chars (YYYY-MM-DD), never a raw datetime string.
  return Math.round(
    (Date.parse(`${to.slice(0, 10)}T00:00:00.000Z`) -
      Date.parse(`${from.slice(0, 10)}T00:00:00.000Z`)) /
      86_400_000,
  )
}

/** Finite, non-negative day counts; malformed dates degrade to neutral 0. */
function clampDays(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

/**
 * Derive the schedule posture from values the roadmap page already holds:
 * the roadmap payload (deadline, weekly hours) and the progress snapshot
 * (projected finish, this-week minutes). Unknown projection stays neutral
 * (behind 0, pace 1) so the verdict degrades to mastery-only, never to noise.
 */
export function buildLoopPosture(args: {
  deadline: string | null
  today: string
  weeklyHours: number
  projectedFinish: string | null
  minutesThisWeek: number
  plannedMinutesThisWeek: number
}): LoopPosture {
  const pace =
    args.plannedMinutesThisWeek > 0
      ? args.minutesThisWeek / args.plannedMinutesThisWeek
      : 1
  return {
    behind_days:
      args.projectedFinish && args.deadline
        ? clampDays(daysBetween(args.deadline, args.projectedFinish))
        : 0,
    days_left: args.deadline ? clampDays(daysBetween(args.today, args.deadline)) : 0,
    pace_vs_plan: Number.isFinite(pace) ? Math.min(5, Math.max(0, pace)) : 1,
    capacity_hours_per_week: clampDays(args.weeklyHours),
  }
}

/** Stable session-memo key over the exact input plus the model version. */
function hashLoopInput(input: LoopDecisionInput, modelVersion: string): string {
  const text = `${JSON.stringify(input)}\u0000${modelVersion}`
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

function isLoopDecision(value: unknown): value is LoopDecision {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    (VERDICTS as readonly string[]).includes(record.verdict as string) &&
    typeof record.choice === 'string' &&
    Number.isFinite(record.confidence) &&
    Number.isFinite(record.sufficiency) &&
    typeof record.model === 'string'
  )
}

export function useLoopDecision(
  client: AssessmentClientLike,
  args: {
    materialIds: string[]
    materialTitles: string[]
    state: FeedbackState
    projections: MasteryProjection[]
    evidence: FeedbackEvidence[]
    posture: LoopPosture
    /**
     * Durable session dates behind the observed signals (see
     * `observedSessionDates`). `undefined` means the local events are not
     * loaded yet, so the hook holds the call instead of firing a span-0
     * verdict; an empty list is a loaded source with no material-scoped
     * sessions.
     */
    observedDates?: string[]
    /**
     * Which posture fed this call: `real` from the page's roadmap and progress
     * values, or `neutral` because the projection is genuinely unknown. Recorded
     * per fired call so a captured verdict names its posture source (D-03).
     */
    postureSource?: 'real' | 'neutral'
  },
): DecidedLoopVerdict | null {
  const {
    state,
    projections,
    evidence,
    posture,
    observedDates,
    postureSource = 'neutral',
  } = args
  // Ids and titles arrive positionally aligned (roadmap payload order); sort
  // the pairs together so the canonical order never breaks the pairing and
  // no title can smuggle an extra entry through a join/split round-trip.
  const sortedIds = useMemo(() => {
    const pairs = args.materialIds.map((id, index) => ({
      id,
      title: args.materialTitles[index] ?? '',
    }))
    pairs.sort((a, b) => a.id.localeCompare(b.id))
    return pairs
  }, [args.materialIds, args.materialTitles])
  const input = useMemo(
    () =>
      buildLoopInput(
        projections,
        evidence,
        posture,
        {
          materialIds: sortedIds.map((pair) => pair.id),
          materialTitles: sortedIds.map((pair) => pair.title),
        },
        observedDates,
      ),
    [projections, evidence, posture, sortedIds, observedDates],
  )
  const key = useMemo(() => {
    const versions = [...new Set(projections.map((projection) => projection.modelVersion))]
      .sort()
      .join('|')
    return hashLoopInput(input, versions)
  }, [input, projections])

  const [verdict, setVerdict] = useState<DecidedLoopVerdict | null>(null)
  // Latest input for the keyed effect; the effect depends on the stable key
  // so a fresh array identity with identical content does not refire it.
  const inputRef = useRef(input)
  inputRef.current = input

  useEffect(() => {
    if (state !== 'updated' || observedDates === undefined) {
      setVerdict(null)
      return
    }
    let cancelled = false
    let pending = memo.get(key)
    if (!pending) {
      // Memo misses are the only real calls (a memo hit fires nothing), so
      // this line names the posture source behind exactly one POST.
      const fired = inputRef.current
      logger.info(
        `[roadmap-feedback] loop decision firing posture=${postureSource} days_span=${fired.evidence_summary.days_span}`,
      )
      pending = client.getLoopDecision(fired).then(
        (decision) => {
          if (!isLoopDecision(decision)) return null
          const decidedAt = new Date().toISOString()
          // The settled line names the join id and decision time a replan
          // mirrors, so the report capture can build an exact-pair entry (D-04).
          logger.info(
            `[roadmap-feedback] loop decision settled verdict=${decision.verdict} id=${key} decided_at=${decidedAt}`,
          )
          return { ...decision, verdictId: key, decidedAt }
        },
        (error) => {
          // Advisory: a failed verdict keeps the static copy and is never
          // cached, so the next updated entry retries.
          memo.delete(key)
          const requestId = (error as { requestId?: unknown } | null)?.requestId
          logger.warn(
            `[roadmap-feedback] loop decision failed, staying static requestId=${
              typeof requestId === 'string' ? requestId : 'none'
            }`,
            error,
          )
          return null
        },
      )
      if (memo.size >= MEMO_MAX_ENTRIES) {
        const oldest = memo.keys().next()
        if (!oldest.done) memo.delete(oldest.value)
      }
      memo.set(key, pending)
    }
    void pending.then((next) => {
      if (!cancelled) setVerdict(next)
    })
    return () => {
      cancelled = true
    }
  }, [client, key, state, postureSource, observedDates])

  return verdict
}
