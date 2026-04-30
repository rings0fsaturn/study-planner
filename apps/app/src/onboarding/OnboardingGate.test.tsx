import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useEventStore } from '../events/useEventStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { OnboardingGate } from './OnboardingGate'
import { BrowserRouter } from 'react-router-dom'

vi.mock('../events/useEventStore')
vi.mock('dexie-react-hooks')

const mockUseEventStore = vi.mocked(useEventStore)
const mockUseLiveQuery = vi.mocked(useLiveQuery)

function ChildComponent() {
  return <div data-testid="child">Onboarding Content</div>
}

describe('OnboardingGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when no OnboardingCompleted event exists', async () => {
    const mockEventStore = {
      getAll: vi.fn().mockResolvedValue([
        { kind: 'SessionLogged', payload: {}, createdAt: '2024-01-01' }
      ]),
      table: vi.fn(),
    }
    mockUseEventStore.mockReturnValue(mockEventStore as any)
    mockUseLiveQuery.mockReturnValue([
      { kind: 'SessionLogged', payload: {}, createdAt: '2024-01-01' }
    ])

    render(
      <BrowserRouter>
        <OnboardingGate>
          <ChildComponent />
        </OnboardingGate>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  it('shows nothing while checking events (events undefined)', async () => {
    const mockEventStore = {
      getAll: vi.fn().mockResolvedValue([]),
      table: vi.fn(),
    }
    mockUseEventStore.mockReturnValue(mockEventStore as any)
    mockUseLiveQuery.mockReturnValue(undefined)

    const { container } = render(
      <BrowserRouter>
        <OnboardingGate>
          <ChildComponent />
        </OnboardingGate>
      </BrowserRouter>
    )

    expect(container.firstChild).toBeNull()
  })
})