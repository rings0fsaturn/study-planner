import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TabNotificationStrategy, type TabNotificationStrategyDeps } from './NotificationStrategy';

function makeDeps(overrides?: Partial<TabNotificationStrategyDeps>): TabNotificationStrategyDeps {
  return {
    getTitle: vi.fn(() => 'Study Tracker'),
    setTitle: vi.fn(),
    setFaviconHref: vi.fn(),
    getOriginalFaviconHref: vi.fn(() => '/study/favicon.svg'),
    isDocumentHidden: vi.fn(() => false),
    setTimeout: vi.fn((cb, ms) => globalThis.setTimeout(cb, ms) as unknown as number),
    clearTimeout: vi.fn((id) => globalThis.clearTimeout(id)),
    setInterval: vi.fn((cb, ms) => globalThis.setInterval(cb, ms) as unknown as number),
    clearInterval: vi.fn((id) => globalThis.clearInterval(id)),
    ...overrides,
  };
}

describe('TabNotificationStrategy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedule fires after remaining ms', () => {
    const deps = makeDeps();
    const callback = vi.fn();
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(callback);

    strategy.schedule(5000);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('title flash starts when tab hidden at planned end', () => {
    const deps = makeDeps({ isDocumentHidden: vi.fn(() => true) });
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(1000);
    // Advance to fire onFire (1000ms) + first flash interval tick (1500ms)
    vi.advanceTimersByTime(2500);

    const calls = (deps.setTitle as ReturnType<typeof vi.fn>).mock.calls;
    const flashTitles = calls.map((c: unknown[]) => c[0] as string);
    expect(flashTitles.some((t: string) => t.includes("Time's up"))).toBe(true);

    // Next interval tick toggles back to original
    vi.advanceTimersByTime(1500);
    const laterCalls = (deps.setTitle as ReturnType<typeof vi.fn>).mock.calls;
    const laterTitles = laterCalls.map((c: unknown[]) => c[0] as string);
    expect(laterTitles).toContain('Study Tracker');
  });

  it('title flash auto-restores after 60s', () => {
    const deps = makeDeps({ isDocumentHidden: vi.fn(() => true) });
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    (deps.setTitle as ReturnType<typeof vi.fn>).mockClear();

    vi.advanceTimersByTime(60_000);

    const calls = (deps.setTitle as ReturnType<typeof vi.fn>).mock.calls;
    const lastTitle = calls[calls.length - 1]?.[0];
    expect(lastTitle).toBe('Study Tracker');
  });

  it('title restores immediately on tab visible', () => {
    const deps = makeDeps({ isDocumentHidden: vi.fn(() => true) });
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    (deps.setTitle as ReturnType<typeof vi.fn>).mockClear();

    strategy.handleVisibilityChange(false);

    expect(deps.setTitle).toHaveBeenCalledWith('Study Tracker');
  });

  it('favicon dot set on planned end regardless of visibility', () => {
    const deps = makeDeps({ isDocumentHidden: vi.fn(() => false) });
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    expect(deps.setFaviconHref).toHaveBeenCalledWith('/study/favicon-dot.svg');
  });

  it('favicon dot persists after tab visible', () => {
    const deps = makeDeps({ isDocumentHidden: vi.fn(() => true) });
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    (deps.setFaviconHref as ReturnType<typeof vi.fn>).mockClear();

    strategy.handleVisibilityChange(false);

    expect(deps.setFaviconHref).not.toHaveBeenCalled();
  });

  it('favicon dot clears on dismiss', () => {
    const deps = makeDeps();
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    (deps.setFaviconHref as ReturnType<typeof vi.fn>).mockClear();

    strategy.dismiss();

    expect(deps.setFaviconHref).toHaveBeenCalledWith('/study/favicon.svg');
  });

  it('favicon dot NOT cleared on cancel', () => {
    const deps = makeDeps();
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    const callsBefore = (deps.setFaviconHref as ReturnType<typeof vi.fn>).mock.calls.length;

    strategy.cancel();

    const callsAfter = (deps.setFaviconHref as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });

  it('cancel clears pending timeout', () => {
    const deps = makeDeps();
    const callback = vi.fn();
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(callback);

    strategy.schedule(5000);
    strategy.cancel();

    vi.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('visible tab at planned end — no title flash but favicon dot', () => {
    const deps = makeDeps({ isDocumentHidden: vi.fn(() => false) });
    const callback = vi.fn();
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(callback);

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    expect(callback).toHaveBeenCalledOnce();
    expect(deps.setFaviconHref).toHaveBeenCalledWith('/study/favicon-dot.svg');
    expect(deps.setInterval).not.toHaveBeenCalled();
  });

  it('hidden-then-visible after planned end', () => {
    const deps = makeDeps({ isDocumentHidden: vi.fn(() => true) });
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    expect(deps.setInterval).toHaveBeenCalled();

    (deps.setTitle as ReturnType<typeof vi.fn>).mockClear();
    (deps.setFaviconHref as ReturnType<typeof vi.fn>).mockClear();

    strategy.handleVisibilityChange(false);

    expect(deps.setTitle).toHaveBeenCalledWith('Study Tracker');
    expect(deps.setFaviconHref).not.toHaveBeenCalled();
  });

  it('destroy cleans up all timers and restores DOM', () => {
    const deps = makeDeps({ isDocumentHidden: vi.fn(() => true) });
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    strategy.destroy();

    expect(deps.setFaviconHref).toHaveBeenLastCalledWith('/study/favicon.svg');
    expect(deps.setTitle).toHaveBeenLastCalledWith('Study Tracker');
  });

  it('after dismiss, visibility change to hidden does NOT re-start flash', () => {
    const deps = makeDeps({ isDocumentHidden: vi.fn(() => false) });
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    strategy.dismiss();

    (deps.setInterval as ReturnType<typeof vi.fn>).mockClear();

    strategy.handleVisibilityChange(true);

    expect(deps.setInterval).not.toHaveBeenCalled();
  });

  it('auto-restore timer cancelled on visibility change to visible', () => {
    const deps = makeDeps({ isDocumentHidden: vi.fn(() => true) });
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(vi.fn());

    strategy.schedule(0);
    vi.advanceTimersByTime(0);

    strategy.handleVisibilityChange(false);

    (deps.setTitle as ReturnType<typeof vi.fn>).mockClear();

    vi.advanceTimersByTime(60_000);

    expect(deps.setTitle).not.toHaveBeenCalled();
  });

  it('schedule(0) fires on next tick', () => {
    const deps = makeDeps();
    const callback = vi.fn();
    const strategy = new TabNotificationStrategy(deps);
    strategy.setCallback(callback);

    strategy.schedule(0);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(callback).toHaveBeenCalledOnce();
    expect(deps.setFaviconHref).toHaveBeenCalledWith('/study/favicon-dot.svg');
  });

  it('setCallback wires the callback — null-safe without it', () => {
    const deps = makeDeps();
    const strategy = new TabNotificationStrategy(deps);

    strategy.schedule(0);
    vi.advanceTimersByTime(0);
    // No crash when callback is null

    const callback = vi.fn();
    strategy.setCallback(callback);

    strategy.schedule(0);
    vi.advanceTimersByTime(0);
    expect(callback).toHaveBeenCalledOnce();
  });
});
