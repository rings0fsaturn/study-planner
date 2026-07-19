import {
  generateRoadmap,
  inferRole,
  addMaterialToRoadmap,
  removeMaterialFromRoadmap,
  regenerateRoadmap,
} from '../../packages/roadmap-engine/src/roadmap-engine'
import type { RoadmapInput, Material, Pin } from '../../packages/roadmap-engine/src/roadmap-engine'
import { type FixtureCase } from './helpers'

const canonicalInput: RoadmapInput = {
  materials: [
    {
      id: 'ddia',
      title: 'Designing Data-Intensive Applications',
      totalMinutes: 600,
      role: 'anchor',
      additionOrder: 0,
    },
    { id: 'cap', title: 'CAP theorem', totalMinutes: 200, role: 'foundation', additionOrder: 1 },
    { id: 'mocks', title: 'Mock interviews', totalMinutes: 300, role: 'practice', additionOrder: 2 },
  ],
  weeks: 8,
  startDate: '2026-04-29',
  selectedStudyDays: ['Mon', 'Wed', 'Sat'],
  weekdayHours: 2,
  weekendHours: 3,
}

export function roadmapCases(): FixtureCase[] {
  return [
    // generateRoadmap unit tests
    {
      name: 'generate-roadmap-week-count',
      fn: 'generateRoadmap',
      input: { ...canonicalInput },
      run: () => generateRoadmap(canonicalInput),
    },
    {
      name: 'generate-roadmap-slots-per-week',
      fn: 'generateRoadmap',
      input: { ...canonicalInput },
      run: () => generateRoadmap(canonicalInput),
    },
    {
      name: 'generate-roadmap-capacity',
      fn: 'generateRoadmap',
      input: { ...canonicalInput },
      run: () => generateRoadmap(canonicalInput),
    },
    {
      name: 'generate-roadmap-under-capacity-buffer',
      fn: 'generateRoadmap',
      input: { ...canonicalInput },
      run: () => generateRoadmap(canonicalInput),
    },
    {
      name: 'generate-roadmap-foundation-early',
      fn: 'generateRoadmap',
      input: { ...canonicalInput },
      run: () => generateRoadmap(canonicalInput),
    },
    {
      name: 'generate-roadmap-anchor-saturdays',
      fn: 'generateRoadmap',
      input: { ...canonicalInput },
      run: () => generateRoadmap(canonicalInput),
    },
    {
      name: 'generate-roadmap-practice-late',
      fn: 'generateRoadmap',
      input: { ...canonicalInput },
      run: () => generateRoadmap(canonicalInput),
    },
    {
      name: 'generate-roadmap-session-titles',
      fn: 'generateRoadmap',
      input: { ...canonicalInput },
      run: () => generateRoadmap(canonicalInput),
    },
    {
      name: 'generate-roadmap-ddia-600-min',
      fn: 'generateRoadmap',
      input: { ...canonicalInput },
      run: () => generateRoadmap(canonicalInput),
    },

    // inferRole
    {
      name: 'infer-role-practice-mocks',
      fn: 'inferRole',
      input: { title: 'Mock interviews', totalMinutes: 300, existing: [] },
      run: () => inferRole('Mock interviews', 300, []),
    },
    {
      name: 'infer-role-practice-leetcode',
      fn: 'inferRole',
      input: { title: 'LeetCode patterns', totalMinutes: 600, existing: [] },
      run: () => inferRole('LeetCode patterns', 600, []),
    },
    {
      name: 'infer-role-anchor-largest',
      fn: 'inferRole',
      input: {
        title: 'DDIA',
        totalMinutes: 600,
        existing: [{ id: 'x', title: 'X', totalMinutes: 100, role: 'anchor', additionOrder: 0 }],
      },
      run: () =>
        inferRole('DDIA', 600, [
          { id: 'x', title: 'X', totalMinutes: 100, role: 'anchor', additionOrder: 0 },
        ]),
    },
    {
      name: 'infer-role-foundation-smaller',
      fn: 'inferRole',
      input: {
        title: 'CAP',
        totalMinutes: 200,
        existing: [{ id: 'x', title: 'X', totalMinutes: 600, role: 'anchor', additionOrder: 0 }],
      },
      run: () =>
        inferRole('CAP', 200, [
          { id: 'x', title: 'X', totalMinutes: 600, role: 'anchor', additionOrder: 0 },
        ]),
    },

    // addMaterialToRoadmap
    {
      name: 'add-material-rest-day-slots',
      fn: 'addMaterialToRoadmap',
      input: (() => {
        const input: RoadmapInput = {
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 180, role: 'anchor', additionOrder: 0 }],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const roadmap = generateRoadmap(input)
        const newMaterial: Material = {
          id: 'cap',
          title: 'CAP',
          totalMinutes: 60,
          role: 'foundation',
          additionOrder: 1,
        }
        return { roadmap, newMaterial, pins: [] }
      })(),
      run: () => {
        const input: RoadmapInput = {
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 180, role: 'anchor', additionOrder: 0 }],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const roadmap = generateRoadmap(input)
        const newMaterial: Material = {
          id: 'cap',
          title: 'CAP',
          totalMinutes: 60,
          role: 'foundation',
          additionOrder: 1,
        }
        return addMaterialToRoadmap(roadmap, newMaterial, [])
      },
    },
    {
      name: 'add-material-recomputes-capacity',
      fn: 'addMaterialToRoadmap',
      input: (() => {
        const input: RoadmapInput = {
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 180, role: 'anchor', additionOrder: 0 }],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const roadmap = generateRoadmap(input)
        const newMaterial: Material = {
          id: 'cap',
          title: 'CAP',
          totalMinutes: 60,
          role: 'foundation',
          additionOrder: 1,
        }
        return { roadmap, newMaterial, pins: [] }
      })(),
      run: () => {
        const input: RoadmapInput = {
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 180, role: 'anchor', additionOrder: 0 }],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const roadmap = generateRoadmap(input)
        const newMaterial: Material = {
          id: 'cap',
          title: 'CAP',
          totalMinutes: 60,
          role: 'foundation',
          additionOrder: 1,
        }
        return addMaterialToRoadmap(roadmap, newMaterial, [])
      },
    },

    // removeMaterialFromRoadmap
    {
      name: 'remove-material-non-pinned',
      fn: 'removeMaterialFromRoadmap',
      input: (() => {
        const input: RoadmapInput = {
          materials: [
            { id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 },
            { id: 'cap', title: 'CAP', totalMinutes: 200, role: 'foundation', additionOrder: 1 },
          ],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const roadmap = generateRoadmap(input)
        return { roadmap, materialId: 'cap', pins: [] }
      })(),
      run: () => {
        const input: RoadmapInput = {
          materials: [
            { id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 },
            { id: 'cap', title: 'CAP', totalMinutes: 200, role: 'foundation', additionOrder: 1 },
          ],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const roadmap = generateRoadmap(input)
        return removeMaterialFromRoadmap(roadmap, 'cap', [])
      },
    },

    // regenerateRoadmap
    {
      name: 'regenerate-preserves-pins',
      fn: 'regenerateRoadmap',
      input: (() => {
        const input: RoadmapInput = {
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 }],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const pins: Pin[] = [
          {
            weekIndex: 0,
            dayOfWeek: 'Mon',
            materialId: 'ddia',
            sessionTitle: 'DDIA · session 1',
            plannedMinutes: 120,
            reason: 'completed',
          },
        ]
        return { input, pins }
      })(),
      run: () => {
        const input: RoadmapInput = {
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 }],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const pins: Pin[] = [
          {
            weekIndex: 0,
            dayOfWeek: 'Mon',
            materialId: 'ddia',
            sessionTitle: 'DDIA · session 1',
            plannedMinutes: 120,
            reason: 'completed',
          },
        ]
        return regenerateRoadmap(input, pins)
      },
    },

    // snapshot tests — canonical scenarios
    {
      name: 'snapshot-canonical-8-week-ddia',
      fn: 'generateRoadmap',
      input: { ...canonicalInput },
      run: () => generateRoadmap(canonicalInput),
    },
    {
      name: 'snapshot-single-material-4-weeks',
      fn: 'generateRoadmap',
      input: {
        materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 }],
        weeks: 4,
        startDate: '2026-04-29',
        selectedStudyDays: ['Mon', 'Wed'],
        weekdayHours: 2,
        weekendHours: 0,
      },
      run: () =>
        generateRoadmap({
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 }],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }),
    },
    {
      name: 'snapshot-two-anchors-6-weeks',
      fn: 'generateRoadmap',
      input: {
        materials: [
          { id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 },
          { id: 'alex', title: 'Alex Xu System Design', totalMinutes: 400, role: 'anchor', additionOrder: 1 },
        ],
        weeks: 6,
        startDate: '2026-04-29',
        selectedStudyDays: ['Mon', 'Wed', 'Sat'],
        weekdayHours: 2,
        weekendHours: 3,
      },
      run: () =>
        generateRoadmap({
          materials: [
            { id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 },
            { id: 'alex', title: 'Alex Xu System Design', totalMinutes: 400, role: 'anchor', additionOrder: 1 },
          ],
          weeks: 6,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed', 'Sat'],
          weekdayHours: 2,
          weekendHours: 3,
        }),
    },
    {
      name: 'snapshot-n1-emergency-cram',
      fn: 'generateRoadmap',
      input: {
        materials: [
          { id: 'ddia', title: 'DDIA', totalMinutes: 200, role: 'anchor', additionOrder: 0 },
          { id: 'cap', title: 'CAP', totalMinutes: 100, role: 'foundation', additionOrder: 1 },
        ],
        weeks: 1,
        startDate: '2026-04-29',
        selectedStudyDays: ['Mon', 'Wed', 'Sat'],
        weekdayHours: 4,
        weekendHours: 6,
      },
      run: () =>
        generateRoadmap({
          materials: [
            { id: 'ddia', title: 'DDIA', totalMinutes: 200, role: 'anchor', additionOrder: 0 },
            { id: 'cap', title: 'CAP', totalMinutes: 100, role: 'foundation', additionOrder: 1 },
          ],
          weeks: 1,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed', 'Sat'],
          weekdayHours: 4,
          weekendHours: 6,
        }),
    },
    {
      name: 'snapshot-n2-short-prep',
      fn: 'generateRoadmap',
      input: {
        materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 300, role: 'anchor', additionOrder: 0 }],
        weeks: 2,
        startDate: '2026-04-29',
        selectedStudyDays: ['Mon', 'Wed'],
        weekdayHours: 2,
        weekendHours: 0,
      },
      run: () =>
        generateRoadmap({
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 300, role: 'anchor', additionOrder: 0 }],
          weeks: 2,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }),
    },
    {
      name: 'snapshot-over-capacity',
      fn: 'generateRoadmap',
      input: {
        materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 3000, role: 'anchor', additionOrder: 0 }],
        weeks: 2,
        startDate: '2026-04-29',
        selectedStudyDays: ['Mon', 'Wed'],
        weekdayHours: 1,
        weekendHours: 0,
      },
      run: () =>
        generateRoadmap({
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 3000, role: 'anchor', additionOrder: 0 }],
          weeks: 2,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 1,
          weekendHours: 0,
        }),
    },
    {
      name: 'snapshot-under-capacity-buffer',
      fn: 'generateRoadmap',
      input: {
        materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 60, role: 'anchor', additionOrder: 0 }],
        weeks: 4,
        startDate: '2026-04-29',
        selectedStudyDays: ['Mon', 'Wed'],
        weekdayHours: 2,
        weekendHours: 0,
      },
      run: () =>
        generateRoadmap({
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 60, role: 'anchor', additionOrder: 0 }],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }),
    },
    {
      name: 'snapshot-regenerate-with-pins',
      fn: 'regenerateRoadmap',
      input: (() => {
        const input: RoadmapInput = {
          materials: [
            { id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 },
            { id: 'cap', title: 'CAP', totalMinutes: 200, role: 'foundation', additionOrder: 1 },
          ],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const pins: Pin[] = [
          {
            weekIndex: 0,
            dayOfWeek: 'Mon',
            materialId: 'ddia',
            sessionTitle: 'DDIA · session 1',
            plannedMinutes: 60,
            reason: 'completed',
          },
        ]
        return { input, pins }
      })(),
      run: () => {
        const input: RoadmapInput = {
          materials: [
            { id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 },
            { id: 'cap', title: 'CAP', totalMinutes: 200, role: 'foundation', additionOrder: 1 },
          ],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const pins: Pin[] = [
          {
            weekIndex: 0,
            dayOfWeek: 'Mon',
            materialId: 'ddia',
            sessionTitle: 'DDIA · session 1',
            plannedMinutes: 60,
            reason: 'completed',
          },
        ]
        return regenerateRoadmap(input, pins)
      },
    },
    {
      name: 'snapshot-add-material-rest-days',
      fn: 'addMaterialToRoadmap',
      input: (() => {
        const input: RoadmapInput = {
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 180, role: 'anchor', additionOrder: 0 }],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const roadmap = generateRoadmap(input)
        const newMaterial: Material = {
          id: 'cap',
          title: 'CAP',
          totalMinutes: 60,
          role: 'foundation',
          additionOrder: 1,
        }
        return { roadmap, newMaterial, pins: [] }
      })(),
      run: () => {
        const input: RoadmapInput = {
          materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 180, role: 'anchor', additionOrder: 0 }],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const roadmap = generateRoadmap(input)
        const newMaterial: Material = {
          id: 'cap',
          title: 'CAP',
          totalMinutes: 60,
          role: 'foundation',
          additionOrder: 1,
        }
        return addMaterialToRoadmap(roadmap, newMaterial, [])
      },
    },
    {
      name: 'snapshot-remove-material',
      fn: 'removeMaterialFromRoadmap',
      input: (() => {
        const input: RoadmapInput = {
          materials: [
            { id: 'ddia', title: 'DDIA', totalMinutes: 180, role: 'anchor', additionOrder: 0 },
            { id: 'cap', title: 'CAP', totalMinutes: 60, role: 'foundation', additionOrder: 1 },
          ],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const roadmap = generateRoadmap(input)
        return { roadmap, materialId: 'cap', pins: [] }
      })(),
      run: () => {
        const input: RoadmapInput = {
          materials: [
            { id: 'ddia', title: 'DDIA', totalMinutes: 180, role: 'anchor', additionOrder: 0 },
            { id: 'cap', title: 'CAP', totalMinutes: 60, role: 'foundation', additionOrder: 1 },
          ],
          weeks: 4,
          startDate: '2026-04-29',
          selectedStudyDays: ['Mon', 'Wed'],
          weekdayHours: 2,
          weekendHours: 0,
        }
        const roadmap = generateRoadmap(input)
        return removeMaterialFromRoadmap(roadmap, 'cap', [])
      },
    },
  ]
}
