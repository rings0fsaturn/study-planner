import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PracticeCoach } from './PracticeCoach'
import type { PracticeGuide } from './usePracticeGuide'

// Real stylesheet from disk (see withRealStyles): `?raw` CSS imports are empty
// under vitest, and module-scope `import.meta.url` does not survive the transform.

const LONG_QUOTE =
  'Performance is judged on both financial and non-financial measures, and the variance ' +
  'analysis identifies which critical success factor the shortfall actually comes from in the ' +
  'case period under review, with the supporting detail quoted at length from the material. '

function fiveLongCitations() {
  return Array.from({ length: 5 }, (_, index) => ({
    chunkId: `chunk-${index}`,
    materialId: 'material-1',
    quote: `${LONG_QUOTE}(${index})`,
  }))
}

/** The real stylesheet: jsdom has no layout, so containment is asserted on computed styles. */
function withRealStyles(): () => void {
  // NOTE: `new URL('./practiceCoach.css', import.meta.url)` is Vite's asset-import
  // syntax and gets rewritten, so resolve the path with dirname instead.
  const practiceCoachCss = readFileSync(join(import.meta.dirname, 'practiceCoach.css'), 'utf8')
  const style = document.createElement('style')
  style.textContent = practiceCoachCss
  document.head.appendChild(style)
  return () => style.remove()
}

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

  it('keeps a five-quote sources list capped, scrollable, and collapsible', () => {
    const removeStyles = withRealStyles()
    try {
      const { container } = render(
        <PracticeCoach guide={makeGuide({ citations: fiveLongCitations() })} />,
      )
      const summary = screen.getByText('5 sources')
      const details = summary.closest('details')
      expect(details).not.toBeNull()

      fireEvent.click(summary)
      expect(details!.open).toBe(true)

      const list = container.querySelector('.coach-citations ul') as HTMLElement
      expect(getComputedStyle(list).overflowY).toBe('auto')
      expect(Number.parseFloat(getComputedStyle(list).maxHeight)).toBeLessThanOrEqual(200)

      const card = container.querySelector('.coach') as HTMLElement
      expect(getComputedStyle(card).display).toBe('flex')
      expect(getComputedStyle(card).overflow).toBe('hidden')
      expect(getComputedStyle(card).maxHeight).toBe('min(70vh, 560px)')

      const body = container.querySelector('.coach-body') as HTMLElement
      expect(getComputedStyle(body).overflowY).toBe('auto')

      fireEvent.click(summary)
      expect(details!.open).toBe(false)
    } finally {
      removeStyles()
    }
  })

  it('dismisses from the close control', () => {
    const dismiss = vi.fn()
    render(<PracticeCoach guide={makeGuide({ dismiss })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss practice coach' }))
    expect(dismiss).toHaveBeenCalled()
  })
})
