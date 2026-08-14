import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useMaterialsClient } from './MaterialsProvider'
import { subscribeMaterialStatus, type MaterialStatusUpdate } from './ingestionSubscription'
import type { MaterialClientLike } from './materialClient'
import type { MaterialRecord } from './types'

const POLL_FALLBACK_MS = 15_000

export interface MaterialLibraryState {
  materials: MaterialRecord[] | null
  status: 'loading' | 'ready' | 'error'
  error: string | null
  live: boolean
  reload: () => Promise<void>
  setMaterials: (updater: (current: MaterialRecord[]) => MaterialRecord[]) => void
}

function applyUpdate(
  current: MaterialRecord[],
  update: MaterialStatusUpdate,
  includeArchived: boolean,
): MaterialRecord[] {
  let next = current
  for (const removed of update.removed) {
    next = next.filter((material) => material.id !== removed)
  }
  for (const upsert of update.upserts) {
    if (!includeArchived && upsert.archived) {
      // An archived row has no place in the non-archived library: drop it
      // rather than leaving a stale copy visible.
      next = next.filter((material) => material.id !== upsert.id)
      continue
    }
    const index = next.findIndex((material) => material.id === upsert.id)
    if (index === -1) next = [upsert, ...next]
    else next = next.map((material) => (material.id === upsert.id ? upsert : material))
  }
  return next
}

export function useMaterialLibrary(options: { includeArchived?: boolean } = {}): MaterialLibraryState {
  const client: MaterialClientLike = useMaterialsClient()
  const [materials, setMaterials] = useState<MaterialRecord[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const includeArchived = options.includeArchived ?? false

  const reload = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const list = await client.listMaterials({ includeArchived })
      setMaterials(list)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials')
      setStatus('error')
    }
  }, [client, includeArchived])

  useEffect(() => {
    void reload()
  }, [reload])

  // Realtime progress with bounded polling fallback: when the subscription is
  // not connected, refresh periodically so a stale UI cannot persist.
  useEffect(() => {
    const unsubscribe = subscribeMaterialStatus(
      supabase as never,
      (update) =>
        setMaterials((current) =>
          current ? applyUpdate(current, update, includeArchived) : current,
        ),
      (channelStatus) => setLive(channelStatus === 'SUBSCRIBED'),
    )
    return unsubscribe
  }, [includeArchived])

  useEffect(() => {
    if (live) return
    const timer = setInterval(() => {
      void reload()
    }, POLL_FALLBACK_MS)
    return () => clearInterval(timer)
  }, [live, reload])

  return {
    materials,
    status,
    error,
    live,
    reload,
    setMaterials: (updater) =>
      setMaterials((current) => (current ? updater(current) : current)),
  }
}
