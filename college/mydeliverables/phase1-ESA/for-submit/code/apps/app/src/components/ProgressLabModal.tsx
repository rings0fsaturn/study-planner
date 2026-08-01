import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import type { BurnUpData } from '@study-tracker/progress'
import {
  computeCapacityScenario,
  parsePaceDeltaMinutes,
  type CapacityScenarioInput,
  type PaceDeltaMinutes,
} from '../roadmap/replan/capacityScenario'
import {
  BurnUpPlot,
  buildCheckpointSummary,
  buildProgressLabDateDomain,
  minutesToLabel,
  type OptionalChartLayers,
  type ProgressLabRange,
} from './BurnUpChart'
import './ProgressLabModal.css'

export interface ProgressLabModalProps {
  open: boolean
  onClose: () => void
  data: BurnUpData
  referenceDateISO: string
  referenceLabel: string
  weekStartISO: string
  weekEndISO: string
  historical?: boolean
  openerRef?: RefObject<HTMLButtonElement | null>
  capacityScenarioInput?: Omit<CapacityScenarioInput, 'paceDeltaMinutes'>
  deadlineISO?: string
  forecastFinishISO?: string
  forecastBasis?: 'gp' | 'analytic'
  totalPlannedMinutes?: number
}

const RANGE_OPTIONS: { value: ProgressLabRange; label: string }[] = [
  { value: 'full', label: 'Full plan' },
  { value: 'month', label: '30 days' },
  { value: 'week', label: 'This week' },
]

const LAYER_OPTIONS: { key: keyof OptionalChartLayers; label: string }[] = [
  { key: 'planned', label: 'Planned staircase' },
  { key: 'projection', label: 'GP pace projection' },
  { key: 'confidence', label: 'Confidence band' },
]

function focusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getAttribute('aria-hidden') !== 'true')
}

function signedMinutes(minutes: number): string {
  if (minutes === 0) return '0m'
  return `${minutes > 0 ? '+' : '-'}${minutesToLabel(Math.abs(minutes))}`
}

function rangeLabel(domain: [Date, Date]): string {
  const days = differenceInCalendarDays(domain[1], domain[0]) + 1
  return `${format(domain[0], 'MMM dd')} to ${format(domain[1], 'MMM dd')} · ${days} days`
}

function deficitText(data: BurnUpData, historical: boolean): string {
  if (data.deficit === 0) return historical ? 'On plan at week end' : 'On track'
  const relation = data.deficit < 0 ? 'behind' : 'ahead of'
  const reference = historical ? 'at week end' : 'today'
  return `${signedMinutes(data.deficit)} ${relation} plan ${reference}`
}

function validISODate(dateISO: string | null | undefined): Date | null {
  if (!dateISO) return null
  const date = parseISO(dateISO)
  return isValid(date) ? date : null
}

function formattedFinish(dateISO: string | null | undefined): string | null {
  const date = validISODate(dateISO)
  return date ? format(date, 'MMM d, yyyy') : null
}

function deadlineDifferenceLabel(
  deadlineISO: string | null | undefined,
  finishISO: string | null | undefined,
): string {
  const deadline = validISODate(deadlineISO)
  const finish = validISODate(finishISO)
  if (!deadline || !finish) return 'Deadline comparison unavailable'
  const days = differenceInCalendarDays(deadline, finish)
  if (days === 0) return 'On the deadline'
  const count = Math.abs(days)
  return days > 0
    ? `${count} day${count === 1 ? '' : 's'} early vs deadline`
    : `${count} day${count === 1 ? '' : 's'} late vs deadline`
}

export function ProgressLabModal({
  open,
  onClose,
  data,
  referenceDateISO,
  referenceLabel,
  weekStartISO,
  weekEndISO,
  historical = false,
  openerRef,
  capacityScenarioInput,
  deadlineISO,
  forecastFinishISO,
  forecastBasis,
  totalPlannedMinutes,
}: ProgressLabModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [range, setRange] = useState<ProgressLabRange>('full')
  const [layers, setLayers] = useState<OptionalChartLayers>({
    planned: true,
    projection: true,
    confidence: true,
  })
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null)
  const [paceDeltaMinutes, setPaceDeltaMinutes] = useState<PaceDeltaMinutes>(0)

  const paceScenario = useMemo(
    () => capacityScenarioInput
      ? computeCapacityScenario({ ...capacityScenarioInput, paceDeltaMinutes })
      : null,
    [capacityScenarioInput, paceDeltaMinutes],
  )
  const visibleForecastFinishISO = historical ? undefined : forecastFinishISO
  const scenarioFinishISO = !historical && paceDeltaMinutes > 0
    ? paceScenario?.finishDate ?? undefined
    : undefined
  const dateDomain = useMemo(
    () => buildProgressLabDateDomain(
      data,
      range,
      referenceDateISO,
      weekStartISO,
      weekEndISO,
      { deadlineISO, forecastFinishISO: visibleForecastFinishISO, scenarioFinishISO },
    ),
    [
      data,
      deadlineISO,
      range,
      referenceDateISO,
      scenarioFinishISO,
      visibleForecastFinishISO,
      weekEndISO,
      weekStartISO,
    ],
  )
  const selectedSummary = useMemo(
    () => selectedCheckpoint
      ? buildCheckpointSummary(data.actual, data.planned, selectedCheckpoint)
      : null,
    [data.actual, data.planned, selectedCheckpoint],
  )

  useEffect(() => {
    if (!open) return
    setRange('full')
    setLayers({ planned: true, projection: true, confidence: true })
    setSelectedCheckpoint(null)
    setPaceDeltaMinutes(0)
  }, [open])

  useEffect(() => {
    if (!selectedCheckpoint) return
    const startISO = dateDomain[0].toISOString().slice(0, 10)
    const endISO = dateDomain[1].toISOString().slice(0, 10)
    if (selectedCheckpoint < startISO || selectedCheckpoint > endISO) {
      setSelectedCheckpoint(null)
    }
  }, [dateDomain, selectedCheckpoint])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    const previousOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'

    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus())
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = focusableElements(dialogRef.current)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.overscrollBehavior = previousOverscroll
      openerRef?.current?.focus()
    }
  }, [onClose, open, openerRef])

  if (!open || typeof document === 'undefined') return null

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }
  const isBehind = data.deficit < 0
  const planFinish = formattedFinish(deadlineISO)
  const forecastFinish = formattedFinish(visibleForecastFinishISO)
  const scenarioFinish = formattedFinish(scenarioFinishISO)
  const hasPlannedTotal = Number.isFinite(totalPlannedMinutes) && (totalPlannedMinutes ?? 0) > 0

  return createPortal(
    <div
      ref={dialogRef}
      className="progress-lab-overlay"
      data-testid="progress-lab-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="progress-lab-title"
      aria-describedby="progress-lab-description"
      onClick={handleBackdrop}
    >
      <article className="progress-lab-shell">
        <header className="progress-lab-header">
          <div className="progress-lab-heading-copy">
            <div className="progress-lab-eyebrow">
              Progress Lab · {historical ? 'Historical week' : 'Active roadmap'}
            </div>
            <h2 id="progress-lab-title">Study trajectory and pace scenario</h2>
            <p id="progress-lab-description">
              Inspect your cumulative progress and compare it with the original plan.
            </p>
          </div>
          <button
            ref={closeRef}
            className="progress-lab-close"
            type="button"
            aria-label="Close Progress Lab"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="progress-lab-rangebar">
          <div className="progress-lab-eyebrow">Range</div>
          <div className="progress-lab-segmented" role="group" aria-label="Chart range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={range === option.value}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="progress-lab-range-readout">{rangeLabel(dateDomain)}</div>
        </div>

        <div className="progress-lab-body">
          <section className="progress-lab-chart-column" aria-label="Progress chart">
            <div className="progress-lab-burn-card">
              <div className="progress-lab-burn-header">
                <span>Hours studied vs plan</span>
                <span>Day {data.dayNumber} of {data.totalDays}</span>
              </div>
              <div className="progress-lab-chart-stage">
                <BurnUpPlot
                  data={data}
                  dateDomain={dateDomain}
                  range={range}
                  layers={layers}
                  referenceDateISO={referenceDateISO}
                  referenceLabel={referenceLabel}
                  selectedCheckpoint={selectedCheckpoint}
                  onCheckpointSelect={setSelectedCheckpoint}
                  deadlineISO={deadlineISO}
                  forecastFinishISO={visibleForecastFinishISO}
                  scenarioFinishISO={scenarioFinishISO}
                  totalPlannedMinutes={totalPlannedMinutes}
                  scenarioPoints={scenarioFinishISO ? paceScenario?.points : undefined}
                  style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}
                />

                {selectedSummary && (
                  <aside className="progress-lab-checkpoint" aria-live="polite">
                    <div className="progress-lab-checkpoint-head">
                      <div>
                        <div className="progress-lab-eyebrow">Selected checkpoint</div>
                        <div className="progress-lab-checkpoint-date">
                          {format(parseISO(selectedSummary.dateISO), 'MMM d')}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="Close checkpoint summary"
                        onClick={() => setSelectedCheckpoint(null)}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                    <div className="progress-lab-checkpoint-metrics">
                      <div><span>Actual</span><strong>{minutesToLabel(selectedSummary.actualMinutes)}</strong></div>
                      <div><span>Plan</span><strong>{minutesToLabel(selectedSummary.plannedMinutes)}</strong></div>
                      <div className={selectedSummary.gapMinutes < 0 ? 'is-behind' : 'is-ahead'}>
                        <span>Gap</span>
                        <strong>{signedMinutes(selectedSummary.gapMinutes)}</strong>
                      </div>
                    </div>
                    <p>{selectedSummary.interpretation}</p>
                  </aside>
                )}
              </div>
              <div className="progress-lab-burn-footer">
                <div className={isBehind ? 'is-behind' : 'is-ahead'}>{deficitText(data, historical)}</div>
                <div className="progress-lab-legend" aria-label="Chart legend">
                  <span><i className={isBehind ? 'actual is-behind' : 'actual is-ahead'} />Actual</span>
                  <span><i className="planned" />Planned</span>
                  <span><i className="forecast" />GP forecast</span>
                  {scenarioFinishISO && <span><i className="scenario" />Your pace</span>}
                  {isBehind && <span><i className="behind" />Behind</span>}
                </div>
              </div>
            </div>
          </section>

          <aside className="progress-lab-rail" aria-label="Progress Lab controls">
            <section className="progress-lab-section">
              <div className="progress-lab-eyebrow">Chart layers</div>
              {LAYER_OPTIONS.map((option) => (
                <div className="progress-lab-layer-row" key={option.key}>
                  <span>{option.label}</span>
                  <button
                    className="progress-lab-switch"
                    type="button"
                    aria-label={option.label}
                    aria-pressed={layers[option.key]}
                    onClick={() => setLayers((current) => ({
                      ...current,
                      [option.key]: !current[option.key],
                    }))}
                  >
                    <span aria-hidden="true" />
                  </button>
                </div>
              ))}
            </section>

            <section className="progress-lab-section progress-lab-finish-section">
              <div className="progress-lab-eyebrow">Finish outlook</div>
              <div className="progress-lab-finish-narrative" aria-live="polite">
                <p data-testid="finish-narrative-plan">
                  <span className="progress-lab-finish-label">Plan</span>
                  {!planFinish
                    ? 'Plan finish is unavailable because the roadmap deadline is missing.'
                    : !hasPlannedTotal
                      ? 'Plan finish is unavailable because the planned total is missing.'
                      : <>Stick to your planned slots and you finish <strong>{planFinish}</strong> - your deadline.</>}
                </p>

                {!historical && (
                  <p data-testid="finish-narrative-forecast">
                    <span className="progress-lab-finish-label">
                      Forecast
                      {forecastBasis === 'analytic' && (
                        <span className="progress-lab-estimate">estimate</span>
                      )}
                    </span>
                    {!forecastFinish
                      ? 'Forecast is unavailable until a projection finish is ready.'
                      : <>
                          At your recent pace, your current trajectory finishes <strong>{forecastFinish}</strong>,{' '}
                          {deadlineDifferenceLabel(deadlineISO, visibleForecastFinishISO)}.
                        </>}
                  </p>
                )}

                {!historical && (
                  <p data-testid="finish-narrative-scenario">
                    <span className="progress-lab-finish-label">Your pace</span>
                    {!capacityScenarioInput || !paceScenario
                      ? 'Pace scenario is unavailable until roadmap capacity is ready.'
                      : paceDeltaMinutes === 0
                        ? 'Choose extra minutes to compare a faster commitment.'
                        : !scenarioFinish
                          ? 'The selected pace does not have a finish date yet.'
                          : <>
                              Commit to +{paceDeltaMinutes} min per study day and you finish{' '}
                              <strong>{scenarioFinish}</strong> -{' '}
                              {deadlineDifferenceLabel(deadlineISO, scenarioFinishISO)}.
                            </>}
                  </p>
                )}
              </div>
            </section>

            {!historical && (
              <section className="progress-lab-section progress-lab-pace-section">
                <div className="progress-lab-eyebrow">Try a pace</div>
                <h3>
                  {paceDeltaMinutes === 0 ? 'Current study pace' : `+${paceDeltaMinutes} min per study day`}
                </h3>
                <p>
                  Preview a capacity finish without changing your roadmap.
                </p>
                <input
                  className="progress-lab-slider"
                  type="range"
                  min="0"
                  max="60"
                  step="15"
                  value={paceDeltaMinutes}
                  aria-label="Extra minutes per study day"
                  disabled={!capacityScenarioInput}
                  onChange={(event) => setPaceDeltaMinutes(parsePaceDeltaMinutes(event.target.value))}
                />
                <div className="progress-lab-slider-labels" aria-hidden="true">
                  <span>Current</span>
                  <span>+60 min</span>
                </div>

                {capacityScenarioInput ? (
                  <Link
                    className="progress-lab-primary"
                    to={`/replan?paceDeltaMinutes=${paceDeltaMinutes}`}
                  >
                    Replan with this pace
                  </Link>
                ) : (
                  <button className="progress-lab-primary" type="button" disabled>
                    Replan with this pace
                  </button>
                )}
              </section>
            )}
          </aside>
        </div>
      </article>
    </div>,
    document.body,
  )
}

export default ProgressLabModal
