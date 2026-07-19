import type { EventStore } from '../events/EventStore'
import type { OnboardingState } from '../onboarding/OnboardingProvider'

export interface RoadmapDraftSummary {
  title: string
  stepReached: number
  stepLabel: string
}

const STEP_LABELS: Record<number, string> = {
  2: 'Hours',
  3: 'Materials',
  4: 'Confirm',
}

function resumableStep(stepReached: number): number {
  if (!Number.isFinite(stepReached)) return 1
  return Math.min(4, Math.max(1, Math.trunc(stepReached)))
}

export async function deriveRoadmapDraft(
  eventStore: EventStore,
  hasCompletedOnboarding: boolean,
): Promise<RoadmapDraftSummary | null> {
  if (!hasCompletedOnboarding) return null

  const row = await eventStore.table('onboardingDraft').get(1) as { state?: Partial<OnboardingState> } | undefined
  const state = row?.state
  const stepReached = resumableStep(Number(state?.stepReached ?? 1))

  if (!state?.deadline || stepReached <= 1) return null

  return {
    title: state.purpose?.trim() || 'Untitled plan',
    stepReached,
    stepLabel: STEP_LABELS[stepReached] ?? STEP_LABELS[4],
  }
}
