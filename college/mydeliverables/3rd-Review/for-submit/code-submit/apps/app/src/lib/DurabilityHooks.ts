/**
 * Shared browser lifecycle event handler.
 *
 * Registers visibilitychange, pagehide, and beforeunload listeners once
 * and dispatches to multiple subscribers. Used by SyncEngine (flush pending
 * events) and SessionLifecycle (persist active session state).
 */

export type DurabilityEventType = 'visibilitychange' | 'pagehide' | 'beforeunload';

export interface DurabilityEvent {
  type: DurabilityEventType;
  /** True when the page is hidden / being unloaded */
  isHidden: boolean;
  /** For visibilitychange: ms the page was hidden (0 on hide, computed on show) */
  hiddenDurationMs: number;
}

export type DurabilityCallback = (event: DurabilityEvent) => void;

export class DurabilityHooks {
  private readonly subscribers = new Set<DurabilityCallback>();
  private hiddenSince = 0;
  private readonly doc: Document;
  private readonly win: Window;
  private boundVisibility: (() => void) | null = null;
  private boundPageHide: (() => void) | null = null;
  private boundBeforeUnload: (() => void) | null = null;

  constructor(doc: Document = document, win: Window = window) {
    this.doc = doc;
    this.win = win;
    this.attach();
  }

  subscribe(callback: DurabilityCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  destroy(): void {
    this.detach();
    this.subscribers.clear();
  }

  private attach(): void {
    this.boundVisibility = () => this.handleVisibilityChange();
    this.boundPageHide = () => this.handlePageHide();
    this.boundBeforeUnload = () => this.handleBeforeUnload();

    this.doc.addEventListener('visibilitychange', this.boundVisibility);
    this.win.addEventListener('pagehide', this.boundPageHide);
    this.win.addEventListener('beforeunload', this.boundBeforeUnload);
  }

  private detach(): void {
    if (this.boundVisibility) {
      this.doc.removeEventListener('visibilitychange', this.boundVisibility);
    }
    if (this.boundPageHide) {
      this.win.removeEventListener('pagehide', this.boundPageHide);
    }
    if (this.boundBeforeUnload) {
      this.win.removeEventListener('beforeunload', this.boundBeforeUnload);
    }
  }

  private handleVisibilityChange(): void {
    const isHidden = this.doc.hidden;
    let hiddenDurationMs = 0;

    if (isHidden) {
      this.hiddenSince = Date.now();
    } else {
      hiddenDurationMs = this.hiddenSince > 0 ? Date.now() - this.hiddenSince : 0;
      this.hiddenSince = 0;
    }

    this.dispatch({ type: 'visibilitychange', isHidden, hiddenDurationMs });
  }

  private handlePageHide(): void {
    this.dispatch({ type: 'pagehide', isHidden: true, hiddenDurationMs: 0 });
  }

  private handleBeforeUnload(): void {
    this.dispatch({ type: 'beforeunload', isHidden: true, hiddenDurationMs: 0 });
  }

  private dispatch(event: DurabilityEvent): void {
    for (const cb of this.subscribers) {
      try {
        cb(event);
      } catch {
        // Subscribers should not throw, but never let one break others
      }
    }
  }
}
