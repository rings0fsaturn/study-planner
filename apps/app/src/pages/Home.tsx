import { useAuth } from '../auth/useAuth';
import { useEventStore } from '../events/useEventStore';
import { totalMinutesLogged } from '../events/ProgressEngine';
import type { Event } from '../events/EventStore';
import { useLiveQuery } from 'dexie-react-hooks';
import Card from '../components/Card';
import Button from '../components/Button';
import { Link } from 'react-router-dom';

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

export function Home() {
  const { user, signOut } = useAuth();
  const eventStore = useEventStore();

  const events = useLiveQuery(() => eventStore.getAll()) ?? [];
  const sessionEvents: Event[] = events
    .filter((e): e is Event => e.kind === 'SessionLogged')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const totalMinutes = totalMinutesLogged(events as Event[]);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="app">
      <div style={{ padding: '2rem 1rem', maxWidth: '640px', margin: '0 auto' }}>
        <h1 className="t-display-2" style={{ marginBottom: '0.5rem' }}>
          Hello, {user?.email}
        </h1>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Here's how your study time adds up
        </p>

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
    </div>
  );
}