import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCalibrationState, useProgressSnapshot } from '../progress';
import { useEventStore } from '../events/useEventStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { findActiveRoadmap, mapSessions } from '../progress/mapEvents';
import { startOfISOWeek, addDays, addWeeks, differenceInCalendarISOWeeks, format, parseISO } from 'date-fns';
import Card from '../components/Card';
import Tag from '../components/Tag';
import { BurnUpChart } from '../components/BurnUpChart';
import { ProgressLabModal } from '../components/ProgressLabModal';
import { DailyMinutesChart } from '../components/DailyMinutesChart';
import { ServiceStatusBanner } from '../components/ServiceStatusBanner';
import type { Verdict } from '@study-tracker/progress';
import type { DayOfWeek } from '@study-tracker/roadmap-engine';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { calibration, status } = useCalibrationState();
  const eventStore = useEventStore();
  const [progressLabOpen, setProgressLabOpen] = useState(false);
  const progressLabOpenerRef = useRef<HTMLButtonElement>(null);

  const events = useLiveQuery(() => eventStore.getAll(), [eventStore]) ?? [];
  const activeRoadmap = useMemo(() => findActiveRoadmap(events), [events]);

  const roadmapBounds = useMemo(() => {
    if (!activeRoadmap) return null;
    const planStart = parseISO(activeRoadmap.startDate);
    const planStartWeek = startOfISOWeek(planStart);
    const today = new Date();
    const currentWeekIndex = Math.max(
      0,
      differenceInCalendarISOWeeks(today, planStartWeek),
    );
    return { planStartWeek, currentWeekIndex };
  }, [activeRoadmap]);

  const wParam = searchParams.get('w');
  const selectedWeekIndex = useMemo(() => {
    if (!roadmapBounds) return 0;
    if (wParam !== null) {
      const parsed = parseInt(wParam, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= roadmapBounds.currentWeekIndex + 1) {
        return parsed - 1;
      }
    }
    return roadmapBounds.currentWeekIndex;
  }, [wParam, roadmapBounds]);

  const isPastWeek = roadmapBounds !== null && selectedWeekIndex < roadmapBounds.currentWeekIndex;

  const referenceDate = useMemo(() => {
    if (!isPastWeek || !roadmapBounds) return undefined;
    return format(addDays(addWeeks(roadmapBounds.planStartWeek, selectedWeekIndex), 6), 'yyyy-MM-dd');
  }, [isPastWeek, roadmapBounds, selectedWeekIndex]);

  const progress = useProgressSnapshot(calibration, referenceDate);

  const selectedWeekBounds = useMemo(() => {
    if (roadmapBounds) {
      const start = addWeeks(roadmapBounds.planStartWeek, selectedWeekIndex);
      return {
        startISO: format(start, 'yyyy-MM-dd'),
        endISO: format(addDays(start, 6), 'yyyy-MM-dd'),
      };
    }
    if (!progress) return null;
    const start = parseISO(progress.weeklyStats.weekStartDate);
    return {
      startISO: progress.weeklyStats.weekStartDate,
      endISO: format(addDays(start, 6), 'yyyy-MM-dd'),
    };
  }, [progress, roadmapBounds, selectedWeekIndex]);

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

  const truncatedBurnUp = useMemo(() => {
    if (!progress || !isPastWeek || !roadmapBounds) return progress?.burnUp ?? null;
    const weekEnd = format(addDays(addWeeks(roadmapBounds.planStartWeek, selectedWeekIndex), 6), 'yyyy-MM-dd');
    return {
      ...progress.burnUp,
      planned: progress.burnUp.planned.filter(p => p.date <= weekEnd),
      actual: progress.burnUp.actual.filter(p => p.date <= weekEnd),
      gpCurve: progress.burnUp.gpCurve.filter(p => p.date <= weekEnd),
    };
  }, [progress, isPastWeek, roadmapBounds, selectedWeekIndex]);

  const progressLabBurnUp = useMemo(() => {
    if (!progress) return null;
    if (!isPastWeek || !referenceDate) return progress.burnUp;
    return {
      ...progress.burnUp,
      actual: progress.burnUp.actual.filter((point) => point.date <= referenceDate),
      today: referenceDate,
    };
  }, [isPastWeek, progress, referenceDate]);

  const capacityScenarioInput = useMemo(() => {
    if (!progress || !activeRoadmap || isPastWeek) return undefined;
    const hoursPerStudyDay = activeRoadmap.weekdayHours;
    const selectedStudyDays = activeRoadmap.selectedStudyDays as DayOfWeek[] | undefined;
    if (
      typeof activeRoadmap.materialRemainingMinutes !== 'number' ||
      typeof hoursPerStudyDay !== 'number' ||
      hoursPerStudyDay <= 0 ||
      !selectedStudyDays ||
      selectedStudyDays.length === 0
    ) return undefined;

    const actualCumulativeMinutes = progress.burnUp.actual.reduce(
      (maximum, point) => Math.max(maximum, point.minutes),
      0,
    );
    const finalPlannedCumulativeMinutes = progress.burnUp.planned.reduce(
      (maximum, point) => Math.max(maximum, point.minutes),
      actualCumulativeMinutes,
    );

    return {
      remainingEstimatedMinutes: activeRoadmap.materialRemainingMinutes,
      sessions: mapSessions(events),
      today: progress.burnUp.today,
      hoursPerStudyDay,
      selectedStudyDays,
      actualCumulativeMinutes,
      finalPlannedCumulativeMinutes,
    };
  }, [activeRoadmap, events, isPastWeek, progress]);

  useEffect(() => {
    setProgressLabOpen(false);
  }, [selectedWeekIndex]);

  if (status === 'loading' && !calibration) {
    return (
      <div style={{ padding: '2rem 1rem', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <h1 className="t-display-2">Week</h1>
        <p className="t-body" role="status" style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Calibrating your pace...
        </p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div style={{ padding: '2rem 1rem', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <ServiceStatusBanner status={status} />
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
  const displayWeekNumber = selectedWeekIndex + 1;
  const projectedFinish = progress.projection.finishDate;
  const confidenceInterval = progress.projection.confidenceInterval;

  const isAtStart = selectedWeekIndex <= 0;
  const isAtEnd = !roadmapBounds || selectedWeekIndex >= roadmapBounds.currentWeekIndex;

  const navigateWeek = (delta: number) => {
    const newWeek = selectedWeekIndex + delta;
    if (!roadmapBounds) return;
    setProgressLabOpen(false);
    if (newWeek >= roadmapBounds.currentWeekIndex) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('w');
        return next;
      });
    } else if (newWeek >= 0) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('w', String(newWeek + 1));
        return next;
      });
    }
  };

  const tintClass = isPastWeek
    ? verdict === 'slipping' ? 'week-tint-rust' : 'week-tint-moss'
    : '';

  const chartBurnUp = truncatedBurnUp ?? burnUp;

  return (
    <div
      className={tintClass}
      style={{ padding: '2rem 1rem', maxWidth: '880px', margin: '0 auto', minHeight: '100vh' }}
    >
      <ServiceStatusBanner status={status} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div className="mono-caps" style={{ color: 'var(--text-tertiary)' }}>
          Week {displayWeekNumber} · {weeklyStats.weekStartDate}
        </div>
        {isPastWeek && <Tag size="sm">Past</Tag>}
      </div>

      <div className="week-nav" style={{ marginBottom: '1.5rem' }}>
        <button
          className="week-nav-btn"
          disabled={isAtStart}
          onClick={() => navigateWeek(-1)}
          aria-label="Previous week"
        >
          ‹
        </button>
        <h1 className="t-display-2" style={{ margin: 0 }}>
          Your week
        </h1>
        <button
          className="week-nav-btn"
          disabled={isAtEnd}
          onClick={() => navigateWeek(1)}
          aria-label="Next week"
        >
          ›
        </button>
      </div>

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

          {!isPastWeek && verdict === 'slipping' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
              <Link to="/replan" className="btn btn-accent" style={{ flex: 1 }}>
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

          {projectedFinish && (
            <div
              aria-label="Projected finish"
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginBottom: '1rem',
              }}
            >
              <div className="stat-label" style={{ marginBottom: 4 }}>Provisional finish</div>
              <div className="stat-value sm">
                {confidenceInterval
                  ? `${format(parseISO(confidenceInterval[0]), 'MMM d')}–${format(parseISO(confidenceInterval[1]), 'MMM d')}`
                  : format(parseISO(projectedFinish), 'MMM d')}
              </div>
            </div>
          )}

          {chartBurnUp.actual.length >= 3 && chartBurnUp.actual.some(p => p.minutes > 0) ? (
            <BurnUpChart
              data={chartBurnUp}
              expanded={progressLabOpen}
              onOpen={() => setProgressLabOpen(true)}
              openerRef={progressLabOpenerRef}
            />
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

      {progressLabBurnUp && selectedWeekBounds && (
        <ProgressLabModal
          open={progressLabOpen}
          onClose={() => setProgressLabOpen(false)}
          data={progressLabBurnUp}
          referenceDateISO={referenceDate ?? progressLabBurnUp.today}
          referenceLabel={isPastWeek ? 'Week end' : 'Today'}
          weekStartISO={selectedWeekBounds.startISO}
          weekEndISO={selectedWeekBounds.endISO}
          historical={isPastWeek}
          openerRef={progressLabOpenerRef}
          capacityScenarioInput={capacityScenarioInput}
        />
      )}
    </div>
  );
}
