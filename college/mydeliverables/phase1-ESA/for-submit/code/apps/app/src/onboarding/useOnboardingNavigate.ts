import { useCallback } from 'react'
import { useLocation, useNavigate, type NavigateOptions } from 'react-router-dom'

/**
 * navigate() that keeps new-roadmap mode (?new=1 / state.newRoadmap) attached while moving
 * BETWEEN onboarding steps. Use ONLY for intra-onboarding destinations ('/onboarding/...').
 * For destinations that leave onboarding ('/home', '/roadmaps'), call useNavigate() directly. (D-01)
 */
export function useOnboardingNavigate() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    (to: string, options?: NavigateOptions) => {
      navigate(
        { pathname: to, search: location.search },
        { state: location.state, ...options },
      )
    },
    [navigate, location.search, location.state],
  )
}
