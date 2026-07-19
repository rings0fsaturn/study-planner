import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEventStore } from '../events/useEventStore'
import { useLiveQuery } from 'dexie-react-hooks'
import { OnboardingGate } from './OnboardingGate'
import { BrowserRouter, MemoryRouter, useLocation } from 'react-router-dom'
import { useOnboardingNavigate } from './useOnboardingNavigate'
import type { EventStore } from '../events/EventStore'

vi.mock('../events/useEventStore')
vi.mock('dexie-react-hooks')

const mockUseEventStore = vi.mocked(useEventStore)
const mockUseLiveQuery = vi.mocked(useLiveQuery)

function ChildComponent() {
  return <div data-testid="child">Onboarding Content</div>
}

function NavigatingChild() {
  const navigate = useOnboardingNavigate()
  const location = useLocation()

  return (
    <>
      <div data-testid="child">Onboarding Content</div>
      <div data-testid="path">{location.pathname}{location.search}</div>
      <button type="button" onClick={() => navigate('/onboarding/2')}>
        Next step
      </button>
    </>
  )
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
    mockUseEventStore.mockReturnValue(mockEventStore as unknown as EventStore)
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
    mockUseEventStore.mockReturnValue(mockEventStore as unknown as EventStore)
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

  it('renders nothing after onboarding was completed outside new-roadmap mode', async () => {
    const mockEventStore = {
      getAll: vi.fn().mockResolvedValue([
        { kind: 'OnboardingCompleted', payload: {}, createdAt: '2024-01-01' },
      ]),
      table: vi.fn(),
    }
    mockUseEventStore.mockReturnValue(mockEventStore as unknown as EventStore)
    mockUseLiveQuery.mockReturnValue([
      { kind: 'OnboardingCompleted', payload: {}, createdAt: '2024-01-01' },
    ])

    const { container } = render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <OnboardingGate>
          <ChildComponent />
        </OnboardingGate>
      </MemoryRouter>
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders children in new-roadmap mode even after onboarding was completed', async () => {
    const mockEventStore = {
      getAll: vi.fn().mockResolvedValue([
        { kind: 'OnboardingCompleted', payload: {}, createdAt: '2024-01-01' },
      ]),
      table: vi.fn(),
    }
    mockUseEventStore.mockReturnValue(mockEventStore as unknown as EventStore)
    mockUseLiveQuery.mockReturnValue([
      { kind: 'OnboardingCompleted', payload: {}, createdAt: '2024-01-01' },
    ])

    render(
      <MemoryRouter initialEntries={['/onboarding?new=1']}>
        <OnboardingGate>
          <ChildComponent />
        </OnboardingGate>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  it('renders children when new-roadmap mode is passed in router state', async () => {
    const mockEventStore = {
      getAll: vi.fn().mockResolvedValue([
        { kind: 'OnboardingCompleted', payload: {}, createdAt: '2024-01-01' },
      ]),
      table: vi.fn(),
    }
    mockUseEventStore.mockReturnValue(mockEventStore as unknown as EventStore)
    mockUseLiveQuery.mockReturnValue([
      { kind: 'OnboardingCompleted', payload: {}, createdAt: '2024-01-01' },
    ])

    render(
      <MemoryRouter initialEntries={[{ pathname: '/onboarding', state: { newRoadmap: true } }]}>
        <OnboardingGate>
          <ChildComponent />
        </OnboardingGate>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  it('keeps returning users in new-roadmap mode after step navigation', async () => {
    const mockEventStore = {
      getAll: vi.fn().mockResolvedValue([
        { kind: 'OnboardingCompleted', payload: {}, createdAt: '2024-01-01' },
      ]),
      table: vi.fn(),
    }
    mockUseEventStore.mockReturnValue(mockEventStore as unknown as EventStore)
    mockUseLiveQuery.mockReturnValue([
      { kind: 'OnboardingCompleted', payload: {}, createdAt: '2024-01-01' },
    ])

    render(
      <MemoryRouter initialEntries={['/onboarding/1?new=1']}>
        <OnboardingGate>
          <NavigatingChild />
        </OnboardingGate>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(screen.getByTestId('path')).toHaveTextContent('/onboarding/2?new=1')
    })
  })
})
