import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BurnUpData } from '@study-tracker/progress'
import {
  BurnUpChart,
  buildBurnUpDateDomain,
  buildBurnUpYDomainMax,
  buildMinuteTickValues,
  hasMeaningfulBurnUpData,
  minutesToLabel,
} from './BurnUpChart'

function makeBurnUpData(overrides: Partial<BurnUpData> = {}): BurnUpData {
  return {
    planned: [],
    actual: [],
    gpCurve: [],
    today: '2026-07-08',
    startDate: '2026-07-06',
    deadline: '2026-07-12',
    deficit: 0,
    dayNumber: 2,
    totalDays: 6,
    ...overrides,
  }
}

describe('BurnUpChart helpers', () => {
  it('formats minute labels without collapsing low ranges', () => {
    expect(minutesToLabel(45)).toBe('45m')
    expect(minutesToLabel(90)).toBe('1h 30m')
    expect(minutesToLabel(120)).toBe('2h')
  })

  it('builds unique minute tick values for low ranges', () => {
    const values = buildMinuteTickValues(90)
    const labels = values.map(minutesToLabel)

    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toEqual(['0m', '30m', '1h', '1h 30m'])
  })

  it('keeps high-range minute tick labels sparse enough to read', () => {
    const values = buildMinuteTickValues(3480)
    const labels = values.map(minutesToLabel)

    expect(new Set(labels).size).toBe(labels.length)
    expect(labels.length).toBeLessThanOrEqual(8)
    expect(labels[labels.length - 1]).toBe('58h')
  })

  it('keeps explicit roadmap dates in the x-domain when chart data is sparse', () => {
    const domain = buildBurnUpDateDomain(
      {
        today: '2026-07-08',
        startDate: '2026-07-06',
        deadline: '2026-07-12',
        dayNumber: 2,
        totalDays: 6,
      },
      [new Date('2026-07-08T00:00:00.000Z')],
    )

    expect(domain[0].toISOString().slice(0, 10)).toBe('2026-07-06')
    expect(domain[1].toISOString().slice(0, 10)).toBe('2026-07-12')
  })

  it('derives a non-degenerate x-domain when explicit hints are missing', () => {
    const domain = buildBurnUpDateDomain(
      {
        today: '2026-07-08',
        dayNumber: 2,
        totalDays: 6,
      },
      [],
    )

    expect(domain[0].getTime()).toBeLessThan(domain[1].getTime())
  })

  it('bounds inflated GP upper values so they do not flatten the chart', () => {
    const max = buildBurnUpYDomainMax({
      planned: [0, 120, 240],
      actual: [0, 90, 180],
      gpMean: [0, 100, 220],
      gpUpper: [0, 2000],
    })

    expect(max).toBeGreaterThan(240)
    expect(max).toBeLessThan(400)
  })

  it('distinguishes empty chart data from meaningful plan or actual data', () => {
    expect(hasMeaningfulBurnUpData([], [])).toBe(false)
    expect(hasMeaningfulBurnUpData([{ date: '2026-07-06', minutes: 0 }], [])).toBe(false)
    expect(hasMeaningfulBurnUpData([{ date: '2026-07-06', minutes: 30 }], [])).toBe(true)
    expect(hasMeaningfulBurnUpData([], [{ date: '2026-07-06', minutes: 0 }])).toBe(true)
  })
})

describe('BurnUpChart', () => {
  it('renders an empty state before responsive SVG layout is needed', () => {
    render(<BurnUpChart data={makeBurnUpData()} />)

    expect(screen.getByText('Log a session to see your burn-up')).toBeInTheDocument()
  })
})
