import { useEffect, useRef } from 'react';

interface YouTubeResumeHintProps {
  onDismiss: () => void;
}

export function YouTubeResumeHint({ onDismiss }: YouTubeResumeHintProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 10_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  return (
    <div className="banner success" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="banner-icon-wrap" style={{ color: 'var(--moss)' }}>
        <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="banner-body">
        <div className="banner-title">Video reloaded</div>
        <div className="banner-desc">Scrub to where you were — your timer picked up where it left off.</div>
      </div>
      <button className="banner-dismiss" onClick={onDismiss} aria-label="Dismiss">
        <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
