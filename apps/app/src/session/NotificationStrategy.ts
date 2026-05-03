import type { PlannedEndNotifier } from './types';

const DOT_FAVICON_PATH = '/study/favicon-dot.svg';
const FLASH_INTERVAL_MS = 1500;
const FLASH_AUTO_RESTORE_MS = 60_000;
const FLASH_TITLE = '\u23F0 Time\'s up \u2014 Study Tracker';

export interface TabNotificationStrategyDeps {
  getTitle: () => string;
  setTitle: (title: string) => void;
  setFaviconHref: (href: string) => void;
  getOriginalFaviconHref: () => string;
  isDocumentHidden: () => boolean;
  setTimeout: (cb: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  setInterval: (cb: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
}

export class TabNotificationStrategy implements PlannedEndNotifier {
  private readonly deps: TabNotificationStrategyDeps;
  private callback: (() => void) | null = null;
  private timeoutId: number | null = null;
  private flashIntervalId: number | null = null;
  private flashAutoRestoreId: number | null = null;
  private fired = false;
  private dismissed = false;
  private originalTitle = '';
  private flashState = false;

  constructor(deps: TabNotificationStrategyDeps) {
    this.deps = deps;
  }

  setCallback(cb: () => void): void {
    this.callback = cb;
  }

  schedule(remainingMs: number): void {
    this.fired = false;
    this.dismissed = false;
    if (this.timeoutId !== null) {
      this.deps.clearTimeout(this.timeoutId);
    }
    this.timeoutId = this.deps.setTimeout(() => this.onFire(), remainingMs);
  }

  cancel(): void {
    if (this.timeoutId !== null) {
      this.deps.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.stopFlash();
  }

  dismiss(): void {
    this.stopFlash();
    this.deps.setFaviconHref(this.deps.getOriginalFaviconHref());
    this.dismissed = true;
    this.fired = false;
  }

  destroy(): void {
    if (this.timeoutId !== null) {
      this.deps.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.stopFlash();
    this.deps.setFaviconHref(this.deps.getOriginalFaviconHref());
  }

  handleVisibilityChange(isHidden: boolean): void {
    if (!this.fired || this.dismissed) return;

    if (!isHidden) {
      this.stopFlash();
    } else if (this.flashIntervalId === null) {
      this.startFlash();
    }
  }

  private onFire(): void {
    this.timeoutId = null;
    this.fired = true;
    this.callback?.();
    this.deps.setFaviconHref(DOT_FAVICON_PATH);
    if (this.deps.isDocumentHidden()) {
      this.startFlash();
    }
  }

  private startFlash(): void {
    if (this.flashIntervalId !== null) return;
    this.originalTitle = this.deps.getTitle();
    this.flashState = false;

    this.flashIntervalId = this.deps.setInterval(() => {
      this.flashState = !this.flashState;
      this.deps.setTitle(this.flashState ? FLASH_TITLE : this.originalTitle);
    }, FLASH_INTERVAL_MS);

    this.flashAutoRestoreId = this.deps.setTimeout(() => {
      this.stopFlash();
    }, FLASH_AUTO_RESTORE_MS);
  }

  private stopFlash(): void {
    if (this.flashIntervalId !== null) {
      this.deps.clearInterval(this.flashIntervalId);
      this.flashIntervalId = null;
    }
    if (this.flashAutoRestoreId !== null) {
      this.deps.clearTimeout(this.flashAutoRestoreId);
      this.flashAutoRestoreId = null;
    }
    if (this.originalTitle) {
      this.deps.setTitle(this.originalTitle);
    }
    this.flashState = false;
  }
}

export function createBrowserDeps(): TabNotificationStrategyDeps {
  const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  const originalHref = link?.getAttribute('href') ?? '/favicon.svg';

  return {
    getTitle: () => document.title,
    setTitle: (title: string) => { document.title = title; },
    setFaviconHref: (href: string) => { if (link) link.setAttribute('href', href); },
    getOriginalFaviconHref: () => originalHref,
    isDocumentHidden: () => document.hidden,
    setTimeout: (cb: () => void, ms: number) => window.setTimeout(cb, ms),
    clearTimeout: (id: number) => window.clearTimeout(id),
    setInterval: (cb: () => void, ms: number) => window.setInterval(cb, ms),
    clearInterval: (id: number) => window.clearInterval(id),
  };
}
