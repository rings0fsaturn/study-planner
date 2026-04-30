import { Outlet, useLocation } from 'react-router-dom'
import { useOnboarding } from './OnboardingProvider'
import { StepDots } from './components/StepDots'
import './onboarding.css'

type LayoutShape = 'column' | 'fused'

interface RouteInfo {
  step: number
  shape: LayoutShape
}

function routeInfo(pathname: string): RouteInfo {
  if (pathname.includes('/onboarding/4')) return { step: 4, shape: 'column' }
  if (pathname.includes('/onboarding/3')) return { step: 3, shape: 'fused' }
  if (pathname.includes('/onboarding/2')) return { step: 2, shape: 'column' }
  return { step: 1, shape: 'column' }
}

export function OnboardingLayout() {
  const location = useLocation()
  const { step, shape } = routeInfo(location.pathname)
  const { state } = useOnboarding()

  return (
    <div className="onboarding-shell" data-shape={shape}>
      <div className="onboarding-stepdots-wrap">
        <StepDots currentStep={step} reachedStep={state.stepReached} totalSteps={4} />
        <div className="mono-caps onboarding-mobile-caption">Step {step} of 4</div>
        {shape === 'fused' && (
          <div className="mono-caps onboarding-desktop-caption">Materials &amp; preview</div>
        )}
      </div>
      <main className="onboarding-content">
        <Outlet />
      </main>
    </div>
  )
}
