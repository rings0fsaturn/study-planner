import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEventStore } from '../events/useEventStore'
import type { CalibrationState } from '@study-tracker/progress'
import { getUpNextSlot } from '../events/ProgressEngine'
import { CalibrationAuthError, postCalibration } from '../lib/intelligenceClient'
import { mapSessions, mapExceptionalTags, mapResolutions, findActiveRoadmap } from './mapEvents'

export type CalibrationStatus = 'loading' | 'ready' | 'stale' | 'auth-error' | 'error'

export interface CalibrationResult {
  calibration: CalibrationState | null
  status: CalibrationStatus
}

interface CalibrationCacheRow {
  key: string
  state: CalibrationState
  updatedAt: number
}

export function useCalibrationState(): CalibrationResult {
  const eventStore = useEventStore()
  const request = useLiveQuery(async () => {
    const events = await eventStore.getAll()
    const sessions = mapSessions(events)
    const roadmap = findActiveRoadmap(events)
    const today = new Date().toISOString().split('T')[0]
    const upNext = roadmap ? getUpNextSlot(roadmap, today) : null
    const sessionIndex = roadmap && upNext ? roadmap.slots.indexOf(upNext) : -1

    return {
      sessions,
      exceptionalTags: mapExceptionalTags(events),
      resolutions: mapResolutions(events),
      nextContext:
        roadmap && upNext
          ? {
              date: upNext.date,
              startedAt: upNext.date,
              materialRole: upNext.role,
              session_index: sessionIndex >= 0 ? sessionIndex : undefined,
              planned_horizon: {
                deadline: roadmap.deadline,
                planned_total_sessions: roadmap.slots.length,
              },
            }
          : null,
    }
  }, [eventStore])
  const requestKey = useMemo(() => JSON.stringify(request ?? null), [request])
  const [result, setResult] = useState<CalibrationResult>({
    calibration: null,
    status: 'loading',
  })

  useEffect(() => {
    if (!request) return
    let cancelled = false
    setResult((previous) => ({
      calibration: previous.calibration,
      status: 'loading',
    }))
    postCalibration(request)
      .then(async (response) => {
        if (cancelled) return
        const state = response as CalibrationState
        await eventStore.table('calibrationCache').put({
          key: 'last',
          state,
          updatedAt: Date.now(),
        } satisfies CalibrationCacheRow)
        if (!cancelled) {
          setResult({
            calibration: state,
            status: 'ready',
          })
        }
      })
      .catch(async (error) => {
        if (cancelled) return
        const cached = (await eventStore.table('calibrationCache').get('last')) as
          | CalibrationCacheRow
          | undefined
        if (cancelled) return
        if (cached?.state) {
          setResult({
            calibration: cached.state,
            status: 'stale',
          })
          return
        }
        setResult({
          calibration: null,
          status: error instanceof CalibrationAuthError ? 'auth-error' : 'error',
        })
      })
    return () => {
      cancelled = true
    }
  }, [requestKey])

  return result
}
