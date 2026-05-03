import type { ActiveSessionRecord, SessionState } from '../types';
import type { PomodoroPhase } from '../pomodoro';
import {
  PulseDot,
  SessionEyebrow,
  getEyebrowColorClass,
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
  PlannedEndBanner,
} from './index';
import { SessionBanner } from './SessionBanner';

export interface SessionDefaultLayoutProps {
  record: ActiveSessionRecord;
  sessionState: SessionState;
  elapsedActiveMs: number;
  pomodoroPhase: PomodoroPhase;
  isPaused: boolean;
  isOverrun: boolean;
  isBreak: boolean;
  overrunMinutes: number;
  onPauseResume: () => void;
  onEnd: () => void;
  onComeBackLater: () => void;
  articleAutoOpened?: boolean;
  plannedEndReached?: boolean;
  plannedEndDismissed?: boolean;
  onDismissPlannedEnd?: () => void;
  onEndFromBanner?: () => void;
}

function getMaterialMeta(record: ActiveSessionRecord): string {
  switch (record.kind) {
    case 'youtube':
      return 'YOUTUBE · EMBEDDED';
    case 'article':
      return record.materialUrl ? 'ARTICLE · LINKED' : 'ARTICLE';
    default:
      return record.materialUrl ? 'MANUAL · LINKED' : 'MANUAL · NO EMBED';
  }
}

function getSubtitle(record: ActiveSessionRecord): string {
  switch (record.kind) {
    case 'article':
      return 'Article · reading in new tab';
    case 'youtube':
      return 'YouTube · embedded';
    default:
      return record.materialUrl ? 'Linked material' : 'Manual · pen and paper';
  }
}

export function SessionDefaultLayout({
  record,
  sessionState,
  elapsedActiveMs,
  pomodoroPhase,
  isPaused,
  isOverrun,
  isBreak,
  overrunMinutes,
  onPauseResume,
  onEnd,
  onComeBackLater,
  articleAutoOpened,
  plannedEndReached,
  plannedEndDismissed,
  onDismissPlannedEnd,
  onEndFromBanner,
}: SessionDefaultLayoutProps) {
  const plannedEndTime = new Date(new Date(record.startedAt).getTime() + record.plannedMinutes * 60_000);
  const materialMeta = getMaterialMeta(record);

  return (
    <div className="session-layout session-layout-centered">
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

      {record.kind === 'article' && articleAutoOpened && (
        <SessionBanner
          message="Article opened in a new tab"
          description="Come back here when you're done to end the session."
          actionLabel="Reopen article"
          onAction={() => {
            if (record.materialUrl) {
              window.open(record.materialUrl, '_blank');
            }
          }}
        />
      )}

      <SessionFrame overrun={isOverrun} isBreak={isBreak} isPaused={isPaused}>
        <div className={`session-eyebrow-row ${getEyebrowColorClass(sessionState, overrunMinutes, isBreak)}`}>
          <PulseDot state={sessionState} />
          <SessionEyebrow
            state={sessionState}
            weekIndex={record.weekIndex}
            overrunMinutes={overrunMinutes}
            isBreak={isBreak}
          />
        </div>

        <SessionTitle title={record.sessionTitle} />
        <SessionSubtitle subtitle={getSubtitle(record)} />

        <div className="session-timer-display">
          <TimerDisplay elapsedMs={elapsedActiveMs} overrun={isOverrun} large />
          <PomodoroIndicator phase={pomodoroPhase} />
          <PlannedEndLine
            plannedMinutes={record.plannedMinutes}
            endsAt={plannedEndTime}
            overrun={isOverrun}
          />
        </div>

        {record.kind === 'article' && record.materialUrl && (
          <a
            href={record.materialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-block session-open-material"
          >
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Reopen article
          </a>
        )}

        {record.kind !== 'article' && record.materialUrl && (
          <OpenMaterialButton url={record.materialUrl} />
        )}

        <MaterialStrip
          title={record.sessionTitle}
          meta={materialMeta}
          kind={record.kind}
        />
      </SessionFrame>

      <div className="session-actions">
        <EndSessionButton onEnd={onEnd} />
        {!isPaused && (
          <ComeBackLaterButton onComeBackLater={onComeBackLater} />
        )}
      </div>
    </div>
  );
}
