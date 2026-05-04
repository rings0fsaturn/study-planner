/**
 * Session lifecycle types for Study Tracker.
 *
 * Five event kinds flow through the sync pipeline:
 *   SessionStarted  → user begins a study session
 *   SessionPaused   → user pauses (clock stops, Pomodoro keeps ticking)
 *   SessionResumed  → user resumes from pause
 *   SessionLogged   → session ends with logged study time (also used by manual /log form)
 *   SessionAbandoned → session closes without logged time (discard or stale)
 *
 * An "unresolved" session is a SessionStarted with no matching SessionLogged
 * or SessionAbandoned (matched by sessionId). Cross-device sync uses this to
 * detect active sessions on other devices.
 *
 * Pomodoro intervals are wall-clock based (computed from startedAt, ignoring
 * pause intervals). This means break/work phase advances even while paused.
 * On overtime (elapsed > planned), Pomodoro stops cycling.
 *
 * Downstream consumers:
 *   - ProgressEngine (issue 009): reads duration, activeMinutes, source
 *   - PaceCalibration (issue 009): reads activeMinutes, plannedMinutes, source
 *   - WeeklyNarrative (issue 011): reads pomodorosCompleted, pauseCount, resolution
 *   - SyncEngine: pushes/pulls all event kinds through public.events table
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** UUID linking all lifecycle events for a single session */
export type SessionId = string;

export type MaterialKind = 'youtube' | 'article' | 'manual';

/** Pomodoro timer configuration snapshotted at session start */
export interface PomodoroConfig {
  /** Duration of a work interval in minutes (default: 50) */
  workMinutes: number;
  /** Duration of a break interval in minutes (default: 10) */
  breakMinutes: number;
}

export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  workMinutes: 50,
  breakMinutes: 10,
};

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

/**
 * Emitted when the user starts a session from the up-next card.
 * One per session — the sessionId is generated here and used by all
 * subsequent events for this session.
 */
export interface SessionStartedPayload {
  sessionId: SessionId;
  /** Which material from the roadmap */
  materialId: string;
  /** Display title shown in the session UI */
  sessionTitle: string;
  /** ISO date (YYYY-MM-DD) — the scheduled date of the slot in the roadmap */
  slotDate: string;
  /** Which week in the roadmap (0-indexed) */
  weekIndex: number;
  /** How long the slot was planned for, in minutes */
  plannedMinutes: number;
  /** ISO timestamp — when the user tapped "Start session" */
  startedAt: string;
  /**
   * Snapshot of Pomodoro config at session start.
   * Stored here so historical data remains accurate even if the user
   * changes their Pomodoro settings later (via PreferenceSet, issue 015).
   */
  pomodoroConfig: PomodoroConfig;
}

/**
 * Emitted when the user taps Pause (clock stops).
 * The Pomodoro timer continues on wall-clock time — only the study
 * clock and activeMinutes tracking are affected by pause.
 */
export interface SessionPausedPayload {
  sessionId: SessionId;
  /** ISO timestamp — when the user paused */
  pausedAt: string;
  /** Total non-paused study minutes accumulated at the moment of pause */
  elapsedActiveMinutes: number;
  /** Which Pomodoro work block the user was on (1-indexed). 0 if no Pomodoro. */
  currentPomodoro: number;
}

/**
 * Emitted when the user resumes from pause.
 */
export interface SessionResumedPayload {
  sessionId: SessionId;
  /** ISO timestamp — when the user tapped Resume */
  resumedAt: string;
}

/**
 * Emitted when a session ends with logged study time.
 *
 * Backward-compatible with the manual /log form: the `duration`,
 * `description`, and `date` fields are always present regardless of source.
 * Active sessions populate the extended fields; manual logs leave them
 * undefined.
 *
 * `source` distinguishes the two paths so downstream consumers
 * (PaceCalibration, WeeklyNarrative) can weight them differently.
 */
export interface SessionLoggedPayload {
  // --- Active session fields (undefined for manual logs) ---
  /** UUID linking to SessionStarted */
  sessionId?: SessionId;
  materialId?: string;
  sessionTitle?: string;
  /** ISO date — the scheduled slot date */
  slotDate?: string;
  weekIndex?: number;
  /** The slot's planned duration in minutes */
  plannedMinutes?: number;
  /** ISO timestamp — when the session started */
  startedAt?: string;
  /** ISO timestamp — when the user tapped End */
  endedAt?: string;
  /** Total non-paused study time in minutes */
  activeMinutes?: number;
  /** Number of times the user paused during this session */
  pauseCount?: number;
  /** Total minutes spent in paused state */
  totalPauseMinutes?: number;
  /** Minutes of actual YouTube video playback (undefined for non-YouTube sessions) */
  videoPlayTimeMinutes?: number;
  /** Number of full Pomodoro work intervals completed */
  pomodorosCompleted?: number;
  /** How the session ended — 'completed' (normal End tap) or 'trimmed' (walk-away trim) */
  resolution?: 'completed' | 'trimmed';

  // --- Always-present fields (backward compat) ---
  /**
   * 'active' = logged from the live session timer
   * 'manual' = logged from the /log past-session form
   * Defaults to 'manual' for existing events without this field.
   */
  source: 'active' | 'manual';
  /** Study duration in minutes. = activeMinutes for active sessions. */
  duration: number;
  /** Session description. = sessionTitle for active sessions. */
  description: string;
  /** ISO date (YYYY-MM-DD). = slotDate for active sessions. */
  date: string;
}

/**
 * Emitted to close out a SessionStarted without logging study time.
 *
 * Reasons:
 *   'discarded'       — user chose "Discard" in the walk-away dialog
 *   'stale_6h'        — active session exceeded 6 hours of elapsed time
 *   'stale_midnight'  — active session crossed a calendar date boundary
 *   'stale_12h_paused' — paused session exceeded 12 hours of continuous pause
 *
 * `activeMinutesAtAbandon` is shown in the Home banner so the user
 * can decide whether to manually log the time via /log.
 */
export interface SessionAbandonedPayload {
  sessionId: SessionId;
  reason: 'discarded' | 'stale_6h' | 'stale_midnight' | 'stale_12h_paused';
  /** How many active (non-paused) minutes were accumulated before abandonment */
  activeMinutesAtAbandon: number;
  /** ISO timestamp — when the session was abandoned */
  abandonedAt: string;
}

// ---------------------------------------------------------------------------
// Event kind constants
// ---------------------------------------------------------------------------

export const SESSION_EVENT_KINDS = {
  STARTED: 'SessionStarted',
  PAUSED: 'SessionPaused',
  RESUMED: 'SessionResumed',
  LOGGED: 'SessionLogged',
  ABANDONED: 'SessionAbandoned',
  TAGGED_EXCEPTIONAL: 'SessionTaggedExceptional',
  RECALIBRATION_RESOLVED: 'RecalibrationPromptResolved',
} as const;

// ---------------------------------------------------------------------------
// Local persistence — Dexie activeSession table
// ---------------------------------------------------------------------------

/** A single pause interval with start and optional end */
export interface PauseInterval {
  /** ISO timestamp — when the pause began */
  pausedAt: string;
  /** ISO timestamp — when the pause ended (undefined if still paused) */
  resumedAt?: string;
}

/**
 * Shape stored in the Dexie `activeSession` table as a singleton (id=1).
 *
 * Written on every state change and on page-close (via DurabilityHooks).
 * Read on app launch to detect and recover in-progress sessions.
 *
 * This record is the local source of truth for the session UI.
 * It is NOT synced to Supabase directly — instead, the lifecycle events
 * (SessionStarted, SessionPaused, etc.) flow through the sync pipeline,
 * and remote devices reconstruct the active session from those events.
 */
export interface ActiveSessionRecord {
  /** Always 1 — singleton row */
  id: 1;
  /** UUID linking to the lifecycle events */
  sessionId: SessionId;
  /** Material being studied */
  materialId: string;
  /** Display title */
  sessionTitle: string;
  /** ISO date — scheduled slot date */
  slotDate: string;
  /** Roadmap week (0-indexed) */
  weekIndex: number;
  /** Planned duration in minutes */
  plannedMinutes: number;
  /** ISO timestamp — when the session started */
  startedAt: string;
  /** Current session state */
  status: 'active' | 'paused';
  /** Complete history of pause/resume intervals for accurate time accounting */
  pauseIntervals: PauseInterval[];
  /** Pomodoro config snapshotted at session start */
  pomodoroConfig: PomodoroConfig;
  /** Optional URL for "Open material" button */
  materialUrl?: string;
  /** Material kind for per-kind session rendering */
  kind?: MaterialKind;
  /** YouTube video ID for embed (only when kind === 'youtube') */
  youtubeVideoId?: string;
  /** Persisted video playback position in seconds (for resume) */
  videoPlaybackPosition?: number;
}

// ---------------------------------------------------------------------------
// SessionLifecycle state machine
// ---------------------------------------------------------------------------

/**
 * UI-facing session states:
 *   idle      — no active session
 *   active    — timer running (work or break Pomodoro phase)
 *   paused    — timer frozen, user tapped Pause
 *   walk_away — elapsed > planned + 10 min, dialog shown
 *   recovery  — tab reopened after > 5 min away, dialog shown
 */
export type SessionState = 'idle' | 'active' | 'paused' | 'walk_away' | 'recovery';

/**
 * Walk-away dialog resolution choices.
 *   log_all  — log the entire elapsed time
 *   trim     — log only the planned duration
 *   discard  — abandon the session, log nothing
 */
export type WalkAwayResolution = 'log_all' | 'trim' | 'discard';

/**
 * Recovery dialog resolution choices.
 *   keep_going — resume the session
 *   end_now    — end and log active time accumulated before the user left
 */
export type RecoveryResolution = 'keep_going' | 'end_now';

// ---------------------------------------------------------------------------
// Slot data passed via React Router location state
// ---------------------------------------------------------------------------

/**
 * Data passed from the Home up-next card to /session via location.state.
 * Contains everything needed to start a session without additional queries.
 */
export interface SessionSlotData {
  materialId: string;
  sessionTitle: string;
  slotDate: string;
  weekIndex: number;
  plannedMinutes: number;
  materialUrl?: string;
  role?: 'anchor' | 'foundation' | 'practice';
  kind?: MaterialKind;
  youtubeVideoId?: string;
}

// ---------------------------------------------------------------------------
// Planned-end notification strategy
// ---------------------------------------------------------------------------

export interface PlannedEndNotifier {
  setCallback(cb: () => void): void;
  schedule(remainingMs: number): void;
  cancel(): void;
  dismiss(): void;
  destroy(): void;
  handleVisibilityChange(isHidden: boolean): void;
}
