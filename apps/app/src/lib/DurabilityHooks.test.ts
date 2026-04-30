import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DurabilityHooks, type DurabilityEvent } from './DurabilityHooks';

describe('DurabilityHooks', () => {
  let hooks: DurabilityHooks;

  beforeEach(() => {
    hooks = new DurabilityHooks(document, window);
  });

  afterEach(() => {
    hooks.destroy();
  });

  it('fires visibilitychange callback when document becomes hidden', () => {
    const events: DurabilityEvent[] = [];
    hooks.subscribe(e => events.push(e));

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('visibilitychange');
    expect(events[0].isHidden).toBe(true);

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('fires visibilitychange callback when document becomes visible', () => {
    const events: DurabilityEvent[] = [];
    hooks.subscribe(e => events.push(e));

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('visibilitychange');
    expect(events[0].isHidden).toBe(false);
  });

  it('computes hidden duration on return to visible', () => {
    vi.useFakeTimers();
    const events: DurabilityEvent[] = [];
    hooks.subscribe(e => events.push(e));

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    vi.advanceTimersByTime(3000);

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(events).toHaveLength(2);
    expect(events[1].hiddenDurationMs).toBe(3000);
    expect(events[1].isHidden).toBe(false);

    vi.useRealTimers();
  });

  it('fires pagehide callback', () => {
    const events: DurabilityEvent[] = [];
    hooks.subscribe(e => events.push(e));

    window.dispatchEvent(new Event('pagehide'));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('pagehide');
    expect(events[0].isHidden).toBe(true);
  });

  it('fires beforeunload callback', () => {
    const events: DurabilityEvent[] = [];
    hooks.subscribe(e => events.push(e));

    window.dispatchEvent(new Event('beforeunload'));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('beforeunload');
    expect(events[0].isHidden).toBe(true);
  });

  it('calls multiple subscribers for the same event', () => {
    const events1: DurabilityEvent[] = [];
    const events2: DurabilityEvent[] = [];
    hooks.subscribe(e => events1.push(e));
    hooks.subscribe(e => events2.push(e));

    window.dispatchEvent(new Event('pagehide'));

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
  });

  it('unsubscribe stops delivery to that callback', () => {
    const events: DurabilityEvent[] = [];
    const unsub = hooks.subscribe(e => events.push(e));

    window.dispatchEvent(new Event('pagehide'));
    expect(events).toHaveLength(1);

    unsub();

    window.dispatchEvent(new Event('pagehide'));
    expect(events).toHaveLength(1);
  });

  it('destroy removes all listeners', () => {
    const events: DurabilityEvent[] = [];
    hooks.subscribe(e => events.push(e));

    hooks.destroy();

    window.dispatchEvent(new Event('pagehide'));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(events).toHaveLength(0);
  });

  it('one subscriber throwing does not break others', () => {
    const events: DurabilityEvent[] = [];
    hooks.subscribe(() => { throw new Error('boom'); });
    hooks.subscribe(e => events.push(e));

    window.dispatchEvent(new Event('pagehide'));

    expect(events).toHaveLength(1);
  });
});
