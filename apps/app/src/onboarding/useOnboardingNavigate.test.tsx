import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useOnboardingNavigate } from './useOnboardingNavigate'

function Probe() {
  const navigate = useOnboardingNavigate()
  const location = useLocation()
  const newRoadmapState = (location.state as { newRoadmap?: boolean } | null)?.newRoadmap === true

  return (
    <>
      <div data-testid="location">
        {location.pathname}
        {location.search}
        {newRoadmapState ? ':state' : ':no-state'}
      </div>
      <button type="button" onClick={() => navigate('/onboarding/2')}>
        Next
      </button>
    </>
  )
}

describe('useOnboardingNavigate', () => {
  it('preserves search params and router state across onboarding step navigation', () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/onboarding/1', search: '?new=1', state: { newRoadmap: true } },
        ]}
      >
        <Probe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/onboarding/2?new=1:state')
  })
})
