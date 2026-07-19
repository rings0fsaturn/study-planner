import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
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

function scenarioDifferenceLabel(
  baselineFinish: string | null,
  scenarioFinish: string | null,
): string {
  if (!baselineFinish || !scenarioFinish) return 'Finish date unavailable'
  const days = differenceInCalendarDays(parseISO(baselineFinish), parseISO(scenarioFinish))
  if (days === 0) return 'Same capacity-model finish'
  return days > 0
    ? `${days} day${days === 1 ? '' : 's'} sooner`
    : `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} later`
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

  const dateDomain = useMemo(
    () => buildProgressLabDateDomain(
      data,
      range,
      referenceDateISO,
      weekStartISO,
      weekEndISO,
    ),
    [data, range, referenceDateISO, weekEndISO, weekStartISO],
  )
  const selectedSummary = useMemo(
    () => selectedCheckpoint
      ? buildCheckpointSummary(data.actual, data.planned, selectedCheckpoint)
      : null,
    [data.actual, data.planned, selectedCheckpoint],
  )
  const baselineScenario = useMemo(
    () => capacityScenarioInput
      ? computeCapacityScenario({ ...capacityScenarioInput, paceDeltaMinutes: 0 })
      : null,
    [capacityScenarioInput],
  )
  const paceScenario = useMemo(
    () => capacityScenarioInput
      ? computeCapacityScenario({ ...capacityScenarioInput, paceDeltaMinutes })
      : null,
    [capacityScenarioInput, paceDeltaMinutes],
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
                  scenarioPoints={paceDeltaMinutes > 0 ? paceScenario?.points : undefined}
                  style={{ height: '100%', minHeight: 0 }}
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

                {capacityScenarioInput && paceScenario ? (
                  <div className="progress-lab-scenario-result" aria-live="polite">
                    <div className="progress-lab-eyebrow">Scenario finish</div>
                    <strong>
                      {paceScenario.finishDate
                        ? format(parseISO(paceScenario.finishDate), 'MMM d, yyyy')
                        : 'Unavailable'}
                    </strong>
                    <span>
                      {scenarioDifferenceLabel(baselineScenario?.finishDate ?? null, paceScenario.finishDate)}
                    </span>
                  </div>
                ) : (
                  <p className="progress-lab-unavailable">
                    Pace scenario is unavailable until roadmap capacity is ready.
                  </p>
                )}

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
