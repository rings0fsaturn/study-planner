import {
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type Ref,
} from 'react';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AreaClosed, LinePath, Line } from '@visx/shape';
import { AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { curveStepAfter, curveMonotoneX, curveLinear } from '@visx/curve';
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

interface CrosshairSeriesValue {
  key: string;
  label: string;
  color: string;
  value: number;
}

export interface FinishDateInputs {
  deadlineISO?: string;
  forecastFinishISO?: string;
  scenarioFinishISO?: string;
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

function parseOptionalISODateUTC(dateISO: string | undefined): Date | null {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  const date = parseISODateUTC(dateISO);
  return Number.isFinite(date.getTime()) && toISODate(date) === dateISO ? date : null;
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

function finishDates(inputs: FinishDateInputs): Date[] {
  return [inputs.deadlineISO, inputs.forecastFinishISO, inputs.scenarioFinishISO]
    .map(parseOptionalISODateUTC)
    .filter((date): date is Date => date !== null);
}

function allBurnUpDates(data: BurnUpData, finishes: FinishDateInputs = {}): Date[] {
  return [
    ...data.planned.map((point) => parseISODateUTC(point.date)),
    ...data.actual.map((point) => parseISODateUTC(point.date)),
    ...data.gpCurve.map((point) => parseISODateUTC(point.date)),
    ...finishDates(finishes),
  ];
}

export function buildProgressLabDateDomain(
  data: BurnUpData,
  range: ProgressLabRange,
  referenceDateISO: string,
  weekStartISO: string,
  weekEndISO: string,
  finishes: FinishDateInputs = {},
): [Date, Date] {
  const suppliedFinishes = finishDates(finishes);
  const full = buildBurnUpDateDomain(data, allBurnUpDates(data, finishes));
  if (range === 'full') {
    return suppliedFinishes.length > 0 ? [full[0], addDays(full[1], 3)] : full;
  }

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

export function interpolateStepMinutes(
  points: CumulativePoint[],
  dateISO: string,
  availableThroughISO?: string,
): number | null {
  if (availableThroughISO && dateISO > availableThroughISO) return null;
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length === 0 || dateISO < ordered[0].date || dateISO > ordered[ordered.length - 1].date) {
    return null;
  }
  return plannedMinutesAtDate(ordered, dateISO);
}

function interpolateLinearValue<T extends { date: string }>(
  points: T[],
  dateISO: string,
  valueFor: (point: T) => number,
  availableThroughISO?: string,
): number | null {
  if (availableThroughISO && dateISO > availableThroughISO) return null;
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length === 0 || dateISO < ordered[0].date || dateISO > ordered[ordered.length - 1].date) {
    return null;
  }
  const exact = ordered.find((point) => point.date === dateISO);
  if (exact) return valueFor(exact);
  const before = [...ordered].reverse().find((point) => point.date < dateISO);
  const after = ordered.find((point) => point.date > dateISO);
  if (!before || !after) return null;
  const beforeTime = parseISODateUTC(before.date).getTime();
  const afterTime = parseISODateUTC(after.date).getTime();
  const dateTime = parseISODateUTC(dateISO).getTime();
  const ratio = (dateTime - beforeTime) / (afterTime - beforeTime);
  return valueFor(before) + (valueFor(after) - valueFor(before)) * ratio;
}

export function interpolateLinearMinutes(
  points: CumulativePoint[],
  dateISO: string,
  availableThroughISO?: string,
): number | null {
  return interpolateLinearValue(points, dateISO, (point) => point.minutes, availableThroughISO);
}

export function interpolateGPMean(
  points: BurnUpData['gpCurve'],
  dateISO: string,
): number | null {
  return interpolateLinearValue(points, dateISO, (point) => point.mean);
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

function validTotalMinutes(totalPlannedMinutes: number | undefined): number | null {
  return typeof totalPlannedMinutes === 'number' && Number.isFinite(totalPlannedMinutes) && totalPlannedMinutes > 0
    ? totalPlannedMinutes
    : null;
}

export function clipPlannedPoints(
  points: CumulativePoint[],
  domain: [Date, Date],
  totalPlannedMinutes?: number,
): CumulativePoint[] {
  const startISO = toISODate(domain[0]);
  const endISO = toISODate(domain[1]);
  const total = validTotalMinutes(totalPlannedMinutes);
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const completed: CumulativePoint[] = [];
  for (const point of ordered) {
    if (total !== null && point.minutes >= total) {
      completed.push({ ...point, minutes: total });
      break;
    }
    completed.push(point);
  }
  const clipped = completed.filter((point) => point.date >= startISO && point.date <= endISO);
  const result = [
    { date: startISO, minutes: plannedMinutesAtDate(completed, startISO) },
    ...clipped,
  ];
  if (total === null || completed.some((point) => point.date > endISO)) {
    result.push({ date: endISO, minutes: plannedMinutesAtDate(completed, endISO) });
  }
  const byDate = new Map(result.map((point) => [point.date, point]));
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function clipScenarioPoints(
  points: ScenarioChartPoint[],
  domain: [Date, Date],
  scenarioFinishISO?: string,
  totalPlannedMinutes?: number,
): ScenarioChartPoint[] {
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const startISO = toISODate(domain[0]);
  const validFinish = parseOptionalISODateUTC(scenarioFinishISO);
  const endISO = toISODate(validFinish && validFinish < domain[1] ? validFinish : domain[1]);
  const bounded = ordered.filter((point) => point.date >= startISO && point.date <= endISO);
  const startMinutes = interpolateLinearMinutes(ordered, startISO);
  const endMinutes = interpolateLinearMinutes(ordered, endISO);
  if (startMinutes !== null) bounded.push({ date: startISO, minutes: startMinutes });
  if (endMinutes !== null) bounded.push({ date: endISO, minutes: endMinutes });

  const byDate = new Map(bounded.map((point) => [point.date, point]));
  const total = validTotalMinutes(totalPlannedMinutes);
  const clipped: ScenarioChartPoint[] = [];
  for (const point of [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    if (total !== null && point.minutes >= total) {
      clipped.push({ ...point, minutes: total });
      break;
    }
    clipped.push(point);
  }
  return clipped;
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
  deadlineISO?: string;
  forecastFinishISO?: string;
  scenarioFinishISO?: string;
  totalPlannedMinutes?: number;
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
  deadlineISO,
  forecastFinishISO,
  scenarioFinishISO,
  totalPlannedMinutes,
}: InnerProps) {
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const isBehind = data.deficit < 0;
  const accentColor = isBehind ? C.rust : C.moss;
  const finishInputs = { deadlineISO, forecastFinishISO, scenarioFinishISO };
  const suppliedFinishDates = finishDates(finishInputs);
  const baseFullDateDomain = buildBurnUpDateDomain(data, allBurnUpDates(data, finishInputs));
  const fullDateDomain: [Date, Date] = suppliedFinishDates.length > 0
    ? [baseFullDateDomain[0], addDays(baseFullDateDomain[1], 3)]
    : baseFullDateDomain;
  const dateDomain = requestedDateDomain ?? fullDateDomain;
  const goalMinutes = validTotalMinutes(totalPlannedMinutes);

  const plannedPoints = useMemo(
    () => clipPlannedPoints(data.planned, dateDomain, goalMinutes ?? undefined),
    [data.planned, dateDomain, goalMinutes],
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
    () => clipScenarioPoints(
      scenarioPoints,
      dateDomain,
      scenarioFinishISO,
      goalMinutes ?? undefined,
    ),
    [dateDomain, goalMinutes, scenarioFinishISO, scenarioPoints],
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
    planned: [
      ...plannedParsed.map((point) => point.minutes),
      ...(goalMinutes !== null ? [goalMinutes] : []),
    ],
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
  const goalY = goalMinutes !== null ? yScale(goalMinutes) : null;
  const deadlineDate = parseOptionalISODateUTC(deadlineISO);
  const forecastFinishDate = parseOptionalISODateUTC(forecastFinishISO);
  const scenarioFinishDate = parseOptionalISODateUTC(scenarioFinishISO);
  const finishMarkers = goalY === null ? [] : [
    { key: 'plan', label: 'Plan', date: deadlineDate, color: C.inkFaint, offsetY: -10 },
    { key: 'forecast', label: 'Forecast', date: forecastFinishDate, color: C.rust, offsetY: -25 },
    { key: 'scenario', label: 'Your pace', date: scenarioFinishDate, color: C.moss, offsetY: 20 },
  ].flatMap((marker) => marker.date !== null && isWithinDomain(marker.date, dateDomain)
    ? [{ ...marker, date: marker.date }]
    : []);
  const hoverDate = hoverPoint ? startOfUTCDate(xScale.invert(hoverPoint.x)) : null;
  const hoverDateISO = hoverDate ? toISODate(hoverDate) : null;
  const crosshairSeries: CrosshairSeriesValue[] = [];
  const addCrosshairSeries = (
    key: string,
    label: string,
    color: string,
    value: number | null,
  ) => {
    if (value !== null) crosshairSeries.push({ key, label, color, value });
  };
  if (hoverDateISO) {
    if (layers.planned) {
      addCrosshairSeries('planned', 'Planned', C.inkFaint, interpolateStepMinutes(plannedPoints, hoverDateISO));
    }
    addCrosshairSeries(
      'actual',
      'Actual',
      accentColor,
      interpolateLinearMinutes(actualPoints, hoverDateISO, data.today),
    );
    if (layers.projection) {
      addCrosshairSeries('gp', 'GP forecast', accentColor, interpolateGPMean(gpPoints, hoverDateISO));
    }
    addCrosshairSeries(
      'scenario',
      'Your pace',
      C.moss,
      interpolateLinearMinutes(visibleScenario, hoverDateISO),
    );
  }

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

  const updateHoverPoint = (event: ReactMouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = (event.clientX - rect.left) * (width / rect.width) - MARGIN.left;
    const y = (event.clientY - rect.top) * (height / rect.height) - MARGIN.top;
    if (x < 0 || x > xMax || y < 0 || y > yMax) {
      setHoverPoint(null);
      return;
    }
    setHoverPoint({ x, y });
  };

  if (width < 10 || height < 10) return null;

  return (
    <svg
      width={width}
      height={height}
      aria-label="Hours studied versus plan"
      onMouseMove={updateHoverPoint}
      onMouseLeave={() => setHoverPoint(null)}
    >
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

        {goalY !== null && (
          <rect
            data-testid="burn-up-done-zone"
            x={0}
            y={0}
            width={xMax}
            height={Math.max(0, goalY)}
            fill={C.moss}
            opacity={0.06}
            pointerEvents="none"
          />
        )}

        <rect
          data-testid="crosshair-hit-area"
          x={0}
          y={0}
          width={xMax}
          height={yMax}
          fill="transparent"
          style={{ pointerEvents: 'all', cursor: 'crosshair' }}
        />

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

        {layers.projection && goalY !== null && forecastFinishDate && gpParsed.length > 0 && isWithinDomain(forecastFinishDate, dateDomain) && (
          <line
            data-testid="forecast-finish-connector"
            x1={xScale(gpParsed[gpParsed.length - 1].date)}
            y1={yScale(gpParsed[gpParsed.length - 1].mean)}
            x2={xScale(forecastFinishDate)}
            y2={goalY}
            stroke={C.rust}
            strokeWidth={1}
            strokeDasharray="2 4"
            opacity={0.45}
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
            curve={curveLinear}
            data-finish-date={scenarioFinishISO}
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

        {goalY !== null && (
          <g data-testid="burn-up-goal-line" pointerEvents="none">
            <line
              x1={0}
              x2={xMax}
              y1={goalY}
              y2={goalY}
              stroke={C.moss}
              strokeWidth={1}
              strokeDasharray="5 4"
              opacity={0.65}
            />
            <text
              x={4}
              y={Math.max(10, goalY - 6)}
              fill={C.inkFaint}
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.08em',
              }}
            >
              PLAN COMPLETE · {minutesToLabel(goalMinutes ?? 0)}
            </text>
          </g>
        )}

        {goalY !== null && finishMarkers.map((marker) => {
          const x = xScale(marker.date);
          const labelY = Math.max(10, Math.min(yMax - 6, goalY + marker.offsetY));
          const nearRight = x > xMax - 70;
          const nearLeft = x < 70;
          const textAnchor = nearRight ? 'end' : nearLeft ? 'start' : 'middle';
          const labelX = nearRight ? x + 4 : nearLeft ? x - 4 : x;
          return (
            <g
              key={marker.key}
              data-testid={`finish-flag-${marker.key}`}
              data-date={toISODate(marker.date)}
              pointerEvents="none"
            >
              <line
                x1={x}
                x2={x}
                y1={goalY}
                y2={labelY < goalY ? labelY + 3 : labelY - 11}
                stroke={marker.color}
                strokeWidth={1}
                opacity={0.55}
              />
              <circle
                cx={x}
                cy={goalY}
                r={4.5}
                fill={marker.color}
                stroke={C.card}
                strokeWidth={1.5}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor={textAnchor}
                fill={marker.color}
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {marker.label} · {format(marker.date, 'MMM d')}
              </text>
            </g>
          );
        })}

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

        {hoverPoint && hoverDate && (
          <g pointerEvents="none">
            <g data-testid="crosshair-guides">
              <line
                x1={hoverPoint.x}
                x2={hoverPoint.x}
                y1={0}
                y2={yMax}
                stroke={C.inkSoft}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.55}
              />
              <line
                x1={0}
                x2={xMax}
                y1={hoverPoint.y}
                y2={hoverPoint.y}
                stroke={C.inkSoft}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.45}
              />
            </g>

            {crosshairSeries.map((series) => (
              <circle
                key={series.key}
                data-testid={`crosshair-dot-${series.key}`}
                cx={hoverPoint.x}
                cy={yScale(series.value)}
                r={4}
                fill={series.color}
                stroke={C.card}
                strokeWidth={1.5}
              />
            ))}

            <g data-testid="crosshair-hours-pill">
              <rect
                x={-54}
                y={Math.max(0, Math.min(yMax - 18, hoverPoint.y - 9))}
                width={50}
                height={18}
                rx={4}
                fill={C.ink}
              />
              <text
                x={-8}
                y={Math.max(13, Math.min(yMax - 5, hoverPoint.y + 4))}
                textAnchor="end"
                fill={C.card}
                style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10 }}
              >
                {minutesToLabel(yScale.invert(hoverPoint.y))}
              </text>
            </g>

            <g data-testid="crosshair-date-pill">
              <rect
                x={Math.max(0, Math.min(xMax - 58, hoverPoint.x - 29))}
                y={yMax + 2}
                width={58}
                height={18}
                rx={4}
                fill={C.ink}
              />
              <text
                x={Math.max(29, Math.min(xMax - 29, hoverPoint.x))}
                y={yMax + 15}
                textAnchor="middle"
                fill={C.card}
                style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10 }}
              >
                {format(hoverDate, 'MMM d')}
              </text>
            </g>

            {(() => {
              const boxWidth = 160;
              const rowHeight = 16;
              const boxHeight = 26 + crosshairSeries.length * rowHeight;
              const boxX = hoverPoint.x + 12 + boxWidth <= xMax
                ? hoverPoint.x + 12
                : Math.max(0, hoverPoint.x - boxWidth - 12);
              const boxY = Math.max(4, Math.min(yMax - boxHeight - 4, hoverPoint.y + 12));
              return (
                <g data-testid="crosshair-readout">
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxWidth}
                    height={boxHeight}
                    rx={8}
                    fill="#FFFDF7"
                    stroke={C.rule}
                  />
                  <text
                    x={boxX + 11}
                    y={boxY + 16}
                    fill={C.inkSoft}
                    style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, fontWeight: 700 }}
                  >
                    {format(hoverDate, 'MMM d')}
                  </text>
                  {crosshairSeries.map((series, index) => {
                    const rowY = boxY + 32 + index * rowHeight;
                    return (
                      <g key={series.key}>
                        <circle cx={boxX + 13} cy={rowY - 4} r={4} fill={series.color} />
                        <text
                          x={boxX + 24}
                          y={rowY}
                          fill={C.inkSoft}
                          style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10 }}
                        >
                          {series.label}
                        </text>
                        <text
                          x={boxX + boxWidth - 10}
                          y={rowY}
                          textAnchor="end"
                          fill={C.ink}
                          style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, fontWeight: 700 }}
                        >
                          {minutesToLabel(series.value)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          </g>
        )}
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
  deadlineISO?: string;
  forecastFinishISO?: string;
  scenarioFinishISO?: string;
  totalPlannedMinutes?: number;
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
  deadlineISO,
  forecastFinishISO,
  scenarioFinishISO,
  totalPlannedMinutes,
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
            deadlineISO={deadlineISO}
            forecastFinishISO={forecastFinishISO}
            scenarioFinishISO={scenarioFinishISO}
            totalPlannedMinutes={totalPlannedMinutes}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={20} height={10} aria-hidden="true">
          <line x1={0} y1={5} x2={20} y2={5} stroke={accentColor} strokeWidth={1.5} strokeDasharray="3 3" />
        </svg>
        <span style={labelStyle}>GP forecast</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={20} height={10} aria-hidden="true">
          <line x1={0} y1={5} x2={20} y2={5} stroke={C.moss} strokeWidth={2.5} strokeDasharray="6 5" />
        </svg>
        <span style={labelStyle}>Your pace</span>
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
