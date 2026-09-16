import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildYearStreakGrid } from '@study-tracker/progress';
import { StreakCalendar } from './StreakCalendar';

describe('StreakCalendar', () => {
  it('renders the 12-month window with a legend and today marker', () => {
    const cells = buildYearStreakGrid([], '2026-01-15');
    const { container } = render(
      <StreakCalendar cells={cells} current={0} longest={0} />,
    );

    expect(screen.getByText('Last 12 months')).toBeInTheDocument();
    expect(screen.getByText(/No streak/)).toBeInTheDocument();
    expect(container.querySelectorAll('.streak-calendar-cell')).toHaveLength(cells.length);
    expect(container.querySelectorAll('.streak-calendar-cell-today')).toHaveLength(1);
    expect(container.querySelectorAll('.streak-calendar-legend-cell')).toHaveLength(5);
  });

  it('shows the current streak and days studied', () => {
    const cells = buildYearStreakGrid(
      [
        { date: '2026-01-14', duration: 30 },
        { date: '2026-01-15', duration: 60 },
      ],
      '2026-01-15',
    );
    render(<StreakCalendar cells={cells} current={2} longest={2} />);

    expect(screen.getByText(/2-day streak/)).toBeInTheDocument();
    expect(screen.getByText(/2 days studied/)).toBeInTheDocument();
  });
});