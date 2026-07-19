import { useState, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { useEventStore } from '../events/useEventStore';
import { totalMinutesLogged } from '../events/ProgressEngine';
import type { Event } from '../events/EventStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSync } from '../sync/useSync';
import Card from '../components/Card';
import Button from '../components/Button';
import { StreakCard } from '../components/StreakCard';
import { Link, useNavigate } from 'react-router-dom';
import type { ActiveSessionRecord } from '../session/types';
import { AbandonedSessionBanner } from '../session/components/AbandonedSessionBanner';
import { PlannedEndBanner } from '../session/components';
import { useCalibrationState, useProgressSnapshot, usePromptDetail } from '../progress';
import { findActiveRoadmap } from '../progress/mapEvents';
import { deriveTodaySessionPlan } from '../session/sessionPlanning';
import { RecalibrationBanner } from '../components/RecalibrationBanner';
import { RecalibrationModal } from '../components/RecalibrationModal';
import { ServiceStatusBanner } from '../components/ServiceStatusBanner';
import { RoadmapEndedBanner } from '../roadmap/RoadmapEndedBanner';
import { deriveRoadmapEndedState } from '../roadmap/useRoadmapEndedState';
import { resolveRoadmap, type RoadmapResolutionKind } from '../roadmap/resolveRoadmap';
import { format, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';

function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateNice(dateString: string): string {
  const d = new Date(dateString);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Home() {
  const { user, signOut } = useAuth();
  const eventStore = useEventStore();
  const navigate = useNavigate();
  const { logEvent } = useSync();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [plannedEndBannerDismissed, setPlannedEndBannerDismissed] = useState(false);
  const [recalModalOpen, setRecalModalOpen] = useState(false);

  const { calibration, status } = useCalibrationState();
  const progress = useProgressSnapshot(calibration);
  const promptDetail = usePromptDetail(calibration);

  const events = useLiveQuery(() => eventStore.getAll()) ?? [];

  const activeSession = useLiveQuery(
    () => eventStore.table('activeSession').get(1) as Promise<ActiveSessionRecord | undefined>,
    [],
  );

  const exceptionalIds = useLiveQuery(async () => {
    const all = await eventStore.getAll();
    const latestBySession = new Map<string, boolean>();
    for (const e of all) {
      if (e.kind === 'SessionTaggedExceptional') {
        latestBySession.set(
          e.payload.sessionId as string,
          e.payload.exceptional as boolean,
        );
      }
    }
    const set = new Set<string>();
    for (const [sid, isExc] of latestBySession) {
      if (isExc) set.add(sid);
    }
    return set;
  }, [eventStore]) ?? new Set<string>();

  const isSessionPastPlannedEnd = (() => {
    if (!activeSession) return false;
    const startMs = new Date(activeSession.startedAt).getTime();
    const nowMs = Date.now();
    let totalPauseMs = 0;
    for (const p of activeSession.pauseIntervals) {
      const pStart = new Date(p.pausedAt).getTime();
      const pEnd = p.resumedAt ? new Date(p.resumedAt).getTime() : nowMs;
      totalPauseMs += pEnd - pStart;
    }
    const activeMs = nowMs - startMs - totalPauseMs;
    return activeMs >= activeSession.plannedMinutes * 60_000;
  })();

  const abandonedEvent = events
    .filter(e => e.kind === 'SessionAbandoned')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const sessionEvents: Event[] = events
    .filter((e): e is Event => e.kind === 'SessionLogged')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const totalMinutes = totalMinutesLogged(events as Event[]);

  const roadmapPayload = findActiveRoadmap(events as Event[]);
  const roadmapEnded = deriveRoadmapEndedState(events as Event[]);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaySessionPlan = deriveTodaySessionPlan(events as Event[], todayStr);

  const projectedFinish = progress?.projection?.finishDate ?? null;
  const confidenceInterval = progress?.projection?.confidenceInterval ?? null;
  const deadline = roadmapPayload?.deadline ?? null;
  const daysEarlyOrLate = projectedFinish && deadline
    ? differenceInCalendarDays(new Date(deadline), new Date(projectedFinish))
    : null;

  const handleSignOut = async () => {
    await signOut();
  };

  const handleResolveRoadmap = useCallback(async (kind: RoadmapResolutionKind) => {
    if (!roadmapEnded.entry) return;
    await resolveRoadmap({
      kind,
      roadmapCreatedAt: roadmapEnded.entry.roadmapCreatedAt,
      logEvent,
    });
  }, [logEvent, roadmapEnded.entry]);

  const handleReplan = useCallback(async () => {
    await logEvent('RecalibrationPromptResolved', {
      resolution: 'replan',
      resolvedAt: new Date().toISOString(),
    });
    setRecalModalOpen(false);
    navigate('/replan');
  }, [logEvent, navigate]);

  const handleAcknowledge = useCallback(async () => {
    await logEvent('RecalibrationPromptResolved', {
      resolution: 'acknowledged',
      resolvedAt: new Date().toISOString(),
    });
    setRecalModalOpen(false);
  }, [logEvent]);

  const handleTemporary = useCallback(async (sessionIds: string[]) => {
    await logEvent('RecalibrationPromptResolved', {
      resolution: 'temporary',
      resolvedAt: new Date().toISOString(),
    });
    for (const sid of sessionIds) {
      await logEvent('SessionTaggedExceptional', {
        sessionId: sid,
        exceptional: true,
      });
    }
    setRecalModalOpen(false);
  }, [logEvent]);

  const handleToggleExceptional = useCallback(async (sessionId: string, currentlyExceptional: boolean) => {
    await logEvent('SessionTaggedExceptional', {
      sessionId,
      exceptional: !currentlyExceptional,
    });
  }, [logEvent]);

  const dateHeader = format(new Date(), 'EEE · MMM d');
  const emailPrefix = user?.email?.split('@')[0] ?? '';

  return (
    <div style={{ padding: '2rem 1rem', maxWidth: '640px', margin: '0 auto' }}>
      {roadmapEnded.ended && roadmapEnded.entry && (
        <RoadmapEndedBanner
          entry={roadmapEnded.entry}
          onMarkComplete={() => void handleResolveRoadmap('RoadmapMarkedComplete')}
          onAbandon={() => void handleResolveRoadmap('RoadmapMarkedAbandoned')}
        />
      )}

      <div className="mono-caps" style={{ marginBottom: 4 }}>{dateHeader}</div>
      <h1 className="t-display-2" style={{ marginBottom: '0.5rem' }}>
        {getGreeting()}, {emailPrefix}.
      </h1>
      <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Here's how your study time adds up
      </p>

      <ServiceStatusBanner status={status} />

      {status === 'loading' && !calibration && (
        <div
          role="status"
          className="t-body"
          style={{
            color: 'var(--text-secondary)',
            padding: '0.75rem 0',
            marginBottom: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          Calibrating your pace...
        </div>
      )}

      {isSessionPastPlannedEnd && !plannedEndBannerDismissed && (
        <PlannedEndBanner
          onDismiss={() => setPlannedEndBannerDismissed(true)}
          actionLabel="Go to session"
          onAction={() => navigate('/session')}
        />
      )}

      {abandonedEvent && !bannerDismissed && (
        <AbandonedSessionBanner
          activeMinutes={(abandonedEvent.payload.activeMinutesAtAbandon as number) ?? 0}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {calibration?.promptNeeded && (
        <RecalibrationBanner onReview={() => setRecalModalOpen(true)} />
      )}

      {roadmapPayload && (
        activeSession ? (
          <Card variant="inverted" style={{ marginBottom: '1.5rem' }}>
            <div className="card-eyebrow">
              In progress · started {new Date(activeSession.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>
            <div className="card-title">{activeSession.sessionTitle}</div>
            <div className="card-meta">
              ~{activeSession.plannedMinutes} min planned · {activeSession.status === 'paused' ? 'paused' : 'running'}
            </div>
            <div className="upnext-actions">
              <Link to="/session" className="btn btn-accent">Continue session</Link>
            </div>
          </Card>
        ) : todaySessionPlan.booking && todaySessionPlan.slotData ? (
          <Card variant="inverted" style={{ marginBottom: '1.5rem' }}>
            <div className="card-eyebrow">Study session · {formatDateNice(todaySessionPlan.booking.date)}</div>
            <div className="card-title">Study session · ~{todaySessionPlan.booking.estimatedDuration} min</div>
            <div className="card-meta">
              {todaySessionPlan.suggestedMaterial ? (
                <>
                  Suggested material:{' '}
                  <span className="tag tag-sm">{todaySessionPlan.suggestedMaterial.title}</span>
                </>
              ) : (
                'Pick a material before you start.'
              )}
            </div>
            <div className="upnext-actions">
              <button
                className="btn btn-accent"
                onClick={() => {
                  navigate('/session', { state: todaySessionPlan.slotData });
                }}
              >
                Start session
              </button>
            </div>
          </Card>
        ) : (
          <Card variant="inverted" style={{ marginBottom: '1.5rem' }}>
            <div className="card-eyebrow">No session today</div>
            <div className="card-title">A planned rest day.</div>
            <div className="card-meta">Browse your material directory or log a session you did elsewhere.</div>
            <div className="upnext-actions">
              <button className="btn btn-accent" style={{ flex: 1 }} onClick={() => navigate('/session')}>
                Start ad-hoc session
              </button>
              <Link to="/log" className="btn btn-ghost-dark" style={{ flex: 1 }}>Log a session</Link>
            </div>
          </Card>
        )
      )}

      {progress && (
        <StreakCard
          current={progress.streak.current}
          weeklyMinutes={progress.weeklyStats.minutesThisWeek}
          grid={progress.streak.grid}
        />
      )}

      {progress && roadmapPayload && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
          {projectedFinish ? (
            <div style={{ padding: '14px 16px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div className="stat-label" style={{ marginBottom: '6px' }}>Projected finish · provisional</div>
              <div className={`stat-value sm ${daysEarlyOrLate !== null && daysEarlyOrLate >= 0 ? 'moss' : 'terracotta'}`}>
                {confidenceInterval
                  ? `${format(new Date(confidenceInterval[0]), 'MMM d')}–${format(new Date(confidenceInterval[1]), 'MMM d')}`
                  : formatDateNice(projectedFinish)}
              </div>
              <div className="mono-caps" style={{ marginTop: '4px', color: daysEarlyOrLate !== null && daysEarlyOrLate >= 0 ? 'var(--moss)' : 'var(--terracotta)' }}>
                {daysEarlyOrLate !== null
                  ? daysEarlyOrLate > 0 ? `${daysEarlyOrLate} days early` : daysEarlyOrLate === 0 ? 'On target' : `${Math.abs(daysEarlyOrLate)} days late`
                  : ''}
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 16px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div className="stat-label" style={{ marginBottom: '6px' }}>Total logged</div>
              <div className="stat-value sm">
                {formatMinutesToHoursAndMinutes(progress.totalMinutes)}
              </div>
              <div className="mono-caps" style={{ marginTop: '4px' }}>
                {Math.round(progress.completionPercentage)}% complete
              </div>
            </div>
          )}
          <div style={{ padding: '14px 16px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div className="stat-label" style={{ marginBottom: '6px' }}>This week</div>
            <div className="stat-value sm">
              {formatMinutesToHoursAndMinutes(progress.weeklyStats.minutesThisWeek)}
            </div>
            <div className="mono-caps" style={{ marginTop: '4px' }}>
              of {roadmapPayload.weeklyHours}h goal
            </div>
          </div>
        </div>
      )}

      {!progress && (
        <Card variant="elevated" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="stat">
            <span className="stat-value md">{formatMinutesToHoursAndMinutes(totalMinutes)}</span>
            <span className="stat-label">Total time logged</span>
          </div>
        </Card>
      )}

      <Card variant="elevated" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="t-display-3" style={{ margin: 0 }}>Recent activity</h2>
          <Link to="/log" className="btn btn-secondary btn-sm">
            Log session
          </Link>
        </div>

        {sessionEvents.length === 0 ? (
          <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
            No sessions logged yet.{' '}
            <Link to="/log">Log your first session</Link>
          </p>
        ) : (
          <div>
            {sessionEvents.map((event, index) => {
              const sessionId = event.payload.sessionId as string | undefined;
              const isExceptional = sessionId ? exceptionalIds.has(sessionId) : false;

              return (
                <div key={event.id}>
                  {index > 0 && <div className="divider-rule-soft" />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <span className="card-eyebrow">{formatDate(event.createdAt)}</span>
                      <p className="card-title" style={{ marginBottom: '0.25rem' }}>
                        {(event.payload.description as string) || (event.payload.sessionTitle as string) || 'Study session'}
                      </p>
                      {Boolean(event.payload.date) && (
                        <p className="card-meta">
                          {formatDate(event.payload.date as string)}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isExceptional && (
                        <span className="tag tag-sm tag-terracotta">Unusual</span>
                      )}
                      <span className="t-mono" style={{ flexShrink: 0 }}>
                        {event.payload.duration as number} min
                      </span>
                      {sessionId && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 4px', minWidth: 0, fontSize: 14, lineHeight: 1 }}
                          title={isExceptional ? 'Unmark as unusual' : 'Mark as unusual'}
                          onClick={() => handleToggleExceptional(sessionId, isExceptional)}
                        >
                          {isExceptional ? '⚑' : '⚐'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Button variant="ghost" onClick={handleSignOut}>
        Sign out
      </Button>

      {recalModalOpen && (
        <RecalibrationModal
          promptDetail={promptDetail}
          onReplan={handleReplan}
          onAcknowledge={handleAcknowledge}
          onTemporary={handleTemporary}
          onClose={() => setRecalModalOpen(false)}
        />
      )}
    </div>
  );
}
