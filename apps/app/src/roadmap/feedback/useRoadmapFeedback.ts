/**
 * Roadmap feedback data hook (#47).
 *
 * Local-first: the cached projection paints immediately, then a fresh
 * `GET /v1/mastery` decides whether the cache is stale. Rebuild adopts the
 * fresh server projection into the cache. Nothing here writes a booking or an
 * event; the band guidance is already advisory through `bandGuidanceByMaterial`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { recommendBand } from '@study-tracker/progress'
import type { DifficultyRecommendation, MasteryProjection } from '../../assessments/types'
import type { AssessmentClientLike } from '../../assessments/assessmentClient'
import { DEFAULT_BAND } from '../../assessments/masteryBands'
import { readMasteryProjections, saveMasteryProjections } from '../../assessments/masteryCache'
import type { EventStore } from '../../events/EventStore'
import { logger } from '../../lib/logger'
import { buildEvidence, projectionsEqual, selectHeadline } from './feedbackModel'
import type { FeedbackEvidence, FeedbackState } from './types'

/** Stable empty result so the pre-emission render does not change identity. */
const NO_PROJECTIONS: MasteryProjection[] = []

export interface RoadmapFeedback {
  state: FeedbackState
  /** Projections for the roadmap's materials, after the stale/rebuild rules. */
  projections: MasteryProjection[]
  headline: MasteryProjection | null
  recommendation: DifficultyRecommendation | null
  evidence: FeedbackEvidence[]
  rebuild: () => void
}

export function useRoadmapFeedback(
  eventStore: EventStore,
  client: AssessmentClientLike,
  materialIds: string[],
): RoadmapFeedback {
  // A stable key so a fresh array identity each render does not re-fetch.
  const materialKey = useMemo(() => [...materialIds].sort().join('|'), [materialIds])
  const idSet = useMemo(() => new Set(materialKey ? materialKey.split('|') : []), [materialKey])

  const cachedRows =
    useLiveQuery(() => readMasteryProjections(eventStore), [eventStore]) ?? NO_PROJECTIONS
  const cached = useMemo(
    () => cachedRows.filter((projection) => idSet.has(projection.materialId)),
    [cachedRows, idSet],
  )

  const [server, setServer] = useState<MasteryProjection[] | null>(null)
  const [rebuilding, setRebuilding] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const fetched = await client.getMastery()
        if (cancelled) return
        setServer(fetched.filter((projection) => idSet.has(projection.materialId)))
      } catch (error) {
        // Advisory: a failed fetch keeps the cached projection and never blocks.
        if (!cancelled) logger.warn('[roadmap-feedback] mastery fetch failed', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client, idSet, materialKey])

  const serverForMaterials = useMemo(
    () => (server ?? []).filter((projection) => idSet.has(projection.materialId)),
    [server, idSet],
  )

  const { state, active } = useMemo<{
    state: FeedbackState
    active: MasteryProjection[]
  }>(() => {
    if (rebuilding) {
      return {
        state: 'rebuilding',
        active: serverForMaterials.length > 0 ? serverForMaterials : cached,
      }
    }
    if (server !== null && !projectionsEqual(cached, serverForMaterials)) {
      // The local snapshot is behind the durable grades: keep showing what the
      // learner last saw and offer a rebuild.
      if (cached.some((projection) => projection.n > 0)) {
        return { state: 'stale', active: cached }
      }
      // Nothing cached to be stale against: adopt the server projection.
      const adopted = serverForMaterials.some((projection) => projection.n > 0)
      return { state: adopted ? 'updated' : 'cold', active: serverForMaterials }
    }
    const resolved = server !== null ? serverForMaterials : cached
    return {
      state: resolved.some((projection) => projection.n > 0) ? 'updated' : 'cold',
      active: resolved,
    }
  }, [rebuilding, server, serverForMaterials, cached])

  const rebuild = useCallback(() => {
    setRebuilding(true)
    void (async () => {
      try {
        const fetched = await client.getMastery()
        const filtered = fetched.filter((projection) => idSet.has(projection.materialId))
        await saveMasteryProjections(eventStore, filtered)
        setServer(filtered)
      } catch (error) {
        logger.warn('[roadmap-feedback] rebuild failed', error)
      } finally {
        setRebuilding(false)
      }
    })()
  }, [client, eventStore, idSet])

  const headline = useMemo(() => selectHeadline(active), [active])
  const recommendation = useMemo(
    () => (headline ? recommendBand(headline, DEFAULT_BAND) : null),
    [headline],
  )
  const evidence = useMemo(
    () => buildEvidence(active, recommendation?.targetExpectedCorrectness ?? 0.7),
    [active, recommendation],
  )

  return {
    state,
    projections: active,
    headline,
    recommendation,
    evidence,
    rebuild,
  }
}
