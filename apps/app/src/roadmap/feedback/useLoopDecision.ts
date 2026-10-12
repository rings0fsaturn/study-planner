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
const memo = new Map<string, Promise<LoopDecision | null>>()

/** Test-only reset for the session memo (each test owns its materials). */
export function __clearLoopDecisionMemo(): void {
  memo.clear()
}

/**
 * Build the canonical loop-decision input. Signals cover the observed
 * (material, skill) pairs the evidence trail shows, sorted for a stable
 * hash; the evidence summary is code-computed totals over those rows.
 * `days_span` is 0: projections carry no dates, and the server treats it
 * as an opaque count the model reads, never a computed span.
 */
export function buildLoopInput(
  projections: MasteryProjection[],
  evidence: FeedbackEvidence[],
  posture: LoopPosture,
  ids: { materialIds: string[]; materialTitles: string[] },
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
      days_span: 0,
    },
    posture,
  }
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000,
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
  },
): LoopDecision | null {
  const { state, projections, evidence, posture } = args
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
      buildLoopInput(projections, evidence, posture, {
        materialIds: sortedIds.map((pair) => pair.id),
        materialTitles: sortedIds.map((pair) => pair.title),
      }),
    [projections, evidence, posture, sortedIds],
  )
  const key = useMemo(() => {
    const versions = [...new Set(projections.map((projection) => projection.modelVersion))]
      .sort()
      .join('|')
    return hashLoopInput(input, versions)
  }, [input, projections])

  const [verdict, setVerdict] = useState<LoopDecision | null>(null)
  // Latest input for the keyed effect; the effect depends on the stable key
  // so a fresh array identity with identical content does not refire it.
  const inputRef = useRef(input)
  inputRef.current = input

  useEffect(() => {
    if (state !== 'updated') {
      setVerdict(null)
      return
    }
    let cancelled = false
    let pending = memo.get(key)
    if (!pending) {
      pending = client.getLoopDecision(inputRef.current).then(
        (decision) => (isLoopDecision(decision) ? decision : null),
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
  }, [client, key, state])

  return verdict
}
