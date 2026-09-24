import { act, renderHook } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuideProvider } from './GuideProvider'
import { FakeGuideClient } from './testing/fakeGuideClient'
import { usePracticeGuide, type UsePracticeGuideOptions } from './usePracticeGuide'
import type { GuideFrame } from './types'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

function wrapper(client: FakeGuideClient) {
  return ({ children }: { children: ReactNode }) => (
    <GuideProvider client={client}>{children}</GuideProvider>
  )
}

function hook(options: Partial<UsePracticeGuideOptions> = {}) {
  const fake = new FakeGuideClient()
  const view = renderHook(
    () =>
      usePracticeGuide({
        questionId: 'q1',
        work: 'cleaned += c',
        enabled: true,
        ...options,
      }),
    { wrapper: wrapper(fake) },
  )
  return { fake, view }
}

const START: GuideFrame = { frame: 'start', sequence: 0, correlationId: 'c', text: 'Hel' }
const DELTA: GuideFrame = { frame: 'delta', sequence: 1, correlationId: 'c', text: 'lo' }
const DONE: GuideFrame = { frame: 'done', sequence: 2, correlationId: 'c' }

afterEach(() => {
  vi.useRealTimers()
})

describe('usePracticeGuide triggers', () => {
  it('offers on an explicit ask and streams the nudge on accept', async () => {
    const { fake, view } = hook()
    fake.scriptStream([START, DELTA, DONE])
    await act(async () => view.result.current.ask())
    expect(view.result.current.status).toBe('offered')
    expect(view.result.current.trigger).toBe('stuck')
    await act(async () => view.result.current.accept())
    expect(view.result.current.status).toBe('active')
    expect(view.result.current.tier).toBe('nudge')
    expect(view.result.current.text).toBe('Hello')
  })

  it('offers on idle after the timer, without forcing an active hint', async () => {
    vi.useFakeTimers()
    const { view } = hook()
    act(() => vi.advanceTimersByTime(45000))
    expect(view.result.current.status).toBe('offered')
    expect(view.result.current.trigger).toBe('idle')
  })

  it('never interrupts an active hint with a failed-test offer', async () => {
    const { fake, view } = hook()
    fake.scriptStream([START, DELTA, DONE])
    await act(async () => view.result.current.accept())
    await act(async () => view.result.current.notifyFailedTest())
    expect(view.result.current.status).toBe('active')
  })

  it('dismiss returns to idle and blocks the idle offer for this question', async () => {
    vi.useFakeTimers()
    const { view } = hook()
    await act(async () => view.result.current.ask())
    act(() => view.result.current.dismiss())
    expect(view.result.current.status).toBe('idle')
    act(() => vi.advanceTimersByTime(90000))
    expect(view.result.current.status).toBe('idle')
  })
})

describe('usePracticeGuide ladder and reveal gate', () => {
  it('escalates nudge -> concept -> strategy, then stops at the gated reveal', async () => {
    const { fake, view } = hook()
    fake.scriptStream([START, DELTA, DONE])
    await act(async () => view.result.current.accept())
    await act(async () => view.result.current.next())
    expect(view.result.current.tier).toBe('concept')
    await act(async () => view.result.current.next())
    expect(view.result.current.tier).toBe('strategy')
    await act(async () => view.result.current.next())
    expect(view.result.current.tier).toBe('worked_step')
    expect(view.result.current.atReveal).toBe(true)
    expect(view.result.current.revealed).toBe(false)
    // The gated tier never streamed on `next`.
    expect(fake.streamHint).toHaveBeenCalledTimes(3)
  })

  it('satisfies the reveal gate before streaming the worked step', async () => {
    const { fake, view } = hook({ attemptId: 'att-1' })
    fake.scriptStream([START, DELTA, DONE])
    fake.scriptReveal()
    await act(async () => view.result.current.accept())
    await act(async () => view.result.current.next())
    await act(async () => view.result.current.next())
    await act(async () => view.result.current.next())
    await act(async () => {
      await view.result.current.confirmReveal()
    })
    expect(fake.reveal).toHaveBeenCalledWith(
      expect.objectContaining({ attemptId: 'att-1', confirmation: true }),
    )
    expect(view.result.current.revealed).toBe(true)
    expect(view.result.current.text).toBe('Hello')
  })

  it('reports the reveal unavailable without an owned attempt', async () => {
    const { view } = hook({ attemptId: null })
    expect(view.result.current.revealAvailable).toBe(false)
  })
})

describe('usePracticeGuide stream integrity', () => {
  it('ignores duplicate sequence numbers', async () => {
    const { fake, view } = hook()
    fake.scriptStream([
      START,
      { frame: 'delta', sequence: 1, correlationId: 'c', text: 'A' },
      { frame: 'delta', sequence: 1, correlationId: 'c', text: 'A-dup' },
      { frame: 'delta', sequence: 2, correlationId: 'c', text: 'B' },
      { frame: 'done', sequence: 3, correlationId: 'c' },
    ])
    await act(async () => view.result.current.accept())
    // The `start` frame carries the first token; the duplicate sequence-1
    // delta is dropped, so the second `A` never lands.
    expect(view.result.current.text).toBe('HelAB')
  })

  it('retries before done and resets the buffer on the fresh start', async () => {
    const { fake, view } = hook()
    fake.streamHint
      .mockImplementationOnce(async (_request, handlers) => {
        handlers.onFrame(START)
        handlers.onFrame(DELTA)
        throw new TypeError('network')
      })
      .mockImplementationOnce(async (_request, handlers) => {
        handlers.onFrame({ frame: 'start', sequence: 0, correlationId: 'c', text: 'Re' })
        handlers.onFrame({ frame: 'delta', sequence: 1, correlationId: 'c', text: 'try' })
        handlers.onFrame(DONE)
      })
    await act(async () => view.result.current.accept())
    expect(view.result.current.text).toBe('Retry')
    expect(fake.streamHint).toHaveBeenCalledTimes(2)
  })

  it('surfaces an in-stream error frame', async () => {
    const { fake, view } = hook()
    fake.scriptStream([
      START,
      {
        frame: 'error',
        sequence: 1,
        correlationId: 'c',
        error: { code: 'provider_timeout', retryable: true, requestId: 'r', correlationId: 'c' },
      },
    ])
    await act(async () => view.result.current.accept())
    expect(view.result.current.error).toContain('provider_timeout')
  })

  it('surfaces a stream that ends cleanly without a done frame', async () => {
    const { fake, view } = hook()
    fake.scriptStream([START, DELTA])
    await act(async () => view.result.current.accept())
    expect(view.result.current.error).toContain('ended early')
  })
})

describe('usePracticeGuide scoping', () => {
  it('resets the coach when the active question changes', async () => {
    const fake = new FakeGuideClient()
    fake.scriptStream([START, DELTA, DONE])
    const view = renderHook(
      ({ qid }: { qid: string }) =>
        usePracticeGuide({ questionId: qid, work: 'w', enabled: true }),
      { wrapper: wrapper(fake), initialProps: { qid: 'q1' } },
    )
    await act(async () => view.result.current.accept())
    expect(view.result.current.status).toBe('active')

    await act(async () => view.rerender({ qid: 'q2' }))
    expect(view.result.current.status).toBe('idle')
    expect(view.result.current.tier).toBeNull()
    expect(view.result.current.text).toBe('')
  })

  it('starts one stream per tier under StrictMode (no double-fire)', async () => {
    const fake = new FakeGuideClient()
    fake.scriptStream([START, DELTA, DONE])
    const view = renderHook(
      () => usePracticeGuide({ questionId: 'q1', work: 'w', enabled: true }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <StrictMode>
            <GuideProvider client={fake}>{children}</GuideProvider>
          </StrictMode>
        ),
      },
    )
    await act(async () => view.result.current.accept())
    await act(async () => view.result.current.next())
    // accept streams the nudge; next streams the concept. StrictMode must not
    // replay the side effect, so neither tier fires twice.
    expect(fake.streamHint).toHaveBeenCalledTimes(2)
  })
})
