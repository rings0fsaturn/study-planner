import { useMemo, useState, type CSSProperties, type KeyboardEvent, type Ref } from 'react';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AreaClosed, LinePath, Line } from '@visx/shape';
import { AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { curveStepAfter, curveMonotoneX } from '@visx/curve';
import { format } from 'date-fns';

import type { BurnUpData, CumulativePoint } from '@study-tracker/progress';

const C = {
  ink: '#2A1F18',
  inkSoft: '#5C4D40',
  inkFaint: '#8B7B6B',
  card: '#FBF7EE',
  paperDeep: '#EDE3D2',
  ruleSoft: '#E6DCC8',
  rule: '#D9CDB8',
  rust: '#A0432A',
  moss: '#4A6B3A',
} as const;

export type ProgressLabRange = 'full' | 'month' | 'week';

export interface OptionalChartLayers {
  planned: boolean;
  projection: boolean;
  confidence: boolean;
}

export interface ChartLayerVisibility extends OptionalChartLayers {
  actual: true;
  reference: true;
}

export interface XAxisTick {
  date: Date;
  dateISO: string;
  label: string;
  isObserved: boolean;
  showLabel: boolean;
  stagger: boolean;
  labelRow: number;
}

export interface CheckpointSummary {
  dateISO: string;
  actualMinutes: number;
  plannedMinutes: number;
  gapMinutes: number;
  changeMinutes: number;
  interpretation: string;
}

export interface ScenarioChartPoint {
  date: string;
  minutes: number;
}

export function minutesToLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const min = safe % 60;
  if (h === 0) return `${min}m`;
  return min === 0 ? `${h}h` : `${h}h ${min}m`;
}

export function buildMinuteTickValues(maxMinutes: number): number[] {
  const max = Math.max(60, Math.ceil(maxMinutes / 30) * 30);
  const targetGap = max / 6;
  const step = [30, 60, 120, 180, 240, 360, 480, 600, 720].find(
    (value) => value >= targetGap,
  ) ?? 720;
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return [...new Set(ticks)];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseISODateUTC(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

function startOfUTCDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function clampDate(date: Date, min: Date, max: Date): Date {
  return new Date(Math.max(min.getTime(), Math.min(max.getTime(), date.getTime())));
}

export function buildBurnUpDateDomain(
  hints: Pick<BurnUpData, 'startDate' | 'deadline' | 'today' | 'dayNumber' | 'totalDays'>,
  candidateDates: Date[],
): [Date, Date] {
  const today = parseISODateUTC(hints.today);
  const derivedStart = addDays(today, -Math.max(0, hints.dayNumber));
  const derivedEnd = addDays(derivedStart, Math.max(1, hints.totalDays));
  const domainStart = hints.startDate ? parseISODateUTC(hints.startDate) : derivedStart;
  const domainEnd = hints.deadline ? parseISODateUTC(hints.deadline) : derivedEnd;
  const dates = [domainStart, domainEnd, ...candidateDates].map(startOfUTCDate);
  const min = Math.min(...dates.map((date) => date.getTime()));
  const max = Math.max(...dates.map((date) => date.getTime()));

  if (min === max) return [new Date(min), addDays(new Date(max), 1)];
  return [new Date(min), new Date(max)];
}

function allBurnUpDates(data: BurnUpData): Date[] {
  return [
    ...data.planned.map((point) => parseISODateUTC(point.date)),
    ...data.actual.map((point) => parseISODateUTC(point.date)),
    ...data.gpCurve.map((point) => parseISODateUTC(point.date)),
  ];
}

export function buildProgressLabDateDomain(
  data: BurnUpData,
  range: ProgressLabRange,
  referenceDateISO: string,
  weekStartISO: string,
  weekEndISO: string,
): [Date, Date] {
  const full = buildBurnUpDateDomain(data, allBurnUpDates(data));
  if (range === 'full') return full;

  const reference = parseISODateUTC(referenceDateISO);
  const requested: [Date, Date] = range === 'month'
    ? [addDays(reference, -7), addDays(reference, 22)]
    : [parseISODateUTC(weekStartISO), parseISODateUTC(weekEndISO)];
  const start = clampDate(requested[0], full[0], full[1]);
  const end = clampDate(requested[1], full[0], full[1]);
  if (start.getTime() === end.getTime()) return [start, addDays(end, 1)];
  return start < end ? [start, end] : [end, start];
}

export function hasMeaningfulBurnUpData(
  planned: BurnUpData['planned'],
  actual: BurnUpData['actual'],
): boolean {
  const hasMeaningfulPlan = planned.length > 1 || planned.some((point) => point.minutes > 0);
  return actual.length > 0 || hasMeaningfulPlan;
}

export function buildBurnUpYDomainMax(series: {
  planned: number[];
  actual: number[];
  gpMean: number[];
  gpUpper: number[];
  scenario?: number[];
}): number {
  const primaryMax = Math.max(
    0,
    ...series.planned,
    ...series.actual,
    ...series.gpMean,
    ...(series.scenario ?? []),
  );
  const gpUpperMax = Math.max(0, ...series.gpUpper);
  const boundedGpUpper = primaryMax > 0 ? Math.min(gpUpperMax, primaryMax * 1.25) : gpUpperMax;
  const rawMax = Math.max(60, primaryMax, boundedGpUpper);
  return Math.ceil((rawMax * 1.08) / 30) * 30;
}

export function plannedMinutesAtDate(planned: CumulativePoint[], dateISO: string): number {
  let result = 0;
  for (const point of planned) {
    if (point.date > dateISO) break;
    result = point.minutes;
  }
  return result;
}

export function buildCheckpointSummary(
  actual: CumulativePoint[],
  planned: CumulativePoint[],
  dateISO: string,
): CheckpointSummary | null {
  const index = actual.findIndex((point) => point.date === dateISO);
  if (index < 0) return null;
  const point = actual[index];
  const previousMinutes = index > 0 ? actual[index - 1].minutes : 0;
  const plannedMinutes = plannedMinutesAtDate(planned, dateISO);
  const gapMinutes = point.minutes - plannedMinutes;
  const changeMinutes = Math.max(0, point.minutes - previousMinutes);
  const gapText = gapMinutes < 0
    ? `${minutesToLabel(Math.abs(gapMinutes))} behind plan`
    : gapMinutes > 0
      ? `${minutesToLabel(gapMinutes)} ahead of plan`
      : 'on plan';
  const interpretation = index === 0
    ? `The first checkpoint records ${minutesToLabel(point.minutes)} and is ${gapText}.`
    : `${minutesToLabel(changeMinutes)} added since the previous checkpoint, leaving you ${gapText}.`;

  return {
    dateISO,
    actualMinutes: point.minutes,
    plannedMinutes,
    gapMinutes,
    changeMinutes,
    interpretation,
  };
}

export function resolveLayerVisibility(
  optional: Partial<OptionalChartLayers> = {},
): ChartLayerVisibility {
  return {
    planned: optional.planned ?? true,
    projection: optional.projection ?? true,
    confidence: optional.confidence ?? true,
    actual: true,
    reference: true,
  };
}

function firstOfFollowingMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export function buildXAxisTicks(
  actual: CumulativePoint[],
  domain: [Date, Date],
  range: ProgressLabRange,
  width: number,
): XAxisTick[] {
  const startISO = toISODate(domain[0]);
  const endISO = toISODate(domain[1]);
  const observed = [...new Set(actual
    .map((point) => point.date)
    .filter((date) => date >= startISO && date <= endISO))]
    .sort();
  const observedSet = new Set(observed);
  const tickDates = new Set<string>(observed);
  tickDates.add(startISO);
  tickDates.add(endISO);

  if (range !== 'week') {
    for (let cursor = firstOfFollowingMonth(domain[0]); cursor < domain[1]; cursor = firstOfFollowingMonth(cursor)) {
      tickDates.add(toISODate(cursor));
    }
  }

  const compactLongRange = width < 700 && range !== 'week';
  const firstObserved = observed[0];
  const lastObserved = observed[observed.length - 1];
  const domainDuration = Math.max(1, domain[1].getTime() - domain[0].getTime());
  const positionFor = (date: Date) => ((date.getTime() - domain[0].getTime()) / domainDuration) * width;
  const rawTicks = [...tickDates]
    .sort()
    .map((dateISO) => {
      const isObserved = observedSet.has(dateISO);
      const observedIndex = observed.indexOf(dateISO);
      const showObservedLabel = !compactLongRange || dateISO === firstObserved || dateISO === lastObserved;
      const showLabel = isObserved ? showObservedLabel : true;
      const date = parseISODateUTC(dateISO);
      const sameObservedMonth = observedIndex > 0 && dateISO.slice(0, 7) === observed[observedIndex - 1].slice(0, 7);
      const label = isObserved && sameObservedMonth
        ? format(date, 'dd')
        : format(date, 'MMM dd');
      return {
        date,
        dateISO,
        label,
        isObserved,
        showLabel,
        stagger: false,
        labelRow: 0,
      };
    });

  for (const tick of rawTicks) {
    if (tick.isObserved || !tick.showLabel) continue;
    const tickX = positionFor(tick.date);
    const tooCloseToObserved = rawTicks.some((candidate) => {
      if (!candidate.isObserved || !candidate.showLabel) return false;
      const combinedHalfWidth = (tick.label.length + candidate.label.length) * 3.1;
      return Math.abs(tickX - positionFor(candidate.date)) < combinedHalfWidth + 6;
    });
    if (tooCloseToObserved) tick.showLabel = false;
  }

  const rowRightEdges = [-Infinity, -Infinity, -Infinity, -Infinity];
  for (const tick of rawTicks) {
    if (!tick.showLabel) continue;
    const x = positionFor(tick.date);
    const labelWidth = Math.max(12, tick.label.length * 6.1);
    const left = x <= 2 ? x : x >= width - 2 ? x - labelWidth : x - labelWidth / 2;
    const right = left + labelWidth;
    const row = rowRightEdges.findIndex((edge) => left >= edge + 4);
    if (row < 0 && !tick.isObserved) {
      tick.showLabel = false;
      continue;
    }
    tick.labelRow = row >= 0 ? row : rowRightEdges.length - 1;
    tick.stagger = tick.labelRow > 0;
    rowRightEdges[tick.labelRow] = right;
  }

  return rawTicks;
}

function deficitLabel(deficit: number): { text: string; color: string } {
  const abs = Math.abs(deficit);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const pad = String(m).padStart(2, '0');
  if (deficit < 0) return { text: `-${h}h ${pad}m behind plan today`, color: C.rust };
  if (deficit > 0) return { text: `+${h}h ${pad}m ahead of plan today`, color: C.moss };
  return { text: 'On track', color: C.moss };
}

function isWithinDomain(date: Date, domain: [Date, Date]): boolean {
  return date >= domain[0] && date <= domain[1];
}

function clipPlannedPoints(points: CumulativePoint[], domain: [Date, Date]): CumulativePoint[] {
  const startISO = toISODate(domain[0]);
  const endISO = toISODate(domain[1]);
  const clipped = points.filter((point) => point.date >= startISO && point.date <= endISO);
  const result = [
    { date: startISO, minutes: plannedMinutesAtDate(points, startISO) },
    ...clipped,
    { date: endISO, minutes: plannedMinutesAtDate(points, endISO) },
  ];
  const byDate = new Map(result.map((point) => [point.date, point]));
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const MARGIN = { top: 12, right: 20, left: 58 };

interface InnerProps {
  data: BurnUpData;
  width: number;
  height: number;
  dateDomain?: [Date, Date];
  range: ProgressLabRange;
  layers: ChartLayerVisibility;
  referenceDateISO: string;
  referenceLabel: string;
  selectedCheckpoint?: string | null;
  onCheckpointSelect?: (dateISO: string) => void;
  scenarioPoints?: ScenarioChartPoint[];
}

function BurnUpPlotInner({
  data,
  width,
  height,
  dateDomain: requestedDateDomain,
  range,
  layers,
  referenceDateISO,
  referenceLabel,
  selectedCheckpoint,
  onCheckpointSelect,
  scenarioPoints = [],
}: InnerProps) {
  const isBehind = data.deficit < 0;
  const accentColor = isBehind ? C.rust : C.moss;
  const fullDateDomain = buildBurnUpDateDomain(data, allBurnUpDates(data));
  const dateDomain = requestedDateDomain ?? fullDateDomain;

  const plannedPoints = useMemo(
    () => clipPlannedPoints(data.planned, dateDomain),
    [data.planned, dateDomain],
  );
  const actualPoints = useMemo(
    () => data.actual.filter((point) => isWithinDomain(parseISODateUTC(point.date), dateDomain)),
    [data.actual, dateDomain],
  );
  const gpPoints = useMemo(
    () => data.gpCurve.filter((point) => isWithinDomain(parseISODateUTC(point.date), dateDomain)),
    [data.gpCurve, dateDomain],
  );
  const visibleScenario = useMemo(
    () => scenarioPoints.filter((point) => isWithinDomain(parseISODateUTC(point.date), dateDomain)),
    [scenarioPoints, dateDomain],
  );

  const plannedParsed = useMemo(
    () => plannedPoints.map((point) => ({ date: parseISODateUTC(point.date), minutes: point.minutes })),
    [plannedPoints],
  );
  const actualParsed = useMemo(
    () => actualPoints.map((point) => ({ date: parseISODateUTC(point.date), dateISO: point.date, minutes: point.minutes })),
    [actualPoints],
  );
  const gpParsed = useMemo(
    () => gpPoints.map((point) => ({
      date: parseISODateUTC(point.date),
      mean: point.mean,
      lower: point.lower,
      upper: point.upper,
    })),
    [gpPoints],
  );
  const scenarioParsed = useMemo(
    () => visibleScenario.map((point) => ({ date: parseISODateUTC(point.date), minutes: point.minutes })),
    [visibleScenario],
  );

  const yDomainMax = buildBurnUpYDomainMax({
    planned: plannedParsed.map((point) => point.minutes),
    actual: actualParsed.map((point) => point.minutes),
    gpMean: gpParsed.map((point) => point.mean),
    gpUpper: gpParsed.map((point) => point.upper),
    scenario: scenarioParsed.map((point) => point.minutes),
  });
  const minuteTickValues = buildMinuteTickValues(yDomainMax);
  const xTicks = buildXAxisTicks(actualPoints, dateDomain, range, width);
  const maxLabelRow = Math.max(0, ...xTicks.filter((tick) => tick.showLabel).map((tick) => tick.labelRow));
  const bottomMargin = Math.max(44, 32 + maxLabelRow * 13);
  const xMax = Math.max(0, width - MARGIN.left - MARGIN.right);
  const yMax = Math.max(0, height - MARGIN.top - bottomMargin);

  const xScale = scaleTime<number>({ domain: dateDomain, range: [0, xMax] });
  const yScale = scaleLinear<number>({ domain: [0, yDomainMax], range: [yMax, 0], nice: true });
  const referenceDate = parseISODateUTC(referenceDateISO);
  const referenceVisible = isWithinDomain(referenceDate, dateDomain);
  const referenceX = xScale(referenceDate);

  const behindPath = useMemo(() => {
    if (!isBehind || actualParsed.length < 2) return null;
    return actualParsed.map((actualPoint) => ({
      date: actualPoint.date,
      plannedMin: plannedMinutesAtDate(data.planned, actualPoint.dateISO),
      actualMin: actualPoint.minutes,
    }));
  }, [actualParsed, data.planned, isBehind]);

  const activateCheckpoint = (dateISO: string, event: KeyboardEvent<SVGCircleElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onCheckpointSelect?.(dateISO);
  };

  if (width < 10 || height < 10) return null;

  return (
    <svg width={width} height={height} aria-label="Hours studied versus plan">
      <rect x={0} y={0} width={width} height={height} fill={C.card} />

      <Group left={MARGIN.left} top={MARGIN.top}>
        {referenceVisible && referenceX < xMax && (
          <rect
            x={referenceX}
            y={0}
            width={Math.max(0, xMax - referenceX)}
            height={yMax}
            fill={C.paperDeep}
            opacity={0.45}
            pointerEvents="none"
          />
        )}

        {behindPath && behindPath.length >= 2 && (
          <AreaClosed
            data={behindPath}
            x={(point) => xScale(point.date)}
            y0={(point) => yScale(point.actualMin)}
            y1={(point) => yScale(point.plannedMin)}
            yScale={yScale}
            fill={C.rust}
            opacity={0.1}
            curve={curveMonotoneX}
            pointerEvents="none"
          />
        )}

        {layers.confidence && gpParsed.length >= 2 && (
          <AreaClosed
            data={gpParsed}
            x={(point) => xScale(point.date)}
            y0={(point) => yScale(point.lower)}
            y1={(point) => yScale(point.upper)}
            yScale={yScale}
            fill={accentColor}
            opacity={0.12}
            curve={curveMonotoneX}
            pointerEvents="none"
          />
        )}

        {layers.planned && plannedParsed.length >= 2 && (
          <LinePath
            data={plannedParsed}
            x={(point) => xScale(point.date)}
            y={(point) => yScale(point.minutes)}
            stroke={C.inkFaint}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            curve={curveStepAfter}
            pointerEvents="none"
          />
        )}

        {layers.projection && gpParsed.length >= 2 && (
          <LinePath
            data={gpParsed}
            x={(point) => xScale(point.date)}
            y={(point) => yScale(point.mean)}
            stroke={accentColor}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            curve={curveMonotoneX}
            pointerEvents="none"
          />
        )}

        {scenarioParsed.length >= 2 && (
          <LinePath
            data-testid="capacity-scenario-line"
            data={scenarioParsed}
            x={(point) => xScale(point.date)}
            y={(point) => yScale(point.minutes)}
            stroke={C.moss}
            strokeWidth={2.5}
            strokeDasharray="6 5"
            curve={curveMonotoneX}
            pointerEvents="none"
          />
        )}

        {actualParsed.length >= 2 && (
          <LinePath
            data={actualParsed}
            x={(point) => xScale(point.date)}
            y={(point) => yScale(point.minutes)}
            stroke={accentColor}
            strokeWidth={2}
            curve={curveMonotoneX}
            pointerEvents="none"
          />
        )}

        {actualParsed.map((point) => (
          <g key={point.dateISO}>
            {selectedCheckpoint === point.dateISO && (
              <circle
                cx={xScale(point.date)}
                cy={yScale(point.minutes)}
                r={9}
                fill="none"
                stroke={accentColor}
                strokeWidth={2}
                opacity={0.45}
                pointerEvents="none"
              />
            )}
            <circle
              cx={xScale(point.date)}
              cy={yScale(point.minutes)}
              r={3}
              fill={accentColor}
              stroke={C.card}
              strokeWidth={1.5}
              pointerEvents="none"
            />
            {onCheckpointSelect && (
              <circle
                data-testid={`checkpoint-${point.dateISO}`}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${format(point.date, 'MMM d')} checkpoint`}
                cx={xScale(point.date)}
                cy={yScale(point.minutes)}
                r={13}
                fill="transparent"
                stroke="transparent"
                style={{ cursor: 'pointer', outline: 'none' }}
                onClick={() => onCheckpointSelect(point.dateISO)}
                onKeyDown={(event) => activateCheckpoint(point.dateISO, event)}
              />
            )}
          </g>
        ))}

        {referenceVisible && (
          <>
            <Line
              from={{ x: referenceX, y: 0 }}
              to={{ x: referenceX, y: yMax }}
              stroke={C.inkSoft}
              strokeWidth={1}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
            <text
              x={referenceX}
              y={-4}
              textAnchor="middle"
              fill={C.inkSoft}
              pointerEvents="none"
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {referenceLabel}
            </text>
          </>
        )}

        <line x1={0} x2={xMax} y1={yMax} y2={yMax} stroke={C.ruleSoft} pointerEvents="none" />
        {xTicks.map((tick) => {
          const x = xScale(tick.date);
          const anchor = x <= 2 ? 'start' : x >= xMax - 2 ? 'end' : 'middle';
          return (
            <g key={tick.dateISO} pointerEvents="none">
              <line
                x1={x}
                x2={x}
                y1={yMax}
                y2={yMax + (tick.isObserved ? 8 : 6)}
                stroke={tick.isObserved ? C.rust : C.ruleSoft}
                strokeWidth={tick.isObserved ? 1.4 : 1}
              />
              {tick.showLabel && (
                <text
                  x={x}
                  y={yMax + 18 + tick.labelRow * 13}
                  textAnchor={anchor}
                  fill={tick.isObserved ? C.inkSoft : C.inkFaint}
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: width < 500 ? 9 : 10,
                    letterSpacing: '0.03em',
                  }}
                >
                  {tick.label}
                </text>
              )}
            </g>
          );
        })}

        <AxisLeft
          scale={yScale}
          tickValues={minuteTickValues}
          tickFormat={(value) => minutesToLabel(value as number)}
          stroke={C.ruleSoft}
          tickStroke={C.ruleSoft}
          tickLabelProps={() => ({
            fill: C.inkFaint,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: '0.03em',
            textAnchor: 'end' as const,
            dx: '-0.4em',
            dy: '0.33em',
            pointerEvents: 'none' as const,
          })}
        />
      </Group>
    </svg>
  );
}

export interface BurnUpPlotProps {
  data: BurnUpData;
  dateDomain?: [Date, Date];
  range?: ProgressLabRange;
  layers?: Partial<OptionalChartLayers>;
  referenceDateISO?: string;
  referenceLabel?: string;
  selectedCheckpoint?: string | null;
  onCheckpointSelect?: (dateISO: string) => void;
  scenarioPoints?: ScenarioChartPoint[];
  style?: CSSProperties;
  className?: string;
}

export function BurnUpPlot({
  data,
  dateDomain,
  range = 'full',
  layers,
  referenceDateISO = data.today,
  referenceLabel = 'Today',
  selectedCheckpoint,
  onCheckpointSelect,
  scenarioPoints,
  style,
  className,
}: BurnUpPlotProps) {
  const visibility = resolveLayerVisibility(layers);
  return (
    <div className={className} style={{ width: '100%', height: 280, ...style }}>
      <ParentSize>
        {({ width, height }) => (
          <BurnUpPlotInner
            data={data}
            width={width}
            height={height}
            dateDomain={dateDomain}
            range={range}
            layers={visibility}
            referenceDateISO={referenceDateISO}
            referenceLabel={referenceLabel}
            selectedCheckpoint={selectedCheckpoint}
            onCheckpointSelect={onCheckpointSelect}
            scenarioPoints={scenarioPoints}
          />
        )}
      </ParentSize>
    </div>
  );
}

function Legend({ isBehind }: { isBehind: boolean }) {
  const accentColor = isBehind ? C.rust : C.moss;
  const labelStyle: CSSProperties = {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: 10,
    color: 'var(--text-tertiary, #8B7B6B)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={20} height={10} aria-hidden="true">
          <line x1={0} y1={5} x2={20} y2={5} stroke={accentColor} strokeWidth={2} />
        </svg>
        <span style={labelStyle}>Actual</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={20} height={10} aria-hidden="true">
          <line x1={0} y1={5} x2={20} y2={5} stroke={C.inkFaint} strokeWidth={1.5} strokeDasharray="4 3" />
        </svg>
        <span style={labelStyle}>Planned</span>
      </div>
      {isBehind && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={14} height={10} aria-hidden="true">
            <rect x={0} y={0} width={14} height={10} fill={C.rust} opacity={0.18} rx={2} />
          </svg>
          <span style={labelStyle}>Behind</span>
        </div>
      )}
    </div>
  );
}

export interface BurnUpChartProps {
  data: BurnUpData;
  expanded?: boolean;
  onOpen?: () => void;
  openerRef?: Ref<HTMLButtonElement>;
}

export function BurnUpChart({ data, expanded = false, onOpen, openerRef }: BurnUpChartProps) {
  const isBehind = data.deficit < 0;
  const { text: deficitText, color: deficitColor } = deficitLabel(data.deficit);
  const hasData = hasMeaningfulBurnUpData(data.planned, data.actual);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const affordanceVisible = Boolean(onOpen) && (hovered || focused);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: 'var(--surface-card, #FBF7EE)',
        border: `1px solid ${affordanceVisible ? 'var(--border-default, #D9CDB8)' : 'var(--border-subtle, #E6DCC8)'}`,
        borderRadius: 'var(--radius-md, 10px)',
        padding: 0,
        overflow: 'hidden',
        boxShadow: affordanceVisible ? '0 12px 30px rgba(42, 31, 24, 0.14)' : 'none',
        transition: 'box-shadow 140ms ease, border-color 140ms ease',
      }}
    >
      {!hasData ? (
        <div style={{ padding: '24px 20px' }}>
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10,
              color: 'var(--text-tertiary, #8B7B6B)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 500,
            }}
          >
            Hours studied vs plan
          </span>
          <p
            style={{
              margin: '12px 0 0',
              fontFamily: "var(--font-body, 'Inter Tight', sans-serif)",
              fontSize: 15,
              lineHeight: 1.5,
              color: 'var(--text-secondary, #5C4D40)',
            }}
          >
            Log a session to see your burn-up
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px 8px',
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10,
                color: 'var(--text-tertiary, #8B7B6B)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 500,
              }}
            >
              Hours studied vs plan
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                fontSize: 10,
                color: 'var(--text-tertiary, #8B7B6B)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 500,
              }}
            >
              Day {data.dayNumber} of {data.totalDays}
            </span>
          </div>

          <BurnUpPlot data={data} />

          <div
            style={{
              padding: '12px 20px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: "var(--font-display, 'Fraunces', Georgia, serif)",
                  fontSize: 26,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  color: deficitColor,
                  lineHeight: 1,
                  fontFeatureSettings: "'tnum'",
                }}
              >
                {deficitText}
              </span>
            </div>
            <Legend isBehind={isBehind} />
          </div>

          {onOpen && (
            <>
              <button
                ref={openerRef}
                type="button"
                aria-label="Open Progress Lab"
                aria-haspopup="dialog"
                aria-expanded={expanded}
                onClick={onOpen}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  width: '100%',
                  border: 0,
                  padding: 0,
                  background: 'transparent',
                  cursor: 'zoom-in',
                  outline: 'none',
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  zIndex: 3,
                  right: 14,
                  top: 44,
                  padding: '6px 9px',
                  border: `1px solid ${C.rule}`,
                  borderRadius: 999,
                  color: C.inkSoft,
                  background: 'rgba(251, 247, 238, 0.96)',
                  boxShadow: '0 5px 16px rgba(42, 31, 24, 0.12)',
                  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  opacity: affordanceVisible ? 1 : 0,
                  pointerEvents: 'none',
                  transition: 'opacity 120ms ease',
                }}
              >
                Open Progress Lab
              </span>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default BurnUpChart;
