interface DesktopTimerStripProps {
  timerString: string;
  title: string;
  statusText: string;
  statusColorClass: string;
  materialIcon: string;
  materialIconClass: string;
  materialMeta: string;
  isOverrun: boolean;
}

export function DesktopTimerStrip({
  timerString,
  title,
  statusText,
  statusColorClass,
  materialIcon,
  materialIconClass,
  materialMeta,
  isOverrun,
}: DesktopTimerStripProps) {
  return (
    <div className={`desktop-timer-strip${isOverrun ? ' is-overrun' : ''}`}>
      <div className={`desktop-timer-num${isOverrun ? ' is-overrun' : ''}`}>
        {timerString}
      </div>
      <div className={`desktop-timer-divider${isOverrun ? ' is-overrun' : ''}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="desktop-timer-title">{title}</div>
        <div className={`mono-caps ${statusColorClass}`}>
          <span className={`desktop-timer-dot ${statusColorClass}`} />
          {statusText}
        </div>
      </div>
      <div className="material-strip" style={{ background: 'var(--paper-deep)', border: 'none', padding: '8px 12px' }}>
        <div className={`material-strip-icon ${materialIconClass}`} style={{ width: 32, height: 32, fontSize: 9 }}>
          {materialIcon}
        </div>
        <div className="material-strip-body">
          <div className="material-strip-title">{title}</div>
          <div className="material-strip-meta">{materialMeta}</div>
        </div>
      </div>
    </div>
  );
}
