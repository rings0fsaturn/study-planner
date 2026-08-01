import type { RoadmapEditedPayload } from '../../sync/types'

export async function logRoadmapEdit(
  logEvent: (kind: string, payload: Record<string, unknown>) => Promise<unknown>,
  edit: RoadmapEditedPayload,
): Promise<void> {
  await logEvent('RoadmapEdited', edit as unknown as Record<string, unknown>)
}
