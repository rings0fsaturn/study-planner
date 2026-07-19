import { useEffect, useState } from 'react';

interface SessionBannerProps {
  message: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  autoDismissMs?: number;
}

export function SessionBanner({
  message,
  description,
  actionLabel,
  onAction,
  onDismiss,
  autoDismissMs,
}: SessionBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoDismissMs) return;
    const id = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoDismissMs);
    return () => clearTimeout(id);
  }, [autoDismissMs, onDismiss]);

  if (!visible) return null;

  return (
    <div className="banner info" role="status">
      <div className="banner-body">
        <div className="banner-title">{message}</div>
        {description && <div className="banner-desc">{description}</div>}
      </div>
      {actionLabel && onAction && (
        <button className="banner-action-btn" onClick={onAction}>{actionLabel}</button>
      )}
      {onDismiss && (
        <button className="banner-dismiss" onClick={() => { setVisible(false); onDismiss(); }} aria-label="Dismiss">
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
