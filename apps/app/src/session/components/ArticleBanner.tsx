import { useState } from 'react';

interface ArticleBannerProps {
  url: string;
  isResume: boolean;
  onOpened?: () => void;
}

export function ArticleBanner({ url, isResume, onOpened }: ArticleBannerProps) {
  const [opened, setOpened] = useState(isResume);

  const handleOpen = () => {
    window.open(url, '_blank');
    setOpened(true);
    onOpened?.();
  };

  if (!opened) {
    return (
      <div className="banner" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="banner-icon-wrap">
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </div>
        <div className="banner-body">
          <div className="banner-title">Ready to read</div>
          <div className="banner-desc">Open the article in a new tab — your timer will keep running here.</div>
        </div>
        <button className="banner-action-btn" onClick={handleOpen}>
          Open article
        </button>
      </div>
    );
  }

  return (
    <div className="banner attention" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="banner-icon-wrap" style={{ color: 'var(--terracotta-d)' }}>
        <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
      <div className="banner-body">
        <div className="banner-title">Article opened in a new tab</div>
        <div className="banner-desc">Come back here when you're done — your timer keeps running.</div>
      </div>
    </div>
  );
}
