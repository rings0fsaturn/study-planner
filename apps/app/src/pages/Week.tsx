import { useMemo } from 'react';
import { useCalibrationState, useProgressSnapshot } from '../progress';
import { useEventStore } from '../events/useEventStore';
import { useLiveQuery } from 'dexie-react-hooks';
import Card from '../components/Card';
import { BurnUpChart } from '../components/BurnUpChart';
import { DailyMinutesChart } from '../components/DailyMinutesChart';
import { Link } from 'react-router-dom';
import type { Verdict } from '@study-tracker/progress';

function verdictDisplay(verdict: Verdict): { title: string; subtitle: string; color: string } {
  switch (verdict) {
    case 'ahead':
      return { title: 'Ahead.', subtitle: 'Ahead of target this week', color: 'var(--moss)' };
    case 'on-track':
      return { title: 'On track.', subtitle: 'Tracking to plan', color: 'var(--moss)' };
    case 'slipping':
      return { title: 'Behind plan.', subtitle: 'Trailing target this week', color: 'var(--rust)' };
  }
}

export function Week() {
  const calibration = useCalibrationState();
  const progress = useProgressSnapshot(calibration);
  const eventStore = useEventStore();

  const events = useLiveQuery(() => eventStore.getAll(), [eventStore]) ?? [];

  const exceptionalDates = useMemo(() => {
    const exceptionalSessionIds = new Set<string>();
    for (const e of events) {
      if (e.kind === 'SessionTaggedExceptional' && e.payload.exceptional) {
        exceptionalSessionIds.add(e.payload.sessionId as string);
      }
    }
    const dates = new Set<string>();
    for (const e of events) {
      if (e.kind === 'SessionLogged') {
        const sid = e.payload.sessionId as string | undefined;
        if (sid && exceptionalSessionIds.has(sid)) {
          dates.add(e.payload.date as string);
        }
      }
    }
    return dates;
  }, [events]);

  if (!progress) {
    return (
      <div style={{ padding: '2rem 1rem', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <h1 className="t-display-2">Week</h1>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Complete onboarding to see your weekly progress.
        </p>
      </div>
    );
  }

  const { weeklyStats, verdict, burnUp, weekSummaryForNarrative } = progress;
  const vd = verdictDisplay(verdict);
  const hoursLogged = Math.round((weeklyStats.minutesThisWeek / 60) * 10) / 10;
  const hoursPlanned = Math.round((weeklyStats.plannedMinutesThisWeek / 60) * 10) / 10;

  return (
    <div style={{ padding: '2rem 1rem', maxWidth: '880px', margin: '0 auto' }}>
      <div className="mono-caps" style={{ marginBottom: 4, color: 'var(--text-tertiary)' }}>
        Week {weeklyStats.weekIndex + 1} · {weeklyStats.weekStartDate}
      </div>
      <h1 className="t-display-2" style={{ marginBottom: '1.5rem' }}>
        Your week
      </h1>

      <div className="week-layout">
        {/* Left column: verdict + summary */}
        <div className="week-left">
          <Card variant="elevated" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div
              className="t-display-2"
              style={{ color: vd.color, marginBottom: 4 }}
            >
              {vd.title}
            </div>
            <div className="t-body" style={{ color: 'var(--text-secondary)' }}>
              {vd.subtitle}
            </div>
          </Card>

          <Card variant="elevated" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
              You logged {hoursLogged}h against a {hoursPlanned}h target this week.
              {weekSummaryForNarrative.daysWithActivity > 0 && (
                <> Active on {weekSummaryForNarrative.daysWithActivity} day{weekSummaryForNarrative.daysWithActivity !== 1 ? 's' : ''}.</>
              )}
            </p>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
            <div style={{ padding: '14px 16px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div className="stat-label" style={{ marginBottom: 4 }}>Sessions</div>
              <div className="stat-value sm">{weeklyStats.sessionsThisWeek}</div>
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div className="stat-label" style={{ marginBottom: 4 }}>Hours</div>
              <div className="stat-value sm">{hoursLogged}h</div>
            </div>
          </div>

          {verdict === 'slipping' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
              <Link to="/roadmap" className="btn btn-accent" style={{ flex: 1 }}>
                Replan the rest
              </Link>
              <button className="btn btn-ghost" style={{ flex: 1 }}>
                Stay the course
              </button>
            </div>
          )}
        </div>

        {/* Right column: charts */}
        <div className="week-right">
          <div style={{ marginBottom: '1rem' }}>
            <DailyMinutesChart
              minutesByDay={weeklyStats.minutesByDay}
              weekStartDate={weeklyStats.weekStartDate}
              plannedMinutesThisWeek={weeklyStats.plannedMinutesThisWeek}
              exceptionalDates={exceptionalDates}
            />
          </div>

          {burnUp.actual.length >= 3 && burnUp.actual.some(p => p.minutes > 0) ? (
            <BurnUpChart data={burnUp} />
          ) : (
            <div
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '32px 20px',
                textAlign: 'center',
              }}
            >
              <div className="mono-caps" style={{ marginBottom: 8 }}>Hours studied vs plan</div>
              <p className="t-body" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Log a few more sessions to see your trend analysis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
