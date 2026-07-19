import { useLiveQuery } from 'dexie-react-hooks'
import { useEventStore } from '../events/useEventStore'
import { computeProgress } from '@study-tracker/progress'
import type { ProgressSnapshot, CalibrationState } from '@study-tracker/progress'
import { mapSessions, findActiveRoadmap } from './mapEvents'

export function useProgressSnapshot(
  calibration: CalibrationState | null,
  referenceDate?: string,
): ProgressSnapshot | null {
  const eventStore = useEventStore()
  const today = referenceDate ?? new Date().toISOString().slice(0, 10)

  return (
    useLiveQuery(async () => {
      if (!calibration) return null
      const events = await eventStore.getAll()
      const roadmap = findActiveRoadmap(events)
      if (!roadmap) return null
      let sessions = mapSessions(events)
      if (referenceDate) {
        sessions = sessions.filter(s => s.date <= referenceDate)
      }
      return computeProgress(sessions, roadmap, calibration, today)
    }, [eventStore, calibration, today]) ?? null
  )
}
