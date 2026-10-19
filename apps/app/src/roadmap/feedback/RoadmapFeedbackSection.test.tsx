import { describe, expect, it, afterEach, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Dexie from 'dexie'
import { RoadmapFeedbackSection } from './RoadmapFeedbackSection'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { EventStore } from '../../events/EventStore'
import {
  EventStoreProvider,
  createEventStore,
  useEventStoreContext,
} from '../../events/EventStoreProvider'
import { saveMasteryProjections } from '../../assessments/masteryCache'
import {
  FakeAssessmentClient,
  feedbackCopy,
  loopDecision,
  masteryProjection,
} from '../../assessments/testing/fakeAssessmentClient'
import type { MasteryProjection } from '../../assessments/types'
import { __clearLoopDecisionMemo } from './useLoopDecision'

const USER = 'roadmap-feedback-section-user'
const DB_NAME = `StudyTracker_${USER}`

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const TITLES = new Map([['mat-1', 'Operating Systems']])
const TWO_TITLES = new Map([
  ['mat-1', 'Operating Systems'],
  ['mat-2', 'Calculus'],
])

afterEach(async () => {
  cleanup()
  __clearLoopDecisionMemo()
  await Dexie.delete(DB_NAME)
})

function renderSection(
  client: FakeAssessmentClient,
  materialIds: string[] = ['mat-1'],
  titles: Map<string, string> = TITLES,
) {
  // In the app the roadmap page mounts after auth resolves, by which point the
  // event store is ready; gate the test the same way.
  function ReadyGate({ children }: { children: React.ReactNode }) {
    const { ready } = useEventStoreContext()
    return ready ? <>{children}</> : null
  }
  return render(
    <MemoryRouter initialEntries={['/roadmap']}>
      <EventStoreProvider userId={USER}>
        <AssessmentProvider client={client}>
          <ReadyGate>
            <Routes>
              <Route
                path="/roadmap"
                element={
                  <RoadmapFeedbackSection
                    materialIds={materialIds}
                    materialTitlesById={titles}
                    pinnedTitle="Systems design sprint"
                    pinnedDetail="Tue, Thu, Sat · 4 sessions booked"
                  />
                }
              />
              <Route path="/replan" element={<div data-testid="replan-page" />} />
            </Routes>
          </ReadyGate>
        </AssessmentProvider>
      </EventStoreProvider>
    </MemoryRouter>,
  )
}

async function seedCache(projection: ReturnType<typeof masteryProjection>) {
  const store = createEventStore(USER)
  await saveMasteryProjections(store, [projection])
  store.close()
}

async function seedGradedAttempts(
  rows: Array<{ clientAttemptId: string; materialId: string; gradedAt: string }>,
) {
  const store = createEventStore(USER)
  for (const row of rows) {
    await store.table('assessmentAttempts').put({
      clientAttemptId: row.clientAttemptId,
      attemptId: `att-${row.clientAttemptId}`,
      questionId: 'q1',
      assessmentId: 'assessment-1',
      status: 'graded',
      submittedAt: row.gradedAt,
      grade: {
        attemptId: `att-${row.clientAttemptId}`,
        questionId: 'q1',
        materialId: row.materialId,
        score: 1,
        correct: true,
        grader: 'objective',
        gradedAt: row.gradedAt,
      },
    })
  }
  store.close()
}

describe('RoadmapFeedbackSection', () => {
  it('shows the cold-start state and no model context', async () => {
    const client = new FakeAssessmentClient()
    renderSection(client)

    expect(await screen.findByTestId('roadmap-feedback')).toBeInTheDocument()
    expect(screen.getByText('Still learning about you')).toBeInTheDocument()
    expect(screen.getByText(/just getting started/)).toBeInTheDocument()
    expect(screen.queryByTestId('rfb-model-context')).not.toBeInTheDocument()
    expect(screen.getByText(/No graded work yet/)).toBeInTheDocument()
  })

  it('shows updated mastery with an inspectable evidence trail and a collapsed model context', async () => {
    await seedCache(masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 }))
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 })])
    renderSection(client)

    expect(await screen.findByText('Feedback refreshed')).toBeInTheDocument()
    const evidence = screen.getByRole('link', { name: /Exam structure/ })
    expect(evidence).toHaveAttribute('href', '/materials/mat-1')
    expect(screen.getByTestId('rfb-model-context')).not.toHaveAttribute('open')
  })

  it('renders the LLM copy when the provider resolves it (#68 AC1)', async () => {
    await seedCache(masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 }))
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 })])
    client.scriptGetFeedbackCopy(feedbackCopy({ summary: 'LLM test summary.' }))
    renderSection(client)

    expect(await screen.findByText('LLM test summary.')).toBeInTheDocument()
    expect(client.getFeedbackCopy).toHaveBeenCalledTimes(1)
  })

  it('passes the loop verdict into the copy request once it lands', async () => {
    await seedCache(masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 }))
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 })])
    client.scriptGetLoopDecision(
      loopDecision({ verdict: 'reprioritize', choice: 'reprioritize', confidence: 0.97 }),
    )
    client.scriptGetFeedbackCopy(feedbackCopy({ summary: 'LLM test summary.' }))
    renderSection(client)

    expect(await screen.findByText('LLM test summary.')).toBeInTheDocument()
    // First call fires before the verdict lands (null keeps the v1 words);
    // the late verdict refires the one batched copy call carrying it.
    await waitFor(() => expect(client.getFeedbackCopy).toHaveBeenCalledTimes(2))
    const calls = client.getFeedbackCopy.mock.calls as unknown[][]
    expect((calls[0][0] as { loopDecision: unknown }).loopDecision).toBeNull()
    expect((calls[1][0] as { loopDecision: unknown }).loopDecision).toEqual({
      verdict: 'reprioritize',
      confidence: 0.97,
    })
  })

  it('sends the real days_span from the local graded attempts', async () => {
    await seedCache(masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 }))
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 })])
    client.scriptGetLoopDecision(loopDecision())
    await seedGradedAttempts([
      { clientAttemptId: 'ca-1', materialId: 'mat-1', gradedAt: '2026-09-19T10:00:00Z' },
      { clientAttemptId: 'ca-2', materialId: 'mat-1', gradedAt: '2026-10-10T10:00:00Z' },
      // Out-of-scope material: other roadmaps' grades must not widen the span.
      { clientAttemptId: 'ca-3', materialId: 'mat-9', gradedAt: '2026-01-01T10:00:00Z' },
    ])
    renderSection(client)

    // The hook holds the call until the grade rows load, so the first POST
    // already carries the real span (no span-0 then refire).
    await waitFor(() => expect(client.getLoopDecision).toHaveBeenCalledTimes(1))
    const sent = (client.getLoopDecision.mock.calls[0] as unknown[])[0] as {
      evidence_summary: { days_span: number }
    }
    expect(sent.evidence_summary.days_span).toBe(21)
  })

  it('ignores a slow pre-verdict copy that resolves after the shaped one', async () => {
    await seedCache(masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 }))
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 })])
    client.scriptGetLoopDecision(loopDecision({ verdict: 'hold', choice: 'hold' }))
    const pending: Array<(copy: ReturnType<typeof feedbackCopy>) => void> = []
    client.getFeedbackCopy.mockImplementation(
      () =>
        new Promise<ReturnType<typeof feedbackCopy>>((resolve) => {
          pending.push(resolve)
        }),
    )
    renderSection(client)

    await waitFor(() => expect(client.getFeedbackCopy).toHaveBeenCalledTimes(2))
    await act(async () => {
      pending[1](feedbackCopy({ summary: 'Shaped hold words.' }))
    })
    expect(await screen.findByText('Shaped hold words.')).toBeInTheDocument()
    await act(async () => {
      pending[0](feedbackCopy({ summary: 'First pre-verdict words.' }))
    })
    expect(screen.getByText('Shaped hold words.')).toBeInTheDocument()
    expect(screen.queryByText('First pre-verdict words.')).not.toBeInTheDocument()
  })

  it('holds the render until the mastery fetch settles (no cold flash)', async () => {
    const client = new FakeAssessmentClient()
    let resolveFetch: (rows: MasteryProjection[]) => void = () => {}
    client.getMastery.mockImplementation(
      () =>
        new Promise<MasteryProjection[]>((resolve) => {
          resolveFetch = resolve
        }),
    )
    renderSection(client)

    await waitFor(() => expect(client.getMastery).toHaveBeenCalled())
    expect(screen.queryByTestId('roadmap-feedback')).not.toBeInTheDocument()
    await act(async () => {
      resolveFetch([])
    })
    expect(await screen.findByTestId('roadmap-feedback')).toBeInTheDocument()
  })

  it('marks a stale projection and rebuilds it from grades', async () => {
    await seedCache(masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.5 }))
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 5, mastery: 0.6 })])
    renderSection(client)

    expect(await screen.findByText('Feedback needs a refresh')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Rebuild from grades' }))
    await waitFor(() => expect(screen.getByText('Feedback refreshed')).toBeInTheDocument())
  })

  it('Keep roadmap acknowledges without navigating or writing an event', async () => {
    await seedCache(masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 }))
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 })])
    const appendSpy = vi.spyOn(EventStore.prototype, 'append')
    renderSection(client)

    await screen.findByText('Feedback refreshed')
    fireEvent.click(screen.getByRole('button', { name: 'Review before applying' }))
    fireEvent.click(screen.getByRole('radio', { name: /Keep roadmap/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep and continue' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByTestId('replan-page')).not.toBeInTheDocument()
    expect(appendSpy).not.toHaveBeenCalled()
    appendSpy.mockRestore()
  })

  it('Open replan navigates to the existing replan flow', async () => {
    await seedCache(masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 }))
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 })])
    renderSection(client)

    await screen.findByText('Feedback refreshed')
    fireEvent.click(screen.getByRole('button', { name: 'Review before applying' }))
    fireEvent.click(screen.getByRole('radio', { name: /Open replan/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Review replan' }))

    expect(await screen.findByTestId('replan-page')).toBeInTheDocument()
  })

  it('preselects Open replan when the loop verdict suggests it', async () => {
    await seedCache(masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 }))
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 })])
    client.scriptGetLoopDecision(loopDecision({ verdict: 'suggest_replan', choice: 'suggest_replan' }))
    renderSection(client)

    await screen.findByText('Feedback refreshed')
    fireEvent.click(screen.getByRole('button', { name: 'Review before applying' }))
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Open replan/ })).toHaveAttribute(
        'aria-checked',
        'true',
      )
    })
    expect(screen.getByRole('button', { name: 'Review replan' })).toBeInTheDocument()
  })

  it('picks up a late verdict while the dialog is already open', async () => {
    await seedCache(masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 }))
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 })])
    let resolveLoop: (decision: ReturnType<typeof loopDecision>) => void = () => {}
    client.getLoopDecision.mockImplementation(
      () =>
        new Promise<ReturnType<typeof loopDecision>>((resolve) => {
          resolveLoop = resolve
        }),
    )
    renderSection(client)

    await screen.findByText('Feedback refreshed')
    fireEvent.click(screen.getByRole('button', { name: 'Review before applying' }))
    expect(screen.getByRole('radio', { name: /Keep roadmap/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    await act(async () => {
      resolveLoop(loopDecision({ verdict: 'suggest_replan', choice: 'suggest_replan' }))
    })
    expect(screen.getByRole('radio', { name: /Open replan/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('lists the weakest skill first when the loop verdict reprioritizes', async () => {
    // Two materials: the cache primary key is materialId, so same-material
    // multi-skill seeds would collide and only the last row would survive.
    const weak = masteryProjection({
      materialId: 'mat-1',
      skillTag: 'Weak spot',
      n: 4,
      mastery: 0.2,
    })
    const strong = masteryProjection({
      materialId: 'mat-2',
      skillTag: 'Strong suit',
      n: 9,
      mastery: 0.95,
    })
    const store = createEventStore(USER)
    await saveMasteryProjections(store, [weak, strong])
    store.close()
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([weak, strong])
    client.scriptGetLoopDecision(loopDecision({ verdict: 'reprioritize' }))
    renderSection(client, ['mat-1', 'mat-2'], TWO_TITLES)

    await screen.findByText('Feedback refreshed')
    await waitFor(() => {
      const rows = screen.getAllByRole('link', { name: /spot|suit/ })
      expect(rows.map((row) => row.textContent ?? '')).toEqual([
        expect.stringContaining('Weak spot'),
        expect.stringContaining('Strong suit'),
      ])
    })
  })

  it('keeps most-practised order when the loop verdict holds', async () => {
    const weak = masteryProjection({
      materialId: 'mat-1',
      skillTag: 'Weak spot',
      n: 4,
      mastery: 0.2,
    })
    const strong = masteryProjection({
      materialId: 'mat-2',
      skillTag: 'Strong suit',
      n: 9,
      mastery: 0.95,
    })
    const store = createEventStore(USER)
    await saveMasteryProjections(store, [weak, strong])
    store.close()
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([weak, strong])
    client.scriptGetLoopDecision(loopDecision({ verdict: 'hold', choice: 'hold' }))
    renderSection(client, ['mat-1', 'mat-2'], TWO_TITLES)

    await screen.findByText('Feedback refreshed')
    const rows = screen.getAllByRole('link', { name: /spot|suit/ })
    expect(rows.map((row) => row.textContent ?? '')).toEqual([
      expect.stringContaining('Strong suit'),
      expect.stringContaining('Weak spot'),
    ])
  })
})
