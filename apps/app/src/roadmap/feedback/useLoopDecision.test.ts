import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  FakeAssessmentClient,
  loopDecision,
  masteryProjection,
} from '../../assessments/testing/fakeAssessmentClient'
import type { LoopPosture } from '../../assessments/types'
import { buildEvidence } from './feedbackModel'
import type { FeedbackState } from './types'
import {
  __clearLoopDecisionMemo,
  buildLoopInput,
  buildLoopPosture,
  useLoopDecision,
} from './useLoopDecision'

const POSTURE: LoopPosture = {
  behind_days: 0,
  days_left: 20,
  pace_vs_plan: 1,
  capacity_hours_per_week: 6,
}

const IDS = { materialIds: ['mat-1'], materialTitles: ['Operating Systems'] }

function argsFor(state: FeedbackState, n = 4) {
  const projections = [masteryProjection({ materialId: 'mat-1', n })]
  return {
    ...IDS,
    state,
    projections,
    evidence: buildEvidence(projections, 0.7),
    posture: POSTURE,
  }
}

beforeEach(() => {
  __clearLoopDecisionMemo()
})

describe('buildLoopInput', () => {
  it('maps observed projections to ceiling signals in canonical order with code-computed totals', () => {
    const projections = [
      masteryProjection({ materialId: 'mat-b', skillTag: 'Zulu', n: 3, mastery: 0.4 }),
      masteryProjection({ materialId: 'mat-a', skillTag: 'Alpha', n: 8, mastery: 0.9 }),
    ]
    const input = buildLoopInput(projections, buildEvidence(projections, 0.7), POSTURE, {
      materialIds: ['mat-b', 'mat-a'],
      materialTitles: ['B', 'A'],
    })

    expect(input.materialIds).toEqual(['mat-b', 'mat-a'])
    expect(input.signals.map((signal) => signal.material)).toEqual(['mat-a', 'mat-b'])
    expect(input.signals[0]).toMatchObject({
      material: 'mat-a',
      skill: 'Alpha',
      mastery: 0.9,
      observations: 8,
    })
    expect(input.evidence_summary).toEqual({
      total_attempts: 11,
      skills_observed: 2,
      min_obs_per_skill: 3,
      max_obs_per_skill: 8,
      days_span: 0,
    })
    expect(input.posture).toEqual(POSTURE)
  })

  it('drops unobserved projections and caps signals at 200', () => {
    const projections = [
      masteryProjection({ materialId: 'mat-1', skillTag: 'Cold', n: 0 }),
      ...Array.from({ length: 250 }, (_, index) =>
        masteryProjection({ materialId: 'mat-1', skillTag: `skill-${index}`, n: 2 }),
      ),
    ]
    const input = buildLoopInput(projections, buildEvidence(projections, 0.7), POSTURE, IDS)

    expect(input.signals).toHaveLength(200)
    expect(input.signals.some((signal) => signal.skill === 'Cold')).toBe(false)
  })

  it('zeroes the summary when nothing is observed', () => {
    const input = buildLoopInput([], [], POSTURE, IDS)

    expect(input.signals).toEqual([])
    expect(input.evidence_summary).toEqual({
      total_attempts: 0,
      skills_observed: 0,
      min_obs_per_skill: 0,
      max_obs_per_skill: 0,
      days_span: 0,
    })
  })
})

describe('buildLoopPosture', () => {
  it('derives behind days, days left, pace, and capacity from roadmap and progress values', () => {
    expect(
      buildLoopPosture({
        deadline: '2026-11-01',
        today: '2026-10-12',
        weeklyHours: 6,
        projectedFinish: '2026-11-04',
        minutesThisWeek: 60,
        plannedMinutesThisWeek: 120,
      }),
    ).toEqual({
      behind_days: 3,
      days_left: 20,
      pace_vs_plan: 0.5,
      capacity_hours_per_week: 6,
    })
  })

  it('falls back to neutral posture when the projection is unknown', () => {
    expect(
      buildLoopPosture({
        deadline: '2026-11-01',
        today: '2026-10-12',
        weeklyHours: 6,
        projectedFinish: null,
        minutesThisWeek: 0,
        plannedMinutesThisWeek: 0,
      }),
    ).toEqual({
      behind_days: 0,
      days_left: 20,
      pace_vs_plan: 1,
      capacity_hours_per_week: 6,
    })
  })

  it('parses datetime-shaped dates by calendar day and clamps an extreme pace', () => {
    expect(
      buildLoopPosture({
        deadline: '2026-11-01',
        today: '2026-10-12',
        weeklyHours: 6,
        projectedFinish: '2026-11-04T10:00:00',
        minutesThisWeek: 600,
        plannedMinutesThisWeek: 60,
      }),
    ).toEqual({
      behind_days: 3,
      days_left: 20,
      pace_vs_plan: 5,
      capacity_hours_per_week: 6,
    })
  })
})

describe('useLoopDecision', () => {
  for (const state of ['cold', 'stale', 'rebuilding'] as const) {
    it(`never calls for the ${state} state`, async () => {
      const client = new FakeAssessmentClient()
      const { result } = renderHook(() => useLoopDecision(client, argsFor(state)))

      await waitFor(() => expect(result.current).toBeNull())
      expect(client.getLoopDecision).not.toHaveBeenCalled()
    })
  }

  it('passes the routed verdict through on updated', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetLoopDecision(loopDecision({ verdict: 'suggest_replan' }))
    const { result } = renderHook(() => useLoopDecision(client, argsFor('updated')))

    await waitFor(() => expect(result.current?.verdict).toBe('suggest_replan'))
    expect(client.getLoopDecision).toHaveBeenCalledTimes(1)
    const sent = (client.getLoopDecision.mock.calls[0] as unknown[])[0] as ReturnType<
      typeof buildLoopInput
    >
    expect(sent.materialIds).toEqual(['mat-1'])
    expect(sent.signals).toHaveLength(1)
    expect(sent.posture).toEqual(POSTURE)
  })

  it('resolves null when the call fails, never throwing', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetLoopDecision(new Error('offline'))
    const { result } = renderHook(() => useLoopDecision(client, argsFor('updated')))

    await waitFor(() => expect(result.current).toBeNull())
    expect(client.getLoopDecision).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['AbortError', Object.assign(new Error('aborted'), { name: 'AbortError' })],
    ['TypeError', new TypeError('fetch failed')],
  ])('resolves null on %s without throwing', async (_label, failure) => {
    const client = new FakeAssessmentClient()
    client.scriptGetLoopDecision(failure)
    const { result } = renderHook(() => useLoopDecision(client, argsFor('updated')))

    await waitFor(() => expect(result.current).toBeNull())
    expect(client.getLoopDecision).toHaveBeenCalledTimes(1)
  })

  it('resolves null on an unknown rejection value without throwing', async () => {
    const client = new FakeAssessmentClient()
    client.getLoopDecision.mockRejectedValueOnce('string failure')
    const { result } = renderHook(() => useLoopDecision(client, argsFor('updated')))

    await waitFor(() => expect(result.current).toBeNull())
    expect(client.getLoopDecision).toHaveBeenCalledTimes(1)
  })

  it('resolves null on a malformed verdict without throwing', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetLoopDecision({ verdict: 'unknown' } as unknown as ReturnType<
      typeof loopDecision
    >)
    const { result } = renderHook(() => useLoopDecision(client, argsFor('updated')))

    await waitFor(() => expect(result.current).toBeNull())
  })

  it('keeps id/title pairing when the canonical order differs from input order', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetLoopDecision(loopDecision())
    const projections = [
      masteryProjection({ materialId: 'mat-b', skillTag: 'Beta', n: 3 }),
      masteryProjection({ materialId: 'mat-a', skillTag: 'Alpha', n: 5 }),
    ]
    const { result } = renderHook(() =>
      useLoopDecision(client, {
        materialIds: ['mat-b', 'mat-a'],
        materialTitles: ['Title B', 'Title A'],
        state: 'updated',
        projections,
        evidence: buildEvidence(projections, 0.7),
        posture: POSTURE,
      }),
    )

    await waitFor(() => expect(result.current?.verdict).toBe('reprioritize'))
    const sent = (client.getLoopDecision.mock.calls[0] as unknown[])[0] as ReturnType<
      typeof buildLoopInput
    >
    expect(sent.materialIds).toEqual(['mat-a', 'mat-b'])
    expect(sent.materialTitles).toEqual(['Title A', 'Title B'])
  })

  it('dedupes the same input across remounts (session memo)', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetLoopDecision(loopDecision())
    const first = renderHook(() => useLoopDecision(client, argsFor('updated')))
    await waitFor(() => expect(first.result.current?.verdict).toBe('reprioritize'))
    first.unmount()

    const second = renderHook(() => useLoopDecision(client, argsFor('updated')))
    await waitFor(() => expect(second.result.current?.verdict).toBe('reprioritize'))
    expect(client.getLoopDecision).toHaveBeenCalledTimes(1)
  })

  it('refires when the input hash changes', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetLoopDecision(loopDecision())
    const hook = renderHook((props: { n: number }) => useLoopDecision(client, argsFor('updated', props.n)), {
      initialProps: { n: 4 },
    })
    await waitFor(() => expect(hook.result.current?.verdict).toBe('reprioritize'))
    expect(client.getLoopDecision).toHaveBeenCalledTimes(1)

    hook.rerender({ n: 5 })
    await waitFor(() => expect(client.getLoopDecision).toHaveBeenCalledTimes(2))
  })

  it('refires on the stale-to-updated transition without a remount', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetLoopDecision(loopDecision())
    const hook = renderHook((props: { state: FeedbackState }) => useLoopDecision(client, argsFor(props.state)), {
      initialProps: { state: 'stale' as FeedbackState },
    })
    await waitFor(() => expect(hook.result.current).toBeNull())
    expect(client.getLoopDecision).not.toHaveBeenCalled()

    hook.rerender({ state: 'updated' as FeedbackState })
    await waitFor(() => expect(hook.result.current?.verdict).toBe('reprioritize'))
    expect(client.getLoopDecision).toHaveBeenCalledTimes(1)
  })

  it('clears the verdict when leaving updated', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetLoopDecision(loopDecision())
    const hook = renderHook((props: { state: FeedbackState }) => useLoopDecision(client, argsFor(props.state)), {
      initialProps: { state: 'updated' as FeedbackState },
    })
    await waitFor(() => expect(hook.result.current?.verdict).toBe('reprioritize'))

    hook.rerender({ state: 'stale' as FeedbackState })
    await waitFor(() => expect(hook.result.current).toBeNull())
  })

  it('retries after a failure instead of caching it', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetLoopDecision(new Error('offline'))
    const first = renderHook(() => useLoopDecision(client, argsFor('updated')))
    await waitFor(() => expect(client.getLoopDecision).toHaveBeenCalledTimes(1))
    expect(first.result.current).toBeNull()
    first.unmount()

    client.scriptGetLoopDecision(loopDecision())
    const second = renderHook(() => useLoopDecision(client, argsFor('updated')))
    await waitFor(() => expect(second.result.current?.verdict).toBe('reprioritize'))
    expect(client.getLoopDecision).toHaveBeenCalledTimes(2)
  })
})
