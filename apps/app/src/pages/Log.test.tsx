import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Log } from './Log'

const mockLogEvent = vi.fn().mockResolvedValue(1)
const mockNavigate = vi.fn()

vi.mock('../sync/useSync', () => ({
  useSync: () => ({ logEvent: mockLogEvent }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('Log', () => {
  beforeEach(() => {
    mockLogEvent.mockClear()
    mockNavigate.mockClear()
  })

  function renderLog() {
    return render(
      <MemoryRouter initialEntries={['/log']}>
        <Log />
      </MemoryRouter>,
    )
  }

  it('renders time-of-day chips', () => {
    renderLog()
    expect(screen.getByText('Morning')).toBeInTheDocument()
    expect(screen.getByText('Afternoon')).toBeInTheDocument()
    expect(screen.getByText('Evening')).toBeInTheDocument()
  })

  it('renders "This was unusual" checkbox', () => {
    renderLog()
    expect(screen.getByText('This was unusual')).toBeInTheDocument()
  })

  it('submitting without unusual emits only SessionLogged', async () => {
    renderLog()

    fireEvent.change(screen.getByLabelText('Duration (minutes)'), {
      target: { value: '45' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Log session' }))

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledTimes(1)
    })
    expect(mockLogEvent).toHaveBeenCalledWith(
      'SessionLogged',
      expect.objectContaining({
        source: 'manual',
        duration: 45,
        sessionId: expect.any(String),
      }),
    )
  })

  it('submitting with unusual emits both SessionLogged and SessionTaggedExceptional', async () => {
    renderLog()

    fireEvent.change(screen.getByLabelText('Duration (minutes)'), {
      target: { value: '60' },
    })
    fireEvent.click(screen.getByText('This was unusual'))
    fireEvent.submit(screen.getByRole('button', { name: 'Log session' }))

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledTimes(2)
    })

    const sessionLoggedCall = mockLogEvent.mock.calls[0]
    const taggedCall = mockLogEvent.mock.calls[1]

    expect(sessionLoggedCall[0]).toBe('SessionLogged')
    expect(taggedCall[0]).toBe('SessionTaggedExceptional')
    expect(taggedCall[1].sessionId).toBe(sessionLoggedCall[1].sessionId)
    expect(taggedCall[1].exceptional).toBe(true)
  })

  it('includes timeOfDay in SessionLogged payload', async () => {
    renderLog()

    fireEvent.change(screen.getByLabelText('Duration (minutes)'), {
      target: { value: '30' },
    })
    fireEvent.click(screen.getByText('Evening'))
    fireEvent.submit(screen.getByRole('button', { name: 'Log session' }))

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith(
        'SessionLogged',
        expect.objectContaining({ timeOfDay: 'evening' }),
      )
    })
  })

  it('shows error when duration is invalid', async () => {
    renderLog()

    fireEvent.change(screen.getByLabelText('Duration (minutes)'), {
      target: { value: '0' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Log session' }))

    expect(
      await screen.findByText('Please enter a valid duration in minutes'),
    ).toBeInTheDocument()
    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})
