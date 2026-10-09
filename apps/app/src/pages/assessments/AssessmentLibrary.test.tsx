import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Dexie from 'dexie'
import { EventStoreProvider, createEventStore } from '../../events/EventStoreProvider'
import { ASSESSMENT_CREATED } from '../../events/EventStore'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import { FakeAssessmentClient, readyAssessment, attemptRecord } from '../../assessments/testing/fakeAssessmentClient'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
import type { MaterialRecord } from '../../materials/types'
import type { Assessment } from '../../assessments/types'
import { MATERIAL_TITLE_PENDING, MATERIAL_UNAVAILABLE } from '../../library/useLibraryRows'
import { AssessmentLibrary } from './AssessmentLibrary'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const USER = 'assessment-library-user'
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

async function seed(events: Array<{ kind: string; payload: Record<string, unknown> }>) {
  const store = createEventStore(USER)
  for (const { kind, payload } of events) {
    await store.append(kind, payload)
  }
  store.close()
}

async function seedCached(envelopes: Assessment[]) {
  const store = createEventStore(USER)
  const db = (store as unknown as { db: Dexie }).db
  await db.open()
  for (const envelope of envelopes) {
    await db
      .table('assessmentContentCache')
      .put({ assessmentId: envelope.id, envelope, cachedAt: new Date().toISOString() })
  }
  store.close()
}

function renderLibrary(
  assessments: FakeAssessmentClient,
  materials: FakeMaterialClient,
  initialEntry = '/assessments',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <EventStoreProvider userId={USER}>
        <MaterialsProvider client={materials}>
          <AssessmentProvider client={assessments}>
            <Routes>
              <Route path="/assessments" element={<AssessmentLibrary />} />
              <Route path="/assessments/:assessmentId" element={<div data-testid="assessment-detail" />} />
              <Route path="/materials/:materialId/assessments/new" element={<div data-testid="new-run" />} />
              <Route path="/materials" element={<div data-testid="library-page" />} />
            </Routes>
          </AssessmentProvider>
        </MaterialsProvider>
      </EventStoreProvider>
    </MemoryRouter>,
  )
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

describe('AssessmentLibrary', () => {
  it('renders the page head and sub-nav', async () => {
    await seed([])
    renderLibrary(new FakeAssessmentClient(), new FakeMaterialClient([]))
    expect(await screen.findByRole('heading', { name: /Assessments/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /Library sections/i })).toBeInTheDocument()
  })

  it('renders ready cards with title, meta, tag, and score', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
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
          score: 0.8,
          correct: true,
          grader: 'objective',
          gradedAt: '2026-09-20T11:00:00Z',
        },
      }),
    ])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'Operating Systems')]))
    expect(await screen.findByRole('link', { name: /Operating Systems/i })).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('0.80')).toBeInTheDocument()
  })

  it('paints cached rows with a refreshing indicator until revalidation lands', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    await seedCached([readyAssessment({ id: 'a-1', materialIds: ['mat-1'] })])
    const assessments = new FakeAssessmentClient()
    let release: ((assessment: Assessment) => void) | null = null
    assessments.getAssessment.mockImplementation(
      () => new Promise<Assessment>((resolve) => { release = resolve }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    expect(await screen.findByRole('link', { name: /OS/i })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Refreshing')
    await act(async () => {
      release?.(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    })
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('keeps the skeleton without a refreshing indicator when nothing is cached', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(() => new Promise<never>(() => {}))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    expect(await screen.findByText('Loading assessments…')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows a neutral title placeholder while titles are still loading', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    await seedCached([readyAssessment({ id: 'a-1', materialIds: ['mat-1'] })])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(() => new Promise<never>(() => {}))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const materials = new FakeMaterialClient([material('mat-1', 'OS')])
    let releaseTitles: (() => void) | null = null
    vi.spyOn(materials, 'listMaterials').mockReturnValue(
      new Promise<MaterialRecord[]>((resolve) => {
        releaseTitles = () => resolve([material('mat-1', 'OS')])
      }),
    )
    renderLibrary(assessments, materials)
    expect(await screen.findByRole('link', { name: MATERIAL_TITLE_PENDING })).toBeInTheDocument()
    expect(screen.queryByText(MATERIAL_UNAVAILABLE)).toBeNull()
    await act(async () => {
      releaseTitles?.()
    })
    expect(await screen.findByRole('link', { name: /OS/i })).toBeInTheDocument()
  })

  it('shows generating rows with dots, N of M ready, and a working retry', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-g', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(
      readyAssessment({
        id: 'a-g',
        materialIds: ['mat-1'],
        status: 'generating',
        recipe: { formats: ['objective'], questionCount: 3 },
        questions: [
          {
            id: 'q1',
            assessmentId: 'a-g',
            materialId: 'mat-1',
            format: 'objective',
            prompt: 'P',
            options: ['A'],
            skillTags: [],
            authoredDifficulty: 1,
            citations: [],
          },
        ],
      }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.regenerateAssessment.mockResolvedValue({
      jobId: 'job-1',
      kind: 'generation',
      status: 'queued',
      ownerId: USER,
      correlationId: 'c',
      attempt: 1,
      resultId: 'a-g',
      createdAt: '2026-09-20T10:00:00Z',
    })
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    expect(await screen.findByText('Generating')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 ready')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Retry generation/i }))
    await waitFor(() => expect(assessments.regenerateAssessment).toHaveBeenCalledWith('a-g'))
  })

  it('shows failed rows with the server reason verbatim and a fresh-run link', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-f', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(
      readyAssessment({
        id: 'a-f',
        materialIds: ['mat-1'],
        status: 'failed',
        questions: [],
        warnings: [{ code: 'code_not_derivable', message: 'notes ship the solution' }],
      }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    expect(await screen.findByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('code_not_derivable: notes ship the solution')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Start a new run/i }).getAttribute('href')).toBe(
      '/materials/mat-1/assessments/new',
    )
  })

  it('marks unreadable uncached rows unavailable with no action but a focusable card', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-x', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockRejectedValue(new Error('offline'))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    expect(await screen.findByText('Unavailable offline')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry generation/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Start a new run/i })).toBeNull()
    // The card stays keyboard-operable through its title link.
    expect(screen.getByRole('link', { name: /OS/i }).getAttribute('href')).toBe('/assessments/a-x')
  })

  it('shows the first-run empty state with an accent CTA to the library', async () => {
    await seed([])
    renderLibrary(new FakeAssessmentClient(), new FakeMaterialClient([]))
    const cta = await screen.findByRole('link', { name: /Browse materials/i })
    expect(cta.getAttribute('href')).toBe('/materials')
    expect(cta.className).toMatch(/btn-accent/)
  })

  it('shows an error banner with a working retry when hydration fails', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockRejectedValue(new Error('offline'))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }))
    await waitFor(() => expect(screen.getByText('Ready')).toBeInTheDocument())
  })

  it('opens the shipped detail route from the card title link', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    const title = await screen.findByRole('link', { name: /OS/i })
    expect(title.getAttribute('href')).toBe('/assessments/a-1')
    fireEvent.click(title)
    expect(await screen.findByTestId('assessment-detail')).toBeInTheDocument()
  })
})
