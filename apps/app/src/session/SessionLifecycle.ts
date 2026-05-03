import type { EventStore } from '../events/EventStore';
import type { DurabilityHooks } from '../lib/DurabilityHooks';
import type {
  SessionState,
  ActiveSessionRecord,
  PomodoroConfig,
  SessionStartedPayload,
  SessionPausedPayload,
  SessionResumedPayload,
  SessionLoggedPayload,
  SessionAbandonedPayload,
  WalkAwayResolution,
  RecoveryResolution,
  SessionSlotData,
} from './types';
import { SESSION_EVENT_KINDS, DEFAULT_POMODORO_CONFIG } from './types';
import { getPomodoroPhase, type PomodoroPhase } from './pomodoro';
import { createChime } from './chime';

const WALK_AWAY_THRESHOLD_MS = 10 * 60_000; // 10 min past planned end
const RECOVERY_THRESHOLD_MS = 5 * 60_000;   // 5 min away = silent resume
const STALE_ACTIVE_MS = 6 * 60 * 60_000;    // 6 hours
const STALE_PAUSED_MS = 12 * 60 * 60_000;   // 12 hours continuous pause

export type SessionLifecycleListener = (state: SessionState) => void;

export interface SessionLifecycleDeps {
  eventStore: EventStore;
  durabilityHooks: DurabilityHooks;
  now?: () => Date;
  pomodoroConfig?: PomodoroConfig;
  audioContext?: AudioContext | null;
}

export class SessionLifecycle {
  private readonly eventStore: EventStore;
  private readonly durabilityHooks: DurabilityHooks;
  private readonly now: () => Date;
  private readonly pomodoroConfig: PomodoroConfig;

  private state: SessionState = 'idle';
  private record: ActiveSessionRecord | null = null;
  private listeners = new Set<SessionLifecycleListener>();
  private unsubDurability: (() => void) | null = null;
  private chime: ReturnType<typeof createChime> | null = null;
  private lastPomodoroPhase: 'work' | 'break' | 'none' = 'none';

  constructor(deps: SessionLifecycleDeps) {
    this.eventStore = deps.eventStore;
    this.durabilityHooks = deps.durabilityHooks;
    this.now = deps.now ?? (() => new Date());
    this.pomodoroConfig = deps.pomodoroConfig ?? DEFAULT_POMODORO_CONFIG;

    if (deps.audioContext) {
      this.chime = createChime(deps.audioContext);
    }

    this.unsubDurability = this.durabilityHooks.subscribe((event) => {
      if (event.isHidden) {
        this.persistToDb();
      }
    });
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async initialize(): Promise<SessionState> {
    const table = this.eventStore.table('activeSession');
    const existing = await table.get(1) as ActiveSessionRecord | undefined;

    if (!existing) {
      this.state = 'idle';
      return this.state;
    }

    this.record = existing;
    const staleResult = this.checkStale(existing);

    if (staleResult) {
      await this.doAbandon(staleResult);
      return this.state;
    }

    if (existing.status === 'paused') {
      this.state = 'paused';
      this.notify();
      return this.state;
    }

    // Active session — check if we need a recovery or walk-away dialog
    const now = this.now();
    const startedAt = new Date(existing.startedAt);
    const elapsedMs = now.getTime() - startedAt.getTime();
    const plannedMs = existing.plannedMinutes * 60_000;

    if (elapsedMs > plannedMs + WALK_AWAY_THRESHOLD_MS) {
      this.state = 'walk_away';
      this.notify();
      return this.state;
    }

    // Check if user was away long enough for recovery dialog
    // We approximate "time away" by looking at how long the page was closed
    // For tab-close recovery, the caller provides hiddenDuration context
    this.state = 'active';
    this.notify();
    return this.state;
  }

  async initializeWithRecovery(hiddenDurationMs: number): Promise<SessionState> {
    const baseState = await this.initialize();

    if (baseState === 'active' && hiddenDurationMs > RECOVERY_THRESHOLD_MS) {
      this.state = 'recovery';
      this.notify();
    }

    return this.state;
  }

  async start(slotData: SessionSlotData): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start session in state: ${this.state}`);
    }

    const sessionId = crypto.randomUUID();
    const startedAt = this.now().toISOString();

    this.record = {
      id: 1,
      sessionId,
      materialId: slotData.materialId,
      sessionTitle: slotData.sessionTitle,
      slotDate: slotData.slotDate,
      weekIndex: slotData.weekIndex,
      plannedMinutes: slotData.plannedMinutes,
      startedAt,
      status: 'active',
      pauseIntervals: [],
      pomodoroConfig: this.pomodoroConfig,
      materialUrl: slotData.materialUrl,
    };

    await this.persistToDb();

    const payload: SessionStartedPayload = {
      sessionId,
      materialId: slotData.materialId,
      sessionTitle: slotData.sessionTitle,
      slotDate: slotData.slotDate,
      weekIndex: slotData.weekIndex,
      plannedMinutes: slotData.plannedMinutes,
      startedAt,
      pomodoroConfig: this.pomodoroConfig,
    };

    await this.eventStore.append(
      SESSION_EVENT_KINDS.STARTED,
      payload as unknown as Record<string, unknown>
    );

    this.lastPomodoroPhase = 'none';
    this.state = 'active';
    this.notify();
  }

  async pause(): Promise<void> {
    if (this.state !== 'active' && this.state !== 'walk_away') {
      throw new Error(`Cannot pause in state: ${this.state}`);
    }

    if (!this.record) throw new Error('No active session record');

    const pausedAt = this.now().toISOString();
    this.record.pauseIntervals.push({ pausedAt });
    this.record.status = 'paused';

    await this.persistToDb();

    const payload: SessionPausedPayload = {
      sessionId: this.record.sessionId,
      pausedAt,
      elapsedActiveMinutes: Math.round(this.getElapsedActiveMs() / 60_000),
      currentPomodoro: this.getPomodoroPhase().current,
    };

    await this.eventStore.append(
      SESSION_EVENT_KINDS.PAUSED,
      payload as unknown as Record<string, unknown>
    );

    this.state = 'paused';
    this.notify();
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused') {
      throw new Error(`Cannot resume in state: ${this.state}`);
    }

    if (!this.record) throw new Error('No active session record');

    const resumedAt = this.now().toISOString();
    const lastPause = this.record.pauseIntervals[this.record.pauseIntervals.length - 1];
    if (lastPause && !lastPause.resumedAt) {
      lastPause.resumedAt = resumedAt;
    }
    this.record.status = 'active';

    await this.persistToDb();

    const payload: SessionResumedPayload = {
      sessionId: this.record.sessionId,
      resumedAt,
    };

    await this.eventStore.append(
      SESSION_EVENT_KINDS.RESUMED,
      payload as unknown as Record<string, unknown>
    );

    this.state = 'active';
    this.notify();
  }

  async end(): Promise<void> {
    if (this.state === 'idle') {
      throw new Error('No session to end');
    }
    if (!this.record) throw new Error('No active session record');

    await this.logSession('completed', this.getElapsedActiveMs());
  }

  async resolveWalkAway(resolution: WalkAwayResolution): Promise<void> {
    if (!this.record) throw new Error('No active session record');

    switch (resolution) {
      case 'log_all':
        await this.logSession('completed', this.getElapsedActiveMs());
        break;
      case 'trim':
        await this.logSession('trimmed', this.record.plannedMinutes * 60_000);
        break;
      case 'discard':
        await this.doAbandon('discarded');
        break;
    }
  }

  async resolveRecovery(resolution: RecoveryResolution): Promise<void> {
    if (!this.record) throw new Error('No active session record');

    switch (resolution) {
      case 'keep_going':
        this.state = 'active';
        this.notify();
        break;
      case 'end_now':
        await this.logSession('completed', this.getElapsedActiveMs());
        break;
    }
  }

  // -----------------------------------------------------------------------
  // State queries
  // -----------------------------------------------------------------------

  getState(): SessionState {
    return this.state;
  }

  getRecord(): ActiveSessionRecord | null {
    return this.record;
  }

  getElapsedActiveMs(): number {
    if (!this.record) return 0;
    const now = this.now();
    const start = new Date(this.record.startedAt).getTime();
    let totalPauseMs = 0;

    for (const interval of this.record.pauseIntervals) {
      const pauseStart = new Date(interval.pausedAt).getTime();
      const pauseEnd = interval.resumedAt
        ? new Date(interval.resumedAt).getTime()
        : now.getTime();
      totalPauseMs += pauseEnd - pauseStart;
    }

    return Math.max(0, now.getTime() - start - totalPauseMs);
  }

  getElapsedWallClockMs(): number {
    if (!this.record) return 0;
    return this.now().getTime() - new Date(this.record.startedAt).getTime();
  }

  getPomodoroPhase(): PomodoroPhase {
    if (!this.record) {
      return { phase: 'none', current: 0, total: 0, remainingMs: 0 };
    }
    return getPomodoroPhase(
      this.getElapsedWallClockMs(),
      this.record.plannedMinutes,
      this.record.pomodoroConfig
    );
  }

  isOverrun(): boolean {
    if (!this.record) return false;
    return this.getElapsedActiveMs() > this.record.plannedMinutes * 60_000;
  }

  isWalkAwayDue(): boolean {
    if (!this.record || this.state !== 'active') return false;
    const activeMs = this.getElapsedActiveMs();
    const plannedMs = this.record.plannedMinutes * 60_000;
    return activeMs > plannedMs + WALK_AWAY_THRESHOLD_MS;
  }

  /**
   * Called on each tick to check for Pomodoro phase transitions and play chimes.
   * Also checks for walk-away threshold.
   * Returns the current state after any transitions.
   */
  tick(): SessionState {
    if (this.state !== 'active') return this.state;

    // Check Pomodoro transitions for chime
    const pomo = this.getPomodoroPhase();
    if (pomo.phase === 'work' && this.lastPomodoroPhase === 'break') {
      this.chime?.playBreakToWork();
    } else if (pomo.phase === 'break' && this.lastPomodoroPhase === 'work') {
      this.chime?.playWorkToBreak();
    }
    if (pomo.phase === 'work' || pomo.phase === 'break') {
      this.lastPomodoroPhase = pomo.phase;
    }

    // Check walk-away threshold
    if (this.isWalkAwayDue() && this.state === 'active') {
      this.state = 'walk_away';
      this.notify();
    }

    return this.state;
  }

  subscribe(listener: SessionLifecycleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.unsubDurability?.();
    this.listeners.clear();
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private checkStale(record: ActiveSessionRecord): SessionAbandonedPayload['reason'] | null {
    const now = this.now();
    const startedAt = new Date(record.startedAt);

    if (record.status === 'paused') {
      const lastPause = record.pauseIntervals[record.pauseIntervals.length - 1];
      if (lastPause && !lastPause.resumedAt) {
        const pausedSince = new Date(lastPause.pausedAt).getTime();
        if (now.getTime() - pausedSince > STALE_PAUSED_MS) {
          return 'stale_12h_paused';
        }
      }
      return null;
    }

    // Active session: check midnight crossing (before 6h — more specific rule)
    if (startedAt.toDateString() !== now.toDateString()) {
      return 'stale_midnight';
    }

    // Active session: check 6h elapsed
    const elapsedMs = now.getTime() - startedAt.getTime();
    if (elapsedMs > STALE_ACTIVE_MS) {
      return 'stale_6h';
    }

    return null;
  }

  private async doAbandon(reason: SessionAbandonedPayload['reason']): Promise<void> {
    if (!this.record) return;

    const activeMinutes = Math.round(this.getElapsedActiveMs() / 60_000);

    const payload: SessionAbandonedPayload = {
      sessionId: this.record.sessionId,
      reason,
      activeMinutesAtAbandon: activeMinutes,
      abandonedAt: this.now().toISOString(),
    };

    await this.eventStore.append(
      SESSION_EVENT_KINDS.ABANDONED,
      payload as unknown as Record<string, unknown>
    );

    await this.clearActiveSession();
    this.state = 'idle';
    this.notify();
  }

  private async logSession(resolution: 'completed' | 'trimmed', activeMs: number): Promise<void> {
    if (!this.record) return;

    const endedAt = this.now().toISOString();
    const activeMinutes = Math.round(activeMs / 60_000);
    const totalPauseMs = this.record.pauseIntervals.reduce((sum, p) => {
      const start = new Date(p.pausedAt).getTime();
      const end = p.resumedAt ? new Date(p.resumedAt).getTime() : this.now().getTime();
      return sum + (end - start);
    }, 0);

    const pomo = this.getPomodoroPhase();
    const completedPomos = pomo.total > 0
      ? Math.max(0, (pomo.phase === 'overtime' ? pomo.total : pomo.current - 1))
      : 0;

    const payload: SessionLoggedPayload = {
      sessionId: this.record.sessionId,
      materialId: this.record.materialId,
      sessionTitle: this.record.sessionTitle,
      slotDate: this.record.slotDate,
      weekIndex: this.record.weekIndex,
      plannedMinutes: this.record.plannedMinutes,
      startedAt: this.record.startedAt,
      endedAt,
      activeMinutes,
      pauseCount: this.record.pauseIntervals.length,
      totalPauseMinutes: Math.round(totalPauseMs / 60_000),
      pomodorosCompleted: completedPomos,
      source: 'active',
      resolution,
      duration: activeMinutes,
      description: this.record.sessionTitle,
      date: this.record.slotDate,
    };

    await this.eventStore.append(
      SESSION_EVENT_KINDS.LOGGED,
      payload as unknown as Record<string, unknown>
    );

    await this.clearActiveSession();
    this.state = 'idle';
    this.notify();
  }

  private async persistToDb(): Promise<void> {
    if (!this.record) return;
    try {
      await this.eventStore.table('activeSession').put(this.record);
    } catch {
      // Best-effort persistence — don't crash the session
    }
  }

  private async clearActiveSession(): Promise<void> {
    try {
      await this.eventStore.table('activeSession').delete(1);
    } catch {
      // Best-effort
    }
    this.record = null;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        // Listeners should not throw
      }
    }
  }
}
