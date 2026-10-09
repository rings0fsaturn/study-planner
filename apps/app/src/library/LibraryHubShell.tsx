import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MaterialsSubnav } from '../materials/MaterialsSubnav'
import '../materials/materials.css'
import './library.css'

/**
 * Shared hub chrome for `/assessments` and `/practice` (thermo follow-up:
 * the two hubs rendered head, sub-nav, and empty state line-for-line).
 * Loading, error, and rows render as `children` so each hub keeps its
 * own states; only the empty state is owned here because both hubs
 * share its copy shape (title, body, accent CTA to `/materials`).
 */
export function LibraryHubShell({
  title,
  emptyTitle,
  emptyBody,
  empty,
  refreshing = false,
  children,
}: {
  title: string
  emptyTitle: string
  emptyBody: string
  empty: boolean
  refreshing?: boolean
  children: ReactNode
}) {
  return (
    <div className="materials-page">
      <div className="materials-head">
        <div>
          <div className="mono-caps">Study library</div>
          <h1>{title}</h1>
        </div>
        {refreshing && <LibraryHubRefreshing />}
      </div>
      <MaterialsSubnav />
      {children}
      {empty && (
        <div className="materials-empty">
          <h3>{emptyTitle}</h3>
          <p>{emptyBody}</p>
          <Link className="btn btn-accent" to="/materials">
            Browse materials
          </Link>
        </div>
      )}
    </div>
  )
}

/** Background revalidation indicator: cached rows stay on screen while the
 * network pass converges. The No-Spinner dots plus a mono caps label. */
function LibraryHubRefreshing() {
  return (
    <div className="library-refreshing" role="status">
      <span className="processing-dots processing-dots-inline" aria-hidden="true">
        <span className="processing-dot" />
        <span className="processing-dot" />
        <span className="processing-dot" />
      </span>
      <span className="mono-caps">Refreshing</span>
    </div>
  )
}

export function LibraryHubLoading({ text }: { text: string }) {
  return (
    <div className="materials-grid" aria-label="Loading">
      <div className="library-skeleton">{text}</div>
    </div>
  )
}

export function LibraryHubError({
  title,
  errorCount,
  onReload,
}: {
  title: string
  errorCount: number
  onReload: () => void
}) {
  return (
    <div className="banner attention" role="alert">
      <div className="banner-body">
        <div className="banner-title">{title}</div>
        <div className="banner-desc">{`${errorCount} unavailable offline. Retry returns with connection.`}</div>
      </div>
      <button type="button" className="btn btn-secondary" onClick={onReload}>
        Retry
      </button>
    </div>
  )
}
