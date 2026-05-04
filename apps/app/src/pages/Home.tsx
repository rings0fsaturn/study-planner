import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { useEventStore } from '../events/useEventStore';
import { totalMinutesLogged, getProjectedFinish, getUpNextSlot } from '../events/ProgressEngine';
import type { Event } from '../events/EventStore';
import { useLiveQuery } from 'dexie-react-hooks';
import Card from '../components/Card';
import Button from '../components/Button';
import { Link, useNavigate } from 'react-router-dom';
import { ROLE_TO_LABEL } from '@study-tracker/roadmap-engine';
import type { Slot } from '@study-tracker/roadmap-engine';
import type { RoadmapCreatedPayload } from '../sync/types';
import type { ActiveSessionRecord, SessionSlotData, MaterialKind } from '../session/types';
import { AbandonedSessionBanner } from '../session/components/AbandonedSessionBanner';
import { PlannedEndBanner } from '../session/components';
import { format, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';

function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} hr`;
  }
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

function findRoadmap(events: Array<{ kind: string; payload: Record<string, unknown> }>): RoadmapCreatedPayload | null {
  const roadmapEvents = events.filter(e => e.kind === 'RoadmapCreated' || e.kind === 'RoadmapReplanned');
  if (roadmapEvents.length === 0) return null;
  return roadmapEvents[roadmapEvents.length - 1].payload as unknown as RoadmapCreatedPayload;
}

export function Home() {
  const { user, signOut } = useAuth();
  const eventStore = useEventStore();
  const navigate = useNavigate();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [plannedEndBannerDismissed, setPlannedEndBannerDismissed] = useState(false);

  const events = useLiveQuery(() => eventStore.getAll()) ?? [];

  const activeSession = useLiveQuery(
    () => eventStore.table('activeSession').get(1) as Promise<ActiveSessionRecord | undefined>,
    [],
  );

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

  const roadmapPayload = findRoadmap(events);
  const projectedFinish = roadmapPayload ? getProjectedFinish(roadmapPayload) : null;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const upNextSlot: Slot | null = roadmapPayload ? getUpNextSlot(roadmapPayload, todayStr) : null;
  const daysToDeadline = projectedFinish
    ? differenceInCalendarDays(new Date(projectedFinish), new Date(todayStr))
    : null;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div style={{ padding: '2rem 1rem', maxWidth: '640px', margin: '0 auto' }}>
      <h1 className="t-display-2" style={{ marginBottom: '0.5rem' }}>
        Hello, {user?.email}
      </h1>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Here's how your study time adds up
        </p>

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
          ) : upNextSlot ? (
            <Card variant="inverted" style={{ marginBottom: '1.5rem' }}>
              <div className="card-eyebrow">Up next · {formatDateNice(upNextSlot.date)}</div>
              <div className="card-title">{upNextSlot.sessionTitle || 'Study session'}</div>
              <div className="card-meta">
                {upNextSlot.role && (
                  <><span className={`tag tag-sm ${upNextSlot.role === 'anchor' ? 'tag-terracotta' : upNextSlot.role === 'practice' ? 'tag-moss' : ''}`}>
                    {ROLE_TO_LABEL[upNextSlot.role]}
                  </span>{' · '}</>
                )}
                ~{upNextSlot.plannedMinutes} min planned
              </div>
              <div className="upnext-actions">
                <button
                  className="btn btn-accent"
                  onClick={() => {
                    const materials = events.filter(e => e.kind === 'MaterialAdded');
                    const material = materials.find(m => (m.payload.materialId as string) === upNextSlot.candidateMaterialIds[0]);
                    const sessionSlot: SessionSlotData = {
                      materialId: upNextSlot.candidateMaterialIds[0] ?? '',
                      sessionTitle: upNextSlot.sessionTitle ?? 'Study session',
                      slotDate: upNextSlot.date,
                      weekIndex: upNextSlot.weekIndex,
                      plannedMinutes: upNextSlot.plannedMinutes,
                      materialUrl: material?.payload.url as string | undefined,
                      role: upNextSlot.role as SessionSlotData['role'],
                      kind: (material?.payload.kind as MaterialKind | undefined) ?? 'manual',
                      youtubeVideoId: material?.payload.youtubeVideoId as string | undefined,
                    };
                    navigate('/session', { state: sessionSlot });
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
              <div className="card-meta">Or log a session you did elsewhere.</div>
              <div className="upnext-actions">
                <Link to="/log" className="btn btn-ghost-dark" style={{ flex: 1 }}>Log a session</Link>
              </div>
            </Card>
          )
        )}

        {projectedFinish && roadmapPayload && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
            <div style={{ padding: '14px 16px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div className="stat-label" style={{ marginBottom: '6px' }}>Projected finish</div>
              <div className={`stat-value sm ${daysToDeadline! >= 0 ? 'moss' : 'terracotta'}`}>
                {formatDateNice(projectedFinish)}
              </div>
              <div className="mono-caps" style={{ marginTop: '4px', color: daysToDeadline! >= 0 ? 'var(--moss)' : 'var(--terracotta)' }}>
                {daysToDeadline! > 0 ? `${daysToDeadline} days left` : daysToDeadline === 0 ? 'Due today' : `${Math.abs(daysToDeadline!)} days past`}
              </div>
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div className="stat-label" style={{ marginBottom: '6px' }}>Weekly goal</div>
              <div className="stat-value sm">{roadmapPayload.weeklyHours}h</div>
              <div className="mono-caps" style={{ marginTop: '4px' }}>per week target</div>
            </div>
          </div>
        )}

        <Card variant="elevated" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="stat">
            <span className="stat-value md">{formatMinutesToHoursAndMinutes(totalMinutes)}</span>
            <span className="stat-label">Total time logged</span>
          </div>
        </Card>

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
              {sessionEvents.map((event, index) => (
                <div key={event.id}>
                  {index > 0 && <div className="divider-rule-soft" />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <span className="card-eyebrow">{formatDate(event.createdAt)}</span>
                      <p className="card-title" style={{ marginBottom: '0.25rem' }}>
                        {(event.payload.description as string) || 'Study session'}
                      </p>
                      {Boolean(event.payload.date) && (
                        <p className="card-meta">
                          {formatDate(event.payload.date as string)}
                        </p>
                      )}
                    </div>
                    <span className="t-mono" style={{ flexShrink: 0 }}>
                      {event.payload.duration as number} min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Button variant="ghost" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
  );
}