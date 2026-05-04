import { useLiveQuery } from 'dexie-react-hooks'
import { useEventStore } from '../events/useEventStore'
import {
  computeCalibration,
  getPromptDetail,
  detectRegimeShifts,
} from '@study-tracker/progress'
import type { PromptDetail } from '@study-tracker/progress'
import {
  mapSessions,
  mapExceptionalTags,
  mapResolutions,
} from './mapEvents'

export function usePromptDetail(): PromptDetail | null {
  const eventStore = useEventStore()

  return (
    useLiveQuery(async () => {
      const events = await eventStore.getAll()
      const sessions = mapSessions(events)
      const tags = mapExceptionalTags(events)
      const resolutions = mapResolutions(events)

      const calibration = computeCalibration(sessions, tags, resolutions)
      if (!calibration.promptNeeded) return null

      const exceptionalIds = new Set<string>()
      for (const tag of tags) {
        if (tag.exceptional) exceptionalIds.add(tag.sessionId)
        else exceptionalIds.delete(tag.sessionId)
      }

      const cusumResult = detectRegimeShifts(
        sessions,
        exceptionalIds,
        calibration.globalPosterior.mean,
        resolutions,
      )

      return getPromptDetail(sessions, cusumResult.breakpoints)
    }, [eventStore]) ?? null
  )
}
