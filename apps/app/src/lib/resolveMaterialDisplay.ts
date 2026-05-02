export interface MaterialDisplay {
  icon: string;
  iconClass: string;
  meta: string;
  label: string;
}

export function resolveMaterialDisplay(
  kind: 'youtube' | 'article' | 'manual' | undefined,
  hasUrl: boolean,
): MaterialDisplay {
  switch (kind) {
    case 'youtube':
      return { icon: 'YT', iconClass: 'yt', meta: 'YOUTUBE', label: 'YouTube' };
    case 'article':
      return { icon: 'BK', iconClass: 'bk', meta: 'ARTICLE', label: 'Article' };
    default:
      return {
        icon: 'NB',
        iconClass: 'notes',
        meta: hasUrl ? 'MANUAL · LINKED' : 'MANUAL · NO EMBED',
        label: 'Manual',
      };
  }
}
