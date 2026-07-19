import { type ReactNode, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useEventStore } from '../events/useEventStore'
import { useLiveQuery } from 'dexie-react-hooks'

interface OnboardingGateProps {
  children: ReactNode
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const eventStore = useEventStore()
  const location = useLocation()
  const navigate = useNavigate()

  const events = useLiveQuery(() => eventStore.getAll(), [eventStore])
  const hasCompletedOnboarding = events?.some(e => e.kind === 'OnboardingCompleted') ?? false
  const urlNewRoadmapMode =
    new URLSearchParams(location.search).get('new') === '1' ||
    (location.state as { newRoadmap?: boolean } | null)?.newRoadmap === true
  const latchedNewRoadmap = useRef(false)
  if (urlNewRoadmapMode) latchedNewRoadmap.current = true
  const newRoadmapMode = urlNewRoadmapMode || latchedNewRoadmap.current

  useEffect(() => {
    if (hasCompletedOnboarding && !newRoadmapMode) {
      navigate('/home', { replace: true })
    }
  }, [hasCompletedOnboarding, newRoadmapMode, navigate])

  if (events === undefined) return null
  if (hasCompletedOnboarding && !newRoadmapMode) return null

  return <>{children}</>
}
