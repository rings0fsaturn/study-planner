import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEventStore } from '../events/useEventStore'
import { materialUsageLabels } from '../progress/mapEvents'

/** The roadmaps a library material currently feeds, derived from the event log. */
export function useMaterialUsage(materialId: string | undefined): string[] {
  const eventStore = useEventStore()
  const events = useLiveQuery(() => eventStore.getAll(), [eventStore])
  return useMemo(
    () => (events ? materialUsageLabels(events, materialId) : []),
    [events, materialId],
  )
}
