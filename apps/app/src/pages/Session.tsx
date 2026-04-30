import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useEventStore } from '../events/useEventStore';
import { DurabilityHooks } from '../lib/DurabilityHooks';
import { SessionLifecycle } from '../session/SessionLifecycle';
import { DEFAULT_POMODORO_CONFIG } from '../session/types';
import type { SessionState, SessionSlotData, WalkAwayResolution, RecoveryResolution } from '../session/types';
import type { PomodoroPhase } from '../session/pomodoro';
import { SyncIndicator } from '../components/SyncIndicator';
import {
  PulseDot,
  SessionEyebrow,
  SessionTitle,
  SessionSubtitle,
  TimerDisplay,
  PomodoroIndicator,
  PlannedEndLine,
  OpenMaterialButton,
  MaterialStrip,
  EndSessionButton,
  ComeBackLaterButton,
  PauseResumeButton,
  SessionFrame,
  WalkAwayDialog,
  RecoveryDialog,
} from '../session/components';
import '../session/session.css';

export function Session() {
  const location = useLocation();
  const navigate = useNavigate();
  const eventStore = useEventStore();
  const slotData = location.state as SessionSlotData | null;

  const lcRef = useRef<SessionLifecycle | null>(null);
  const durabilityRef = useRef<DurabilityHooks | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [elapsedActiveMs, setElapsedActiveMs] = useState(0);
  const [, setElapsedWallClockMs] = useState(0);
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>({ phase: 'none', current: 0, total: 0, remainingMs: 0 });
  const [initialized, setInitialized] = useState(false);

  // Initialize lifecycle
  useEffect(() => {
    const durability = new DurabilityHooks();
    durabilityRef.current = durability;

    const lc = new SessionLifecycle({
      eventStore,
      durabilityHooks: durability,
      pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      audioContext: null, // Created on user gesture (start)
    });

    lcRef.current = lc;
    lc.subscribe(setSessionState);

    const init = async () => {
      const state = await lc.initialize();

      if (state === 'idle' && slotData) {
        try {
          audioCtxRef.current = new AudioContext();
        } catch {
          // AudioContext not available
        }
        await lc.start(slotData);
      }

      setSessionState(lc.getState());
      setInitialized(true);
    };

    init();

    return () => {
      lc.destroy();
      durability.destroy();
    };
  }, [eventStore, slotData]);

  // Timer tick interval
  useEffect(() => {
    if (sessionState !== 'active' && sessionState !== 'walk_away') return;

    const interval = setInterval(() => {
      const lc = lcRef.current;
      if (!lc) return;

      lc.tick();
      setElapsedActiveMs(lc.getElapsedActiveMs());
      setElapsedWallClockMs(lc.getElapsedWallClockMs());
      setPomodoroPhase(lc.getPomodoroPhase());
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState]);

  // Update derived state when paused (no tick running)
  useEffect(() => {
    const lc = lcRef.current;
    if (!lc || sessionState === 'idle') return;
    setElapsedActiveMs(lc.getElapsedActiveMs());
    setElapsedWallClockMs(lc.getElapsedWallClockMs());
    setPomodoroPhase(lc.getPomodoroPhase());
  }, [sessionState]);

  const handlePauseResume = useCallback(async () => {
    const lc = lcRef.current;
    if (!lc) return;

    if (sessionState === 'paused') {
      await lc.resume();
    } else {
      await lc.pause();
    }
  }, [sessionState]);

  const handleEnd = useCallback(async () => {
    const lc = lcRef.current;
    if (!lc) return;
    await lc.end();
    navigate('/home');
  }, [navigate]);

  const handleComeBackLater = useCallback(async () => {
    const lc = lcRef.current;
    if (!lc) return;
    await lc.pause();
    navigate('/home');
  }, [navigate]);

  const handleWalkAwayResolve = useCallback(async (resolution: WalkAwayResolution) => {
    const lc = lcRef.current;
    if (!lc) return;
    await lc.resolveWalkAway(resolution);
    navigate('/home');
  }, [navigate]);

  const handleRecoveryResolve = useCallback(async (resolution: RecoveryResolution) => {
    const lc = lcRef.current;
    if (!lc) return;
    await lc.resolveRecovery(resolution);
    if (resolution === 'end_now') {
      navigate('/home');
    }
  }, [navigate]);

  if (!initialized) {
    return (
      <div className="session-layout session-layout-centered">
        <p className="t-body" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          Loading...
        </p>
      </div>
    );
  }

  // No active session and no slot data to start one
  if (sessionState === 'idle') {
    return (
      <div className="session-empty">
        <p className="t-body">No active session.</p>
        <p>Start one from your home screen.</p>
        <Link to="/home" className="btn btn-secondary">Go to Home</Link>
      </div>
    );
  }

  const record = lcRef.current?.getRecord();
  if (!record) return null;

  const isOverrun = (lcRef.current?.isOverrun()) ?? false;
  const isBreak = pomodoroPhase.phase === 'break';
  const isPaused = sessionState === 'paused';
  const overrunMinutes = isOverrun
    ? Math.round((elapsedActiveMs - record.plannedMinutes * 60_000) / 60_000)
    : 0;

  const plannedEndTime = new Date(new Date(record.startedAt).getTime() + record.plannedMinutes * 60_000);
  const startedAtLabel = new Date(record.startedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const materialMeta = record.materialUrl ? 'MANUAL · LINKED' : 'MANUAL · NO EMBED';

  return (
    <>
      <div className="session-layout session-layout-centered">
        <div className="session-top-bar">
          <PauseResumeButton isPaused={isPaused} onToggle={handlePauseResume} />
          <SyncIndicator />
        </div>

        <SessionFrame overrun={isOverrun} isBreak={isBreak}>
          <div className="session-eyebrow-row">
            <PulseDot state={sessionState} />
            <SessionEyebrow
              state={sessionState}
              weekIndex={record.weekIndex}
              overrunMinutes={overrunMinutes}
              isBreak={isBreak}
            />
          </div>

          <SessionTitle title={record.sessionTitle} />
          <SessionSubtitle subtitle={record.materialUrl ? 'Linked material' : 'Manual · pen and paper'} />

          <TimerDisplay elapsedMs={elapsedActiveMs} overrun={isOverrun} large />

          <PomodoroIndicator phase={pomodoroPhase} />

          <PlannedEndLine
            plannedMinutes={record.plannedMinutes}
            endsAt={plannedEndTime}
            overrun={isOverrun}
          />

          {record.materialUrl && (
            <OpenMaterialButton url={record.materialUrl} />
          )}

          <MaterialStrip
            title={record.sessionTitle}
            meta={materialMeta}
          />
        </SessionFrame>

        <div className="session-actions">
          <EndSessionButton onEnd={handleEnd} />
          {!isPaused && (
            <ComeBackLaterButton onComeBackLater={handleComeBackLater} />
          )}
        </div>

        {/* Desktop floating End button */}
        <div className="session-fab-end desktop-only">
          <EndSessionButton onEnd={handleEnd} />
        </div>
      </div>

      {sessionState === 'walk_away' && (
        <WalkAwayDialog
          materialTitle={record.sessionTitle}
          elapsedMinutes={Math.round(elapsedActiveMs / 60_000)}
          startedAtLabel={startedAtLabel}
          plannedMinutes={record.plannedMinutes}
          onResolve={handleWalkAwayResolve}
        />
      )}

      {sessionState === 'recovery' && (
        <RecoveryDialog
          materialTitle={record.sessionTitle}
          elapsedMinutes={Math.round(elapsedActiveMs / 60_000)}
          awayMinutes={0}
          onResolve={handleRecoveryResolve}
        />
      )}
    </>
  );
}
