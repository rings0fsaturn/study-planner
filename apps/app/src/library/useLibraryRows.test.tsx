import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import Dexie from 'dexie'
import { EventStoreProvider, createEventStore } from '../events/EventStoreProvider'
import { ASSESSMENT_CREATED, PRACTICE_RUN_STARTED } from '../events/EventStore'
import { AssessmentProvider } from '../assessments/AssessmentProvider'
import { MaterialsProvider } from '../materials/MaterialsProvider'
import { FakeAssessmentClient, readyAssessment, attemptRecord } from '../assessments/testing/fakeAssessmentClient'
import { FakeMaterialClient } from '../materials/testing/fakeMaterialClient'
import type { MaterialRecord } from '../materials/types'
import { useLibraryRows, useLibraryCounts, MATERIAL_UNAVAILABLE } from './useLibraryRows'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const USER = 'library-user'
const USER2 = 'library-user-2'
const DB_NAME = `StudyTracker_${USER}`
const DB_NAME2 = `StudyTracker_${USER2}`

function material(id: string, title: string): MaterialRecord {
  return {
    id,
    ownerId: 'user-a',
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

async function seedEvents(events: Array<{ kind: string; payload: Record<string, unknown> }>) {
  const store = createEventStore(USER)
  for (const { kind, payload } of events) {
    await store.append(kind, payload)
  }
  store.close()
}

function Probe({ materialId }: { materialId?: string }) {
  const rows = useLibraryRows({ materialId })
  return (
    <div>
      <div data-testid="loading">{rows.loading ? 'loading' : 'done'}</div>
      <div data-testid="errors">{rows.errorCount}</div>
      <div data-testid="assessments">{rows.assessmentRows.map((r) => `${r.assessmentId}:${r.state}`).join(',')}</div>
      <div data-testid="runs">{rows.runRows.map((r) => `${r.runId}:${r.state}`).join(',')}</div>
      <div data-testid="titles">{JSON.stringify(rows.materialTitles)}</div>
      <button type="button" onClick={() => void rows.reload()}>reload</button>
    </div>
  )
}

function CountsProbe() {
  const counts = useLibraryCounts()
  return (
    <div>
      <div data-testid="counts">{`${counts.assessmentCount}:${counts.practiceCount}`}</div>
    </div>
  )
}

function renderProbe(
  assessments: FakeAssessmentClient,
  materials: FakeMaterialClient,
  materialId?: string,
) {
  return render(
    <EventStoreProvider userId={USER}>
      <MaterialsProvider client={materials}>
        <AssessmentProvider client={assessments}>
          <Probe materialId={materialId} />
        </AssessmentProvider>
      </MaterialsProvider>
    </EventStoreProvider>,
  )
}

beforeEach(async () => {
  await Dexie.delete(DB_NAME)
  await Dexie.delete(DB_NAME2)
})

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  const store = createEventStore(USER)
  store.close()
  await Dexie.delete(DB_NAME)
  const store2 = createEventStore(USER2)
  store2.close()
  await Dexie.delete(DB_NAME2)
})

describe('useLibraryRows', () => {
  it('shows event pointers as rows after hydration', async () => {
    await seedEvents([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) => readyAssessment({ id, materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderProbe(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('done'))
    expect(screen.getByTestId('assessments')).toHaveTextContent('a-1:ready')
  })

  it('caches hydrated envelopes and merges server attempts', async () => {
    await seedEvents([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    const envelope = readyAssessment({
      id: 'a-1',
      materialIds: ['mat-1'],
      questions: [
        { id: 'q1', assessmentId: 'a-1', materialId: 'mat-1', format: 'objective', prompt: 'P', options: ['A'], skillTags: [], authoredDifficulty: 1, citations: [] },
      ],
    })
    assessments.getAssessment.mockResolvedValue(envelope)
    assessments.listAssessmentAttempts.mockResolvedValue([
      attemptRecord({ assessmentId: 'a-1', questionId: 'q1', status: 'graded', grade: { attemptId: 'att-1', questionId: 'q1', materialId: 'mat-1', score: 1, correct: true, grader: 'objective', gradedAt: '2026-09-20T11:00:00Z' } }),
    ])
    renderProbe(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    await waitFor(() => expect(screen.getByTestId('assessments')).toHaveTextContent('a-1:ready'))
    const store = createEventStore(USER)
    const db = (store as unknown as { db: Dexie }).db
    await db.open()
    const cached = await db.table('assessmentContentCache').get('a-1')
    expect(cached?.envelope?.id).toBe('a-1')
    const local = await db.table('assessmentAttempts').where('assessmentId').equals('a-1').toArray()
    expect(local.length).toBeGreaterThan(0)
    store.close()
  })

  it('falls back to the cache when the network fails', async () => {
    await seedEvents([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockRejectedValue(new Error('offline'))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const envelope = readyAssessment({ id: 'a-1', materialIds: ['mat-1'] })
    const seeder = createEventStore(USER)
    const seederDb = (seeder as unknown as { db: Dexie }).db
    await seederDb.open()
    await seederDb.table('assessmentContentCache').put({ assessmentId: 'a-1', envelope, cachedAt: new Date().toISOString() })
    seeder.close()
    renderProbe(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    await waitFor(() => expect(screen.getByTestId('assessments')).toHaveTextContent('a-1:ready'))
    expect(screen.getByTestId('errors')).toHaveTextContent('0')
  })

  it('marks unreadable uncached rows unavailable and raises the error count', async () => {
    await seedEvents([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockRejectedValue(new Error('offline'))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderProbe(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    await waitFor(() => expect(screen.getByTestId('errors')).toHaveTextContent('1'))
    expect(screen.getByTestId('assessments')).toHaveTextContent('a-1:unavailable')
  })

  it('reloads only failed ids', async () => {
    await seedEvents([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-2', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) => {
      if (id === 'a-1') throw new Error('offline')
      return readyAssessment({ id, materialIds: ['mat-1'] })
    })
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderProbe(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    await waitFor(() => expect(screen.getByTestId('assessments')).toHaveTextContent('a-2:ready'))
    expect(screen.getByTestId('assessments')).toHaveTextContent('a-1:unavailable')
    assessments.getAssessment.mockClear()
    assessments.getAssessment.mockImplementation(async (id) => readyAssessment({ id, materialIds: ['mat-1'] }))
    await act(async () => {
      screen.getByRole('button', { name: 'reload' }).click()
    })
    await waitFor(() => expect(screen.getByTestId('assessments')).toHaveTextContent('a-1:ready'))
    const calledIds = assessments.getAssessment.mock.calls.map((call) => call[0])
    expect(calledIds).not.toContain('a-2')
  })

  it('polls generating envelopes until ready', async () => {
    await seedEvents([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
    ])
    const assessments = new FakeAssessmentClient()
    let calls = 0
    assessments.getAssessment.mockImplementation(async (id) => {
      calls += 1
      if (calls === 1) return readyAssessment({ id, materialIds: ['mat-1'], status: 'generating', questions: [] })
      return readyAssessment({ id, materialIds: ['mat-1'], status: 'ready' })
    })
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderProbe(assessments, new FakeMaterialClient([material('mat-1', 'OS')]))
    await waitFor(() => expect(screen.getByTestId('assessments')).toHaveTextContent('a-1:generating'))
    await waitFor(() => expect(screen.getByTestId('assessments')).toHaveTextContent('a-1:ready'), { timeout: 8000 })
  }, 15000)

  it('filters pointers by materialId', async () => {
    await seedEvents([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-2', materialIds: ['mat-2'] } },
      {
        kind: PRACTICE_RUN_STARTED,
        payload: { runId: 'run-1', materialIds: ['mat-1'], mode: 'written', assessmentIds: ['a-1'], count: 1 },
      },
      {
        kind: PRACTICE_RUN_STARTED,
        payload: { runId: 'run-2', materialIds: ['mat-2'], mode: 'written', assessmentIds: ['a-2'], count: 1 },
      },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) => readyAssessment({ id }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    renderProbe(assessments, new FakeMaterialClient([material('mat-1', 'OS'), material('mat-2', 'DB')]), 'mat-1')
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('done'))
    expect(screen.getByTestId('assessments')).toHaveTextContent('a-1')
    expect(screen.getByTestId('assessments')).not.toHaveTextContent('a-2')
    expect(screen.getByTestId('runs')).toHaveTextContent('run-1')
    expect(screen.getByTestId('runs')).not.toHaveTextContent('run-2')
  })

  it('titles come from one list call with fallback for missing materials', async () => {
    await seedEvents([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-missing'] } },
    ])
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) => readyAssessment({ id, materialIds: ['mat-missing'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const materials = new FakeMaterialClient([material('mat-1', 'OS')])
    const spy = vi.spyOn(materials, 'listMaterials')
    renderProbe(assessments, materials)
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('done'))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('titles')).toHaveTextContent(MATERIAL_UNAVAILABLE)
  })

  it('recreates the attempt flow on account switch instead of reusing the stale db', async () => {
    await seedEvents([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
    ])
    const seeder2 = createEventStore(USER2)
    await seeder2.append(ASSESSMENT_CREATED, { assessmentId: 'b-1', materialIds: ['mat-1'] })
    seeder2.close()
    const assessments = new FakeAssessmentClient()
    assessments.getAssessment.mockImplementation(async (id) => readyAssessment({ id, materialIds: ['mat-1'] }))
    assessments.listAssessmentAttempts.mockResolvedValue([])
    const materials = new FakeMaterialClient([material('mat-1', 'OS')])
    function Switcher() {
      const [userId, setUserId] = useState(USER)
      return (
        <div>
          <button type="button" onClick={() => setUserId(USER2)}>switch-user</button>
          <EventStoreProvider userId={userId}>
            <MaterialsProvider client={materials}>
              <AssessmentProvider client={assessments}>
                <Probe />
              </AssessmentProvider>
            </MaterialsProvider>
          </EventStoreProvider>
        </div>
      )
    }
    render(<Switcher />)
    await waitFor(() => expect(screen.getByTestId('assessments')).toHaveTextContent('a-1:ready'))
    await act(async () => {
      screen.getByRole('button', { name: 'switch-user' }).click()
    })
    await waitFor(() => expect(screen.getByTestId('assessments')).toHaveTextContent('b-1:ready'), { timeout: 8000 })
    expect(screen.getByTestId('assessments')).not.toHaveTextContent('a-1')
    const store2 = createEventStore(USER2)
    const db2 = (store2 as unknown as { db: Dexie }).db
    await db2.open()
    const cached = await db2.table('assessmentContentCache').get('b-1')
    expect(cached?.envelope?.id).toBe('b-1')
    store2.close()
  }, 15000)
})

describe('useLibraryCounts', () => {
  it('counts pointers without hydration', async () => {
    await seedEvents([
      { kind: ASSESSMENT_CREATED, payload: { assessmentId: 'a-1', materialIds: ['mat-1'] } },
      {
        kind: PRACTICE_RUN_STARTED,
        payload: { runId: 'run-1', materialIds: ['mat-1'], mode: 'written', assessmentIds: ['a-1'], count: 1 },
      },
    ])
    render(
      <EventStoreProvider userId={USER}>
        <CountsProbe />
      </EventStoreProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('counts')).toHaveTextContent('1:1'))
  })
})
