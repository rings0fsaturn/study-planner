interface DesktopArticlePlaceholderProps {
  url: string;
}

export function DesktopArticlePlaceholder({ url }: DesktopArticlePlaceholderProps) {
  return (
    <div className="desktop-article-placeholder">
      <div style={{
        display: 'inline-flex',
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--paper-deep)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
      }}>
        <svg className="icon" viewBox="0 0 24 24" style={{ width: 24, height: 24, color: 'var(--text-secondary)' }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: '-0.012em',
        marginBottom: 6,
      }}>
        Reading in another tab
      </div>
      <p style={{
        fontSize: 14,
        color: 'var(--text-secondary)',
        marginBottom: 20,
        maxWidth: 360,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        If you've closed it, re-open here. Your timer keeps counting either way.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-secondary"
      >
        Re-open article
      </a>
    </div>
  );
}
