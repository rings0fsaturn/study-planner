import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { CalendarBubble } from './calendarModel'
import { SessionDetailModal, statusCopyFor } from './SessionDetailModal'

function makeBubble(overrides: Partial<CalendarBubble> = {}): CalendarBubble {
  return {
    id: 'slot:1',
    date: '2026-06-26',
    status: 'done',
    label: 'Distributed systems',
    materialTitle: 'DDIA',
    materialUrl: 'https://example.com/ddia',
    materialId: 'mat-1',
    minutes: 52,
    plannedMinutes: 60,
    loggedMinutes: 52,
    sessionIds: ['session-1'],
    kind: 'booking',
    ...overrides,
  }
}

describe('SessionDetailModal', () => {
  it.each([
    ['done', 'Completed', 'View session'],
    ['booked', 'Booked', 'View booking'],
    ['missed', 'Missed', 'View booking'],
    ['unplanned', 'Unplanned', 'View session'],
  ] as const)('maps %s status to the correct pill and action', (status, pill, action) => {
    expect(statusCopyFor(status)).toEqual({
      pillLabel: pill,
      actionLabel: action,
    })

    render(
      <SessionDetailModal
        bubble={makeBubble({
          status,
          loggedMinutes: status === 'done' ? 52 : 0,
        })}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText(pill)).toBeInTheDocument()
    expect(screen.getByText(action)).toBeInTheDocument()
  })

  it('renders date, material link, and logged vs planned body', () => {
    render(
      <SessionDetailModal
        bubble={makeBubble()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Friday, Jun 26')).toBeInTheDocument()
    expect(screen.getByText('Distributed systems')).toBeInTheDocument()
    expect(screen.getByText(/52m logged against 1h planned/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'DDIA' })).toHaveAttribute(
      'href',
      'https://example.com/ddia',
    )
  })

  it('closes from the close button', () => {
    const onClose = vi.fn()
    render(
      <SessionDetailModal
        bubble={makeBubble()}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByLabelText('Close modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders in a body-level portal without locking page scroll', () => {
    document.body.style.overflow = 'auto'

    const { container, unmount } = render(
      <SessionDetailModal
        bubble={makeBubble()}
        onClose={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Roadmap session detail' })
    expect(dialog.parentElement).toBe(document.body)
    expect(container).toBeEmptyDOMElement()
    expect(document.body.style.overflow).toBe('auto')

    unmount()
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })

  it('renders nothing without a selected bubble', () => {
    const { container } = render(
      <SessionDetailModal bubble={null} onClose={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
