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
      try {
        const list = await fetchTitles()
        if (cancelled.current) return
        const titles: Record<string, string> = {}
        for (const record of list) titles[record.id] = record.title
        const referenced = new Set([
          ...assessmentPointers.flatMap((pointer) => pointer.materialIds),
          ...runEntries.flatMap((entry) => entry.started.materialIds),
        ])
        for (const id of referenced) {
          if (!(id in titles)) titles[id] = MATERIAL_UNAVAILABLE
        }
        setMaterialTitles(titles)
      } catch (error) {
        logger.debug('[library] titles advisory', error)
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
      const { failed } = await hydrateEnvelopes(ids, flow, getAssessment, cancelled)
      if (cancelled.current) return
      setFailedIds(failed)
      await hydrateTitles(fetchTitles, snapshotPointers, snapshotEntries, cancelled)
      if (!cancelled.current) setHydrated(true)
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
    const retried = [...failedIds]
    if (retried.length === 0) return
    void (async () => {
      const { failed } = await hydrateEnvelopes(retried, flow, getAssessment, cancelled)
      if (cancelled.current) return
      setFailedIds((previous) => [
        ...previous.filter((id) => !retried.includes(id)),
        ...failed,
      ])
    })()
  }, [flow, flowOwner, eventStore, failedIds, getAssessment, hydrateEnvelopes])

  // Poll only the generating / in-flight subset, never the whole union.
  // Never-loaded envelopes stay in the subset (the run model reads a missing
  // envelope as generating); ids in failedIds stay out until reload().
  const activeIds = useMemo(
    () =>
      uniqueIds.filter((id) => {
        const envelope = envelopes[id]
        if (!envelope) return !failedIds.includes(id)
        if (envelope.status === 'generating') return true
        const rows = rowsByAssessment[id]
        return rows?.some((row) => !row.grade && (row.status === 'queued' || row.status === 'submitted')) ?? false
      }),
    [uniqueIds, envelopes, rowsByAssessment, failedIds],
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
    errorCount: failedIds.length,
    failedIds,
    reload,
  }
}
