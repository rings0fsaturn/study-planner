import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useEventStore } from '../events/useEventStore'
import { useLiveQuery } from 'dexie-react-hooks'

export function RequireOnboarding({ children }: { children: ReactNode }) {
  const eventStore = useEventStore()
  const events = useLiveQuery(() => eventStore.getAll(), [eventStore])

  if (events === undefined) return null

  const hasCompleted = events.some(e => e.kind === 'OnboardingCompleted')
  if (!hasCompleted) {
    return <Navigate to="/onboarding/1" replace />
  }

  return <>{children}</>
}
