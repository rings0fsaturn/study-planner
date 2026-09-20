/**
 * Derived, non-synced mastery cache (Dexie v7 `masteryCache`, #43).
 *
 * The projection is rebuildable from durable grades via `GET /v1/mastery`,
 * so the cache is a convenience copy, never an authority: a fresh fetch
 * overwrites the row in place (calibrationCache precedent, map #4 #10).
 */

import type { EventStore } from '../events/EventStore'
import type { MasteryProjection } from './types'

export interface MasteryCacheRow extends MasteryProjection {}

function table(store: EventStore) {
  return store.table('masteryCache')
}

export async function saveMasteryProjections(
  store: EventStore,
  projections: MasteryProjection[],
): Promise<void> {
  for (const projection of projections) {
    await table(store).put(projection as MasteryCacheRow)
  }
}

export async function readMasteryProjections(
  store: EventStore,
  materialId?: string,
): Promise<MasteryProjection[]> {
  const rows: MasteryCacheRow[] = materialId
    ? await table(store).where('materialId').equals(materialId).toArray()
    : await table(store).toArray()
  return rows
}