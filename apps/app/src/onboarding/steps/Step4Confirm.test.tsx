import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Step4Confirm } from './Step4Confirm'
import { useEventStore } from '../../events/useEventStore'
import type { EventStore } from '../../events/EventStore'

vi.mock('../../events/useEventStore')
vi.mock('../CheckpointGate', () => ({
  CheckpointGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let mockEvents: Array<{ kind: string; payload: Record<string, unknown>; createdAt: string }> | undefined = []

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => mockEvents,
}))

const mockUseEventStore = vi.mocked(useEventStore)

describe('Step4Confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEvents = []

    const mockEventStore = {
      getAll: vi.fn().mockResolvedValue([]),
      append: vi.fn(),
    } as unknown as EventStore

    mockUseEventStore.mockReturnValue(mockEventStore)
  })

  it('renders success message with check icon', () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/4']}>
        <Step4Confirm />
      </MemoryRouter>
    )

    expect(screen.getByText('All set.')).toBeInTheDocument()
    expect(document.querySelector('.onboarding-success-check')).toBeInTheDocument()
  })

  it('"Go to home" button navigates to /home', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/4']}>
        <Routes>
          <Route path="/onboarding/4" element={<Step4Confirm />} />
          <Route path="/home" element={<div data-testid="home-page">Home</div>} />
        </Routes>
      </MemoryRouter>
    )

    const goHomeBtn = screen.getByText('Go to home')
    fireEvent.click(goHomeBtn)

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })
})
