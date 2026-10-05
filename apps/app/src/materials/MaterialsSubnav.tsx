import { NavLink } from 'react-router-dom'
import { useLibraryCounts } from '../library/useLibraryRows'

/**
 * Library | Assessments N | Practice M sub-nav (Phase 2, D-02).
 * Counts read the local event log only; the hubs own hydration.
 */
export function MaterialsSubnav() {
  const { assessmentCount, practiceCount } = useLibraryCounts()
  // Hubs only (never detail pages), so every tab matches exactly.
  return (
    <nav aria-label="Library sections" className="materials-subnav">
      <NavLink to="/materials" end className={subnavLinkClass}>
        Library
      </NavLink>
      <NavLink to="/assessments" end className={subnavLinkClass}>
        {`Assessments ${assessmentCount}`}
      </NavLink>
      <NavLink to="/practice" end className={subnavLinkClass}>
        {`Practice ${practiceCount}`}
      </NavLink>
    </nav>
  )
}

function subnavLinkClass({ isActive }: { isActive: boolean }): string {
  return `materials-subnav-link${isActive ? ' is-active' : ''}`
}
