import { useCallback, useEffect, useState } from 'react'
import { useMaterialsClient } from './MaterialsProvider'
import type { MaterialClientLike } from './materialClient'
import type { MaterialRecord } from './types'

export interface MaterialLibraryState {
  materials: MaterialRecord[] | null
  status: 'loading' | 'ready' | 'error'
  error: string | null
  reload: () => Promise<void>
  setMaterials: (updater: (current: MaterialRecord[]) => MaterialRecord[]) => void
}

export function useMaterialLibrary(options: { includeArchived?: boolean } = {}): MaterialLibraryState {
  const client: MaterialClientLike = useMaterialsClient()
  const [materials, setMaterials] = useState<MaterialRecord[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
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

  return {
    materials,
    status,
    error,
    reload,
    setMaterials: (updater) =>
      setMaterials((current) => (current ? updater(current) : current)),
  }
}
