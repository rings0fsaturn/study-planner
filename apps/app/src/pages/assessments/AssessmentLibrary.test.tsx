import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Dexie from 'dexie'
import { EventStoreProvider, createEventStore } from '../../events/EventStoreProvider'
import { ASSESSMENT_CREATED, ASSESSMENT_DELETED, EventStore } from '../../events/EventStore'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import {
  FakeAssessmentClient,
  attemptRecord,
  queuedJob,
  readyAssessment,
} from '../../assessments/testing/fakeAssessmentClient'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
import type { MaterialRecord } from '../../materials/types'
import { AssessmentServiceError, type Assessment, type AsyncJob } from '../../assessments/types'
import { MATERIAL_TITLE_PENDING, MATERIAL_UNAVAILABLE } from '../../library/useLibraryRows'
import { AssessmentLibrary } from './AssessmentLibrary'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const USER = 'assessment-library-user'
const USER2 = 'assessment-library-user-2'
const DB_NAME = `StudyTracker_${USER}`
const DB_NAME2 = `StudyTracker_${USER2}`

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

async function readEvents() {
  const store = createEventStore(USER)
  const events = await store.getAll()
  store.close()
  return events
}

async function readCachedEnvelope(assessmentId: string): Promise<unknown> {
  const store = createEventStore(USER)
  const db = (store as unknown as { db: Dexie }).db
  await db.open()
  const row = await db.table('assessmentContentCache').get(assessmentId)
  store.close()
  return row
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

function renderLibraryWithAccountSwitch(
  assessments: FakeAssessmentClient,
  materials: FakeMaterialClient,
) {
  function Switcher() {
    const [userId, setUserId] = useState(USER)
    return (
      <div>
        <button type="button" onClick={() => setUserId(USER2)}>switch-user</button>
        <EventStoreProvider userId={userId}>
          <MaterialsProvider client={materials}>
            <AssessmentProvider client={assessments}>
              <Routes>
                <Route path="/assessments" element={<AssessmentLibrary />} />
              </Routes>
            </AssessmentProvider>
          </MaterialsProvider>
        </EventStoreProvider>
      </div>
    )
  }
  return render(
    <MemoryRouter initialEntries={['/assessments']}>
      <Switcher />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await Dexie.delete(DB_NAME)
  await Dexie.delete(DB_NAME2)
})

afterEach(async () => {
  cleanup()
  const store = createEventStore(USER)
  store.close()
  const store2 = createEventStore(USER2)
  store2.close()
  await Dexie.delete(DB_NAME)
  await Dexie.delete(DB_NAME2)
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

describe('AssessmentLibrary delete flow', () => {
  it('shows the delete control on ready, generating, failed, and unavailable cards', async () => {
    await seed([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-ready', materialIds: ['mat-1'] } },
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-gen', materialIds: ['mat-1'] } },
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-fail', materialIds: ['mat-1'] } },
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-gone', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (assessmentId: string) => {
      if (assessmentId === 'a-gen') {
        return readyAssessment({
          id: 'a-gen',
          materialIds: ['mat-1'],
          status: 'generating',
          recipe: { formats: ['objective'], questionCount: 3 },
          questions: [],
        })
      }
      if (assessmentId === 'a-fail') {
        return readyAssessment({
          id: 'a-fail',
          materialIds: ['mat-1'],
          status: 'failed',
          questions: [],
          warnings: [{ code: 'code_not_derivable', message: 'notes ship the solution' }],
        })
      }
      if (assessmentId === 'a-gone') throw new Error('offline')
      return readyAssessment({ id: assessmentId, materialIds: ['mat-1'] })
    })
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    expect(await screen.findAllByRole('button', { name: 'Delete OS assessment' })).toHaveLength(4)
    expect(document.querySelectorAll('.library-card-deletable .library-card-delete')).toHaveLength(4)
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Generating')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Unavailable offline')).toBeInTheDocument()
  })

  it('hides the corner X at rest and pins the hover/focus reveal contract in the stylesheet', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    const x = await screen.findByRole('button', { name: 'Delete OS assessment' })
    expect(x.closest('.material-card')).toHaveClass('library-card-deletable')

    // jsdom applies static rules but never matches :hover / :focus-within, so
    // the hidden-at-rest state is computed and the reveal is pinned on the
    // stylesheet selectors (PracticeCoach.test.tsx withRealStyles precedent).
    const style = document.createElement('style')
    style.textContent = readFileSync(join(import.meta.dirname, '..', '..', 'library', 'library.css'), 'utf8')
    document.head.appendChild(style)
    try {
      expect(getComputedStyle(x).opacity).toBe('0')
      expect(style.textContent).toMatch(/\.library-card:hover \.library-card-delete/)
      expect(style.textContent).toMatch(/\.library-card:focus-within \.library-card-delete/)
      expect(style.textContent).toMatch(/\.library-card-delete:focus-visible/)
    } finally {
      style.remove()
    }
  })

  it('opens the confirm dialog from the X with the assessment named and focus on Cancel', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'Operating Systems')]))

    const x = await screen.findByRole('button', { name: 'Delete Operating Systems assessment' })
    x.focus()
    fireEvent.click(x)

    const dialog = await screen.findByRole('dialog', { name: 'Confirm delete this assessment?' })
    expect(within(dialog).getByText('Operating Systems')).toBeInTheDocument()
    expect(within(dialog).getByText(/Objective/)).toBeInTheDocument()
    expect(within(dialog).getByText(/1 question/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('cancels without calling the client and restores focus to the X', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    const x = await screen.findByRole('button', { name: 'Delete OS assessment' })
    // No x.focus(): the page hands the X to the dialog as the opener, so
    // restoration works even where a click does not focus the button (Safari).
    fireEvent.click(x)
    await screen.findByRole('dialog', { name: 'Confirm delete this assessment?' })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(x).toHaveFocus())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(assessments.deleteAssessment).not.toHaveBeenCalled()
  })

  it('appends the tombstone, evicts the cached envelope, and drops the row on success', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    await seedCached([readyAssessment({ id: 'a-1', materialIds: ['mat-1'] })])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(queuedJob({ jobId: 'job-del', kind: 'deletion', resultId: 'a-1' }))
    assessments.getJob.mockResolvedValue(
      queuedJob({ jobId: 'job-del', kind: 'deletion', status: 'succeeded', resultId: 'a-1' }),
    )
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))

    await waitFor(() => expect(assessments.deleteAssessment).toHaveBeenCalledWith('a-1'))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'OS' })).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(assessments.getJob).toHaveBeenCalledWith('job-del')

    const events = await readEvents()
    expect(
      events.some(
        (event) =>
          event.kind === ASSESSMENT_DELETED &&
          (event.payload as { assessmentId?: string }).assessmentId === 'a-1',
      ),
    ).toBe(true)
    expect(await readCachedEnvelope('a-1')).toBeUndefined()
  })

  it('keeps the card and renders the typed conflict error inline', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(
      new AssessmentServiceError('conflict', 'A deletion job is already open for this assessment.', false),
    )
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('A deletion job is already open for this assessment.')
    expect(assessments.deleteAssessment).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'OS' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Confirm delete this assessment?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete assessment' })).toBeEnabled()
  })

  it('locks the confirm, cancel, and the card X while the job is in flight', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(queuedJob({ jobId: 'job-slow', kind: 'deletion', resultId: 'a-1' }))
    assessments.getJob.mockImplementation(() => new Promise<AsyncJob>(() => {}))
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    const x = await screen.findByRole('button', { name: 'Delete OS assessment' })
    fireEvent.click(x)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))

    const confirm = await screen.findByRole('button', { name: 'Deleting…' })
    await waitFor(() => expect(confirm).toBeDisabled())
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await waitFor(() => expect(x).toBeDisabled())
    expect(x).toHaveAttribute('aria-busy', 'true')
    const card = x.closest('.material-card') as HTMLElement
    expect(within(card).getByRole('status')).toHaveTextContent('Deleting...')

    fireEvent.click(x)
    fireEvent.click(confirm)
    expect(assessments.deleteAssessment).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog', { name: 'Confirm delete this assessment?' })).toBeInTheDocument()
  })

  it('ignores a second card X while a delete job is in flight', async () => {
    await seed([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-2', materialIds: ['mat-2'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (assessmentId: string) =>
      readyAssessment({ id: assessmentId, materialIds: [assessmentId === 'a-2' ? 'mat-2' : 'mat-1'] }),
    )
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(queuedJob({ jobId: 'job-first', kind: 'deletion', resultId: 'a-1' }))
    assessments.getJob.mockImplementation(() => new Promise<AsyncJob>(() => {}))
    renderLibrary(
      assessments,
      new FakeMaterialClient([material('mat-1', 'OS'), material('mat-2', 'Networks')]),
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))
    await screen.findByRole('button', { name: 'Deleting…' })

    // The second X belongs to a live card, but the in-flight flow owns the dialog.
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Networks assessment' }))
    expect(assessments.deleteAssessment).toHaveBeenCalledTimes(1)
    const dialog = screen.getByRole('dialog', { name: 'Confirm delete this assessment?' })
    expect(within(dialog).getByText('OS')).toBeInTheDocument()
    expect(within(dialog).queryByText('Networks')).toBeNull()
  })

  it('surfaces a failed deletion job, keeps the card, and unlocks the dialog', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(queuedJob({ jobId: 'job-fail', kind: 'deletion', resultId: 'a-1' }))
    assessments.getJob.mockResolvedValue(
      queuedJob({
        jobId: 'job-fail',
        kind: 'deletion',
        status: 'failed',
        resultId: 'a-1',
        error: {
          code: 'provider_error',
          message: 'deletion worker failed',
          requestId: 'req-job-fail',
          retryable: false,
        },
      }),
    )
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('deletion worker failed')
    expect(screen.getByRole('button', { name: 'Delete assessment' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'OS' })).toBeInTheDocument()
  })

  it('stops polling and unlocks the dialog on a non-retryable poll failure', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(queuedJob({ jobId: 'job-lost', kind: 'deletion', resultId: 'a-1' }))
    assessments.getJob.mockRejectedValue(
      new AssessmentServiceError('not_found', 'resource not found', false),
    )
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not confirm the deletion. Reload to check.')
    expect(screen.getByRole('button', { name: 'Delete assessment' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'OS' })).toBeInTheDocument()
  })

  it('retries from an inline error and finalizes on the second confirm', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(new AssessmentServiceError('service', 'temporary failure', true))
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('temporary failure')

    assessments.scriptDelete(queuedJob({ jobId: 'job-r', kind: 'deletion', resultId: 'a-1' }))
    assessments.getJob.mockResolvedValue(
      queuedJob({ jobId: 'job-r', kind: 'deletion', status: 'succeeded', resultId: 'a-1' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete assessment' }))

    await waitFor(() => expect(screen.queryByRole('link', { name: 'OS' })).toBeNull())
    expect(assessments.deleteAssessment).toHaveBeenCalledTimes(2)
  })

  it('keeps polling after a transient failure and settles on the next tick', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(queuedJob({ jobId: 'job-net', kind: 'deletion', resultId: 'a-1' }))
    assessments.getJob
      .mockRejectedValueOnce(new AssessmentServiceError('network', 'assessment request failed', true))
      .mockResolvedValue(
        queuedJob({ jobId: 'job-net', kind: 'deletion', status: 'succeeded', resultId: 'a-1' }),
      )
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))

    await waitFor(() => expect(assessments.getJob).toHaveBeenCalledTimes(1))
    // Transient failure keeps the flow locked with no error surfaced.
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(screen.queryByRole('alert')).toBeNull()

    await waitFor(() => expect(screen.queryByRole('link', { name: 'OS' })).toBeNull(), {
      timeout: 4500,
    })
    expect(assessments.getJob).toHaveBeenCalledTimes(2)
  }, 6000)

  it('never overlaps poll ticks: a slow getJob yields one request and one tombstone', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(queuedJob({ jobId: 'job-overlap', kind: 'deletion', resultId: 'a-1' }))
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    assessments.getJob.mockImplementation(async () => {
      await gate
      return queuedJob({ jobId: 'job-overlap', kind: 'deletion', status: 'succeeded', resultId: 'a-1' })
    })
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))
    await waitFor(() => expect(assessments.getJob).toHaveBeenCalledTimes(1))

    // Let the 3s interval tick pass while the first poll is still in flight.
    await new Promise((resolve) => setTimeout(resolve, 3100))
    expect(assessments.getJob).toHaveBeenCalledTimes(1)

    release()
    await waitFor(() => expect(screen.queryByRole('link', { name: 'OS' })).toBeNull())
    const events = await readEvents()
    expect(events.filter((event) => event.kind === ASSESSMENT_DELETED)).toHaveLength(1)
  }, 8000)

  it('finalizes an already-deleted assessment when the enqueue answers not_found', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(new AssessmentServiceError('not_found', 'resource not found', false))
    renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))

    await waitFor(() => expect(screen.queryByRole('link', { name: 'OS' })).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    const events = await readEvents()
    expect(
      events.some(
        (event) =>
          event.kind === ASSESSMENT_DELETED &&
          (event.payload as { assessmentId?: string }).assessmentId === 'a-1',
      ),
    ).toBe(true)
  })

  it('keeps the dialog with honest copy when the local tombstone cannot be recorded', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    assessments.scriptDelete(queuedJob({ jobId: 'job-record', kind: 'deletion', resultId: 'a-1' }))
    assessments.getJob.mockResolvedValue(
      queuedJob({ jobId: 'job-record', kind: 'deletion', status: 'succeeded', resultId: 'a-1' }),
    )
    const appendSpy = vi
      .spyOn(EventStore.prototype, 'append')
      .mockRejectedValueOnce(new Error('quota exceeded'))
    try {
      renderLibrary(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
      fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        'Deleted on the server, but this device could not record it. Reload to refresh.',
      )
      expect(screen.getByRole('link', { name: 'OS' })).toBeInTheDocument()
    } finally {
      appendSpy.mockRestore()
    }
  })

  it('drops a delete enqueue that resolves after an account switch', async () => {
    await seed([{ kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } }])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockResolvedValue(readyAssessment({ id: 'a-1', materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    let releaseDelete = (_job: AsyncJob) => {}
    assessments.deleteAssessment.mockImplementation(
      () =>
        new Promise<AsyncJob>((resolve) => {
          releaseDelete = resolve
        }),
    )
    renderLibraryWithAccountSwitch(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))

    fireEvent.click(await screen.findByRole('button', { name: 'Delete OS assessment' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assessment' }))
    await waitFor(() => expect(assessments.deleteAssessment).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'switch-user' }))
    await act(async () => {
      releaseDelete(queuedJob({ jobId: 'job-switch', kind: 'deletion', resultId: 'a-1' }))
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(assessments.getJob).not.toHaveBeenCalled()
  })
})
