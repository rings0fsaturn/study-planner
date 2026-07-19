import { describe, expect, it, vi } from 'vitest'
import type { RoadmapEditedPayload } from '../../sync/types'
import { logRoadmapEdit } from './logRoadmapEdit'

describe('logRoadmapEdit', () => {
  it('emits a RoadmapEdited event with identity and slot fields', async () => {
    const logEvent = vi.fn().mockResolvedValue(1)
    const edit: RoadmapEditedPayload = {
      roadmapCreatedAt: '2026-06-01T00:00:00.000Z',
      weekIndex: 1,
      dayOfWeek: 'Wed',
      materialId: 'mat-1',
      sessionTitle: 'Updated session',
      plannedMinutes: 75,
    }

    await logRoadmapEdit(logEvent, edit)

    expect(logEvent).toHaveBeenCalledWith('RoadmapEdited', edit)
  })
})
