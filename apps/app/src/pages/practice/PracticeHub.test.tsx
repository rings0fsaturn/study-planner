import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Dexie from 'dexie'
import { EventStoreProvider, createEventStore } from '../../events/EventStoreProvider'
import { PRACTICE_RUN_FINISHED, PRACTICE_RUN_STARTED } from '../../events/EventStore'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import { FakeAssessmentClient, readyAssessment, attemptRecord } from '../../assessments/testing/fakeAssessmentClient'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
import type { MaterialRecord } from '../../materials/types'
import { PracticeHub } from './PracticeHub'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const USER = 'practice-hub-user'
const DB_NAME = `StudyTracker_${USER}`

function material(id: string, title: string): MaterialRecord {
  return {
    id,
    ownerId: USER,
    title,
    kind: 'file',
    source: `${id}.pdf`,
    ingestionState: 'ready',
    ingestionProgress: 1,
    ingestionError: null,
    archived: false,
    contentVersion: 'v1',
    replacedAt: null,
    estimatedMinutes: 60,
    uploadCompleteAt: null,
    chunkCount: 0,
    groundingVersion: null,
    extractedTextPath: null,
    createdAt: '2026-09-20T09:00:00Z',
    updatedAt: '2026-09-20T09:00:00Z',
  }
}

interface SeedEvent {
  kind: string
  payload: Record<string, unknown>
  createdAt?: string
}

async function seed(events: SeedEvent[]) {
  const store = createEventStore(USER)
  for (const { kind, payload, createdAt } of events) {
    await store.append(kind, payload, createdAt)
  }
  store.close()
}

function startedPayload(runId: string, materialId: string, assessmentIds: string[], extra: Record<string, unknown> = {}) {
  return {
    runId,
    materialIds: [materialId],
    mode: 'written',
    assessmentIds,
    count: assessmentIds.length,
    families: assessmentIds.map(() => 'written'),
    ...extra,
  }
}

function renderHub(
  assessments: FakeAssessmentClient,
  materials: FakeMaterialClient,
  initialEntry = '/practice',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <EventStoreProvider userId={USER}>
        <MaterialsProvider client={materials}>
          <AssessmentProvider client={assessments}>
            <Routes>
              <Route path="/practice" element={<PracticeHub />} />
              <Route path="/materials/:materialId/practice/:runId" element={<div data-testid="run-detail" />} />
              <Route path="/materials/:materialId/practice" element={<div data-testid="new-run" />} />
              <Route path="/materials" element={<div data-testid="library-page" />} />
            </Routes>
          </AssessmentProvider>
        </MaterialsProvider>
      </EventStoreProvider>
    </MemoryRouter>,
  )
}

function scriptReady(assessments: FakeAssessmentClient) {
  assessments.getAssessment.mockImplementation(async (id) => readyAssessment({ id, materialIds: ['mat-1'] }))
  assessments.listAssessmentAttempts.mockResolvedValue([])
}

beforeEach(async () => {
  await Dexie.delete(DB_NAME)
})

afterEach(async () => {
  cleanup()
  const store = createEventStore(USER)
  store.close()
  await Dexie.delete(DB_NAME)
})

describe('PracticeHub', () => {
  it('renders the page head and sub-nav', async () => {
    await seed([])
    renderHub(new FakeAssessmentClient(), new FakeMaterialClient([]))
    expect(await screen.findByRole('heading', { name: /Practice/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /Library sections/i })).toBeInTheDocument()
  })

  it('lists Resume newest first with only the topmost Resume as accent', async () => {
    await seed([
      {
        kind: PRACTICE_RUN_STARTED,
        payload: startedPayload('run-old', 'mat-1', ['a-1']),
        createdAt: '2026-09-20T10:00:00Z',
      },
      {
        kind: PRACTICE_RUN_STARTED,
        payload: startedPayload('run-new', 'mat-2', ['a-2']),
        createdAt: '2026-09-21T10:00:00Z',
      },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) =>
      readyAssessment({ id, materialIds: [id === 'a-2' ? 'mat-2' : 'mat-1'] }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderHub(
      assessments,
      new FakeMaterialClient([material('mat-1', 'Operating Systems'), material('mat-2', 'Databases')]),
    )
    const resume = await screen.findByRole('region', { name: /Resume/i })
    const titles = within(resume)
      .getAllByRole('link', { name: /Operating Systems|Databases/ })
      .map((link) => link.textContent)
    expect(titles[0]).toMatch(/Databases/)
    expect(titles[1]).toMatch(/Operating Systems/)
    const resumes = within(resume).getAllByRole('link', { name: /Resume/i })
    expect(resumes).toHaveLength(2)
    expect(resumes[0].className).toMatch(/btn-accent/)
    expect(resumes[1].className).toMatch(/btn-secondary/)
  })

  it('lists History newest first across completed, abandoned, and failed', async () => {
    await seed([
      {
        kind: PRACTICE_RUN_STARTED,
        payload: startedPayload('run-done', 'mat-1', ['a-1']),
        createdAt: '2026-09-20T10:00:00Z',
      },
      { kind: PRACTICE_RUN_FINISHED, payload: { runId: 'run-done', outcome: 'completed' } },
      {
        kind: PRACTICE_RUN_STARTED,
        payload: startedPayload('run-left', 'mat-2', ['a-2']),
        createdAt: '2026-09-21T10:00:00Z',
      },
      { kind: PRACTICE_RUN_FINISHED, payload: { runId: 'run-left', outcome: 'abandoned' } },
      {
        kind: PRACTICE_RUN_STARTED,
        payload: startedPayload('run-bad', 'mat-3', ['a-3']),
        createdAt: '2026-09-22T10:00:00Z',
      },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) => {
      if (id === 'a-3') {
        return readyAssessment({
          id,
          materialIds: ['mat-3'],
          status: 'failed',
          questions: [],
          warnings: [{ code: 'code_not_derivable', message: 'notes ship the solution' }],
        })
      }
      return readyAssessment({ id, materialIds: [id === 'a-2' ? 'mat-2' : 'mat-1'] })
    })
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderHub(
      assessments,
      new FakeMaterialClient([
        material('mat-1', 'Operating Systems'),
        material('mat-2', 'Databases'),
        material('mat-3', 'Networks'),
      ]),
    )
    const history = await screen.findByRole('region', { name: /History/i })
    const titles = within(history)
      .getAllByRole('link', { name: /Operating Systems|Databases|Networks/ })
      .map((link) => link.textContent)
    expect(titles[0]).toMatch(/Networks/)
    expect(titles[1]).toMatch(/Databases/)
    expect(titles[2]).toMatch(/Operating Systems/)
  })

  it('opens the shipped run route from a completed run Open summary', async () => {
    await seed([
      { kind: PRACTICE_RUN_STARTED, payload: startedPayload('run-1', 'mat-1', ['a-1']) },
      { kind: PRACTICE_RUN_FINISHED, payload: { runId: 'run-1', outcome: 'completed' } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([
      attemptRecord({
        assessmentId: 'a-1',
        questionId: 'q1',
        status: 'graded',
        grade: {
          attemptId: 'att-1',
          questionId: 'q1',
          materialId: 'mat-1',
          score: 1,
          correct: true,
          grader: 'objective',
          gradedAt: '2026-09-20T11:00:00Z',
        },
      }),
    ])
    renderHub(assessments, new FakeMaterialClient([material('mat-1', 'Operating Systems')]))
    const open = await screen.findByRole('link', { name: /Open summary/i })
    expect(open.getAttribute('href')).toBe('/materials/mat-1/practice/run-1')
    expect(screen.getByText('1 of 1 graded')).toBeInTheDocument()
    fireEvent.click(open)
    expect(await screen.findByTestId('run-detail')).toBeInTheDocument()
  })

  it('shows abandoned runs as history with no action button', async () => {
    await seed([
      { kind: PRACTICE_RUN_STARTED, payload: startedPayload('run-1', 'mat-1', ['a-1']) },
      { kind: PRACTICE_RUN_FINISHED, payload: { runId: 'run-1', outcome: 'abandoned' } },
    ])
    const assessments = new FakeAssessmentClient()
    scriptReady(assessments)
    renderHub(assessments, new FakeMaterialClient([material('mat-1', 'Operating Systems')]))
    expect(await screen.findByText('Abandoned')).toBeInTheDocument()
    expect(screen.getByText(/kept as history/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Resume/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Open summary/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Start a new run/i })).toBeNull()
  })

  it('shows a terminally failed problem reason verbatim with a fresh-run link', async () => {
    await seed([{ kind: PRACTICE_RUN_STARTED, payload: startedPayload('run-1', 'mat-1', ['a-1']) }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(
      readyAssessment({
        id: 'a-1',
        materialIds: ['mat-1'],
        status: 'failed',
        questions: [],
        warnings: [{ code: 'code_not_derivable', message: 'notes ship the solution' }],
      }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderHub(assessments, new FakeMaterialClient([material('mat-1', 'Operating Systems')]))
    expect(await screen.findByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('code_not_derivable: notes ship the solution')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start a new run/i }).getAttribute('href')).toBe(
      '/materials/mat-1/practice',
    )
  })

  it('shows generating runs as N of M ready with dots and no invented grade', async () => {
    await seed([
      {
        kind: PRACTICE_RUN_STARTED,
        payload: { ...startedPayload('run-1', 'mat-1', ['a-1', 'a-2']), count: 2 },
      },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) => {
      if (id === 'a-1') {
        return readyAssessment({
          id,
          materialIds: ['mat-1'],
          status: 'generating',
          recipe: { formats: ['written'], questionCount: 1 },
          questions: [],
        })
      }
      throw new Error('offline')
    })
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderHub(assessments, new FakeMaterialClient([material('mat-1', 'Operating Systems')]))
    expect(await screen.findByText('Generating')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 ready')).toBeInTheDocument()
    expect(screen.queryByText(/graded/)).toBeNull()
  })

  it('names the missing count on partial runs', async () => {
    await seed([
      {
        kind: PRACTICE_RUN_STARTED,
        payload: { ...startedPayload('run-1', 'mat-1', ['a-1']), count: 3 },
      },
    ])
    const assessments = new FakeAssessmentClient()
    scriptReady(assessments)
    renderHub(assessments, new FakeMaterialClient([material('mat-1', 'Operating Systems')]))
    expect(await screen.findByText(/2 of 3 never generated/i)).toBeInTheDocument()
  })

  it('renders legacy pointers without families through the mode fallback', async () => {
    const payload = startedPayload('run-1', 'mat-1', ['a-1'])
    delete (payload as Partial<typeof payload>).families
    await seed([{ kind: PRACTICE_RUN_STARTED, payload }])
    const assessments = new FakeAssessmentClient()
    scriptReady(assessments)
    renderHub(assessments, new FakeMaterialClient([material('mat-1', 'Operating Systems')]))
    expect(await screen.findByText(/Written/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Resume/i }).getAttribute('href')).toBe(
      '/materials/mat-1/practice/run-1',
    )
  })

  it('shows the empty state with an accent CTA to the library', async () => {
    await seed([])
    renderHub(new FakeAssessmentClient(), new FakeMaterialClient([]))
    const cta = await screen.findByRole('link', { name: /Browse materials/i })
    expect(cta.getAttribute('href')).toBe('/materials')
    expect(cta.className).toMatch(/btn-accent/)
  })
})
