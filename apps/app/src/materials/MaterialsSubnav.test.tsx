import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dexie from 'dexie'
import { EventStoreProvider, createEventStore } from '../events/EventStoreProvider'
import { ASSESSMENT_CREATED, PRACTICE_RUN_STARTED } from '../events/EventStore'
import { MaterialsSubnav } from './MaterialsSubnav'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const USER = 'subnav-user'
const DB_NAME = `StudyTracker_${USER}`

async function seed() {
  const store = createEventStore(USER)
  await store.append(ASSESSMENT_CREATED, { assessmentId: 'a-1', materialIds: ['mat-1'] })
  await store.append(ASSESSMENT_CREATED, { assessmentId: 'a-2', materialIds: ['mat-1'] })
  await store.append(PRACTICE_RUN_STARTED, {
    runId: 'run-1',
    materialIds: ['mat-1'],
    mode: 'written',
    assessmentIds: ['a-1'],
    count: 1,
  })
  store.close()
}

function renderSubnav(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <EventStoreProvider userId={USER}>
        <MaterialsSubnav />
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

describe('MaterialsSubnav', () => {
  it('links to the three library surfaces with live counts', async () => {
    await seed()
    renderSubnav('/materials')
    await waitFor(() => expect(screen.getByRole('link', { name: /Assessments 2/i })).toBeTruthy())
    expect(screen.getByRole('link', { name: /Library/i }).getAttribute('href')).toBe('/materials')
    expect(screen.getByRole('link', { name: /Assessments 2/i }).getAttribute('href')).toBe('/assessments')
    expect(screen.getByRole('link', { name: /Practice 1/i }).getAttribute('href')).toBe('/practice')
  })

  it('marks the active surface with aria-current', async () => {
    await seed()
    renderSubnav('/assessments')
    await waitFor(() => expect(screen.getByRole('link', { name: /Assessments 2/i })).toBeTruthy())
    expect(screen.getByRole('link', { name: /Assessments 2/i }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: /Library/i }).getAttribute('aria-current')).toBeNull()
  })

  it('exposes an accessible nav label', async () => {
    await seed()
    renderSubnav('/practice')
    await waitFor(() => expect(screen.getByRole('navigation', { name: /Library sections/i })).toBeTruthy())
  })
})
