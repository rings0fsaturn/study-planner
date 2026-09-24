import { vi } from 'vitest'
import type { GuideClientLike } from '../guideClient'
import type { GuideFrame, RevealResponse } from '../types'

/** Test double for `GuideClientLike`: every method is a `vi.fn` by default. */
export class FakeGuideClient implements GuideClientLike {
  streamHint = vi.fn(
    async (
      _request: Parameters<GuideClientLike['streamHint']>[0],
      _handlers: Parameters<GuideClientLike['streamHint']>[1],
    ): Promise<void> => {
      throw new Error('streamHint not scripted')
    },
  )

  reveal = vi.fn(async (): Promise<RevealResponse> => {
    throw new Error('reveal not scripted')
  })

  /** Deliver a fixed frame list on the next `streamHint` call. */
  scriptStream(frames: GuideFrame[]): void {
    this.streamHint.mockImplementation(async (_request, handlers) => {
      for (const frame of frames) handlers.onFrame(frame)
    })
  }

  /** Deliver one frame list per attempt; an Error entry throws that attempt. */
  scriptStreamAttempts(attempts: Array<GuideFrame[] | Error>): void {
    let index = 0
    this.streamHint.mockImplementation(async (_request, handlers) => {
      const attempt = attempts[Math.min(index, attempts.length - 1)]
      index += 1
      if (attempt instanceof Error) throw attempt
      for (const frame of attempt) handlers.onFrame(frame)
    })
  }

  scriptReveal(response?: Partial<RevealResponse>): void {
    this.reveal.mockImplementation(async () => ({
      questionId: 'q1',
      attemptId: 'att-1',
      gateSatisfied: true,
      explanation: 'gate satisfied',
      ...response,
    }))
  }
}

export function guideFrame(overrides: Partial<GuideFrame> & { sequence: number }): GuideFrame {
  return {
    frame: 'delta',
    correlationId: 'corr',
    text: 'text',
    ...overrides,
  }
}
