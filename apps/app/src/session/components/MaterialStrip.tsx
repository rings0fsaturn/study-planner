interface MaterialStripProps {
  title: string;
  meta: string;
  iconLabel?: string;
}

export function MaterialStrip({ title, meta, iconLabel = 'NB' }: MaterialStripProps) {
  return (
    <div className="material-strip">
      <div className="material-strip-icon">{iconLabel}</div>
      <div className="material-strip-body">
        <div className="material-strip-title">{title}</div>
        <div className="material-strip-meta">{meta}</div>
      </div>
    </div>
  );
}
