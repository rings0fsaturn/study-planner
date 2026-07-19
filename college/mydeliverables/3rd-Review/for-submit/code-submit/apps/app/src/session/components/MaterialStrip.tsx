import type { MaterialKind } from '../types';

interface MaterialStripProps {
  title: string;
  meta: string;
  kind?: MaterialKind;
  iconLabel?: string;
}

function getIconLabel(kind?: MaterialKind): string {
  switch (kind) {
    case 'youtube': return 'YT';
    case 'article': return 'AR';
    default: return 'NB';
  }
}

export function MaterialStrip({ title, meta, kind, iconLabel }: MaterialStripProps) {
  return (
    <div className="material-strip">
      <div className="material-strip-icon">{iconLabel ?? getIconLabel(kind)}</div>
      <div className="material-strip-body">
        <div className="material-strip-title">{title}</div>
        <div className="material-strip-meta">{meta}</div>
      </div>
    </div>
  );
}
