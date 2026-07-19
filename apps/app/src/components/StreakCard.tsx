import type { DayCell } from '@study-tracker/progress';

interface StreakCardProps {
  current: number;
  weeklyMinutes: number;
  grid: DayCell[];
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function StreakCard({ current, weeklyMinutes, grid }: StreakCardProps) {
  const hours = Math.floor(weeklyMinutes / 60);
  const mins = weeklyMinutes % 60;
  const weekLabel = hours > 0
    ? mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    : `${mins}m`;

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="t-body" style={{ fontWeight: 500 }}>
          {current > 0 ? `${current}-day streak` : 'No streak'}
        </span>
        <span className="t-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {weekLabel} this week
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {grid.slice(0, 7).map((cell, i) => (
          <div
            key={cell.date}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <div
              data-lvl={cell.level}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 'var(--radius-sm)',
                background: `var(--streak-${cell.level})`,
                boxShadow: cell.isToday ? 'inset 0 0 0 1.5px var(--ink)' : undefined,
              }}
            />
            <span
              className="t-mono"
              style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
            >
              {DAY_LABELS[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
