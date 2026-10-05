import { Link } from 'react-router-dom'
import { formatShortDate } from '../lib/formatShortDate'
import { familyLabel, modeLabel } from './LibraryCards'
import { useLibraryRows } from './useLibraryRows'
import './library.css'

/**
 * Phase 4 backlink (compact list, not cards). Reads this material's rows
 * through the shared hook; derivation stays in the library model.
 */
export function MaterialLibrarySection({ materialId }: { materialId: string }) {
  const { assessmentRows, runRows, loading } = useLibraryRows({ materialId })

  return (
    <section aria-labelledby={`material-library-${materialId}`} className="material-detail-block">
      <h3 id={`material-library-${materialId}`} className="t-display-3 library-backlink-title">
        Assessments and practice runs
      </h3>
      {loading ? (
        <p className="t-body-sm library-backlink-loading">
          Loading assessments…
        </p>
      ) : assessmentRows.length === 0 && runRows.length === 0 ? (
        <p className="t-body-sm">No assessments or practice runs for this material yet.</p>
      ) : (
        <>
          {assessmentRows.length > 0 && (
            <div className="library-backlink-group">
              <div className="library-meta library-backlink-count">
                Assessments · {assessmentRows.length}
              </div>
              <ul className="material-ref-list library-backlink-list">
                {assessmentRows.map((row) => (
                  <li key={row.assessmentId}>
                    <Link to={`/assessments/${row.assessmentId}`}>
                      {familyLabel(row.family)} · {formatShortDate(row.createdAt)}
                    </Link>{' '}
                    {row.state === 'generating' && (
                      <span className="library-note">{`${row.readyCount} of ${row.totalCount} ready`}</span>
                    )}
                    {row.state === 'failed' && (
                      <span className="library-warning">{row.warningReason ?? 'Failed'}</span>
                    )}
                    {row.state === 'ready' &&
                      (row.score != null ? (
                        <span className="library-score">{row.score.toFixed(2)}</span>
                      ) : (
                        <span className="library-note">Not started</span>
                      ))}
                    {row.state === 'unavailable' && (
                      <span className="library-note">Unavailable offline</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {runRows.length > 0 && (
            <div className="library-backlink-group">
              <div className="library-meta library-backlink-count">
                Practice runs · {runRows.length}
              </div>
              <ul className="material-ref-list library-backlink-list">
                {runRows.map((row) => (
                  <li key={row.runId}>
                    <Link to={`/materials/${row.primaryMaterialId}/practice/${row.runId}`}>
                      {modeLabel(row.mode)} · {formatShortDate(row.startedAt)}
                    </Link>{' '}
                    {row.state === 'generating' && (
                      <span className="library-note">{`${row.readyCount} of ${row.totalCount} ready`}</span>
                    )}
                    {(row.state === 'completed' ||
                      row.state === 'abandoned' ||
                      row.state === 'in-progress') && (
                      <span className="library-note">{`${row.gradedCount} of ${row.totalCount} graded`}</span>
                    )}
                    {row.state === 'in-progress' && row.missingCount > 0 && (
                      <span className="library-note">{`Partial start · ${row.missingCount} of ${row.totalCount} never generated`}</span>
                    )}
                    {row.state === 'failed' && (
                      <>
                        {row.failedReason && (
                          <span className="library-warning">{row.failedReason}</span>
                        )}{' '}
                        <span className="library-note">{`${row.gradedCount} of ${row.totalCount} graded`}</span>
                      </>
                    )}
                    {row.state === 'abandoned' && (
                      <span className="library-note">kept as history</span>
                    )}
                    {row.state === 'unavailable' && (
                      <span className="library-note">Progress unavailable offline</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
