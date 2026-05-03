interface PlannedEndBannerProps {
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export function PlannedEndBanner({ onDismiss, actionLabel, onAction }: PlannedEndBannerProps) {
  return (
    <div className="banner attention">
      <div className="banner-icon-wrap" style={{ color: 'var(--terracotta-d)' }}>
        <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div className="banner-body">
        <div className="banner-title">Planned time reached</div>
        <div className="banner-desc">
          You've hit your planned end — wrap up when you're ready, or keep going.
        </div>
      </div>
      {actionLabel && onAction && (
        <button className="banner-action-btn" onClick={onAction}>{actionLabel}</button>
      )}
      <button className="banner-dismiss" onClick={onDismiss} aria-label="Dismiss">
        <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
