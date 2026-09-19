import type { CalibrationStatus } from '../progress/useCalibration'

interface ServiceStatusBannerProps {
  status: CalibrationStatus
}

const COPY = {
  stale: {
    label: 'Offline',
    message: 'Showing your last known pace while we reconnect.',
  },
  error: {
    label: 'Pace',
    message: "We can't reach the pace service. Your sessions are safe on this device.",
  },
  'auth-error': {
    label: 'Pace',
    message: "We can't refresh your pace estimate right now. Please try again shortly.",
  },
} as const

export function ServiceStatusBanner({ status }: ServiceStatusBannerProps) {
  if (status !== 'stale' && status !== 'error' && status !== 'auth-error') return null

  const copy = COPY[status]
  const borderColor = status === 'stale' ? 'var(--ink-faint)' : 'var(--rust)'

  return (
    <div
      role="status"
      data-testid="service-status-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0.75rem 0',
        marginBottom: '1rem',
        borderTop: `1px solid ${borderColor}`,
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <span
        className="mono-caps"
        style={{
          color: borderColor,
          whiteSpace: 'nowrap',
        }}
      >
        {copy.label}
      </span>
      <span className="t-body" style={{ color: 'var(--text-secondary)' }}>
        {copy.message}
      </span>
    </div>
  )
}
