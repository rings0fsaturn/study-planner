import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useEventStore } from '../events/useEventStore';
import { DurabilityHooks } from '../lib/DurabilityHooks';
import { useMatchMedia } from '../lib/useMatchMedia';
import { SessionLifecycle } from '../session/SessionLifecycle';
import { TabNotificationStrategy, createBrowserDeps } from '../session/NotificationStrategy';
import { DEFAULT_POMODORO_CONFIG } from '../session/types';
import type { SessionState, SessionSlotData, WalkAwayResolution, RecoveryResolution } from '../session/types';
import type { PomodoroPhase } from '../session/pomodoro';
import type { YouTubePlayerAdapter, YouTubePlayerState } from '../session/YouTubePlayerAdapter';
import {
  WalkAwayDialog,
  RecoveryDialog,
  SessionDefaultLayout,
  SessionYouTubeLayout,
  EscapeConfirmModal,
} from '../session/components';
import '../session/session.css';

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Session() {
  const location = useLocation();
  const navigate = useNavigate();
  const eventStore = useEventStore();
  const slotData = location.state as SessionSlotData | null;
  const isDesktop = useMatchMedia('(min-width: 1024px)');

  const lcRef = useRef<SessionLifecycle | null>(null);
  const durabilityRef = useRef<DurabilityHooks | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playerAdapterRef = useRef<YouTubePlayerAdapter | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [elapsedActiveMs, setElapsedActiveMs] = useState(0);
  const [, setElapsedWallClockMs] = useState(0);
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>({ phase: 'none', current: 0, total: 0, remainingMs: 0 });
  const [initialized, setInitialized] = useState(false);
  const [articleAutoOpened, setArticleAutoOpened] = useState(false);
  const [playerState, setPlayerState] = useState<YouTubePlayerState>('unstarted');
  const [videoDuration, setVideoDuration] = useState(0);
  const [resumeBannerVisible, setResumeBannerVisible] = useState(false);
  const [videoEndedPromptVisible, setVideoEndedPromptVisible] = useState(false);
  const [escapeModalVisible, setEscapeModalVisible] = useState(false);
  const [plannedEndReached, setPlannedEndReached] = useState(false);
  const [plannedEndDismissed, setPlannedEndDismissed] = useState(false);

  // Initialize lifecycle
  useEffect(() => {
    const durability = new DurabilityHooks();
    durabilityRef.current = durability;

    const notifier = new TabNotificationStrategy(createBrowserDeps());

    const lc = new SessionLifecycle({
      eventStore,
      durabilityHooks: durability,
      pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      audioContext: null,
      notifier,
    });

    lcRef.current = lc;
    lc.subscribe(setSessionState);

    const init = async () => {
      const state = await lc.initialize();

      if (state === 'idle' && slotData) {
        if (slotData.kind === 'article' && slotData.materialUrl) {
          window.open(slotData.materialUrl, '_blank');
          window.focus();
          setArticleAutoOpened(true);
        }

        try {
          audioCtxRef.current = new AudioContext();
        } catch {
          // AudioContext not available
        }
        await lc.start(slotData);
      }

      if (state !== 'idle' && lc.getRecord()?.kind === 'article') {
        setArticleAutoOpened(true);
      }

      if (state !== 'idle' && lc.getRecord()?.kind === 'youtube' && lc.getRecord()?.videoPlaybackPosition) {
        setResumeBannerVisible(true);
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
      setPlannedEndReached(lc.isPlannedEndReached());
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

  // Escape key handler
  useEffect(() => {
    const record = lcRef.current?.getRecord();
    if (!record || sessionState === 'idle') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.fullscreenElement) return;
      if (escapeModalVisible) return;

      e.preventDefault();
      setEscapeModalVisible(true);

      // Pause session + video
      const lc = lcRef.current;
      if (lc && sessionState === 'active') {
        lc.pause();
        playerAdapterRef.current?.pause();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sessionState, escapeModalVisible]);

  // YouTube player state change handler
  const handlePlayerStateChange = useCallback((state: YouTubePlayerState) => {
    setPlayerState(state);
    if (state === 'ended') {
      setVideoEndedPromptVisible(true);
    } else if (state === 'playing') {
      setVideoEndedPromptVisible(false);
    }
  }, []);

  const handlePlayerReady = useCallback(() => {
    const adapter = playerAdapterRef.current;
    if (adapter) {
      setVideoDuration(adapter.getDuration());
    }
  }, []);

  const handlePauseResume = useCallback(async () => {
    const lc = lcRef.current;
    if (!lc) return;

    if (sessionState === 'paused') {
      await lc.resume();
      playerAdapterRef.current?.play();
    } else {
      await lc.pause();
      playerAdapterRef.current?.pause();
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

    // Save video playback position before pausing
    const adapter = playerAdapterRef.current;
    const record = lc.getRecord();
    if (adapter && record) {
      record.videoPlaybackPosition = adapter.getCurrentTime();
    }

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

  const handleEscapeConfirm = useCallback(async () => {
    setEscapeModalVisible(false);
    const lc = lcRef.current;
    if (!lc) return;
    await lc.end();
    navigate('/home');
  }, [navigate]);

  const handleEscapeCancel = useCallback(async () => {
    setEscapeModalVisible(false);
    const lc = lcRef.current;
    if (!lc) return;
    if (lc.getState() === 'paused') {
      await lc.resume();
      playerAdapterRef.current?.play();
    }
  }, []);

  const handleDismissPlannedEnd = useCallback(() => {
    const lc = lcRef.current;
    if (!lc) return;
    lc.dismissPlannedEnd();
    setPlannedEndDismissed(true);
    setPlannedEndReached(false);
  }, []);

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

  const startedAtLabel = new Date(record.startedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const isYouTube = record.kind === 'youtube' && record.youtubeVideoId;

  return (
    <>
      {isYouTube ? (
        <SessionYouTubeLayout
          record={record}
          sessionState={sessionState}
          elapsedActiveMs={elapsedActiveMs}
          pomodoroPhase={pomodoroPhase}
          isPaused={isPaused}
          isOverrun={isOverrun}
          isBreak={isBreak}
          overrunMinutes={overrunMinutes}
          isDesktop={isDesktop}
          onPauseResume={handlePauseResume}
          onEnd={handleEnd}
          onComeBackLater={handleComeBackLater}
          playerAdapterRef={playerAdapterRef}
          playerState={playerState}
          videoDurationFormatted={formatDuration(videoDuration)}
          resumeBannerVisible={resumeBannerVisible}
          onDismissResumeBanner={() => setResumeBannerVisible(false)}
          videoEndedPromptVisible={videoEndedPromptVisible}
          onPlayerStateChange={handlePlayerStateChange}
          onPlayerReady={handlePlayerReady}
          plannedEndReached={plannedEndReached}
          plannedEndDismissed={plannedEndDismissed}
          onDismissPlannedEnd={handleDismissPlannedEnd}
          onEndFromBanner={handleEnd}
        />
      ) : (
        <SessionDefaultLayout
          record={record}
          sessionState={sessionState}
          elapsedActiveMs={elapsedActiveMs}
          pomodoroPhase={pomodoroPhase}
          isPaused={isPaused}
          isOverrun={isOverrun}
          isBreak={isBreak}
          overrunMinutes={overrunMinutes}
          onPauseResume={handlePauseResume}
          onEnd={handleEnd}
          onComeBackLater={handleComeBackLater}
          articleAutoOpened={articleAutoOpened}
          plannedEndReached={plannedEndReached}
          plannedEndDismissed={plannedEndDismissed}
          onDismissPlannedEnd={handleDismissPlannedEnd}
          onEndFromBanner={handleEnd}
        />
      )}

      {escapeModalVisible && (
        <EscapeConfirmModal
          onConfirm={handleEscapeConfirm}
          onCancel={handleEscapeCancel}
        />
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
