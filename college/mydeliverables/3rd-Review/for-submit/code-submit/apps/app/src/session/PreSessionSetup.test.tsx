import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PreSessionSetup } from './PreSessionSetup';
import type { SessionSlotData } from './types';
import type { SessionMaterialOption } from './sessionPlanning';

const materials: SessionMaterialOption[] = [
  {
    materialId: 'mat-1',
    title: 'Linear Algebra Lecture 4',
    estimatedMinutes: 90,
    remainingEstimatedMinutes: 60,
    role: 'anchor',
    kind: 'youtube',
    started: true,
    done: false,
    lastPosition: { kind: 'percent', value: 25, ofTotal: 100 },
    youtubeVideoId: 'abc123',
  },
  {
    materialId: 'mat-2',
    title: 'Problem set 4',
    estimatedMinutes: 45,
    remainingEstimatedMinutes: 45,
    role: 'practice',
    kind: 'manual',
    started: false,
    done: false,
  },
];

const initialSlotData: SessionSlotData = {
  bookingId: 'booking-1',
  materialId: 'mat-1',
  sessionTitle: 'Linear Algebra Lecture 4',
  slotDate: '2026-07-01',
  weekIndex: 0,
  plannedMinutes: 50,
  plannedSessionMinutes: 50,
  materialEstimatedMinutes: 90,
  materialStartPosition: { kind: 'percent', value: 25, ofTotal: 100 },
  role: 'anchor',
  kind: 'youtube',
  youtubeVideoId: 'abc123',
};

describe('PreSessionSetup', () => {
  it('uses the dial value when starting a session', async () => {
    const onStart = vi.fn();
    render(
      <PreSessionSetup
        initialSlotData={initialSlotData}
        materials={materials}
        onStart={onStart}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Planned session length'), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
      materialId: 'mat-1',
      plannedMinutes: 35,
      plannedSessionMinutes: 35,
      bookingId: 'booking-1',
    }));
  });

  it('starts with a changed material from the picker', async () => {
    const onStart = vi.fn();
    render(
      <PreSessionSetup
        initialSlotData={initialSlotData}
        materials={materials}
        onStart={onStart}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pick a different material' }));
    fireEvent.click(screen.getByRole('button', { name: /Problem set 4/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use this material' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
      materialId: 'mat-2',
      sessionTitle: 'Problem set 4',
      materialEstimatedMinutes: 45,
      kind: 'manual',
    }));
  });
});
