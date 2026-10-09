import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type Dexie from 'dexie'
import type { Assessment } from '../assessments/types'
import type { LocalAttemptRow } from '../assessments/attemptFlow'
import { createAttemptFlow, type AttemptFlow } from '../assessments/attemptFlow'
import { useAssessmentClient } from '../assessments/AssessmentProvider'
import { useMaterialsClient } from '../materials/MaterialsProvider'
import { useEventStoreContext } from '../events/EventStoreProvider'
import { logger } from '../lib/logger'
import { mergeEnvelopes } from '../pages/practice/practiceRunModel'
import {
  buildAssessmentRow,
  buildPracticeRunRow,
  listAssessmentPointers,
  listPracticeRunEntries,
  orderAssessmentRows,
  splitRunRows,
  type AssessmentRow,
  type PracticeRunRow,
} from './libraryModel'

export const MATERIAL_UNAVAILABLE = 'Material unavailable'
/** Neutral title shown while the material list is still in flight; it asserts
 * nothing, unlike MATERIAL_UNAVAILABLE which is a resolved outcome. */
export const MATERIAL_TITLE_PENDING = 'Loading title…'

const HYDRATION_CONCURRENCY = 4
const POLL_INTERVAL_MS = 3000

async function pool<T>(ids: string[], fn: (id: string) => Promise<T>, concurrency: number): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency)
    const settled = await Promise.all(batch.map((id) => fn(id)))
    results.push(...settled)
  }
  return results
}

function dbOf(eventStore: unknown): Dexie | null {
  const db = (eventStore as unknown as { db?: Dexie }).db
  return db ?? null
}

/**
 * Cache-first seed: read the Dexie envelope cache and local attempts for the
 * requested ids before any network call, so reload paints from local state.
 * Read failures are advisory (a missing row is a cache miss, not an error).
 */
async function seedFromCache(
  ids: string[],
  flow: AttemptFlow,
): Promise<{
  envelopes: Record<string, Assessment>
  rows: Record<string, LocalAttemptRow[]>
}> {
  const envelopes: Record<string, Assessment> = {}
  const rows: Record<string, LocalAttemptRow[]> = {}
  await Promise.all(
    ids.map(async (id) => {
      try {
        const envelope = await flow.cachedAssessment(id)
        if (envelope) envelopes[id] = envelope
      } catch (error) {
        logger.debug('[library] cache read advisory', error)
      }
      try {
        rows[id] = await flow.listLocalAttempts(id)
      } catch (error) {
        logger.debug('[library] local attempts advisory', error)
        rows[id] = []
      }
    }),
  )
  return { envelopes, rows }
}

export function useLibraryCounts(options?: { materialId?: string }) {
  const { eventStore } = useEventStoreContext()
  const liveEvents = useLiveQuery(() => (eventStore ? eventStore.getAll() : []), [eventStore])
  const events = liveEvents ?? []
  const materialId = options?.materialId
  return useMemo(() => {
    const assessments = listAssessmentPointers(events, materialId ? { materialId } : undefined)
    const runs = listPracticeRunEntries(events, materialId ? { materialId } : undefined)
    return { assessmentCount: assessments.length, practiceCount: runs.length }
  }, [events, materialId])
}

export function useLibraryRows(options?: { materialId?: string }) {
  const materialId = options?.materialId
  const { eventStore } = useEventStoreContext()
  const assessments = useAssessmentClient()
  const materials = useMaterialsClient()

  const liveEvents = useLiveQuery(() => (eventStore ? eventStore.getAll() : []), [eventStore])
  const events = liveEvents ?? null
  const [envelopes, setEnvelopes] = useState<Record<string, Assessment>>({})
  const [rowsByAssessment, setRowsByAssessment] = useState<Record<string, LocalAttemptRow[]>>({})
  const [failedIds, setFailedIds] = useState<string[]>([])
  const [materialTitles, setMaterialTitles] = useState<Record<string, string>>({})
  const [hydrated, setHydrated] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Per-user attempt flow (PracticeRun precedent): recreated whenever the
  // event store (account) or transport changes, never reused across users.
  // Per-user view-model state resets in the same effect so a switch never
  // renders user A's envelopes under user B or writes into A's tables.
  const [flow, setFlow] = useState<AttemptFlow | null>(null)
  const [flowOwner, setFlowOwner] = useState<unknown>(null)
  useEffect(() => {
    setEnvelopes({})
    setRowsByAssessment({})
    setFailedIds([])
    setMaterialTitles({})
    setHydrated(false)
    setRefreshing(false)
    if (!eventStore) {
      setFlow(null)
      setFlowOwner(null)
      return
    }
    const db = dbOf(eventStore)
    if (!db) {
      setFlow(null)
      setFlowOwner(null)
      return
    }
    setFlow(createAttemptFlow({ db, eventStore, transport: assessments.transport }))
    setFlowOwner(eventStore)
  }, [eventStore, assessments])

  const pointers = useMemo(
    () => listAssessmentPointers(events ?? [], materialId ? { materialId } : undefined),
    [events, materialId],
  )
  const entries = useMemo(
    () => listPracticeRunEntries(events ?? [], materialId ? { materialId } : undefined),
    [events, materialId],
  )
  const uniqueIds = useMemo(() => {
    const ids = new Set<string>()
    for (const pointer of pointers) ids.add(pointer.assessmentId)
    for (const entry of entries) for (const id of entry.started.assessmentIds) ids.add(id)
    return [...ids]
  }, [pointers, entries])
  const uniqueKey = uniqueIds.join(',')

  const uniqueIdSet = useMemo(() => new Set(uniqueIds), [uniqueIds])
  // Failures that belong to a previous event snapshot (account switch pairs
  // the new flow with the old events for a tick) are hidden at render, so the
  // hub never shows a stale retry banner or retries ids it no longer lists.
  const visibleFailedIds = useMemo(
    () => failedIds.filter((id) => uniqueIdSet.has(id)),
    [failedIds, uniqueIdSet],
  )

  const hydrateEnvelopes = useCallback(
    async (
      ids: string[],
      activeFlow: AttemptFlow,
      getAssessment: (id: string) => Promise<Assessment>,
      cancelled: { current: boolean },
    ): Promise<{ loaded: Record<string, Assessment>; failed: string[] }> => {
      const loaded: Record<string, Assessment> = {}
      const failed: string[] = []
      await pool(
        ids,
        async (id) => {
          try {
            const envelope = await getAssessment(id)
            loaded[id] = envelope
            try {
              await activeFlow.cacheAssessment(envelope)
            } catch (error) {
              logger.debug('[library] cache write advisory', error)
            }
          } catch {
            let cached: Assessment | null = null
            try {
              cached = await activeFlow.cachedAssessment(id)
            } catch (error) {
              logger.debug('[library] cache read advisory', error)
            }
            if (cached) {
              loaded[id] = cached
            } else {
              failed.push(id)
            }
          }
        },
        HYDRATION_CONCURRENCY,
      )
      if (cancelled.current) return { loaded, failed }
      setEnvelopes((previous) => mergeEnvelopes(previous, loaded))
      const nextRows: Record<string, LocalAttemptRow[]> = {}
      await pool(
        ids,
        async (id) => {
          const envelope = loaded[id] ?? null
          if (envelope) {
            try {
              await activeFlow.refreshAttempts(envelope)
            } catch (error) {
              logger.debug('[library] attempt refresh advisory', error)
            }
          }
          try {
            nextRows[id] = await activeFlow.listLocalAttempts(id)
          } catch (error) {
            logger.debug('[library] local attempts advisory', error)
            nextRows[id] = []
          }
        },
        HYDRATION_CONCURRENCY,
      )
      if (cancelled.current) return { loaded, failed }
      setRowsByAssessment((previous) => ({ ...previous, ...nextRows }))
      return { loaded, failed }
    },
    [],
  )

  const hydrateTitles = useCallback(
    async (
      fetchTitles: () => Promise<Array<{ id: string; title: string }>>,
      assessmentPointers: Array<{ materialIds: string[] }>,
      runEntries: Array<{ started: { materialIds: string[] } }>,
      cancelled: { current: boolean },
    ): Promise<void> => {
      const referenced = new Set([
        ...assessmentPointers.flatMap((pointer) => pointer.materialIds),
        ...runEntries.flatMap((entry) => entry.started.materialIds),
      ])
      try {
        const list = await fetchTitles()
        if (cancelled.current) return
        const titles: Record<string, string> = {}
        for (const record of list) titles[record.id] = record.title
        for (const id of referenced) {
          if (!(id in titles)) titles[id] = MATERIAL_UNAVAILABLE
        }
        setMaterialTitles(titles)
      } catch (error) {
        logger.debug('[library] titles advisory', error)
        // A failed list is a resolved outcome for every referenced material:
        // terminate pending placeholders instead of leaving them loading.
        if (cancelled.current) return
        setMaterialTitles((previous) => {
          const next = { ...previous }
          for (const id of referenced) {
            if (!(id in next)) next[id] = MATERIAL_UNAVAILABLE
          }
          return next
        })
      }
    },
    [],
  )

  // Initial + event-driven hydration (owns titles and the failed set).
  // Stable string keys: liveQuery re-emits new array identities, so the
  // effect must not depend on the raw events array or it refetches in a loop.
  const pointersKey = JSON.stringify(pointers)
  const entriesKey = JSON.stringify(
    entries.map((entry) => [entry.started.runId, entry.finished?.outcome ?? '', entry.startedAt]),
  )
  const getAssessment = useCallback(
    (id: string) => assessments.getAssessment(id),
    [assessments],
  )
  const fetchTitles = useCallback(
    () => materials.listMaterials({ includeArchived: true }),
    [materials],
  )
  useEffect(() => {
    if (!eventStore || !flow || flowOwner !== eventStore || events == null) return
    const cancelled = { current: false }
    const ids = uniqueKey ? uniqueKey.split(',') : []
    const snapshotPointers = pointers
    const snapshotEntries = entries
    void (async () => {
      setRefreshing(true)
      try {
        // Cache-first: seed envelopes and local attempts from Dexie, paint if
        // anything was cached, then revalidate over the network in the
        // background. A cold cache keeps the skeleton until the first network
        // pass lands (nothing cached to show), preserving the honest states.
        const seeded = await seedFromCache(ids, flow)
        if (cancelled.current) return
        setEnvelopes((previous) => mergeEnvelopes(previous, seeded.envelopes))
        setRowsByAssessment((previous) => ({ ...previous, ...seeded.rows }))
        if (Object.keys(seeded.envelopes).length > 0) setHydrated(true)

        // Titles never gate first paint: they run beside envelope
        // revalidation and fill in (or fall back in the pages) whenever the
        // material list lands.
        const titles = hydrateTitles(fetchTitles, snapshotPointers, snapshotEntries, cancelled)
        const { failed } = await hydrateEnvelopes(ids, flow, getAssessment, cancelled)
        if (cancelled.current) return
        setFailedIds(failed)
        setHydrated(true)
        await titles
      } finally {
        if (!cancelled.current) setRefreshing(false)
      }
    })()
    return () => {
      cancelled.current = true
    }
    // pointers/entries intentionally omitted: pointersKey/entriesKey are their
    // content-derived stabilization (see comment above).
  }, [eventStore, flow, flowOwner, events == null, uniqueKey, pointersKey, entriesKey, getAssessment, fetchTitles, hydrateEnvelopes, hydrateTitles])

  // Reload retries only failed ids.
  const reload = useCallback(() => {
    if (!flow || flowOwner !== eventStore) return
    const cancelled = { current: false }
    const retried = [...visibleFailedIds]
    if (retried.length === 0) return
    void (async () => {
      const { failed } = await hydrateEnvelopes(retried, flow, getAssessment, cancelled)
      if (cancelled.current) return
      setFailedIds((previous) => [
        ...previous.filter((id) => !retried.includes(id)),
        ...failed,
      ])
    })()
  }, [flow, flowOwner, eventStore, visibleFailedIds, getAssessment, hydrateEnvelopes])

  // Poll only the generating / in-flight subset, never the whole union.
  // Never-loaded envelopes stay in the subset (the run model reads a missing
  // envelope as generating); ids in failedIds stay out until reload().
  const activeIds = useMemo(
    () =>
      uniqueIds.filter((id) => {
        const envelope = envelopes[id]
        if (!envelope) return !visibleFailedIds.includes(id)
        if (envelope.status === 'generating') return true
        const rows = rowsByAssessment[id]
        return rows?.some((row) => !row.grade && (row.status === 'queued' || row.status === 'submitted')) ?? false
      }),
    [uniqueIds, envelopes, rowsByAssessment, visibleFailedIds],
  )
  const activeKey = activeIds.join(',')
  const pollInFlight = useRef(false)
  useEffect(() => {
    if (!eventStore || !flow || flowOwner !== eventStore || activeKey === '') return
    const cancelled = { current: false }
    const ids = activeKey.split(',')
    const timer = setInterval(() => {
      if (pollInFlight.current) return
      pollInFlight.current = true
      void (async () => {
        try {
          const { failed } = await hydrateEnvelopes(ids, flow, getAssessment, cancelled)
          if (cancelled.current) return
          setFailedIds((previous) => {
            const surviving = previous.filter((id) => !ids.includes(id) || failed.includes(id))
            const added = failed.filter((id) => !surviving.includes(id))
            return [...surviving, ...added]
          })
        } finally {
          pollInFlight.current = false
        }
      })()
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled.current = true
      clearInterval(timer)
    }
  }, [eventStore, flow, flowOwner, activeKey, getAssessment, hydrateEnvelopes])

  const assessmentRows: AssessmentRow[] = useMemo(
    () =>
      orderAssessmentRows(
        pointers.map((pointer) =>
          buildAssessmentRow({
            pointer,
            assessment: envelopes[pointer.assessmentId] ?? null,
            attempts: rowsByAssessment[pointer.assessmentId] ?? [],
          }),
        ),
      ),
    [pointers, envelopes, rowsByAssessment],
  )
  const runRows: PracticeRunRow[] = useMemo(
    () =>
      entries
        .map((entry) =>
          buildPracticeRunRow({
            entry,
            assessments: entry.started.assessmentIds.map((id) => envelopes[id] ?? null),
            attemptsByAssessment: rowsByAssessment,
          }),
        )
        .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : a.runId.localeCompare(b.runId))),
    [entries, envelopes, rowsByAssessment],
  )
  const { resume, history } = useMemo(() => splitRunRows(runRows), [runRows])

  return {
    assessmentRows,
    runRows,
    resumeRows: resume,
    historyRows: history,
    materialTitles,
    loading: !eventStore || events == null || !hydrated,
    refreshing,
    errorCount: visibleFailedIds.length,
    failedIds: visibleFailedIds,
    reload,
  }
}
