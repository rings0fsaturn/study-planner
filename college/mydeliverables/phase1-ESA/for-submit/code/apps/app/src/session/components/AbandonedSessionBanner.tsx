import { Link } from 'react-router-dom';

interface AbandonedSessionBannerProps {
  activeMinutes: number;
  onDismiss: () => void;
}

export function AbandonedSessionBanner({ activeMinutes, onDismiss }: AbandonedSessionBannerProps) {
  return (
    <div className="banner attention">
      <div className="banner-icon-wrap">
        <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="banner-body">
        <div className="banner-title">We didn't hear back from your session yesterday</div>
        <div className="banner-desc">
          It wasn't logged.
          {activeMinutes > 0 && (
            <> You studied ~{activeMinutes} min before we lost you. </>
          )}
          <Link to="/log">Log it manually</Link> if you studied.
        </div>
      </div>
      <button className="banner-dismiss" onClick={onDismiss} aria-label="Dismiss">
        <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
