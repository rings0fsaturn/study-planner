import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import Dexie from 'dexie';
import { EventStore } from '../events/EventStore';
import { DurabilityHooks } from '../lib/DurabilityHooks';
import { SessionLifecycle, type SessionLifecycleDeps } from './SessionLifecycle';
import type { ActiveSessionRecord, SessionSlotData, PlannedEndNotifier } from './types';
import { SESSION_EVENT_KINDS, DEFAULT_POMODORO_CONFIG } from './types';

const DB_NAME = 'StudyTrackerTest-SessionLifecycle';

function createTestDb(): { db: Dexie; eventStore: EventStore } {
  const db = new Dexie(DB_NAME);
  db.version(1).stores({
    events: '++id, kind, createdAt',
    activeSession: 'id',
  });
  return { db, eventStore: new EventStore(db) };
}

const slotData: SessionSlotData = {
  materialId: 'mat-1',
  sessionTitle: 'Practice problems · ch. 5',
  slotDate: '2026-04-29',
  weekIndex: 2,
  plannedMinutes: 60,
  materialUrl: 'https://drive.google.com/some-pdf',
};

describe('SessionLifecycle', () => {
  let db: Dexie;
  let eventStore: EventStore;
  let durability: DurabilityHooks;
  let currentTime: Date;

  function makeNow() {
    return () => currentTime;
  }

  function makeDeps(overrides?: Partial<SessionLifecycleDeps>): SessionLifecycleDeps {
    return {
      eventStore,
      durabilityHooks: durability,
      now: makeNow(),
      pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      audioContext: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    const created = createTestDb();
    db = created.db;
    eventStore = created.eventStore;
    durability = new DurabilityHooks(document, window);
    currentTime = new Date('2026-04-29T09:00:00Z');
    await db.open();
    await db.table('events').clear();
    await db.table('activeSession').clear();
  });

  afterEach(async () => {
    durability.destroy();
    db.close();
  });

  // -----------------------------------------------------------------------
  // Start → End happy path
  // -----------------------------------------------------------------------

  describe('start and end', () => {
    it('starts a session and transitions to active', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      expect(lc.getState()).toBe('active');
      expect(lc.getRecord()?.sessionId).toBeTruthy();
      expect(lc.getRecord()?.materialId).toBe('mat-1');

      const events = await eventStore.getAll();
      expect(events.filter(e => e.kind === SESSION_EVENT_KINDS.STARTED)).toHaveLength(1);

      lc.destroy();
    });

    it('ending a session logs it and returns to idle', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T09:45:00Z'); // 45 min later
      await lc.end();

      expect(lc.getState()).toBe('idle');
      expect(lc.getRecord()).toBeNull();

      const events = await eventStore.getAll();
      const logged = events.find(e => e.kind === SESSION_EVENT_KINDS.LOGGED);
      expect(logged).toBeTruthy();
      expect(logged!.payload.duration).toBe(45);
      expect(logged!.payload.source).toBe('active');
      expect(logged!.payload.resolution).toBe('completed');

      lc.destroy();
    });

    it('persists booking and material metadata from pre-session start data', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start({
        ...slotData,
        bookingId: 'booking-1',
        plannedSessionMinutes: 45,
        materialEstimatedMinutes: 120,
        materialStartPosition: { kind: 'percent', value: 25, ofTotal: 100 },
      });

      const record = lc.getRecord();
      expect(record?.bookingId).toBe('booking-1');
      expect(record?.plannedSessionMinutes).toBe(45);
      expect(record?.materialEstimatedMinutes).toBe(120);
      expect(record?.materialStartPosition).toEqual({ kind: 'percent', value: 25, ofTotal: 100 });

      const events = await eventStore.getAll();
      const started = events.find(e => e.kind === SESSION_EVENT_KINDS.STARTED);
      expect(started?.payload.bookingId).toBe('booking-1');
      expect(started?.payload.plannedSessionMinutes).toBe(45);

      lc.destroy();
    });

    it('interrupt logs a partial with booking and material-position fields', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start({
        ...slotData,
        bookingId: 'booking-1',
        plannedSessionMinutes: 45,
        materialEstimatedMinutes: 120,
        materialStartPosition: { kind: 'percent', value: 25, ofTotal: 100 },
      });

      currentTime = new Date('2026-04-29T09:20:00Z');
      await lc.interrupt({ kind: 'percent', value: 50, ofTotal: 100 });

      expect(lc.getState()).toBe('idle');
      const logged = (await eventStore.getAll()).find(e => e.kind === SESSION_EVENT_KINDS.LOGGED);
      expect(logged?.payload.resolution).toBe('interrupted');
      expect(logged?.payload.bookingId).toBe('booking-1');
      expect(logged?.payload.plannedSessionMinutes).toBe(45);
      expect(logged?.payload.materialPosition).toEqual({ kind: 'percent', value: 50, ofTotal: 100 });
      expect(logged?.payload.materialConsumedMinutes).toBe(30);

      lc.destroy();
    });

    it('cannot start a session when one is already active', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      await expect(lc.start(slotData)).rejects.toThrow('Cannot start session');

      lc.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // Pause / Resume
  // -----------------------------------------------------------------------

  describe('pause and resume', () => {
    it('pausing stops the active time clock', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T09:30:00Z'); // +30 min
      await lc.pause();
      expect(lc.getState()).toBe('paused');

      currentTime = new Date('2026-04-29T10:00:00Z'); // +30 min paused
      // Active time should still be 30 min, not 60
      expect(Math.round(lc.getElapsedActiveMs() / 60_000)).toBe(30);

      const events = await eventStore.getAll();
      const paused = events.find(e => e.kind === SESSION_EVENT_KINDS.PAUSED);
      expect(paused).toBeTruthy();
      expect(paused!.payload.elapsedActiveMinutes).toBe(30);

      lc.destroy();
    });

    it('resume restores active state and time tracking', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T09:30:00Z');
      await lc.pause();

      currentTime = new Date('2026-04-29T10:00:00Z');
      await lc.resume();
      expect(lc.getState()).toBe('active');

      currentTime = new Date('2026-04-29T10:15:00Z'); // +15 min after resume
      expect(Math.round(lc.getElapsedActiveMs() / 60_000)).toBe(45); // 30 + 15

      const events = await eventStore.getAll();
      expect(events.filter(e => e.kind === SESSION_EVENT_KINDS.RESUMED)).toHaveLength(1);

      lc.destroy();
    });

    it('ending during pause logs the accumulated active time', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T09:35:00Z');
      await lc.pause();

      currentTime = new Date('2026-04-29T11:00:00Z'); // long pause
      await lc.end();

      expect(lc.getState()).toBe('idle');
      const events = await eventStore.getAll();
      const logged = events.find(e => e.kind === SESSION_EVENT_KINDS.LOGGED);
      expect(logged!.payload.duration).toBe(35);
      expect(logged!.payload.pauseCount).toBe(1);

      lc.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // Walk-away detection
  // -----------------------------------------------------------------------

  describe('walk-away', () => {
    it('tick transitions to walk_away when 10 min past planned end', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData); // 60 min planned

      currentTime = new Date('2026-04-29T10:09:00Z'); // 69 min, not yet
      expect(lc.tick()).toBe('active');

      currentTime = new Date('2026-04-29T10:11:00Z'); // 71 min, over threshold
      expect(lc.tick()).toBe('walk_away');
      expect(lc.getState()).toBe('walk_away');

      lc.destroy();
    });

    it('resolveWalkAway log_all logs full elapsed time', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T10:30:00Z'); // 90 min elapsed
      lc.tick();

      await lc.resolveWalkAway('log_all');
      expect(lc.getState()).toBe('idle');

      const logged = (await eventStore.getAll()).find(e => e.kind === SESSION_EVENT_KINDS.LOGGED);
      expect(logged!.payload.duration).toBe(90);
      expect(logged!.payload.resolution).toBe('completed');

      lc.destroy();
    });

    it('resolveWalkAway trim logs planned duration', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T10:30:00Z');
      lc.tick();

      await lc.resolveWalkAway('trim');
      const logged = (await eventStore.getAll()).find(e => e.kind === SESSION_EVENT_KINDS.LOGGED);
      expect(logged!.payload.duration).toBe(60); // planned minutes
      expect(logged!.payload.resolution).toBe('trimmed');

      lc.destroy();
    });

    it('resolveWalkAway discard abandons the session', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T10:30:00Z');
      lc.tick();

      await lc.resolveWalkAway('discard');
      expect(lc.getState()).toBe('idle');

      const abandoned = (await eventStore.getAll()).find(e => e.kind === SESSION_EVENT_KINDS.ABANDONED);
      expect(abandoned!.payload.reason).toBe('discarded');

      lc.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // Recovery (tab-close-and-reopen)
  // -----------------------------------------------------------------------

  describe('recovery', () => {
    async function setupPersistedSession() {
      const record: ActiveSessionRecord = {
        id: 1,
        sessionId: 'session-123',
        materialId: 'mat-1',
        sessionTitle: 'Practice problems',
        slotDate: '2026-04-29',
        weekIndex: 2,
        plannedMinutes: 60,
        startedAt: '2026-04-29T09:00:00Z',
        status: 'active',
        pauseIntervals: [],
        pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      };
      await eventStore.table('activeSession').put(record);
    }

    it('silent resume when hidden < 5 min', async () => {
      await setupPersistedSession();
      currentTime = new Date('2026-04-29T09:30:00Z');

      const lc = new SessionLifecycle(makeDeps());
      const state = await lc.initializeWithRecovery(3 * 60_000); // 3 min away

      expect(state).toBe('active');
      lc.destroy();
    });

    it('recovery dialog when hidden > 5 min', async () => {
      await setupPersistedSession();
      currentTime = new Date('2026-04-29T09:30:00Z');

      const lc = new SessionLifecycle(makeDeps());
      const state = await lc.initializeWithRecovery(8 * 60_000); // 8 min away

      expect(state).toBe('recovery');
      lc.destroy();
    });

    it('resolveRecovery keep_going resumes to active', async () => {
      await setupPersistedSession();
      currentTime = new Date('2026-04-29T09:30:00Z');

      const lc = new SessionLifecycle(makeDeps());
      await lc.initializeWithRecovery(8 * 60_000);

      await lc.resolveRecovery('keep_going');
      expect(lc.getState()).toBe('active');

      lc.destroy();
    });

    it('resolveRecovery end_now logs active time', async () => {
      await setupPersistedSession();
      currentTime = new Date('2026-04-29T09:30:00Z');

      const lc = new SessionLifecycle(makeDeps());
      await lc.initializeWithRecovery(8 * 60_000);

      await lc.resolveRecovery('end_now');
      expect(lc.getState()).toBe('idle');

      const logged = (await eventStore.getAll()).find(e => e.kind === SESSION_EVENT_KINDS.LOGGED);
      expect(logged!.payload.duration).toBe(30);

      lc.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // Stale session abandonment
  // -----------------------------------------------------------------------

  describe('stale detection', () => {
    it('abandons active session after 6 hours', async () => {
      const record: ActiveSessionRecord = {
        id: 1,
        sessionId: 'session-stale',
        materialId: 'mat-1',
        sessionTitle: 'Stale session',
        slotDate: '2026-04-29',
        weekIndex: 0,
        plannedMinutes: 60,
        startedAt: '2026-04-29T09:00:00Z',
        status: 'active',
        pauseIntervals: [],
        pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      };
      await eventStore.table('activeSession').put(record);

      currentTime = new Date('2026-04-29T15:30:00Z'); // 6.5h later

      const lc = new SessionLifecycle(makeDeps());
      const state = await lc.initialize();

      expect(state).toBe('idle');
      const abandoned = (await eventStore.getAll()).find(e => e.kind === SESSION_EVENT_KINDS.ABANDONED);
      expect(abandoned!.payload.reason).toBe('stale_6h');

      lc.destroy();
    });

    it('logs an interrupted partial for active session crossing midnight', async () => {
      const localLateNightStart = new Date(2026, 3, 29, 23, 30);
      const record: ActiveSessionRecord = {
        id: 1,
        sessionId: 'session-midnight',
        materialId: 'mat-1',
        sessionTitle: 'Midnight session',
        slotDate: '2026-04-29',
        weekIndex: 0,
        plannedMinutes: 60,
        startedAt: localLateNightStart.toISOString(),
        status: 'active',
        pauseIntervals: [],
        pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      };
      await eventStore.table('activeSession').put(record);

      currentTime = new Date(2026, 3, 30, 1, 30); // next local day, under 6h

      const lc = new SessionLifecycle(makeDeps());
      const state = await lc.initialize();

      expect(state).toBe('idle');
      const events = await eventStore.getAll();
      const logged = events.find(e => e.kind === SESSION_EVENT_KINDS.LOGGED);
      expect(logged!.payload.resolution).toBe('interrupted');
      expect(logged!.payload.duration).toBe(120);
      expect(events.find(e => e.kind === SESSION_EVENT_KINDS.ABANDONED)).toBeUndefined();

      lc.destroy();
    });

    it('abandons paused session after 12h continuous pause', async () => {
      const record: ActiveSessionRecord = {
        id: 1,
        sessionId: 'session-paused-stale',
        materialId: 'mat-1',
        sessionTitle: 'Paused stale',
        slotDate: '2026-04-28',
        weekIndex: 0,
        plannedMinutes: 60,
        startedAt: '2026-04-28T09:00:00Z',
        status: 'paused',
        pauseIntervals: [{ pausedAt: '2026-04-28T09:40:00Z' }],
        pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      };
      await eventStore.table('activeSession').put(record);

      currentTime = new Date('2026-04-29T08:00:00Z'); // ~22h paused

      const lc = new SessionLifecycle(makeDeps());
      const state = await lc.initialize();

      expect(state).toBe('idle');
      const abandoned = (await eventStore.getAll()).find(e => e.kind === SESSION_EVENT_KINDS.ABANDONED);
      expect(abandoned!.payload.reason).toBe('stale_12h_paused');
      expect(abandoned!.payload.activeMinutesAtAbandon).toBe(40);

      lc.destroy();
    });

    it('paused session under 12h stays paused', async () => {
      const record: ActiveSessionRecord = {
        id: 1,
        sessionId: 'session-paused-ok',
        materialId: 'mat-1',
        sessionTitle: 'Paused OK',
        slotDate: '2026-04-29',
        weekIndex: 0,
        plannedMinutes: 60,
        startedAt: '2026-04-29T09:00:00Z',
        status: 'paused',
        pauseIntervals: [{ pausedAt: '2026-04-29T09:40:00Z' }],
        pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      };
      await eventStore.table('activeSession').put(record);

      currentTime = new Date('2026-04-29T18:00:00Z'); // ~8h paused

      const lc = new SessionLifecycle(makeDeps());
      const state = await lc.initialize();

      expect(state).toBe('paused');

      lc.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // DurabilityHooks persistence
  // -----------------------------------------------------------------------

  describe('durability', () => {
    it('persists to Dexie on pagehide', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T09:20:00Z');

      window.dispatchEvent(new Event('pagehide'));

      // Give the async persist a tick
      await new Promise(resolve => setTimeout(resolve, 10));

      const saved = await eventStore.table('activeSession').get(1);
      expect(saved).toBeTruthy();
      expect(saved.sessionId).toBe(lc.getRecord()!.sessionId);

      lc.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // Pomodoro
  // -----------------------------------------------------------------------

  describe('pomodoro', () => {
    it('returns none for slots shorter than work interval', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start({ ...slotData, plannedMinutes: 30 });

      const phase = lc.getPomodoroPhase();
      expect(phase.phase).toBe('none');

      lc.destroy();
    });

    it('returns work phase during first work block', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData); // 60 min

      currentTime = new Date('2026-04-29T09:25:00Z');
      const phase = lc.getPomodoroPhase();
      expect(phase.phase).toBe('work');
      expect(phase.current).toBe(1);
      expect(phase.total).toBe(1);

      lc.destroy();
    });

    it('returns break phase after work block', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T09:52:00Z'); // 52 min = in break
      const phase = lc.getPomodoroPhase();
      expect(phase.phase).toBe('break');

      lc.destroy();
    });

    it('returns overtime past planned end', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T10:05:00Z'); // 65 min
      const phase = lc.getPomodoroPhase();
      expect(phase.phase).toBe('overtime');

      lc.destroy();
    });

    it('wall-clock based: Pomodoro advances during pause', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData); // 60 min, work = 50, break = 10

      currentTime = new Date('2026-04-29T09:30:00Z'); // 30 min
      await lc.pause();

      // Still paused at 55 min wall-clock — should be in break phase
      currentTime = new Date('2026-04-29T09:55:00Z');
      const phase = lc.getPomodoroPhase();
      expect(phase.phase).toBe('break');

      lc.destroy();
    });

    it('ending mid-pomodoro logs partial time', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T09:25:00Z'); // 25 min into 50 min work
      await lc.end();

      const logged = (await eventStore.getAll()).find(e => e.kind === SESSION_EVENT_KINDS.LOGGED);
      expect(logged!.payload.duration).toBe(25);

      lc.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // State listener
  // -----------------------------------------------------------------------

  describe('listeners', () => {
    it('notifies listeners on state changes', async () => {
      const states: string[] = [];
      const lc = new SessionLifecycle(makeDeps());
      lc.subscribe(s => states.push(s));

      await lc.start(slotData);
      expect(states).toContain('active');

      currentTime = new Date('2026-04-29T09:30:00Z');
      await lc.pause();
      expect(states).toContain('paused');

      lc.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // SessionLogged payload shape
  // -----------------------------------------------------------------------

  describe('SessionLogged payload', () => {
    it('contains all expected fields', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);

      currentTime = new Date('2026-04-29T09:20:00Z');
      await lc.pause();

      currentTime = new Date('2026-04-29T09:30:00Z');
      await lc.resume();

      currentTime = new Date('2026-04-29T09:50:00Z');
      await lc.end();

      const events = await eventStore.getAll();
      const logged = events.find(e => e.kind === SESSION_EVENT_KINDS.LOGGED)!;
      const p = logged.payload;

      expect(p.sessionId).toBeTruthy();
      expect(p.materialId).toBe('mat-1');
      expect(p.sessionTitle).toBe('Practice problems · ch. 5');
      expect(p.slotDate).toBe('2026-04-29');
      expect(p.weekIndex).toBe(2);
      expect(p.plannedMinutes).toBe(60);
      expect(p.startedAt).toBeTruthy();
      expect(p.endedAt).toBeTruthy();
      expect(p.activeMinutes).toBe(40); // 20 + 20, minus 10 paused
      expect(p.pauseCount).toBe(1);
      expect(p.totalPauseMinutes).toBe(10);
      expect(p.source).toBe('active');
      expect(p.resolution).toBe('completed');
      expect(p.duration).toBe(40);
      expect(p.description).toBe('Practice problems · ch. 5');
      expect(p.date).toBe('2026-04-29');

      lc.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // Planned-end notification integration
  // -----------------------------------------------------------------------

  describe('planned-end notifier', () => {
    type MockNotifier = {
      [K in keyof PlannedEndNotifier]: Mock;
    };

    function makeFakeNotifier(): MockNotifier {
      return {
        setCallback: vi.fn(),
        schedule: vi.fn(),
        cancel: vi.fn(),
        dismiss: vi.fn(),
        destroy: vi.fn(),
        handleVisibilityChange: vi.fn(),
      };
    }

    it('constructor binds callback via setCallback', () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      expect(notifier.setCallback).toHaveBeenCalledWith(expect.any(Function));
      lc.destroy();
    });

    it('start schedules notification', async () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.start(slotData); // 60 min
      expect(notifier.schedule).toHaveBeenCalledWith(60 * 60_000);
      lc.destroy();
    });

    it('pause cancels notification but NOT dismiss', async () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.start(slotData);
      currentTime = new Date('2026-04-29T09:20:00Z');
      await lc.pause();
      expect(notifier.cancel).toHaveBeenCalled();
      expect(notifier.dismiss).not.toHaveBeenCalled();
      lc.destroy();
    });

    it('resume reschedules with remaining time', async () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.start(slotData);
      currentTime = new Date('2026-04-29T09:20:00Z');
      await lc.pause();
      currentTime = new Date('2026-04-29T09:30:00Z');
      await lc.resume();
      // 20 min active (pause excluded), 40 min remaining
      const lastCall = notifier.schedule.mock.calls[notifier.schedule.mock.calls.length - 1];
      expect(lastCall[0]).toBe(40 * 60_000);
      lc.destroy();
    });

    it('resume after planned end reached does not reschedule', async () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.start(slotData);
      currentTime = new Date('2026-04-29T10:01:00Z');
      // Manually invoke the callback bound via setCallback to simulate notifier firing
      const callback = notifier.setCallback.mock.calls[0][0] as () => void;
      callback();
      expect(lc.isPlannedEndReached()).toBe(true);
      await lc.pause();
      notifier.schedule.mockClear();
      currentTime = new Date('2026-04-29T10:05:00Z');
      await lc.resume();
      expect(notifier.schedule).not.toHaveBeenCalled();
      expect(lc.isPlannedEndReached()).toBe(true);
      lc.destroy();
    });

    it('end clears notification via clearActiveSession', async () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.start(slotData);
      const callback = notifier.setCallback.mock.calls[0][0] as () => void;
      callback();
      currentTime = new Date('2026-04-29T09:45:00Z');
      await lc.end();
      expect(notifier.dismiss).toHaveBeenCalled();
      expect(lc.isPlannedEndReached()).toBe(false);
      lc.destroy();
    });

    it('dismissPlannedEnd clears flag and calls notifier.dismiss', async () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.start(slotData);
      const callback = notifier.setCallback.mock.calls[0][0] as () => void;
      callback();
      expect(lc.isPlannedEndReached()).toBe(true);
      lc.dismissPlannedEnd();
      expect(lc.isPlannedEndReached()).toBe(false);
      expect(notifier.dismiss).toHaveBeenCalled();
      lc.destroy();
    });

    it('tick fallback triggers schedule(0) through notifier', async () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.start(slotData);
      currentTime = new Date('2026-04-29T10:01:00Z');
      notifier.schedule.mockClear();
      lc.tick();
      expect(notifier.schedule).toHaveBeenCalledWith(0);
      lc.destroy();
    });

    it('initialize past planned end fires schedule(0)', async () => {
      const record: ActiveSessionRecord = {
        id: 1,
        sessionId: 'session-past',
        materialId: 'mat-1',
        sessionTitle: 'Past planned end',
        slotDate: '2026-04-29',
        weekIndex: 0,
        plannedMinutes: 60,
        startedAt: '2026-04-29T08:00:00Z',
        status: 'active',
        pauseIntervals: [],
        pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      };
      await eventStore.table('activeSession').put(record);
      currentTime = new Date('2026-04-29T09:10:00Z'); // 70 min later

      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.initialize();
      expect(notifier.schedule).toHaveBeenCalledWith(0);
      lc.destroy();
    });

    it('initialize before planned end schedules remaining time', async () => {
      const record: ActiveSessionRecord = {
        id: 1,
        sessionId: 'session-early',
        materialId: 'mat-1',
        sessionTitle: 'Early session',
        slotDate: '2026-04-29',
        weekIndex: 0,
        plannedMinutes: 60,
        startedAt: '2026-04-29T08:40:00Z',
        status: 'active',
        pauseIntervals: [],
        pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      };
      await eventStore.table('activeSession').put(record);
      currentTime = new Date('2026-04-29T09:00:00Z'); // 20 min in

      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.initialize();
      expect(notifier.schedule).toHaveBeenCalledWith(40 * 60_000);
      lc.destroy();
    });

    it('DurabilityHooks forwards visibilitychange to notifier', async () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.start(slotData);
      const callback = notifier.setCallback.mock.calls[0][0] as () => void;
      callback();
      document.dispatchEvent(new Event('visibilitychange'));
      expect(notifier.handleVisibilityChange).toHaveBeenCalled();
      lc.destroy();
    });

    it('DurabilityHooks does NOT forward pagehide to notifier', async () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      await lc.start(slotData);
      const callback = notifier.setCallback.mock.calls[0][0] as () => void;
      callback();
      window.dispatchEvent(new Event('pagehide'));
      expect(notifier.handleVisibilityChange).not.toHaveBeenCalled();
      lc.destroy();
    });

    it('destroy calls notifier.destroy', () => {
      const notifier = makeFakeNotifier();
      const lc = new SessionLifecycle(makeDeps({ notifier }));
      lc.destroy();
      expect(notifier.destroy).toHaveBeenCalled();
    });

    it('no notifier — backward compat', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.start(slotData);
      currentTime = new Date('2026-04-29T10:01:00Z');
      lc.tick();
      expect(lc.isPlannedEndReached()).toBe(true);
      lc.destroy();
    });
  });

  describe('material kind persistence', () => {
    it('persists kind and youtubeVideoId from slot data', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.initialize();
      await lc.start({
        ...slotData,
        kind: 'youtube',
        youtubeVideoId: 'dQw4w9WgXcQ',
      });
      const record = lc.getRecord();
      expect(record?.kind).toBe('youtube');
      expect(record?.youtubeVideoId).toBe('dQw4w9WgXcQ');
      lc.destroy();
    });

    it('defaults kind to undefined when not provided', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.initialize();
      await lc.start(slotData);
      const record = lc.getRecord();
      expect(record?.kind).toBeUndefined();
      lc.destroy();
    });

    it('persists kind to Dexie activeSession table', async () => {
      const lc = new SessionLifecycle(makeDeps());
      await lc.initialize();
      await lc.start({
        ...slotData,
        kind: 'article',
      });

      const persisted = await eventStore.table('activeSession').get(1);
      expect(persisted?.kind).toBe('article');
      lc.destroy();
    });
  });
});
