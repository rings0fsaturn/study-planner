import { Outlet, useLocation } from 'react-router-dom'
import { useOnboarding } from './OnboardingProvider'

function currentStepNumber(pathname: string): number {
  if (pathname.includes('/onboarding/4')) return 4
  if (pathname.includes('/onboarding/3')) return 3
  if (pathname.includes('/onboarding/2')) return 2
  return 1
}

export function OnboardingLayout() {
  const location = useLocation()
  const step = currentStepNumber(location.pathname)
  const { state } = useOnboarding()

  return (
    <div className="app">
      <div style={{ padding: '16px 20px', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div className="stepdots">
            {[1, 2, 3, 4].map(n => (
              <div
                key={n}
                className={`stepdot ${n < step || (n === step && state.stepReached >= n) ? 'done' : ''} ${n === step ? 'active' : ''}`}
              />
            ))}
          </div>
          <div className="mono-caps">Step {step} of 4</div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}