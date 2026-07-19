import { exportFixtures } from './helpers'
import { progressCases } from './progress-cases'
import { roadmapCases } from './roadmap-cases'

export function exportAllFixtures(): { progress: number; roadmap: number } {
  const progress = exportFixtures('progress', progressCases())
  const roadmap = exportFixtures('roadmap', roadmapCases())
  return { progress, roadmap }
}
