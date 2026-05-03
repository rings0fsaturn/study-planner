# Onboarding Architecture

4-step wizard collecting study plan parameters, generating a roadmap. Draft persists to IndexedDB.

## Files

| File | Purpose |
|---|---|
| `apps/app/src/onboarding/OnboardingGate.tsx` | Redirects to `/home` if `OnboardingCompleted` event exists |
| `apps/app/src/onboarding/RequireOnboarding.tsx` | Redirects to `/onboarding` if no `OnboardingCompleted` event |
| `apps/app/src/onboarding/CheckpointGate.tsx` | Prevents skipping ahead in flow |
| `apps/app/src/onboarding/OnboardingProvider.tsx` | useReducer state + IndexedDB persistence via `EventStore.table('onboardingDraft')` |
| `apps/app/src/onboarding/OnboardingLayout.tsx` | Layout wrapper (StepDots + Outlet) |

## Steps

| Step | Component | Collects |
|---|---|---|
| 1 | `Step1Deadline` | Deadline date, purpose |
| 2 | `Step2Hours` | Weekly hours, weekday/weekend split, study days |
| 3 | `Step3Materials` | Materials (title, duration, role) |
| 3/preview | `Step3Preview` | Roadmap preview via progress-engine, slot edits |
| 4 | `Step4Confirm` | Confirmation — emits events |

Sub-components in `onboarding/components/`: StepDots, TieResolver, CapacityPrompt, SchedulePreview, InlineEditTitle, MaterialRow.

## Completion

Step4Confirm emits three events:
- `OnboardingCompleted` — gate signal for RequireOnboarding / OnboardingGate
- `MaterialAdded` (one per material)
- `RoadmapCreated` (slots, schedule, deadline)

## State Persistence

OnboardingProvider reads/writes full reducer state to `onboardingDraft` table (id=1). Restored on mount, written on every dispatch. Cleared after completion.
