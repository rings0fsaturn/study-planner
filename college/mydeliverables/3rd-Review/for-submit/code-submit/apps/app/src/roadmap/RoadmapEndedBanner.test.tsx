import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { RoadmapLifecycleEntry } from './roadmapLifecycle'
import { RoadmapEndedBanner } from './RoadmapEndedBanner'

function endedEntry(): RoadmapLifecycleEntry {
  return {
    roadmapCreatedAt: '2026-05-01T00:00:00.000Z',
    eventKind: 'RoadmapCreated',
    status: 'active',
    payload: {
      startDate: '2026-05-01',
      deadline: '2026-06-01',
      weeks: 4,
      purpose: 'Algorithms',
      selectedStudyDays: ['Mon'],
      weekdayHours: 1,
      weekendHours: 0,
      weeklyHours: 1,
      slots: [],
    },
    title: 'Algorithms',
    startDate: '2026-05-01',
    deadline: '2026-06-01',
    weeks: 4,
    totalSlots: 0,
    completedSlots: 0,
    percentComplete: 0,
  }
}

describe('RoadmapEndedBanner', () => {
  it('renders three actions, invokes handlers, and has no dismiss control', () => {
    const onMarkComplete = vi.fn()
    const onExtendDeadline = vi.fn()
    const onAbandon = vi.fn()

    render(
      <MemoryRouter>
        <RoadmapEndedBanner
          entry={endedEntry()}
          onMarkComplete={onMarkComplete}
          onExtendDeadline={onExtendDeadline}
          onAbandon={onAbandon}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('status', { name: 'Roadmap ended' })).toBeInTheDocument()
    expect(screen.getByText("Your plan 'Algorithms' reached its end date on Jun 1, 2026.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
    fireEvent.click(screen.getByRole('link', { name: 'Extend deadline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abandon' }))

    expect(onMarkComplete).toHaveBeenCalledTimes(1)
    expect(onExtendDeadline).toHaveBeenCalledTimes(1)
    expect(onAbandon).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Extend deadline' })).toHaveAttribute('href', '/replan?intent=extend')
  })
})
