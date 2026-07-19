import { describe, it, expect } from 'vitest'
import { exportAllFixtures } from './export-all'
import { progressCases } from './progress-cases'
import { roadmapCases } from './roadmap-cases'

describe('fixture export', () => {
  it('exports all golden fixtures to tests/fixtures/pillar-a/', () => {
    const counts = exportAllFixtures()
    expect(counts.progress).toBe(progressCases().length)
    expect(counts.roadmap).toBe(roadmapCases().length)
    expect(counts.progress).toBeGreaterThanOrEqual(70)
    expect(counts.roadmap).toBeGreaterThanOrEqual(27)
  })
})
