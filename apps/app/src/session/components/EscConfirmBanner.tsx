import { useEffect, useRef } from 'react';

interface EscConfirmBannerProps {
  onDismiss: () => void;
}

export function EscConfirmBanner({ onDismiss }: EscConfirmBannerProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 3500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  return (
    <div className="banner attention" style={{ position: 'fixed', bottom: 'var(--space-8)', right: 'var(--space-6)', zIndex: 20, maxWidth: 320 }}>
      <div className="banner-body">
        <div className="banner-title">Press ESC again to end session</div>
      </div>
    </div>
  );
}
