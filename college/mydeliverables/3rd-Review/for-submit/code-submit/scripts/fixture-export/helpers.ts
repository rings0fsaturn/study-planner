import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  SessionEvent,
  CalibrationState,
  RoadmapSlot,
  RoadmapInput,
} from '../../packages/progress/src/types'
import { BAYESIAN_PRIOR_MEAN, BAYESIAN_PRIOR_VARIANCE } from '../../packages/progress/src/config'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = join(__dirname, '../..')
export const FIXTURE_ROOT = join(REPO_ROOT, 'tests/fixtures/pillar-a')

export function makeSession(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    date: '2026-01-15',
    source: 'active',
    plannedMinutes: 60,
    activeMinutes: 60,
    duration: 60,
    materialRole: 'anchor',
    startedAt: '2026-01-15T14:00:00Z',
    sessionId: `session-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  }
}

export function defaultCalibration(): CalibrationState {
  return {
    globalMultiplier: 1.0,
    globalPosterior: {
      mean: BAYESIAN_PRIOR_MEAN,
      variance: BAYESIAN_PRIOR_VARIANCE,
      sessionCount: 0,
    },
    roleMultipliers: {},
    trend: {
      phases: [],
      currentPhase: null,
      projectionSlope: 0,
      projectionUncertainty: 1,
    },
    promptNeeded: false,
    insightsByContext: [],
  }
}

export function makeSlot(date: string, plannedMinutes: number): RoadmapSlot {
  return {
    date,
    dayOfWeek: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
    weekIndex: 0,
    plannedMinutes,
    candidateMaterialIds: ['mat-1'],
    role: 'anchor',
  }
}

export function makeProgressRoadmap(slots: RoadmapSlot[]): RoadmapInput {
  const sortedDates = slots.map((s) => s.date).sort()
  return {
    startDate: sortedDates[0] ?? '2026-01-01',
    deadline: sortedDates[sortedDates.length - 1] ?? '2026-01-31',
    weeks: 4,
    weeklyHours: 6,
    slots,
  }
}

export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface FixtureCase {
  name: string
  fn: string
  input: Record<string, unknown>
  run: () => unknown
}

export function exportFixtures(subdir: string, cases: FixtureCase[]): number {
  const dir = join(FIXTURE_ROOT, subdir)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }
  mkdirSync(dir, { recursive: true })

  for (const testCase of cases) {
    const expected = testCase.run()
    const inputDoc = { fn: testCase.fn, ...testCase.input }
    writeFileSync(join(dir, `${testCase.name}.input.json`), JSON.stringify(inputDoc, null, 2) + '\n')
    writeFileSync(
      join(dir, `${testCase.name}.expected.json`),
      JSON.stringify(expected, null, 2) + '\n',
    )
  }

  return cases.length
}
