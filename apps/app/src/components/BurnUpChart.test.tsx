import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BurnUpData } from '@study-tracker/progress'
import {
  BurnUpChart,
  BurnUpPlot,
  buildCheckpointSummary,
  buildBurnUpDateDomain,
  buildBurnUpYDomainMax,
  buildMinuteTickValues,
  buildProgressLabDateDomain,
  buildXAxisTicks,
  clipPlannedPoints,
  clipScenarioPoints,
  hasMeaningfulBurnUpData,
  interpolateGPMean,
  interpolateLinearMinutes,
  interpolateStepMinutes,
  minutesToLabel,
  plannedMinutesAtDate,
  resolveLayerVisibility,
} from './BurnUpChart'

vi.mock('@visx/responsive', () => ({
  ParentSize: ({ children }: { children: (size: { width: number; height: number }) => unknown }) =>
    children({ width: 800, height: 400 }),
}))

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

  it('extends only the full-plan domain past supplied finish dates', () => {
    const data = makeBurnUpData({
      startDate: '2026-07-01',
      deadline: '2026-08-31',
      today: '2026-07-18',
    })
    const finishes = {
      deadlineISO: '2026-09-02',
      forecastFinishISO: '2026-09-07',
      scenarioFinishISO: '2026-09-05',
    }

    const full = buildProgressLabDateDomain(
      data,
      'full',
      '2026-07-18',
      '2026-07-13',
      '2026-07-19',
      finishes,
    )
    const month = buildProgressLabDateDomain(
      data,
      'month',
      '2026-07-18',
      '2026-07-13',
      '2026-07-19',
      finishes,
    )
    const week = buildProgressLabDateDomain(
      data,
      'week',
      '2026-07-18',
      '2026-07-13',
      '2026-07-19',
      finishes,
    )

    expect(full.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-07-01', '2026-09-10'])
    expect(month.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-07-11', '2026-08-09'])
    expect(week.map((date) => date.toISOString().slice(0, 10))).toEqual(['2026-07-13', '2026-07-19'])
  })

  it('stops planned and scenario trajectories at their supplied completion', () => {
    const domain: [Date, Date] = [
      new Date('2026-07-01T00:00:00.000Z'),
      new Date('2026-07-15T00:00:00.000Z'),
    ]
    const planned = clipPlannedPoints([
      { date: '2026-07-01', minutes: 0 },
      { date: '2026-07-05', minutes: 120 },
      { date: '2026-07-10', minutes: 240 },
      { date: '2026-07-12', minutes: 300 },
    ], domain, 240)
    const scenario = clipScenarioPoints([
      { date: '2026-07-05', minutes: 90 },
      { date: '2026-07-08', minutes: 180 },
      { date: '2026-07-10', minutes: 260 },
      { date: '2026-07-12', minutes: 300 },
    ], domain, '2026-07-10', 240)

    expect(planned).toEqual([
      { date: '2026-07-01', minutes: 0 },
      { date: '2026-07-05', minutes: 120 },
      { date: '2026-07-10', minutes: 240 },
    ])
    expect(scenario).toEqual([
      { date: '2026-07-05', minutes: 90 },
      { date: '2026-07-08', minutes: 180 },
      { date: '2026-07-10', minutes: 240 },
    ])
  })

  it('uses step and linear interpolation with explicit availability bounds', () => {
    const cumulative = [
      { date: '2026-07-01', minutes: 60 },
      { date: '2026-07-05', minutes: 180 },
    ]
    const gpCurve = [
      { date: '2026-07-05', mean: 180, lower: 150, upper: 210 },
      { date: '2026-07-09', mean: 300, lower: 240, upper: 360 },
    ]

    expect(interpolateStepMinutes(cumulative, '2026-07-03')).toBe(60)
    expect(interpolateStepMinutes(cumulative, '2026-06-30')).toBeNull()
    expect(interpolateStepMinutes(cumulative, '2026-07-06')).toBeNull()
    expect(interpolateLinearMinutes(cumulative, '2026-07-03')).toBe(120)
    expect(interpolateLinearMinutes(cumulative, '2026-07-05', '2026-07-04')).toBeNull()
    expect(interpolateGPMean(gpCurve, '2026-07-07')).toBe(240)
    expect(interpolateGPMean(gpCurve, '2026-07-10')).toBeNull()
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

describe('BurnUpPlot finish indicators', () => {
  const plottedData = makeBurnUpData({
    startDate: '2026-07-01',
    deadline: '2026-07-12',
    today: '2026-07-08',
    planned: [
      { date: '2026-07-01', minutes: 0 },
      { date: '2026-07-12', minutes: 240 },
      { date: '2026-07-15', minutes: 300 },
    ],
    actual: [
      { date: '2026-07-01', minutes: 0 },
      { date: '2026-07-08', minutes: 100 },
    ],
    gpCurve: [
      { date: '2026-07-08', mean: 100, lower: 80, upper: 120 },
      { date: '2026-07-13', mean: 220, lower: 170, upper: 270 },
    ],
  })

  it('renders a safe goal line, dated flags, connector, and clipped scenario', () => {
    render(
      <BurnUpPlot
        data={plottedData}
        deadlineISO="2026-07-12"
        forecastFinishISO="2026-07-14"
        scenarioFinishISO="2026-07-16"
        totalPlannedMinutes={240}
        scenarioPoints={[
          { date: '2026-07-08', minutes: 100 },
          { date: '2026-07-14', minutes: 210 },
          { date: '2026-07-16', minutes: 240 },
          { date: '2026-07-18', minutes: 300 },
        ]}
      />,
    )

    expect(screen.getByTestId('burn-up-done-zone')).toBeInTheDocument()
    expect(screen.getByTestId('burn-up-goal-line')).toHaveTextContent('PLAN COMPLETE · 4h')
    expect(screen.getByTestId('forecast-finish-connector')).toBeInTheDocument()

    const plan = screen.getByTestId('finish-flag-plan')
    const forecast = screen.getByTestId('finish-flag-forecast')
    const scenario = screen.getByTestId('finish-flag-scenario')
    expect(plan).toHaveTextContent('Plan · Jul 12')
    expect(forecast).toHaveTextContent('Forecast · Jul 14')
    expect(scenario).toHaveTextContent('Your pace · Jul 16')

    const flagX = (flag: HTMLElement) => Number(flag.querySelector('circle')?.getAttribute('cx'))
    expect(flagX(plan)).toBeLessThan(flagX(forecast))
    expect(flagX(forecast)).toBeLessThan(flagX(scenario))
    expect(screen.getByTestId('capacity-scenario-line')).toHaveAttribute('data-finish-date', '2026-07-16')
  })

  it('hides goal and finish decorations when required values are missing or invalid', () => {
    render(
      <BurnUpPlot
        data={plottedData}
        deadlineISO="not-a-date"
        forecastFinishISO="2026-07-14"
        totalPlannedMinutes={-1}
      />,
    )

    expect(screen.queryByTestId('burn-up-done-zone')).not.toBeInTheDocument()
    expect(screen.queryByTestId('burn-up-goal-line')).not.toBeInTheDocument()
    expect(screen.queryByTestId('finish-flag-plan')).not.toBeInTheDocument()
    expect(screen.queryByTestId('finish-flag-forecast')).not.toBeInTheDocument()
  })

  it('shows coordinate guides and future line values on blank-chart hover, then clears them', () => {
    const onCheckpointSelect = vi.fn()
    render(
      <BurnUpPlot
        data={plottedData}
        deadlineISO="2026-07-12"
        forecastFinishISO="2026-07-14"
        scenarioFinishISO="2026-07-16"
        totalPlannedMinutes={240}
        onCheckpointSelect={onCheckpointSelect}
        scenarioPoints={[
          { date: '2026-07-08', minutes: 100 },
          { date: '2026-07-14', minutes: 210 },
          { date: '2026-07-16', minutes: 240 },
        ]}
      />,
    )

    const svg = screen.getByLabelText('Hours studied versus plan')
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 400,
      width: 800,
      height: 400,
      toJSON: () => ({}),
    })
    const hitArea = screen.getByTestId('crosshair-hit-area')
    const checkpoint = screen.getByTestId('checkpoint-2026-07-08')
    expect(hitArea).toHaveStyle({ pointerEvents: 'all' })
    expect(hitArea.compareDocumentPosition(checkpoint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.mouseMove(hitArea, { clientX: 419, clientY: 150 })

    expect(screen.getByTestId('crosshair-guides')).toBeInTheDocument()
    expect(screen.getByTestId('crosshair-date-pill')).toHaveTextContent('Jul 10')
    expect(screen.getByTestId('crosshair-hours-pill')).toBeInTheDocument()
    const readout = screen.getByTestId('crosshair-readout')
    expect(readout).toHaveTextContent('GP forecast')
    expect(readout).toHaveTextContent('Your pace')
    expect(readout).not.toHaveTextContent('Actual')
    expect(screen.getByTestId('crosshair-dot-gp')).toBeInTheDocument()
    expect(screen.getByTestId('crosshair-dot-scenario')).toBeInTheDocument()
    expect(screen.queryByTestId('crosshair-dot-actual')).not.toBeInTheDocument()

    fireEvent.keyDown(checkpoint, { key: 'Enter' })
    expect(onCheckpointSelect).toHaveBeenCalledWith('2026-07-08')

    fireEvent.mouseLeave(svg)
    expect(screen.queryByTestId('crosshair-guides')).not.toBeInTheDocument()
    expect(screen.queryByTestId('crosshair-readout')).not.toBeInTheDocument()
  })

  it('omits the scenario readout and dot when no pace scenario is active', () => {
    render(
      <BurnUpPlot
        data={plottedData}
        deadlineISO="2026-07-12"
        forecastFinishISO="2026-07-14"
        totalPlannedMinutes={240}
      />,
    )

    const svg = screen.getByLabelText('Hours studied versus plan')
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 400,
      width: 800,
      height: 400,
      toJSON: () => ({}),
    })
    fireEvent.mouseMove(screen.getByTestId('crosshair-hit-area'), { clientX: 374, clientY: 150 })

    const readout = screen.getByTestId('crosshair-readout')
    expect(readout).toHaveTextContent('Actual')
    expect(readout).toHaveTextContent('GP forecast')
    expect(readout).not.toHaveTextContent('Your pace')
    expect(screen.queryByTestId('crosshair-dot-scenario')).not.toBeInTheDocument()
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
    expect(screen.getByText('GP forecast')).toBeInTheDocument()
    expect(screen.getByText('Your pace')).toBeInTheDocument()

    fireEvent.click(opener)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
