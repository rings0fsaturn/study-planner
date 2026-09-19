import type { YearStreakCell } from '@study-tracker/progress';

interface StreakCalendarProps {
  cells: YearStreakCell[];
  current: number;
  longest: number;
}

function monthLabel(isoMonth: string): string {
  return new Date(`${isoMonth}-01T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
  });
}

export function StreakCalendar({ cells, current, longest }: StreakCalendarProps) {
  const weeks = cells.length / 7;
  const daysStudied = cells.filter((c) => c.level > 0).length;

  const monthSpans: { label: string; start: number; end: number }[] = [];
  for (let w = 0; w < weeks; w++) {
    const label = cells[w * 7].date.slice(0, 7);
    const last = monthSpans[monthSpans.length - 1];
    if (last && last.label === label) {
      last.end = w + 1;
    } else {
      monthSpans.push({ label, start: w, end: w + 1 });
    }
  }

  return (
    <div className="streak-calendar">
      <div className="streak-calendar-header">
        <div>
          <h2 className="t-display-3">Last 12 months</h2>
          <div className="streak-calendar-meta">
            {current > 0 ? `${current}-day streak` : 'No streak'} · {daysStudied}{' '}
            {daysStudied === 1 ? 'day' : 'days'} studied · longest {longest}{' '}
            {longest === 1 ? 'day' : 'days'}
          </div>
        </div>
      </div>

      <div className="streak-calendar-scroll">
        <div
          className="streak-calendar-grid"
          role="img"
          aria-label={`Study calendar for the last 12 months. ${daysStudied} ${daysStudied === 1 ? 'day' : 'days'} studied. ${current > 0 ? `${current}-day current streak, ` : 'No current streak, '}longest ${longest} ${longest === 1 ? 'day' : 'days'}.`}
          style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
        >
          {/* A partial month at either edge can be narrower than its own label.
              Dropping those beats either a clipped stub or a label that widens
              the scroll area; the heading's "Last 12 months" carries the span. */}
          {monthSpans
            .filter((span) => span.end - span.start >= 3)
            .map((span) => (
              <div
                key={span.label}
                className="streak-calendar-month"
                aria-hidden="true"
                style={{ gridColumn: `${span.start + 1} / ${span.end + 1}` }}
              >
                {monthLabel(span.label)}
              </div>
            ))}
          {cells.map((cell, i) => (
            <div
              key={cell.date}
              className={`streak-calendar-cell${cell.isToday ? ' streak-calendar-cell-today' : ''}`}
              data-level={cell.level}
              style={{
                gridRow: (i % 7) + 2,
                gridColumn: Math.floor(i / 7) + 1,
              }}
              title={cell.minutes > 0 ? `${cell.date} · ${cell.minutes} min` : cell.date}
            />
          ))}
        </div>
      </div>

      <div className="streak-calendar-legend">
        <span>less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className="streak-calendar-legend-cell"
            style={{ background: `var(--streak-${level})` }}
          />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}