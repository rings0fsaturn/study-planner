import { useLiveQuery } from 'dexie-react-hooks'
import { useEventStore } from '../events/useEventStore'
import { computeProgress } from '@study-tracker/progress'
import type { ProgressSnapshot, CalibrationState } from '@study-tracker/progress'
import { mapSessions, findRoadmap } from './mapEvents'

export function useProgressSnapshot(
  calibration: CalibrationState | null,
): ProgressSnapshot | null {
  const eventStore = useEventStore()
  const today = new Date().toISOString().slice(0, 10)

  return (
    useLiveQuery(async () => {
      if (!calibration) return null
      const events = await eventStore.getAll()
      const roadmap = findRoadmap(events)
      if (!roadmap) return null
      const sessions = mapSessions(events)
      return computeProgress(sessions, roadmap, calibration, today)
    }, [eventStore, calibration, today]) ?? null
  )
}
