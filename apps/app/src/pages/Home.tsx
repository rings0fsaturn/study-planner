import { useAuth } from '../auth/useAuth';
import { useEventStore } from '../events/useEventStore';
import { totalMinutesLogged, getProjectedFinish, getUpNextSlot } from '../events/ProgressEngine';
import type { Event } from '../events/EventStore';
import { useLiveQuery } from 'dexie-react-hooks';
import Card from '../components/Card';
import Button from '../components/Button';
import { Link } from 'react-router-dom';
import { ROLE_TO_LABEL } from '@study-tracker/progress-engine';
import type { Slot } from '@study-tracker/progress-engine';
import type { RoadmapCreatedPayload } from '../sync/types';
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

  const events = useLiveQuery(() => eventStore.getAll()) ?? [];
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

        {roadmapPayload && (
          upNextSlot ? (
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
                <Link to="/log" className="btn btn-accent">Log session</Link>
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