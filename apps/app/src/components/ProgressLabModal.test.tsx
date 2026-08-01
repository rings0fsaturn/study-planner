import { useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { BurnUpData } from '@study-tracker/progress'
import { ProgressLabModal } from './ProgressLabModal'

vi.mock('@visx/responsive', () => ({
  ParentSize: ({ children }: { children: (size: { width: number; height: number }) => ReactNode }) =>
    children({ width: 760, height: 360 }),
}))

function data(): BurnUpData {
  return {
    planned: [
      { date: '2026-07-01', minutes: 60 },
      { date: '2026-07-05', minutes: 180 },
      { date: '2026-07-15', minutes: 300 },
      { date: '2026-08-31', minutes: 600 },
    ],
    actual: [
      { date: '2026-07-01', minutes: 30 },
      { date: '2026-07-05', minutes: 150 },
      { date: '2026-07-15', minutes: 260 },
    ],
    gpCurve: [
      { date: '2026-07-15', mean: 260, lower: 220, upper: 300 },
      { date: '2026-08-31', mean: 540, lower: 420, upper: 650 },
    ],
    today: '2026-07-15',
    startDate: '2026-07-01',
    deadline: '2026-08-31',
    deficit: -40,
    dayNumber: 14,
    totalDays: 61,
  }
}

function renderModal(overrides: Partial<ComponentProps<typeof ProgressLabModal>> = {}) {
  const onClose = vi.fn()
  const view = render(
    <MemoryRouter>
      <ProgressLabModal
        open
        onClose={onClose}
        data={data()}
        referenceDateISO="2026-07-15"
        referenceLabel="Today"
        weekStartISO="2026-07-13"
        weekEndISO="2026-07-19"
        deadlineISO="2026-08-31"
        forecastFinishISO="2026-09-12"
        forecastBasis="analytic"
        totalPlannedMinutes={600}
        {...overrides}
      />
    </MemoryRouter>,
  )
  return { ...view, onClose }
}

describe('ProgressLabModal', () => {
  it('renders an accessible body portal with fixed ranges and independent layer controls', async () => {
    renderModal()

    const dialog = screen.getByRole('dialog', { name: 'Study trajectory and pace scenario' })
    expect(dialog.parentElement).toBe(document.body)
    expect(dialog).toHaveAccessibleDescription('Inspect your cumulative progress and compare it with the original plan.')
    expect(screen.getByRole('button', { name: 'Full plan' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'false')

    const planned = screen.getByRole('button', { name: 'Planned staircase' })
    const projection = screen.getByRole('button', { name: 'GP pace projection' })
    const confidence = screen.getByRole('button', { name: 'Confidence band' })
    expect(planned).toHaveAttribute('aria-pressed', 'true')
    expect(projection).toHaveAttribute('aria-pressed', 'true')
    expect(confidence).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(planned)
    fireEvent.click(confidence)
    expect(planned).toHaveAttribute('aria-pressed', 'false')
    expect(projection).toHaveAttribute('aria-pressed', 'true')
    expect(confidence).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('checkpoint-2026-07-15')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close Progress Lab' })).toHaveFocus())
  })

  it('selects visible checkpoints with pointer, Enter, and Space and shows signed summaries', () => {
    renderModal()

    fireEvent.click(screen.getByTestId('checkpoint-2026-07-05'))
    expect(screen.getByText('Jul 5')).toBeInTheDocument()
    expect(screen.getByText('2h 30m')).toBeInTheDocument()
    expect(screen.getByText('3h')).toBeInTheDocument()
    expect(screen.getByText('-30m')).toBeInTheDocument()
    expect(screen.getByText(/2h added since the previous checkpoint/)).toBeInTheDocument()

    const laterCheckpoint = screen.getByTestId('checkpoint-2026-07-15')
    fireEvent.keyDown(laterCheckpoint, { key: 'Enter' })
    expect(screen.getByText('Jul 15')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId('checkpoint-2026-07-01'), { key: ' ' })
    expect(screen.getByText('Jul 1')).toBeInTheDocument()
  })

  it('clears a selected checkpoint when a range change removes it', () => {
    renderModal()

    fireEvent.click(screen.getByTestId('checkpoint-2026-07-05'))
    expect(screen.getByText('Selected checkpoint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'This week' }))
    expect(screen.queryByText('Selected checkpoint')).not.toBeInTheDocument()
    expect(screen.queryByTestId('checkpoint-2026-07-05')).not.toBeInTheDocument()
    expect(screen.getByTestId('checkpoint-2026-07-15')).toBeInTheDocument()
  })

  it('locks body scrolling and handles Escape dismissal', () => {
    const { onClose } = renderModal()
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows Plan and Forecast narrative at Current pace, then adds the selected pace finish', () => {
    renderModal({
      capacityScenarioInput: {
        remainingEstimatedMinutes: 340,
        sessions: [],
        today: '2026-07-15',
        hoursPerStudyDay: 1,
        selectedStudyDays: ['Wed', 'Fri'],
        actualCumulativeMinutes: 260,
        finalPlannedCumulativeMinutes: 600,
      },
    })

    const slider = screen.getByRole('slider', { name: 'Extra minutes per study day' })
    expect(slider).toHaveValue('0')
    expect(screen.getByTestId('finish-narrative-plan')).toHaveTextContent('Aug 31, 2026')
    expect(screen.getByTestId('finish-narrative-forecast')).toHaveTextContent('Sep 12, 2026')
    expect(screen.getByTestId('finish-narrative-forecast')).toHaveTextContent('12 days late vs deadline')
    expect(screen.getByTestId('finish-narrative-forecast')).toHaveTextContent('current trajectory')
    expect(screen.getByText('estimate')).toBeInTheDocument()
    expect(screen.queryByTestId('capacity-scenario-line')).not.toBeInTheDocument()
    expect(screen.queryByTestId('finish-flag-scenario')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Replan with this pace' })).toHaveAttribute(
      'href',
      '/replan?paceDeltaMinutes=0',
    )

    fireEvent.change(slider, { target: { value: '15' } })
    expect(screen.getByTestId('capacity-scenario-line')).toBeInTheDocument()
    expect(screen.getByTestId('finish-flag-scenario')).toHaveTextContent('Your pace · Jul 29')
    expect(screen.getByTestId('finish-narrative-scenario')).toHaveTextContent('Jul 29, 2026')
    expect(screen.getByTestId('finish-narrative-scenario')).toHaveTextContent('33 days early vs deadline')
    expect(screen.getByRole('link', { name: 'Replan with this pace' })).toHaveAttribute(
      'href',
      '/replan?paceDeltaMinutes=15',
    )
  })

  it('shows explicit unavailable inputs and keeps historical Plan inspection', () => {
    const view = renderModal({
      deadlineISO: undefined,
      forecastFinishISO: undefined,
      totalPlannedMinutes: undefined,
    })
    expect(screen.getByRole('slider', { name: 'Extra minutes per study day' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Replan with this pace' })).toBeDisabled()
    expect(screen.getByText('Pace scenario is unavailable until roadmap capacity is ready.')).toBeInTheDocument()
    expect(screen.getByTestId('finish-narrative-plan')).toHaveTextContent('roadmap deadline is missing')
    expect(screen.getByTestId('finish-narrative-forecast')).toHaveTextContent('projection finish is ready')

    view.unmount()
    renderModal({ historical: true })
    expect(screen.queryByRole('slider', { name: 'Extra minutes per study day' })).not.toBeInTheDocument()
    expect(screen.queryByText('Try a pace')).not.toBeInTheDocument()
    expect(screen.getByTestId('finish-narrative-plan')).toHaveTextContent('Aug 31, 2026')
    expect(screen.queryByTestId('finish-narrative-forecast')).not.toBeInTheDocument()
    expect(screen.getByTestId('burn-up-goal-line')).toBeInTheDocument()
    expect(screen.getByTestId('finish-flag-plan')).toBeInTheDocument()
    expect(screen.queryByTestId('finish-flag-forecast')).not.toBeInTheDocument()
    expect(screen.getByTestId('crosshair-hit-area')).toBeInTheDocument()
  })

  it('marks only analytic forecasts as estimates and names a missing planned total', () => {
    const view = renderModal({ forecastBasis: 'gp' })
    expect(screen.queryByText('estimate')).not.toBeInTheDocument()

    view.unmount()
    renderModal({ totalPlannedMinutes: undefined })
    expect(screen.getByTestId('finish-narrative-plan')).toHaveTextContent('planned total is missing')
  })

  it('traps focus and restores the opener after backdrop dismissal', async () => {
    function Harness() {
      const [open, setOpen] = useState(true)
      const openerRef = useRef<HTMLButtonElement>(null)
      return (
        <>
          <button ref={openerRef} type="button" onClick={() => setOpen(true)}>Open lab</button>
          <ProgressLabModal
            open={open}
            onClose={() => setOpen(false)}
            data={data()}
            referenceDateISO="2026-07-15"
            referenceLabel="Today"
            weekStartISO="2026-07-13"
            weekEndISO="2026-07-19"
            openerRef={openerRef}
          />
        </>
      )
    }

    render(<MemoryRouter><Harness /></MemoryRouter>)
    const close = screen.getByRole('button', { name: 'Close Progress Lab' })
    await waitFor(() => expect(close).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Confidence band' })).toHaveFocus()

    fireEvent.click(screen.getByTestId('progress-lab-backdrop'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open lab' })).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })
})
