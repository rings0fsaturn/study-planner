import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PracticeThis } from './PracticeThis'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
import {
  FakeAssessmentClient,
  masteryProjection,
  queuedJob,
} from '../../assessments/testing/fakeAssessmentClient'
import { AssessmentServiceError } from '../../assessments/types'
import type { MaterialRecord } from '../../materials/types'

const mockAppend = vi.fn().mockResolvedValue(1)
const mockTablePut = vi.fn().mockResolvedValue(undefined)
const mockNavigate = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

vi.mock('../../events/useEventStore', () => ({
  useEventStore: () => ({ append: mockAppend, table: () => ({ put: mockTablePut }) }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function material(overrides: Partial<MaterialRecord>): MaterialRecord {
  return {
    id: 'mat-1',
    ownerId: 'user-a',
    title: 'Operating Systems — Three Easy Pieces',
    kind: 'file',
    source: 'ostep.pdf',
    ingestionState: 'ready',
    ingestionProgress: 1,
    ingestionError: null,
    archived: false,
    contentVersion: 'v1',
    replacedAt: null,
    estimatedMinutes: 420,
    uploadCompleteAt: null,
    chunkCount: 0,
    groundingVersion: null,
    extractedTextPath: null,
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
    ...overrides,
  }
}

function renderPractice(client: FakeMaterialClient, assessments = new FakeAssessmentClient()) {
  return render(
    <MemoryRouter initialEntries={['/materials/mat-1/practice']}>
      <MaterialsProvider client={client}>
        <AssessmentProvider client={assessments}>
          <Routes>
            <Route path="/materials/:materialId/practice" element={<PracticeThis />} />
            <Route path="/materials/:materialId" element={<div data-testid="detail-page" />} />
          </Routes>
        </AssessmentProvider>
      </MaterialsProvider>
    </MemoryRouter>,
  )
}

/** Script one generation per problem, each answering with its own assessment id. */
function scriptGenerations(
  assessments: FakeAssessmentClient,
  ids: string[],
  failAt: Record<number, Error> = {},
) {
  let call = 0
  assessments.generateAssessment.mockImplementation(async () => {
    const index = call++
    if (failAt[index]) throw failAt[index]
    return queuedJob({ resultId: ids[index] })
  })
}

async function startRun(count: number) {
  fireEvent.change(await screen.findByLabelText('Number of questions'), {
    target: { value: String(count) },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Start practice run' }))
}

/** Open the material picker and add one extra ready material by title. */
async function addMaterial(title: string) {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Add another material' }),
  )
  const dialog = await screen.findByRole('dialog', { name: /Choose materials for assessment/i })
  fireEvent.click(within(dialog).getByRole('checkbox', { name: new RegExp(title) }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
}

describe('PracticeThis', () => {
  afterEach(() => {
    mockAppend.mockClear()
    mockNavigate.mockClear()
    mockTablePut.mockClear()
  })

  it('renders the configuration page for a ready material', async () => {
    const client = new FakeMaterialClient([material({})])

    renderPractice(client)

    expect((await screen.findAllByText('Operating Systems — Three Easy Pieces')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Number of questions')).toHaveValue(5)
    expect(screen.getByRole('button', { name: 'Start practice run' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add another material' })).toBeInTheDocument()
  })

  it('offers all three focus families and bands 1-5, with adaptive enabled', async () => {
    const client = new FakeMaterialClient([material({})])

    renderPractice(client)

    await screen.findByText('Focus')
    expect(screen.getByRole('button', { name: 'Written' })).toHaveClass('selected')
    expect(screen.getByRole('button', { name: 'Coding' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Mixed' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Adaptive' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '3' })).toHaveClass('selected')
    expect(screen.getByRole('button', { name: '5' })).toBeEnabled()
  })

  it('distributes a run’s problems round-robin across the chosen materials', async () => {
    const client = new FakeMaterialClient([
      material({}),
      material({ id: 'mat-2', title: 'Database Internals', source: 'db.pdf' }),
    ])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2', 'a-3', 'a-4'])

    renderPractice(client, assessments)
    await addMaterial('Database Internals')
    await startRun(4)

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(4)
    })
    const requests = assessments.generateAssessment.mock.calls.map(([request]) => request)
    // N problems, N calls — never N x M — alternating primary-first.
    expect(requests.map((request) => request.materialIds)).toEqual([
      ['mat-1'],
      ['mat-2'],
      ['mat-1'],
      ['mat-2'],
    ])
  })

  it('carries the full ordered material list on the run pointer, primary first', async () => {
    const client = new FakeMaterialClient([
      material({}),
      material({ id: 'mat-2', title: 'Database Internals', source: 'db.pdf' }),
    ])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2'])

    renderPractice(client, assessments)
    await addMaterial('Database Internals')
    await startRun(2)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })
    expect(mockAppend).toHaveBeenCalledWith(
      'PracticeRunStarted',
      expect.objectContaining({ materialIds: ['mat-1', 'mat-2'] }),
    )
  })

  it('uses only the first N materials when there are more materials than problems', async () => {
    const client = new FakeMaterialClient([
      material({}),
      material({ id: 'mat-2', title: 'Database Internals', source: 'db.pdf' }),
      material({ id: 'mat-3', title: 'Compiler Design', source: 'cc.pdf' }),
    ])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2'])

    renderPractice(client, assessments)
    await addMaterial('Database Internals')
    await addMaterial('Compiler Design')
    await startRun(2)

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(2)
    })
    const requests = assessments.generateAssessment.mock.calls.map(([request]) => request)
    expect(requests.map((request) => request.materialIds)).toEqual([['mat-1'], ['mat-2']])
    // The pointer still names every chosen material, so the run can say so.
    expect(mockAppend).toHaveBeenCalledWith(
      'PracticeRunStarted',
      expect.objectContaining({ materialIds: ['mat-1', 'mat-2', 'mat-3'] }),
    )
  })

  it('warns when fewer problems than materials means some materials go unused', async () => {
    const client = new FakeMaterialClient([
      material({}),
      material({ id: 'mat-2', title: 'Database Internals', source: 'db.pdf' }),
      material({ id: 'mat-3', title: 'Compiler Design', source: 'cc.pdf' }),
    ])

    renderPractice(client)
    await addMaterial('Database Internals')
    await addMaterial('Compiler Design')
    // 2 problems across 3 materials: the third material is never drawn from.
    fireEvent.change(screen.getByLabelText('Number of questions'), { target: { value: '2' } })

    expect(
      await screen.findByText(/only the first 2 materials will be used/i),
    ).toBeInTheDocument()
  })

  it('generates one single-material written question per problem', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2', 'a-3'])

    renderPractice(client, assessments)
    await startRun(3)

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(3)
    })
    const requests = assessments.generateAssessment.mock.calls.map(([request]) => request)
    for (const request of requests) {
      expect(request.materialIds).toEqual(['mat-1'])
      expect(request.recipe).toMatchObject({
        formats: ['written'],
        questionCount: 1,
        difficulty: 3,
      })
      expect(request.recipe.scope).toBeUndefined()
    }
    // Every problem is its own idempotent request.
    expect(new Set(requests.map((request) => request.clientId)).size).toBe(3)
    expect(new Set(requests.map((request) => request.correlationId)).size).toBe(3)
  })

  it('appends one run pointer and no assessment pointer, then opens the run', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2', 'a-3'])

    renderPractice(client, assessments)
    await startRun(3)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })
    // Exact shape: the run pointer carries no questionIds (D-02).
    expect(mockAppend).toHaveBeenCalledWith('PracticeRunStarted', {
      runId: expect.any(String),
      materialIds: ['mat-1'],
      mode: 'written',
      assessmentIds: ['a-1', 'a-2', 'a-3'],
      count: 3,
      families: ['written', 'written', 'written'],
    })
    expect(mockAppend).not.toHaveBeenCalledWith('AssessmentCreated', expect.anything())

    const [{ runId }] = mockAppend.mock.calls[0].slice(1)
    expect(mockNavigate).toHaveBeenCalledWith(`/materials/mat-1/practice/${runId}`)
  })

  it('generates a coding-only run and records each problem’s family', async () => {
    const client = new FakeMaterialClient([material({ hasCode: true })])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2'])

    renderPractice(client, assessments)
    fireEvent.click(await screen.findByRole('button', { name: 'Coding' }))
    await startRun(2)

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(2)
    })
    const requests = assessments.generateAssessment.mock.calls.map(([request]) => request)
    expect(requests.map((request) => request.recipe.formats)).toEqual([['coding'], ['coding']])
    expect(mockAppend).toHaveBeenCalledWith(
      'PracticeRunStarted',
      expect.objectContaining({
        mode: 'coding',
        assessmentIds: ['a-1', 'a-2'],
        families: ['coding', 'coding'],
      }),
    )
  })

  it('alternates one family per call for a mixed run, never two in one request', async () => {
    const client = new FakeMaterialClient([material({ hasCode: true })])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2', 'a-3'])

    renderPractice(client, assessments)
    fireEvent.click(await screen.findByRole('button', { name: 'Mixed' }))
    await startRun(3)

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(3)
    })
    const requests = assessments.generateAssessment.mock.calls.map(([request]) => request)
    // The server admits exactly one family per call, so a mixed run alternates
    // rather than sending ['written', 'coding'] in a single recipe.
    expect(requests.map((request) => request.recipe.formats)).toEqual([
      ['written'],
      ['coding'],
      ['written'],
    ])
    for (const request of requests) {
      expect(request.recipe.formats).toHaveLength(1)
    }
    expect(mockAppend).toHaveBeenCalledWith(
      'PracticeRunStarted',
      expect.objectContaining({
        mode: 'mixed',
        families: ['written', 'coding', 'written'],
      }),
    )
  })

  it('warns that a material with no code blocks may not yield a coding problem', async () => {
    const client = new FakeMaterialClient([material({ hasCode: false })])

    renderPractice(client)

    fireEvent.click(await screen.findByRole('button', { name: 'Coding' }))
    expect(await screen.findByText(/No code blocks detected/i)).toBeInTheDocument()
    // The coding family stays selectable: the note informs, it does not block.
    expect(screen.getByRole('button', { name: 'Coding' })).toHaveClass('selected')
  })

  it('stays silent about code blocks on unscanned materials, matching the assessment flow', async () => {
    for (const overrides of [{}, { hasCode: null }, { hasCode: true }]) {
      const client = new FakeMaterialClient([material(overrides)])
      const view = renderPractice(client)

      fireEvent.click(await screen.findByRole('button', { name: 'Coding' }))
      expect(screen.queryByText(/No code blocks detected/i)).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('adaptive runs pick the recommended band from the mastery projection', async () => {
    const client = new FakeMaterialClient([
      material({}),
      material({ id: 'mat-2', title: 'Database Internals', source: 'db.pdf' }),
    ])
    const assessments = new FakeAssessmentClient()
    // mat-1 is mastered (high p), mat-2 is weak (low p): one band up, one
    // band down from the mid-band reference.
    assessments.scriptGetMastery([
      masteryProjection({ materialId: 'mat-1', mastery: 0.95, n: 8 }),
      masteryProjection({ materialId: 'mat-2', mastery: 0.1, n: 3 }),
    ])
    scriptGenerations(assessments, ['a-1', 'a-2'])

    renderPractice(client, assessments)
    await addMaterial('Database Internals')
    fireEvent.click(screen.getByRole('button', { name: 'Adaptive' }))
    await startRun(2)

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(2)
    })
    const requests = assessments.generateAssessment.mock.calls.map(([request]) => request)
    expect(requests.map((request) => request.recipe.difficulty)).toEqual([4, 2])
    // The fetched projections are cached in the derived masteryCache.
    expect(mockTablePut).toHaveBeenCalledTimes(2)
  })

  it('adaptive cold start keeps the mid band when there are no projections', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    assessments.scriptGetMastery([])
    scriptGenerations(assessments, ['a-1', 'a-2'])

    renderPractice(client, assessments)
    await screen.findByText('Focus')
    fireEvent.click(screen.getByRole('button', { name: 'Adaptive' }))
    await startRun(2)

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(2)
    })
    const requests = assessments.generateAssessment.mock.calls.map(([request]) => request)
    expect(requests.map((request) => request.recipe.difficulty)).toEqual([3, 3])
  })

  it('adaptive falls back to the mid band when the mastery fetch fails', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    assessments.scriptGetMastery(new AssessmentServiceError('network', 'request failed', true))
    scriptGenerations(assessments, ['a-1', 'a-2'])

    renderPractice(client, assessments)
    await screen.findByText('Focus')
    fireEvent.click(screen.getByRole('button', { name: 'Adaptive' }))
    await startRun(2)

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(2)
    })
    const requests = assessments.generateAssessment.mock.calls.map(([request]) => request)
    expect(requests.map((request) => request.recipe.difficulty)).toEqual([3, 3])
    expect(mockTablePut).not.toHaveBeenCalled()
  })

  it('keeps the problems that generated when some generations fail', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1', 'a-2', 'a-3'], {
      2: new AssessmentServiceError('network', 'request failed', true),
    })

    renderPractice(client, assessments)
    await startRun(3)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled()
    })
    expect(mockAppend).toHaveBeenCalledWith(
      'PracticeRunStarted',
      expect.objectContaining({ assessmentIds: ['a-1', 'a-2'], count: 3 }),
    )
  })

  it('shows a quota banner with retryAfterSeconds and starts nothing', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    scriptGenerations(assessments, ['a-1'], {
      0: new AssessmentServiceError('quota_exhausted', 'quota', false, 60),
      1: new AssessmentServiceError('quota_exhausted', 'quota', false, 60),
    })

    renderPractice(client, assessments)
    await startRun(2)

    expect(await screen.findByText('Generation quota exhausted')).toBeInTheDocument()
    expect(screen.getByText(/about 60 seconds/)).toBeInTheDocument()
    expect(mockAppend).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    // Recoverable: the learner can try again by hand.
    expect(screen.getByRole('button', { name: 'Start practice run' })).toBeEnabled()
  })

  it('reports progress and blocks a second start while generating', async () => {
    const client = new FakeMaterialClient([material({})])
    const assessments = new FakeAssessmentClient()
    assessments.generateAssessment.mockImplementation(() => new Promise(() => undefined))

    renderPractice(client, assessments)
    await startRun(3)

    const card = (await screen.findByText('Generating 3 questions…')).closest('.card')
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled()
    expect(assessments.generateAssessment).toHaveBeenCalledTimes(2)
  })

  it.each(['pending', 'extracting', 'chunking', 'embedding'] as const)(
    'blocks a direct practice route while the material is %s',
    async (state) => {
      const client = new FakeMaterialClient([material({ ingestionState: state })])

      renderPractice(client)

      expect(await screen.findByText('Material is not ready yet')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Start practice run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add another material' })).not.toBeInTheDocument()
    },
  )

  it('blocks a direct practice route for a failed material', async () => {
    const client = new FakeMaterialClient([
      material({ ingestionState: 'failed', ingestionError: 'provider_timeout' }),
    ])

    renderPractice(client)

    expect(await screen.findByText('Material is not ready yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start practice run' })).not.toBeInTheDocument()
  })
})
