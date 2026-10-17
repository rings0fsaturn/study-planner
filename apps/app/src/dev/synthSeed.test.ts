import { describe, expect, it } from 'vitest'
import { ARCHETYPES, buildSynthHistory, countAnalyzable } from './synthSeed'

describe('buildSynthHistory', () => {
  it('steady: 20 bookings, past ones logged, order contract holds', () => {
    const events = buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
    const kinds = events.map((e) => e.kind)
    expect(kinds.indexOf('MaterialAdded')).toBeLessThan(kinds.indexOf('RoadmapCreated'))
    expect(kinds.indexOf('RoadmapCreated')).toBeLessThan(kinds.indexOf('SessionBooked'))
    expect(events.filter((e) => e.kind === 'SessionBooked')).toHaveLength(20)
    expect(countAnalyzable(events).logged).toBeGreaterThanOrEqual(15)
  })
  it('returning: gap weeks produce no logged sessions', () => {
    const events = buildSynthHistory('returning', ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
    const logged = events.filter((e) => e.kind === 'SessionLogged')
    expect(logged.length).toBeLessThan(15)
  })
  it('event order is non-decreasing in createdAt', () => {
    for (const key of Object.keys(ARCHETYPES) as Array<keyof typeof ARCHETYPES>) {
      const events = buildSynthHistory(key, ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
      const times = events.map((e) => new Date(e.createdAt).getTime())
      expect([...times].sort((a, b) => a - b)).toEqual(times)
    }
  })
  it('emits zero graded events and no attempted pointers (live grades only, D-07)', () => {
    for (const key of Object.keys(ARCHETYPES) as Array<keyof typeof ARCHETYPES>) {
      const events = buildSynthHistory(key, ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
      expect(countAnalyzable(events).graded).toBe(0)
      expect(events.some((e) => e.kind === 'QuestionAttempted')).toBe(false)
    }
  })
  it('emits one run pair per non-gap week', () => {
    const steady = buildSynthHistory('steady', ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
    expect(steady.filter((e) => e.kind === 'PracticeRunStarted')).toHaveLength(5)
    expect(countAnalyzable(steady).runs).toBe(5)
    const returning = buildSynthHistory('returning', ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
    expect(returning.filter((e) => e.kind === 'PracticeRunStarted')).toHaveLength(3)
    expect(countAnalyzable(returning).runs).toBe(3)
  })
  it('struggling: one RoadmapReplanned with increase-hours back-pointer after week 3', () => {
    const events = buildSynthHistory('struggling', ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
    const replans = events.filter((e) => e.kind === 'RoadmapReplanned')
    expect(replans).toHaveLength(1)
    const created = events.find((e) => e.kind === 'RoadmapCreated')
    const payload = replans[0].payload as unknown as { roadmapCreatedAt: string; option: string }
    expect(payload.roadmapCreatedAt).toBe(created?.createdAt)
    expect(payload.option).toBe('increase-hours')
    expect(new Date(replans[0].createdAt).getHours()).toBe(22)
    const finishes = events
      .filter((e) => e.kind === 'PracticeRunFinished' && e.createdAt < replans[0].createdAt)
      .map((e) => new Date(e.createdAt).getTime())
    expect(new Date(replans[0].createdAt).getTime() - Math.max(...finishes)).toBe(3_600_000)
  })
  it('returning: one RoadmapReplanned with extend-deadline back-pointer after gap weeks', () => {
    const events = buildSynthHistory('returning', ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
    const replans = events.filter((e) => e.kind === 'RoadmapReplanned')
    expect(replans).toHaveLength(1)
    const created = events.find((e) => e.kind === 'RoadmapCreated')
    const payload = replans[0].payload as unknown as { roadmapCreatedAt: string; option: string }
    expect(payload.roadmapCreatedAt).toBe(created?.createdAt)
    expect(payload.option).toBe('extend-deadline')
  })
  it('steady and crammer emit no RoadmapReplanned', () => {
    for (const key of ['steady', 'crammer'] as const) {
      const events = buildSynthHistory(key, ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
      expect(events.filter((e) => e.kind === 'RoadmapReplanned')).toHaveLength(0)
    }
  })
  it('replan is additive: other kind counts match the locked study-half shape', () => {
    const struggling = buildSynthHistory('struggling', ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
    expect(struggling.filter((e) => e.kind === 'SessionBooked')).toHaveLength(20)
    expect(countAnalyzable(struggling).logged).toBe(10)
    expect(countAnalyzable(struggling).runs).toBe(5)
    const returning = buildSynthHistory('returning', ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-09-14T12:00:00Z'))
    expect(returning.filter((e) => e.kind === 'SessionBooked')).toHaveLength(20)
    expect(countAnalyzable(returning).runs).toBe(3)
  })
  it('replan is past-gated: no RoadmapReplanned when the replan week is still future', () => {
    for (const key of ['struggling', 'returning'] as const) {
      const events = buildSynthHistory(key, ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-08-20T12:00:00Z'))
      expect(events.filter((e) => e.kind === 'RoadmapReplanned')).toHaveLength(0)
    }
  })
  it('replan boundary: anchor-date today emits nothing (strict past gate)', () => {
    for (const key of ['struggling', 'returning'] as const) {
      const events = buildSynthHistory(key, ['m1', 'm2', 'm3'], '2026-08-10', new Date('2026-08-29T12:00:00Z'))
      expect(events.filter((e) => e.kind === 'RoadmapReplanned')).toHaveLength(0)
    }
  })
})
