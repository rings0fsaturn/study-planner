import { INGESTION_STATE_LABELS, INGESTION_STATES, type IngestionState } from './types'

function statusPercent(status: IngestionState): number {
  if (status === 'failed') return 0
  const index = INGESTION_STATES.indexOf(status)
  return Math.round((index / (INGESTION_STATES.length - 1)) * 100)
}

function tagClass(status: IngestionState): string {
  switch (status) {
    case 'ready':
      return 'tag-moss'
    case 'failed':
      return 'tag-rust'
    default:
      return 'tag-terracotta'
  }
}

export function MaterialStatusBadge({
  status,
  detail,
}: {
  status: IngestionState
  detail?: string | null
}) {
  return (
    <span className="material-status" title={detail ?? undefined}>
      <span className={`tag tag-sm ${tagClass(status)}`}>{INGESTION_STATE_LABELS[status]}</span>
      {detail && <span className="material-status-detail">{detail}</span>}
    </span>
  )
}

export function IngestionProgress({ status }: { status: IngestionState }) {
  const percent = statusPercent(status)
  return (
    <div className="material-progress" aria-label={`Ingestion progress ${percent}%`}>
      <div className="progress">
        <div
          className={`progress-fill ${status === 'failed' ? 'behind' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="material-progress-label">
        {INGESTION_STATES.map((step) => (
          <span key={step} className={INGESTION_STATES.indexOf(status) >= INGESTION_STATES.indexOf(step) ? 'is-done' : ''}>
            {step}
          </span>
        ))}
      </div>
    </div>
  )
}
