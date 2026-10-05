import { Link } from 'react-router-dom'
import Tag from '../components/Tag'
import { formatShortDate } from '../lib/formatShortDate'
import type { AssessmentRow, PracticeRunRow } from './libraryModel'
import { MATERIAL_UNAVAILABLE } from './useLibraryRows'

function GeneratingDots() {
  return (
    <span className="library-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

function StateTag({ state }: { state: AssessmentRow['state'] }) {
  switch (state) {
    case 'ready':
      return <Tag variant="moss">Ready</Tag>
    case 'generating':
      return <Tag variant="terracotta">Generating</Tag>
    case 'failed':
      return <Tag variant="rust">Failed</Tag>
    default:
      return <Tag>Unavailable offline</Tag>
  }
}

export function familyLabel(family: AssessmentRow['family']): string {
  switch (family) {
    case 'objective':
      return 'Objective'
    case 'written':
      return 'Written'
    case 'coding':
      return 'Coding'
    default:
      return 'Assessment'
  }
}

export function AssessmentCard({
  row,
  title,
  onRetry,
}: {
  row: AssessmentRow
  title: string
  onRetry: (assessmentId: string) => void
}) {
  const meta = `${familyLabel(row.family)} · ${formatShortDate(row.createdAt)} · ${row.totalCount} question${row.totalCount === 1 ? '' : 's'}`
  return (
    <article className="material-card library-card">
      <div className="material-body">
        <h3 className="library-title">
          <Link className="library-title-link" to={`/assessments/${row.assessmentId}`}>
            {title || MATERIAL_UNAVAILABLE}
          </Link>
        </h3>
        <div className="library-meta">{meta}</div>
        <div className="material-row-status">
          <StateTag state={row.state} />
          {row.state === 'generating' && (
            <>
              <GeneratingDots />
              <span className="library-note">{`${row.readyCount} of ${row.totalCount} ready`}</span>
            </>
          )}
          {row.state === 'failed' && row.warningReason && (
            <span className="library-warning">{row.warningReason}</span>
          )}
          {row.state === 'ready' &&
            (row.score != null ? (
              <span className="library-score">{row.score.toFixed(2)}</span>
            ) : (
              <span className="library-note">Not started</span>
            ))}
        </div>
      </div>
      {row.state === 'generating' && (
        <div className="material-card-actions-wrap library-card-actions">
          <div className="material-card-actions">
            <button type="button" className="btn btn-secondary" onClick={() => onRetry(row.assessmentId)}>
              Retry generation
            </button>
          </div>
        </div>
      )}
      {row.state === 'failed' && (
        <div className="material-card-actions-wrap library-card-actions">
          <div className="material-card-actions">
            <Link className="btn btn-secondary" to={`/materials/${row.primaryMaterialId}/assessments/new`}>
              Start a new run
            </Link>
          </div>
        </div>
      )}
    </article>
  )
}

function RunStateTag({ state }: { state: PracticeRunRow['state'] }) {
  switch (state) {
    case 'completed':
      return <Tag variant="moss">Completed</Tag>
    case 'generating':
      return <Tag variant="terracotta">Generating</Tag>
    case 'in-progress':
      return <Tag variant="terracotta">In progress</Tag>
    case 'failed':
      return <Tag variant="rust">Failed</Tag>
    case 'abandoned':
      return <Tag>Abandoned</Tag>
    default:
      return <Tag>Unavailable offline</Tag>
  }
}

export function modeLabel(mode: PracticeRunRow['mode']): string {
  switch (mode) {
    case 'coding':
      return 'Coding'
    case 'mixed':
      return 'Mixed'
    default:
      return 'Written'
  }
}

function runHref(row: PracticeRunRow): string {
  return `/materials/${row.primaryMaterialId}/practice/${row.runId}`
}

export function PracticeRunCard({
  row,
  title,
  accent,
}: {
  row: PracticeRunRow
  title: string
  accent: boolean
}) {
  const meta = `${modeLabel(row.mode)} · ${formatShortDate(row.startedAt)} · ${row.count} problem${row.count === 1 ? '' : 's'}`
  const href = runHref(row)
  const resumable = row.state === 'generating' || row.state === 'in-progress' || row.state === 'unavailable'
  return (
    <article className="material-card library-card">
      <div className="material-body">
        <h3 className="library-title">
          <Link className="library-title-link" to={href}>
            {title || MATERIAL_UNAVAILABLE}
          </Link>
        </h3>
        <div className="library-meta">{meta}</div>
        <div className="material-row-status">
          <RunStateTag state={row.state} />
          {row.state === 'generating' && (
            <>
              <GeneratingDots />
              <span className="library-note">{`${row.readyCount} of ${row.totalCount} ready`}</span>
            </>
          )}
          {(row.state === 'completed' || row.state === 'abandoned' || row.state === 'in-progress') && (
            <span className="library-note">{`${row.gradedCount} of ${row.totalCount} graded`}</span>
          )}
          {row.state === 'failed' && (
            <>
              {row.failedReason && <span className="library-warning">{row.failedReason}</span>}
              <span className="library-note">{`${row.gradedCount} of ${row.totalCount} graded`}</span>
            </>
          )}
          {row.state === 'abandoned' && <span className="library-note">kept as history</span>}
          {row.state === 'in-progress' && row.missingCount > 0 && (
            <span className="library-note">{`Partial start · ${row.missingCount} of ${row.totalCount} never generated`}</span>
          )}
          {row.state === 'unavailable' && (
            <span className="library-note">Progress unavailable offline</span>
          )}
        </div>
      </div>
      {row.state === 'completed' && (
        <div className="material-card-actions-wrap library-card-actions">
          <div className="material-card-actions">
            <Link className="btn btn-secondary" to={href}>
              Open summary
            </Link>
          </div>
        </div>
      )}
      {row.state === 'failed' && (
        <div className="material-card-actions-wrap library-card-actions">
          <div className="material-card-actions">
            <Link className="btn btn-secondary" to={`/materials/${row.primaryMaterialId}/practice`}>
              Start a new run
            </Link>
          </div>
        </div>
      )}
      {resumable && (
        <div className="material-card-actions-wrap library-card-actions">
          <div className="material-card-actions">
            <Link className={`btn ${accent ? 'btn-accent' : 'btn-secondary'}`} to={href}>
              Resume
            </Link>
          </div>
        </div>
      )}
    </article>
  )
}
