import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EndSessionSheet } from './EndSessionSheet';
import type { ActiveSessionRecord } from '../types';

function makeRecord(overrides?: Partial<ActiveSessionRecord>): ActiveSessionRecord {
  return {
    id: 1,
    sessionId: 'session-1',
    materialId: 'mat-1',
    sessionTitle: 'Linear Algebra Lecture 4',
    slotDate: '2026-07-01',
    weekIndex: 0,
    plannedMinutes: 50,
    startedAt: '2026-07-01T09:00:00.000Z',
    status: 'active',
    pauseIntervals: [],
    pomodoroConfig: { workMinutes: 50, breakMinutes: 10 },
    materialEstimatedMinutes: 120,
    ...overrides,
  };
}

describe('EndSessionSheet', () => {
  it('logs complete with done position when Done is selected', () => {
    const onComplete = vi.fn();
    const onInterrupt = vi.fn();

    render(
      <EndSessionSheet
        record={makeRecord()}
        unusual={false}
        onUnusualChange={vi.fn()}
        onComplete={onComplete}
        onInterrupt={onInterrupt}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log session' }));

    expect(onComplete).toHaveBeenCalledWith({ kind: 'percent', value: 100, ofTotal: 100 });
    expect(onInterrupt).not.toHaveBeenCalled();
  });

  it('logs interrupted when position is not finished', () => {
    const onComplete = vi.fn();
    const onInterrupt = vi.fn();

    render(
      <EndSessionSheet
        record={makeRecord()}
        unusual={false}
        onUnusualChange={vi.fn()}
        onComplete={onComplete}
        onInterrupt={onInterrupt}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '75%' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log session' }));

    expect(onInterrupt).toHaveBeenCalledWith({ kind: 'percent', value: 75, ofTotal: 100 });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('captures YouTube position automatically (read-only) instead of the manual slider (D18)', () => {
    const onComplete = vi.fn();
    const onInterrupt = vi.fn();
    const record = makeRecord({
      kind: 'youtube',
      currentVideoIndex: 2,
      videos: [
        { youtubeVideoId: 'a', title: 'A', durationMinutes: 10 },
        { youtubeVideoId: 'b', title: 'B', durationMinutes: 10 },
        { youtubeVideoId: 'c', title: 'C', durationMinutes: 10 },
        { youtubeVideoId: 'd', title: 'D', durationMinutes: 10 },
      ],
    });

    render(
      <EndSessionSheet
        record={record}
        unusual={false}
        onUnusualChange={vi.fn()}
        onComplete={onComplete}
        onInterrupt={onInterrupt}
        onCancel={vi.fn()}
      />,
    );

    // No manual preset/slider for YouTube — position comes from the player.
    expect(screen.queryByRole('button', { name: '75%' })).toBeNull();
    expect(screen.getByText('2 of 4 videos watched')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Log session' }));

    expect(onInterrupt).toHaveBeenCalledWith({ kind: 'videos', value: 2, ofTotal: 4 });
    expect(onComplete).not.toHaveBeenCalled();
  });
});
