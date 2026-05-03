import type { ActiveSessionRecord, SessionState } from '../types';
import type { PomodoroPhase } from '../pomodoro';
import type { YouTubePlayerAdapter, YouTubePlayerState } from '../YouTubePlayerAdapter';
import {
  PulseDot,
  SessionEyebrow,
  getEyebrowColorClass,
  PomodoroIndicator,
  PlannedEndLine,
  ComeBackLaterButton,
  PauseResumeButton,
  PlannedEndBanner,
} from './index';
import { YouTubeEmbed } from './YouTubeEmbed';
import { VideoStatusStrip } from './VideoStatusStrip';
import { SessionBanner } from './SessionBanner';

export interface SessionYouTubeLayoutProps {
  record: ActiveSessionRecord;
  sessionState: SessionState;
  elapsedActiveMs: number;
  pomodoroPhase: PomodoroPhase;
  isPaused: boolean;
  isOverrun: boolean;
  isBreak: boolean;
  overrunMinutes: number;
  isDesktop: boolean;
  onPauseResume: () => void;
  onEnd: () => void;
  onComeBackLater: () => void;
  playerAdapterRef: React.MutableRefObject<YouTubePlayerAdapter | null>;
  playerState: YouTubePlayerState;
  videoDurationFormatted: string;
  resumeBannerVisible: boolean;
  onDismissResumeBanner: () => void;
  videoEndedPromptVisible: boolean;
  onPlayerStateChange: (state: YouTubePlayerState) => void;
  onPlayerReady: () => void;
  plannedEndReached?: boolean;
  plannedEndDismissed?: boolean;
  onDismissPlannedEnd?: () => void;
  onEndFromBanner?: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function SessionYouTubeLayout({
  record,
  sessionState,
  elapsedActiveMs,
  pomodoroPhase,
  isPaused,
  isOverrun,
  isBreak,
  overrunMinutes,
  isDesktop,
  onPauseResume,
  onEnd,
  onComeBackLater,
  playerAdapterRef,
  playerState,
  videoDurationFormatted,
  resumeBannerVisible,
  onDismissResumeBanner,
  videoEndedPromptVisible,
  onPlayerStateChange,
  onPlayerReady,
  plannedEndReached,
  plannedEndDismissed,
  onDismissPlannedEnd,
  onEndFromBanner,
}: SessionYouTubeLayoutProps) {
  const plannedEndTime = new Date(new Date(record.startedAt).getTime() + record.plannedMinutes * 60_000);
  const elapsedFormatted = formatElapsed(elapsedActiveMs);

  return (
    <div className={`session-layout session-layout-youtube${isPaused ? ' is-paused' : ''}`}>
      <div className="session-top-bar">
        <PauseResumeButton isPaused={isPaused} onToggle={onPauseResume} />
      </div>

      {plannedEndReached && !plannedEndDismissed && onDismissPlannedEnd && (
        <PlannedEndBanner
          onDismiss={onDismissPlannedEnd}
          actionLabel="End session"
          onAction={onEndFromBanner}
        />
      )}

      {resumeBannerVisible && (
        <SessionBanner
          message="Resumed from where you left off"
          autoDismissMs={5000}
          onDismiss={onDismissResumeBanner}
        />
      )}

      {videoEndedPromptVisible && (
        <SessionBanner
          message="Video finished"
          description="End session when you're ready."
          actionLabel="End session"
          onAction={onEnd}
        />
      )}

      <div className="session-yt-timer-panel">
        <div className="session-yt-timer-left">
          <div className={`session-eyebrow-row ${getEyebrowColorClass(sessionState, overrunMinutes, isBreak)}`} style={{ justifyContent: 'flex-start' }}>
            <PulseDot state={sessionState} />
            <SessionEyebrow
              state={sessionState}
              weekIndex={record.weekIndex}
              overrunMinutes={overrunMinutes}
              isBreak={isBreak}
            />
          </div>
          <div className="session-title" style={{ textAlign: 'left', marginBottom: 2 }}>
            {record.sessionTitle}
          </div>
          <div className="session-yt-status-strip" style={{ marginBottom: 0 }}>
            YOUTUBE · {videoDurationFormatted}
          </div>
        </div>

        <div className="session-yt-timer-right">
          <div className={`session-timer-time${isOverrun ? ' is-overrun' : ''}`}>
            {elapsedFormatted}
          </div>
          <div className="session-timer-of">
            / {record.plannedMinutes} MIN · ENDS{' '}
            {plannedEndTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })}
          </div>
          <PomodoroIndicator phase={pomodoroPhase} />
          <PlannedEndLine
            plannedMinutes={record.plannedMinutes}
            endsAt={plannedEndTime}
            overrun={isOverrun}
          />
        </div>
      </div>

      <YouTubeEmbed
        videoId={record.youtubeVideoId!}
        startSeconds={record.videoPlaybackPosition}
        onStateChange={onPlayerStateChange}
        onReady={onPlayerReady}
        adapterRef={playerAdapterRef}
      />

      <VideoStatusStrip
        durationFormatted={videoDurationFormatted}
        playerState={playerState}
      />

      <div className="session-yt-bottom-row">
        <ComeBackLaterButton onComeBackLater={onComeBackLater} />
        {isDesktop && (
          <span className="session-yt-esc-hint">PRESS ESC TO END</span>
        )}
      </div>

      {/* Mobile inline End button */}
      {!isDesktop && (
        <div className="session-actions" style={{ marginTop: 'var(--space-4)' }}>
          <button className="btn btn-accent" onClick={onEnd}>End session</button>
        </div>
      )}

      {/* Desktop fixed FAB */}
      {isDesktop && (
        <div className="session-fab-end">
          <button className="btn btn-accent" onClick={onEnd}>End session</button>
        </div>
      )}
    </div>
  );
}
