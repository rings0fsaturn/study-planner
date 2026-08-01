import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Event } from '../events/EventStore'
import { useEventStore } from '../events/useEventStore'
import { deriveRoadmapLifecycle, type RoadmapLifecycleEntry } from './roadmapLifecycle'

export interface RoadmapEndedState {
  ended: boolean
  entry: RoadmapLifecycleEntry | null
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function deriveRoadmapEndedState(
  events: Event[],
  today: string = todayISO(),
): RoadmapEndedState {
  const entry = deriveRoadmapLifecycle(events).active[0] ?? null
  if (!entry) return { ended: false, entry: null }

  return {
    ended: entry.deadline < today,
    entry,
  }
}

export function useRoadmapEndedState(): RoadmapEndedState {
  const eventStore = useEventStore()
  const events = useLiveQuery(() => eventStore.getAll(), [eventStore])

  return useMemo(
    () => deriveRoadmapEndedState(events ?? []),
    [events],
  )
}
