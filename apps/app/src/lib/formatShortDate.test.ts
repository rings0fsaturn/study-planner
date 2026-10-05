import { describe, expect, it } from 'vitest'
import { formatShortDate } from './formatShortDate'

describe('formatShortDate', () => {
  it('renders month and day', () => {
    expect(formatShortDate('2026-09-12T10:00:00Z')).toBe('Sep 12')
  })

  it('returns the input for unparseable dates', () => {
    expect(formatShortDate('not-a-date')).toBe('not-a-date')
  })
})
