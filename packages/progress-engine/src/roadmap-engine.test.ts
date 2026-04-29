import { describe, it, expect } from 'vitest'
import { generateRoadmap, inferRole, addMaterialToRoadmap, removeMaterialFromRoadmap, regenerateRoadmap } from './roadmap-engine'
import type { RoadmapInput, Material } from './roadmap-engine'

describe('generateRoadmap', () => {
  const canonicalInput: RoadmapInput = {
    materials: [
      { id: 'ddia', title: 'Designing Data-Intensive Applications', totalMinutes: 600, role: 'anchor', additionOrder: 0 },
      { id: 'cap', title: 'CAP theorem', totalMinutes: 200, role: 'foundation', additionOrder: 1 },
      { id: 'mocks', title: 'Mock interviews', totalMinutes: 300, role: 'practice', additionOrder: 2 },
    ],
    weeks: 8,
    startDate: '2026-04-29',
    selectedStudyDays: ['Mon', 'Wed', 'Sat'],
    weekdayHours: 2,
    weekendHours: 3,
  }

  it('generates a roadmap with correct week count', () => {
    const result = generateRoadmap(canonicalInput)
    expect(result.weeks).toHaveLength(8)
  })

  it('generates correct number of slots per week', () => {
    const result = generateRoadmap(canonicalInput)
    for (const week of result.weeks) {
      expect(week.slots).toHaveLength(3) // Mon, Wed, Sat
    }
  })

  it('computes capacity correctly for canonical input', () => {
    const result = generateRoadmap(canonicalInput)
    // weekdayPerSlot = 2h * 60 / 2 days = 60 min
    // weekendPerSlot = 3h * 60 / 1 day = 180 min
    const totalCapacity = 8 * (60 + 60 + 180) // 2400 min
    expect(result.capacityCheck.totalCapacityMinutes).toBe(totalCapacity)
    expect(result.capacityCheck.totalMaterialMinutes).toBe(1100)
  })

  it('capacityCheck status is under-capacity-buffer for canonical', () => {
    const result = generateRoadmap(canonicalInput)
    expect(result.capacityCheck.status).toBe('under-capacity-buffer')
    expect(result.capacityCheck.suggestedWeeks).toBe(4)
  })

  it('assigns foundation slots in early weeks', () => {
    const result = generateRoadmap(canonicalInput)
    const week0 = result.weeks[0]
    const foundationSlots = week0.slots.filter(s => s.role === 'foundation')
    expect(foundationSlots.length).toBeGreaterThan(0)
  })

  it('assigns anchor slots to Saturdays until material exhausted', () => {
    const result = generateRoadmap(canonicalInput)
    // Anchor material (DDIA, 600m) gets ~4 Saturday slots (180+180+180+60)
    // So first 4 weeks have anchor on Sat, remaining may be rest days
    const anchorSatSlots = result.weeks.filter(w => 
      w.slots.find(s => s.dayOfWeek === 'Sat')?.role === 'anchor'
    )
    expect(anchorSatSlots.length).toBeGreaterThan(0)
    
    // All anchor slots should be on Saturdays (the largest-capacity day)
    for (const week of result.weeks) {
      const satSlot = week.slots.find(s => s.dayOfWeek === 'Sat')
      if (satSlot?.role === 'anchor') {
        expect(satSlot.candidateMaterialIds).toContain('ddia')
      }
    }
  })

  it('assigns practice slots in late weeks (weeks 2-4)', () => {
    const result = generateRoadmap(canonicalInput)
    // Practice slots should appear in weeks 2-4, not necessarily week 7
    const week2 = result.weeks[2]
    const week3 = result.weeks[3]
    const week4 = result.weeks[4]
    const practiceSlots = [
      ...week2.slots.filter(s => s.role === 'practice'),
      ...week3.slots.filter(s => s.role === 'practice'),
      ...week4.slots.filter(s => s.role === 'practice'),
    ]
    expect(practiceSlots.length).toBeGreaterThan(0)
  })

  it('produces session titles with X of Y format', () => {
    const result = generateRoadmap(canonicalInput)
    const allSlots = result.weeks.flatMap(w => w.slots)
    const assignedSlots = allSlots.filter(s => s.candidateMaterialIds.length === 1)
    
    // Find problematic slots
    const noTitle = assignedSlots.filter(s => !s.sessionTitle)
    if (noTitle.length > 0) {
      console.log('Slots without title:', noTitle.map(s => `${s.weekIndex}:${s.dayOfWeek} candidates=${s.candidateMaterialIds.join(',')}`))
    }
    
    // Should have assigned slots
    expect(assignedSlots.length).toBeGreaterThan(0)
    expect(noTitle.length).toBe(0) // All should have titles
    
    // Each should have a session title that's a string
    for (const slot of assignedSlots) {
      expect(typeof slot.sessionTitle).toBe('string')
      expect(slot.sessionTitle).toMatch(/session \d+ of \d+/)
    }
  })

  it('DDIA is allocated exactly 600 min via partial-slot filling', () => {
    const result = generateRoadmap(canonicalInput)
    const ddiaSlots = result.weeks.flatMap(w => w.slots).filter(s => s.candidateMaterialIds.includes('ddia'))
    const totalAllocated = ddiaSlots.reduce((sum, s) => sum + s.plannedMinutes, 0)
    expect(totalAllocated).toBe(600)
    // No overfill warning because partial-slot filling prevents it
    const overfilled = result.warnings.find(w => w.kind === 'material-overfilled')
    expect(overfilled).toBeUndefined()
  })
})

describe('inferRole', () => {
  it('returns practice for mock interviews', () => {
    expect(inferRole('Mock interviews', 300, [])).toBe('practice')
  })

  it('returns practice for leetcode', () => {
    expect(inferRole('LeetCode patterns', 600, [])).toBe('practice')
  })

  it('returns anchor for largest material', () => {
    const existing: Material[] = [{ id: 'x', title: 'X', totalMinutes: 100, role: 'anchor', additionOrder: 0 }]
    expect(inferRole('DDIA', 600, existing)).toBe('anchor')
  })

  it('returns foundation for smaller than anchor', () => {
    const existing: Material[] = [{ id: 'x', title: 'X', totalMinutes: 600, role: 'anchor', additionOrder: 0 }]
    expect(inferRole('CAP', 200, existing)).toBe('foundation')
  })
})

describe('addMaterialToRoadmap', () => {
  it('adds material to rest-day slots only', () => {
    // Use smaller material that fits, leaving rest-day slots
    const input: RoadmapInput = {
      materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 180, role: 'anchor', additionOrder: 0 }],
      weeks: 4,
      startDate: '2026-04-29',
      selectedStudyDays: ['Mon', 'Wed'],
      weekdayHours: 2,
      weekendHours: 0,
    }
    const roadmap = generateRoadmap(input)
    const newMaterial: Material = { id: 'cap', title: 'CAP', totalMinutes: 60, role: 'foundation', additionOrder: 1 }
    
    const result = addMaterialToRoadmap(roadmap, newMaterial, [])
    
    // Should find rest-day slots - if over-capacity, there may be none
    const capSlots = result.weeks.flatMap(w => w.slots).filter(s => s.candidateMaterialIds.includes('cap'))
    expect(capSlots.length).toBeGreaterThan(0)
  })

  it('recomputes capacityCheck after add', () => {
    // Use smaller material that fits, leaving rest-day slots
    const input: RoadmapInput = {
      materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 180, role: 'anchor', additionOrder: 0 }],
      weeks: 4,
      startDate: '2026-04-29',
      selectedStudyDays: ['Mon', 'Wed'],
      weekdayHours: 2,
      weekendHours: 0,
    }
    const roadmap = generateRoadmap(input)
    const newMaterial: Material = { id: 'cap', title: 'CAP', totalMinutes: 60, role: 'foundation', additionOrder: 1 }
    
    const result = addMaterialToRoadmap(roadmap, newMaterial, [])
    
    expect(result.capacityCheck.totalMaterialMinutes).toBe(240)
  })
})

describe('removeMaterialFromRoadmap', () => {
  it('removes material from non-pinned slots', () => {
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
    
    const result = removeMaterialFromRoadmap(roadmap, 'cap', [])
    
    const capSlots = result.weeks.flatMap(w => w.slots).filter(s => s.candidateMaterialIds.includes('cap'))
    expect(capSlots.length).toBe(0)
  })
})

describe('regenerateRoadmap', () => {
  it('preserves pinned slots', () => {
    const input: RoadmapInput = {
      materials: [{ id: 'ddia', title: 'DDIA', totalMinutes: 600, role: 'anchor', additionOrder: 0 }],
      weeks: 4,
      startDate: '2026-04-29',
      selectedStudyDays: ['Mon', 'Wed'],
      weekdayHours: 2,
      weekendHours: 0,
    }
    
    const pins: import('./roadmap-engine').Pin[] = [
      { weekIndex: 0, dayOfWeek: 'Mon', materialId: 'ddia', sessionTitle: 'DDIA · session 1', plannedMinutes: 120, reason: 'completed' },
    ]
    
    const result = regenerateRoadmap(input, pins)
    
    const pinnedSlot = result.weeks[0].slots.find(s => s.dayOfWeek === 'Mon')
    expect(pinnedSlot?.candidateMaterialIds).toContain('ddia')
  })
})
