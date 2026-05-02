import { resolveMaterialDisplay } from '../lib/resolveMaterialDisplay';
import type { ActiveSessionRecord, SessionState } from './types';

export interface SessionLayoutConfig {
  showYouTubeEmbed: boolean;
  showArticleBanner: boolean;
  showArticleOpenPrompt: boolean;
  showOpenMaterialButton: boolean;
  showResumeHint: boolean;
  showReOpenButton: boolean;

  materialIcon: string;
  materialMeta: string;
  materialIconClass: string;
  subtitle: string;

  timerSizeClass: string;

  isDesktop: boolean;
  useDesktopTimerStrip: boolean;
  showFab: boolean;
  showInlineEnd: boolean;
  showEscHint: boolean;

  frameOverrun: boolean;
  eyebrowColorClass: string;
  eyebrowText: string;
}

export function resolveSessionLayout(
  record: ActiveSessionRecord,
  sessionState: SessionState,
  isDesktop: boolean,
  isResume: boolean,
  overrunMinutes: number,
  isBreak: boolean,
  articleOpened: boolean,
): SessionLayoutConfig {
  const kind = record.kind ?? 'manual';
  const hasUrl = !!record.materialUrl;
  const display = resolveMaterialDisplay(kind, hasUrl);
  const isOverrun = overrunMinutes > 0;
  const isActiveOrPaused =
    sessionState === 'active' || sessionState === 'paused';

  let eyebrowColorClass: string;
  if (sessionState === 'paused') eyebrowColorClass = 'eyebrow-faint';
  else if (isBreak) eyebrowColorClass = 'eyebrow-clay';
  else if (isOverrun) eyebrowColorClass = 'eyebrow-terracotta';
  else eyebrowColorClass = 'eyebrow-moss';

  let eyebrowText: string;
  if (sessionState === 'paused') {
    eyebrowText = `Paused · Week ${record.weekIndex + 1}`;
  } else if (isBreak) {
    eyebrowText = `On break · Week ${record.weekIndex + 1}`;
  } else if (isOverrun) {
    eyebrowText = `${overrunMinutes} min over plan`;
  } else {
    const verb = kind === 'article' ? 'Reading' : 'In session';
    eyebrowText = `${verb} · Week ${record.weekIndex + 1}`;
  }

  return {
    showYouTubeEmbed: kind === 'youtube',
    showArticleBanner: kind === 'article',
    showArticleOpenPrompt: kind === 'article',
    showOpenMaterialButton: kind === 'manual' && hasUrl,
    showResumeHint: isResume && kind === 'youtube' && isActiveOrPaused,
    showReOpenButton: kind === 'article' && articleOpened,

    materialIcon: display.icon,
    materialMeta: display.meta,
    materialIconClass: display.iconClass,
    subtitle:
      kind === 'youtube'
        ? 'YouTube video'
        : kind === 'article'
          ? 'Article'
          : hasUrl
            ? 'Linked material'
            : 'Manual · pen and paper',

    timerSizeClass:
      kind === 'manual' && !hasUrl
        ? isDesktop
          ? 'session-timer-giant'
          : 'session-timer-large'
        : '',

    isDesktop,
    useDesktopTimerStrip:
      isDesktop && (kind === 'youtube' || kind === 'article'),
    showFab: isDesktop,
    showInlineEnd: !isDesktop,
    showEscHint: isDesktop,

    frameOverrun: isOverrun,
    eyebrowColorClass,
    eyebrowText,
  };
}
