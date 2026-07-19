import { describe, expect, it } from 'vitest'
import { buildMaterialLedger } from '../src/materialLedger'
import type { SessionEvent } from '../src/types'

function session(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    date: '2026-06-10',
    source: 'active',
    duration: 30,
    activeMinutes: 30,
    materialId: 'mat-1',
    resolution: 'interrupted',
    ...overrides,
  }
}

describe('buildMaterialLedger', () => {
  it('uses materialConsumedMinutes from partial sessions for estimated consumption', () => {
    const result = buildMaterialLedger(
      [{ id: 'mat-1', title: 'DDIA', estimatedMinutes: 100 }],
      [session({ materialConsumedMinutes: 40 })],
    )

    expect(result[0]).toMatchObject({
      activeMinutesLogged: 30,
      estimatedConsumedMinutes: 40,
      remainingEstimatedMinutes: 60,
      done: false,
      started: true,
    })
  })

  it('folds out-of-session progress marks without requiring a session', () => {
    const result = buildMaterialLedger(
      [{ id: 'mat-1', title: 'DDIA', estimatedMinutes: 100 }],
      [],
      [{
        materialId: 'mat-1',
        markedAt: '2026-06-11T10:00:00.000Z',
        materialPosition: { kind: 'percent', value: 75 },
      }],
    )

    expect(result[0]).toMatchObject({
      estimatedConsumedMinutes: 75,
      remainingEstimatedMinutes: 25,
      done: false,
      started: true,
      lastPosition: { kind: 'percent', value: 75 },
    })
  })

  it('marks complete sessions done', () => {
    const result = buildMaterialLedger(
      [{ id: 'mat-1', title: 'DDIA', estimatedMinutes: 100 }],
      [session({ resolution: 'completed', materialConsumedMinutes: 100 })],
    )

    expect(result[0].done).toBe(true)
    expect(result[0].remainingEstimatedMinutes).toBe(0)
  })
})
