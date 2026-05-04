import { useLiveQuery } from 'dexie-react-hooks'
import { useEventStore } from '../events/useEventStore'
import { computeCalibration } from '@study-tracker/progress'
import type { CalibrationState } from '@study-tracker/progress'
import { mapSessions, mapExceptionalTags, mapResolutions } from './mapEvents'

export function useCalibrationState(): CalibrationState | null {
  const eventStore = useEventStore()

  return (
    useLiveQuery(async () => {
      const events = await eventStore.getAll()
      const sessions = mapSessions(events)
      const exceptionalTags = mapExceptionalTags(events)
      const resolutions = mapResolutions(events)
      return computeCalibration(sessions, exceptionalTags, resolutions)
    }, [eventStore]) ?? null
  )
}
