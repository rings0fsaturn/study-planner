import { useLiveQuery } from 'dexie-react-hooks'
import { useEventStore } from '../events/useEventStore'
import { getPromptDetail } from '@study-tracker/progress'
import type { PromptDetail, CalibrationState } from '@study-tracker/progress'
import { mapSessions } from './mapEvents'

export function usePromptDetail(
  calibration: CalibrationState | null,
): PromptDetail | null {
  const eventStore = useEventStore()

  return (
    useLiveQuery(async () => {
      if (!calibration?.promptNeeded) return null
      const events = await eventStore.getAll()
      const sessions = mapSessions(events)
      const breakpoints = calibration.trend.phases
        .slice(1)
        .map((p) => p.startSessionIndex - 1)
      return getPromptDetail(sessions, breakpoints)
    }, [eventStore, calibration]) ?? null
  )
}
