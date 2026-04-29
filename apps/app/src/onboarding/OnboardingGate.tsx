import { type ReactNode, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEventStore } from '../events/useEventStore'
import { useLiveQuery } from 'dexie-react-hooks'

interface OnboardingGateProps {
  children: ReactNode
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const eventStore = useEventStore()
  const navigate = useNavigate()

  const events = useLiveQuery(() => eventStore.getAll(), [eventStore])
  const hasCompletedOnboarding = events?.some(e => e.kind === 'OnboardingCompleted') ?? false

  useEffect(() => {
    if (hasCompletedOnboarding) {
      navigate('/home', { replace: true })
    }
  }, [hasCompletedOnboarding, navigate])

  if (events === undefined) return null
  if (hasCompletedOnboarding) return null

  return <>{children}</>
}