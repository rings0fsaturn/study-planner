import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useEventStore } from '../events/useEventStore';
import { useMatchMedia } from '../lib/useMatchMedia';
import { DurabilityHooks } from '../lib/DurabilityHooks';
import { SessionLifecycle } from '../session/SessionLifecycle';
import { DEFAULT_POMODORO_CONFIG } from '../session/types';
import { resolveSessionLayout } from '../session/resolveSessionLayout';
import { formatElapsedTime } from '../session/components/TimerDisplay';
import type { SessionState, SessionSlotData, WalkAwayResolution, RecoveryResolution } from '../session/types';
import type { PomodoroPhase } from '../session/pomodoro';
import {
  PulseDot,
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
  YouTubeEmbed,
  ArticleBanner,
  YouTubeResumeHint,
  DesktopTimerStrip,
  EscConfirmBanner,
  DesktopArticlePlaceholder,
} from '../session/components';
import '../session/session.css';

export function Session() {
  const location = useLocation();
  const navigate = useNavigate();
  const eventStore = useEventStore();
  const slotData = location.state as SessionSlotData | null;
  const isDesktop = useMatchMedia('(min-width: 1024px)');

  const lcRef = useRef<SessionLifecycle | null>(null);
  const durabilityRef = useRef<DurabilityHooks | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isResumeRef = useRef(false);
  const youtubePositionRef = useRef(0);

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [elapsedActiveMs, setElapsedActiveMs] = useState(0);
  const [, setElapsedWallClockMs] = useState(0);
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>({ phase: 'none', current: 0, total: 0, remainingMs: 0 });
  const [initialized, setInitialized] = useState(false);
  const [showResumeHint, setShowResumeHint] = useState(false);
  const [articleOpened, setArticleOpened] = useState(false);
  const [showEscConfirm, setShowEscConfirm] = useState(false);

  // Initialize lifecycle
  useEffect(() => {
    const durability = new DurabilityHooks();
    durabilityRef.current = durability;

    const lc = new SessionLifecycle({
      eventStore,
      durabilityHooks: durability,
      pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      audioContext: null,
    });

    lcRef.current = lc;
    lc.subscribe(setSessionState);

    const init = async () => {
      const state = await lc.initialize();

      if (state !== 'idle') {
        isResumeRef.current = true;
      }

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

      // Set initial article opened state for resume
      const record = lc.getRecord();
      if (isResumeRef.current && record?.kind === 'article') {
        setArticleOpened(true);
      }
    };

    init();

    return () => {
      lc.destroy();
      durability.destroy();
    };
  }, [eventStore, slotData]);

  // Resume hint — only for YouTube, only when active/paused
  useEffect(() => {
    if (
      initialized &&
      isResumeRef.current &&
      lcRef.current?.getRecord()?.kind === 'youtube' &&
      (sessionState === 'active' || sessionState === 'paused')
    ) {
      setShowResumeHint(true);
    }
  }, [initialized, sessionState]);

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

  // Update derived state when paused
  useEffect(() => {
    const lc = lcRef.current;
    if (!lc || sessionState === 'idle') return;
    setElapsedActiveMs(lc.getElapsedActiveMs());
    setElapsedWallClockMs(lc.getElapsedWallClockMs());
    setPomodoroPhase(lc.getPomodoroPhase());
  }, [sessionState]);

  // YouTube position: 10s persist interval
  useEffect(() => {
    const record = lcRef.current?.getRecord();
    if (record?.kind !== 'youtube' || sessionState !== 'active') return;
    const interval = setInterval(() => {
      lcRef.current?.updateYoutubePosition(youtubePositionRef.current);
    }, 10_000);
    return () => clearInterval(interval);
  }, [sessionState]);

  // YouTube position: persist on visibilitychange
  useEffect(() => {
    const record = lcRef.current?.getRecord();
    if (record?.kind !== 'youtube') return;
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        lcRef.current?.updateYoutubePosition(youtubePositionRef.current);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [initialized]);

  const onYoutubeTimeUpdate = useCallback((seconds: number) => {
    youtubePositionRef.current = seconds;
  }, []);

  // ESC double-tap (desktop only)
  useEffect(() => {
    if (!isDesktop) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEscConfirm) {
          setShowEscConfirm(false);
          void handleEnd();
        } else {
          setShowEscConfirm(true);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDesktop, showEscConfirm]);

  const persistYoutubePosition = useCallback(async () => {
    const record = lcRef.current?.getRecord();
    if (record?.kind === 'youtube') {
      await lcRef.current?.updateYoutubePosition(youtubePositionRef.current);
    }
  }, []);

  const handlePauseResume = useCallback(async () => {
    const lc = lcRef.current;
    if (!lc) return;
    await persistYoutubePosition();
    if (sessionState === 'paused') {
      await lc.resume();
    } else {
      await lc.pause();
    }
  }, [sessionState, persistYoutubePosition]);

  const handleEnd = useCallback(async () => {
    const lc = lcRef.current;
    if (!lc) return;
    await persistYoutubePosition();
    await lc.end();
    navigate('/home');
  }, [navigate, persistYoutubePosition]);

  const handleComeBackLater = useCallback(async () => {
    const lc = lcRef.current;
    if (!lc) return;
    await persistYoutubePosition();
    await lc.pause();
    navigate('/home');
  }, [navigate, persistYoutubePosition]);

  const handleWalkAwayResolve = useCallback(async (resolution: WalkAwayResolution) => {
    const lc = lcRef.current;
    if (!lc) return;
    await persistYoutubePosition();
    await lc.resolveWalkAway(resolution);
    navigate('/home');
  }, [navigate, persistYoutubePosition]);

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

  const layout = resolveSessionLayout(
    record,
    sessionState,
    isDesktop,
    isResumeRef.current,
    overrunMinutes,
    isBreak,
    articleOpened,
  );

  const plannedEndTime = new Date(new Date(record.startedAt).getTime() + record.plannedMinutes * 60_000);
  const startedAtLabel = new Date(record.startedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const timerString = formatElapsedTime(elapsedActiveMs);
  const statusText = isOverrun
    ? `${overrunMinutes} min over plan · ended ${plannedEndTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
    : `${layout.eyebrowText.includes('·') ? layout.eyebrowText : `In session · ${record.plannedMinutes} min planned · ends ${plannedEndTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}`;

  // ---------- Desktop layout ----------
  if (layout.isDesktop) {
    return (
      <>
        {layout.useDesktopTimerStrip ? (
          <div className="desktop-session-pane">
            {layout.showArticleBanner && (
              <ArticleBanner
                url={record.materialUrl!}
                isResume={isResumeRef.current}
                onOpened={() => setArticleOpened(true)}
              />
            )}

            {showResumeHint && (
              <YouTubeResumeHint onDismiss={() => setShowResumeHint(false)} />
            )}

            <DesktopTimerStrip
              timerString={timerString}
              title={record.sessionTitle}
              statusText={statusText}
              statusColorClass={isOverrun ? 'terracotta' : isBreak ? 'clay' : 'moss'}
              materialIcon={layout.materialIcon}
              materialIconClass={layout.materialIconClass}
              materialMeta={layout.materialMeta}
              isOverrun={isOverrun}
            />

            {layout.showYouTubeEmbed && record.youtubeVideoId && (
              <YouTubeEmbed
                videoId={record.youtubeVideoId}
                initialSeekPosition={record.youtubeLastPosition}
                onTimeUpdate={onYoutubeTimeUpdate}
                paused={sessionState === 'paused'}
              />
            )}

            {layout.showArticleBanner && (
              <DesktopArticlePlaceholder url={record.materialUrl!} />
            )}

            <div className="desktop-come-back-row">
              <button
                className="btn btn-ghost"
                style={{ color: 'var(--text-tertiary)' }}
                onClick={handleComeBackLater}
              >
                <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                I'll come back later
              </button>
              <span className="mono-caps">Press ESC to end</span>
            </div>
          </div>
        ) : (
          /* Desktop manual layout — giant centered timer */
          <div className="desktop-session-pane" style={{ padding: '64px 32px', textAlign: 'center' }}>
            <div className={`session-eyebrow-row ${layout.eyebrowColorClass}`} style={{ marginBottom: 16 }}>
              <PulseDot state={sessionState} />
              <span>{layout.eyebrowText}</span>
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '-0.018em',
              lineHeight: 1.2,
              marginBottom: 8,
            }}>
              {record.sessionTitle}
            </div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 48 }}>
              {layout.subtitle}
            </div>
            <TimerDisplay
              elapsedMs={elapsedActiveMs}
              overrun={isOverrun}
              sizeClass={layout.timerSizeClass}
            />
            <PomodoroIndicator phase={pomodoroPhase} />
            <div className="mono-caps" style={{ marginBottom: 48 }}>
              of {record.plannedMinutes} min planned · ends {plannedEndTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>
            {layout.showOpenMaterialButton && record.materialUrl && (
              <OpenMaterialButton url={record.materialUrl} />
            )}
            <MaterialStrip
              title={record.sessionTitle}
              meta={layout.materialMeta}
              iconLabel={layout.materialIcon}
            />
          </div>
        )}

        {layout.showFab && sessionState !== 'walk_away' && sessionState !== 'recovery' && (
          <div className="session-fab-end">
            <EndSessionButton onEnd={handleEnd} />
          </div>
        )}

        {showEscConfirm && (
          <EscConfirmBanner onDismiss={() => setShowEscConfirm(false)} />
        )}

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

  // ---------- Mobile layout ----------
  return (
    <>
      <div className="session-layout session-layout-centered">
        <div className="session-top-bar">
          <PauseResumeButton isPaused={isPaused} onToggle={handlePauseResume} />
        </div>

        {layout.showArticleBanner && (
          <ArticleBanner
            url={record.materialUrl!}
            isResume={isResumeRef.current}
            onOpened={() => setArticleOpened(true)}
          />
        )}

        {showResumeHint && (
          <YouTubeResumeHint onDismiss={() => setShowResumeHint(false)} />
        )}

        <SessionFrame overrun={isOverrun} isBreak={isBreak} isPaused={isPaused}>
          <div className={`session-eyebrow-row ${layout.eyebrowColorClass}`}>
            <PulseDot state={sessionState} />
            <span>{layout.eyebrowText}</span>
          </div>

          <SessionTitle title={record.sessionTitle} />
          <SessionSubtitle subtitle={layout.subtitle} />

          <div className="session-timer-display">
            <TimerDisplay
              elapsedMs={elapsedActiveMs}
              overrun={isOverrun}
              sizeClass={layout.timerSizeClass}
            />
            <PomodoroIndicator phase={pomodoroPhase} />
            <PlannedEndLine
              plannedMinutes={record.plannedMinutes}
              endsAt={plannedEndTime}
              overrun={isOverrun}
            />
          </div>

          {layout.showYouTubeEmbed && record.youtubeVideoId && (
            <YouTubeEmbed
              videoId={record.youtubeVideoId}
              initialSeekPosition={record.youtubeLastPosition}
              onTimeUpdate={onYoutubeTimeUpdate}
              paused={sessionState === 'paused'}
            />
          )}

          {layout.showReOpenButton && (
            <a
              href={record.materialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-block"
              style={{ marginTop: 'var(--space-3)' }}
            >
              <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Re-open article
            </a>
          )}

          {layout.showOpenMaterialButton && record.materialUrl && (
            <OpenMaterialButton url={record.materialUrl} />
          )}

          <MaterialStrip
            title={record.sessionTitle}
            meta={layout.materialMeta}
            iconLabel={layout.materialIcon}
          />
        </SessionFrame>

        <div className="session-actions">
          <EndSessionButton onEnd={handleEnd} />
          {!isPaused && (
            <ComeBackLaterButton onComeBackLater={handleComeBackLater} />
          )}
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
