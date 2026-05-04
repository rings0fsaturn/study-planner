import { generateRoadmap } from './roadmap-engine'

const result = generateRoadmap({
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
})

console.log('=== Session Titles ===')
for (const week of result.weeks) {
  for (const slot of week.slots) {
    console.log(`Week ${week.weekIndex} ${slot.dayOfWeek}:`, {
      role: slot.role,
      title: slot.sessionTitle,
      titleType: typeof slot.sessionTitle,
      candidates: slot.candidateMaterialIds,
      planned: slot.plannedMinutes
    })
  }
}
