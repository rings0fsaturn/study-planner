import { useMemo } from 'react';

interface DailyMinutesChartProps {
  minutesByDay: Record<string, number>;
  weekStartDate: string;
  plannedMinutesThisWeek: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DailyMinutesChart({
  minutesByDay,
  weekStartDate,
  plannedMinutesThisWeek,
}: DailyMinutesChartProps) {
  const bars = useMemo(() => {
    return DAY_LABELS.map((label, i) => {
      const date = addDaysToDate(weekStartDate, i);
      const minutes = minutesByDay[date] ?? 0;
      return { label, date, minutes };
    });
  }, [minutesByDay, weekStartDate]);

  const maxMinutes = Math.max(...bars.map((b) => b.minutes), 1);
  const dailyTarget = plannedMinutesThisWeek > 0
    ? Math.round(plannedMinutesThisWeek / 7)
    : 0;

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
      }}
    >
      <div
        className="mono-caps"
        style={{ marginBottom: 12, color: 'var(--text-tertiary)', fontSize: 10 }}
      >
        Daily minutes
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120 }}>
        {bars.map((bar) => {
          const heightPct = maxMinutes > 0 ? (bar.minutes / maxMinutes) * 100 : 0;
          const isAboveTarget = dailyTarget > 0 && bar.minutes >= dailyTarget;

          return (
            <div
              key={bar.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              {bar.minutes > 0 && (
                <span
                  className="t-mono"
                  style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 2 }}
                >
                  {bar.minutes}
                </span>
              )}
              <div
                style={{
                  width: '100%',
                  maxWidth: 32,
                  height: `${Math.max(heightPct, bar.minutes > 0 ? 4 : 0)}%`,
                  background: isAboveTarget ? 'var(--moss)' : 'var(--terracotta)',
                  borderRadius: '4px 4px 0 0',
                  minHeight: bar.minutes > 0 ? 4 : 0,
                  transition: 'height var(--duration-3) var(--ease-out)',
                }}
              />
              <span
                className="t-mono"
                style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  marginTop: 4,
                }}
              >
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
