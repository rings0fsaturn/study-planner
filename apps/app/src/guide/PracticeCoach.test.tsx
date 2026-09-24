import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PracticeCoach } from './PracticeCoach'
import type { PracticeGuide } from './usePracticeGuide'

function makeGuide(overrides: Partial<PracticeGuide> = {}): PracticeGuide {
  return {
    status: 'active',
    trigger: null,
    tier: 'nudge',
    tierIndex: 0,
    atReveal: false,
    revealed: false,
    text: 'What does this line do to each character?',
    citations: [],
    streaming: false,
    error: null,
    revealAvailable: true,
    ask: vi.fn(),
    accept: vi.fn(),
    next: vi.fn(),
    dismiss: vi.fn(),
    poke: vi.fn(),
    confirmReveal: vi.fn(),
    notifyFailedTest: vi.fn(),
    ...overrides,
  }
}

describe('PracticeCoach', () => {
  it('renders nothing while idle', () => {
    const { container } = render(<PracticeCoach guide={makeGuide({ status: 'idle' })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers help without forcing it', () => {
    const accept = vi.fn()
    render(
      <PracticeCoach
        guide={makeGuide({ status: 'offered', trigger: 'idle', accept })}
      />,
    )
    expect(screen.getByText(/want a hint/i)).toBeInTheDocument()
    expect(screen.getByText("You've paused for a bit")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, help me' }))
    expect(accept).toHaveBeenCalled()
  })

  it('shows the tier, the line, and the streamed hint', () => {
    render(<PracticeCoach guide={makeGuide()} activeLine={4} />)
    expect(screen.getByText('Nudge')).toBeInTheDocument()
    expect(screen.getByText('Line 4')).toBeInTheDocument()
    expect(screen.getByText(/what does this line do/i)).toBeInTheDocument()
  })

  it('shows the processing dots while streaming before the first token', () => {
    const { container } = render(
      <PracticeCoach guide={makeGuide({ streaming: true, text: '' })} />,
    )
    expect(container.querySelectorAll('.processing-dot')).toHaveLength(3)
  })

  it('escalates with Go deeper', () => {
    const next = vi.fn()
    render(<PracticeCoach guide={makeGuide({ next })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Go deeper' }))
    expect(next).toHaveBeenCalled()
  })

  it('gates the reveal behind an explicit confirm', () => {
    const confirmReveal = vi.fn()
    render(
      <PracticeCoach
        guide={makeGuide({ tier: 'worked_step', tierIndex: 3, atReveal: true, confirmReveal })}
      />,
    )
    expect(screen.getByText('Reveal (gated)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal a worked step' }))
    expect(confirmReveal).toHaveBeenCalled()
  })

  it('tells the learner to submit first when the gate is unavailable', () => {
    render(
      <PracticeCoach
        guide={makeGuide({ tier: 'worked_step', tierIndex: 3, atReveal: true, revealAvailable: false })}
      />,
    )
    expect(screen.getByText(/submit an attempt first/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal a worked step' })).toBeNull()
  })

  it('shows the reveal note once revealed', () => {
    render(
      <PracticeCoach
        guide={makeGuide({ tier: 'worked_step', tierIndex: 3, atReveal: true, revealed: true })}
      />,
    )
    expect(screen.getByText(/reference to check against, not to paste/i)).toBeInTheDocument()
  })

  it('lists citations in a collapsed disclosure', () => {
    render(
      <PracticeCoach
        guide={makeGuide({
          citations: [{ chunkId: 'c1', materialId: 'm1', quote: 'a grounded line' }],
        })}
      />,
    )
    expect(screen.getByText('1 source')).toBeInTheDocument()
    expect(screen.getByText(/a grounded line/i)).toBeInTheDocument()
  })

  it('dismisses from the close control', () => {
    const dismiss = vi.fn()
    render(<PracticeCoach guide={makeGuide({ dismiss })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss practice coach' }))
    expect(dismiss).toHaveBeenCalled()
  })
})
