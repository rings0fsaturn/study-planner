import { describe, expect, it, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  masteryProjection,
} from '../../assessments/testing/fakeAssessmentClient'

const USER = 'roadmap-feedback-section-user'
const DB_NAME = `StudyTracker_${USER}`

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const TITLES = new Map([['mat-1', 'Operating Systems']])

afterEach(async () => {
  cleanup()
  await Dexie.delete(DB_NAME)
})

function renderSection(client: FakeAssessmentClient) {
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
                    materialIds={['mat-1']}
                    materialTitlesById={TITLES}
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
})
