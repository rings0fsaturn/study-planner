import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecalibrationModal } from './RecalibrationModal'
import type { PromptDetail } from '@study-tracker/progress'

const mockPromptDetail: PromptDetail = {
  sessions: [
    {
      sessionId: 'sess-1',
      date: '2026-04-28',
      timeOfDay: 'afternoon',
      sessionTitle: 'DDIA Chapter 3',
      plannedMinutes: 60,
      activeMinutes: 92,
    },
    {
      sessionId: 'sess-2',
      date: '2026-04-29',
      timeOfDay: 'morning',
      sessionTitle: 'LeetCode session',
      plannedMinutes: 45,
      activeMinutes: 70,
    },
  ],
  currentPace: 1.4,
  previousPace: 1.0,
}

describe('RecalibrationModal', () => {
  let onReplan: ReturnType<typeof vi.fn>
  let onAcknowledge: ReturnType<typeof vi.fn>
  let onTemporary: ReturnType<typeof vi.fn>
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onReplan = vi.fn()
    onAcknowledge = vi.fn()
    onTemporary = vi.fn()
    onClose = vi.fn()
  })

  function renderModal(promptDetail: PromptDetail | null = mockPromptDetail) {
    return render(
      <RecalibrationModal
        promptDetail={promptDetail}
        onReplan={onReplan}
        onAcknowledge={onAcknowledge}
        onTemporary={onTemporary}
        onClose={onClose}
      />,
    )
  }

  it('shows pace change message', () => {
    renderModal()
    expect(screen.getByText('Your pace has changed')).toBeInTheDocument()
    expect(screen.getByText(/faster than planned/)).toBeInTheDocument()
  })

  it('"Adjust my roadmap" calls onReplan', () => {
    renderModal()
    fireEvent.click(screen.getByText('Adjust my roadmap'))
    expect(onReplan).toHaveBeenCalledTimes(1)
  })

  it('"This is my pace now" calls onAcknowledge', () => {
    renderModal()
    fireEvent.click(screen.getByText('This is my pace now'))
    expect(onAcknowledge).toHaveBeenCalledTimes(1)
  })

  it('"This was temporary" shows session checklist', () => {
    renderModal()
    fireEvent.click(screen.getByText('This was temporary'))
    expect(screen.getByText('DDIA Chapter 3')).toBeInTheDocument()
    expect(screen.getByText('LeetCode session')).toBeInTheDocument()
  })

  it('checklist confirm calls onTemporary with checked session IDs', () => {
    renderModal()
    fireEvent.click(screen.getByText('This was temporary'))

    // Both sessions checked by default
    fireEvent.click(screen.getByText(/Mark as unusual/))
    expect(onTemporary).toHaveBeenCalledWith(['sess-1', 'sess-2'])
  })

  it('unchecking a session excludes it from temporary callback', () => {
    renderModal()
    fireEvent.click(screen.getByText('This was temporary'))

    // Uncheck the first session by clicking its row
    fireEvent.click(screen.getByText('DDIA Chapter 3'))
    fireEvent.click(screen.getByText(/Mark as unusual/))
    expect(onTemporary).toHaveBeenCalledWith(['sess-2'])
  })

  it('closing overlay calls onClose without emitting events', () => {
    renderModal()
    const overlay = document.querySelector('.modal-overlay')!
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onReplan).not.toHaveBeenCalled()
    expect(onAcknowledge).not.toHaveBeenCalled()
    expect(onTemporary).not.toHaveBeenCalled()
  })

  it('shows session details in checklist rows', () => {
    renderModal()
    fireEvent.click(screen.getByText('This was temporary'))

    expect(screen.getByText(/60 min planned → 92 min actual/)).toBeInTheDocument()
    expect(screen.getByText(/45 min planned → 70 min actual/)).toBeInTheDocument()
  })
})
