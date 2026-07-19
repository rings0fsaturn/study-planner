import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BurnUpData } from '@study-tracker/progress'
import {
  BurnUpChart,
  buildCheckpointSummary,
  buildBurnUpDateDomain,
  buildBurnUpYDomainMax,
  buildMinuteTickValues,
  buildProgressLabDateDomain,
  buildXAxisTicks,
  hasMeaningfulBurnUpData,
  minutesToLabel,
  plannedMinutesAtDate,
  resolveLayerVisibility,
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

  it('builds clamped full, 30-day, and selected-week domains', () => {
    const data = makeBurnUpData({
      startDate: '2026-07-01',
      deadline: '2026-08-31',
      today: '2026-07-18',
    })

    const full = buildProgressLabDateDomain(data, 'full', '2026-07-18', '2026-07-13', '2026-07-19')
    const month = buildProgressLabDateDomain(data, 'month', '2026-07-18', '2026-07-13', '2026-07-19')
    const week = buildProgressLabDateDomain(data, 'week', '2026-07-18', '2026-07-13', '2026-07-19')

    expect(full.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-07-01', '2026-08-31'])
    expect(month.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-07-11', '2026-08-09'])
    expect(week.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-07-13', '2026-07-19'])
  })

  it('gives every visible checkpoint a deterministic tick and reduces compact long-range labels', () => {
    const actual = [
      { date: '2026-07-01', minutes: 0 },
      { date: '2026-07-03', minutes: 60 },
      { date: '2026-07-05', minutes: 120 },
      { date: '2026-07-06', minutes: 150 },
    ]
    const domain: [Date, Date] = [
      new Date('2026-07-01T00:00:00.000Z'),
      new Date('2026-08-31T00:00:00.000Z'),
    ]

    const wide = buildXAxisTicks(actual, domain, 'full', 900)
    const compact = buildXAxisTicks(actual, domain, 'full', 520)
    const week = buildXAxisTicks(actual, domain, 'week', 390)

    expect(wide.filter((tick) => tick.isObserved)).toHaveLength(4)
    expect(wide.filter((tick) => tick.isObserved && tick.showLabel)).toHaveLength(4)
    expect(compact.filter((tick) => tick.isObserved)).toHaveLength(4)
    expect(compact.filter((tick) => tick.isObserved && tick.showLabel).map((tick) => tick.dateISO)).toEqual([
      '2026-07-01',
      '2026-07-06',
    ])
    expect(week.filter((tick) => tick.isObserved && tick.showLabel)).toHaveLength(4)

    const adjacentAnchorTicks = buildXAxisTicks(
      actual,
      [new Date('2026-06-30T00:00:00.000Z'), domain[1]],
      'full',
      900,
    )
    expect(adjacentAnchorTicks.find((tick) => tick.dateISO === '2026-06-30')?.showLabel).toBe(false)
  })

  it('interpolates the planned staircase and builds a signed checkpoint summary', () => {
    const planned = [
      { date: '2026-07-01', minutes: 60 },
      { date: '2026-07-04', minutes: 180 },
      { date: '2026-07-08', minutes: 300 },
    ]
    const actual = [
      { date: '2026-07-01', minutes: 30 },
      { date: '2026-07-05', minutes: 150 },
    ]

    expect(plannedMinutesAtDate(planned, '2026-07-05')).toBe(180)
    expect(plannedMinutesAtDate(planned, '2026-06-30')).toBe(0)

    const summary = buildCheckpointSummary(actual, planned, '2026-07-05')
    expect(summary).toMatchObject({
      dateISO: '2026-07-05',
      actualMinutes: 150,
      plannedMinutes: 180,
      gapMinutes: -30,
      changeMinutes: 120,
    })
    expect(summary?.interpretation).toContain('2h added since the previous checkpoint')
    expect(summary?.interpretation).toContain('30m behind plan')
  })

  it('keeps actual and reference layers visible while optional layers toggle independently', () => {
    expect(resolveLayerVisibility()).toEqual({
      planned: true,
      projection: true,
      confidence: true,
      actual: true,
      reference: true,
    })
    expect(resolveLayerVisibility({ planned: false, confidence: false })).toEqual({
      planned: false,
      projection: true,
      confidence: false,
      actual: true,
      reference: true,
    })
  })
})

describe('BurnUpChart', () => {
  it('renders an empty state before responsive SVG layout is needed', () => {
    render(<BurnUpChart data={makeBurnUpData()} />)

    expect(screen.getByText('Log a session to see your burn-up')).toBeInTheDocument()
  })

  it('exposes the meaningful-data card as a quiet semantic dialog opener', () => {
    const onOpen = vi.fn()
    render(
      <BurnUpChart
        data={makeBurnUpData({
          planned: [
            { date: '2026-07-06', minutes: 60 },
            { date: '2026-07-12', minutes: 240 },
          ],
          actual: [{ date: '2026-07-08', minutes: 90 }],
        })}
        expanded={false}
        onOpen={onOpen}
      />,
    )

    const opener = screen.getByRole('button', { name: 'Open Progress Lab' })
    expect(opener).toHaveAttribute('aria-haspopup', 'dialog')
    expect(opener).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Open Progress Lab')).toBeInTheDocument()

    fireEvent.click(opener)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
