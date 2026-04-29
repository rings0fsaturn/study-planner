import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useOnboarding } from './OnboardingProvider'

interface CheckpointGateProps {
  step: number
  children: ReactNode
}

const STEP_PREREQS: Record<number, (state: ReturnType<typeof useOnboarding>['state']) => boolean> = {
  1: () => true,
  2: (s) => s.deadline !== null,
  3: (s) => s.selectedStudyDays.length > 0 && s.weeklyHours > 0
      && s.weekdayHours + s.weekendHours === s.weeklyHours,
  4: (s) => s.materials.length >= 1,
}

export function CheckpointGate({ step, children }: CheckpointGateProps) {
  const { state } = useOnboarding()

  const earliestIncomplete = ((): number => {
    for (let s = 1; s < step; s++) {
      const check = STEP_PREREQS[s]
      if (!check(state)) return s
    }
    return -1
  })()

  if (earliestIncomplete > 0) {
    return <Navigate to={`/onboarding/${earliestIncomplete}`} replace />
  }

  return <>{children}</>
}