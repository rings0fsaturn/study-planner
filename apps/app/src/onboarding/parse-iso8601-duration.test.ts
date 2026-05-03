import { describe, it, expect } from 'vitest'

// Test the duration parsing logic that lives in the Edge Function
// Duplicated here as a pure function test since we can't run Deno tests in CI yet
function parseISO8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 60 + minutes + Math.ceil(seconds / 60)
}

describe('parseISO8601Duration', () => {
  it('parses hours, minutes, seconds', () => {
    expect(parseISO8601Duration('PT1H2M3S')).toBe(63) // 60 + 2 + ceil(3/60)
  })

  it('parses minutes only', () => {
    expect(parseISO8601Duration('PT15M')).toBe(15)
  })

  it('parses hours only', () => {
    expect(parseISO8601Duration('PT2H')).toBe(120)
  })

  it('parses seconds only and rounds up', () => {
    expect(parseISO8601Duration('PT45S')).toBe(1)
  })

  it('parses hours and minutes', () => {
    expect(parseISO8601Duration('PT1H30M')).toBe(90)
  })

  it('returns 0 for invalid format', () => {
    expect(parseISO8601Duration('not-a-duration')).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(parseISO8601Duration('')).toBe(0)
  })

  it('handles zero seconds correctly', () => {
    expect(parseISO8601Duration('PT10M0S')).toBe(10)
  })
})
