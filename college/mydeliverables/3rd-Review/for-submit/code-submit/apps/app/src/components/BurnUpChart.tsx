import { useMemo } from 'react';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AreaClosed, LinePath, Line } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { curveStepAfter, curveMonotoneX } from '@visx/curve';
import { format } from 'date-fns';

import type { BurnUpData } from '@study-tracker/progress';

/* ------------------------------------------------------------------ */
/*  Palette — hard-coded from Marginalia tokens.css                    */
/*  (CSS vars don't resolve inside SVG fill/stroke attributes)         */
/* ------------------------------------------------------------------ */

const C = {
  ink:        '#2A1F18',
  inkSoft:    '#5C4D40',
  inkFaint:   '#8B7B6B',
  card:       '#FBF7EE',
  paperDeep:  '#EDE3D2',
  ruleSoft:   '#E6DCC8',
  rule:       '#D9CDB8',
  rust:       '#A0432A',
  moss:       '#4A6B3A',
  terracotta: '#B85C38',
} as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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
  const step = [30, 60, 120, 180, 240, 360, 480, 600, 720].find((value) => value >= targetGap) ?? 720;
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

  if (min === max) {
    return [new Date(min), addDays(new Date(max), 1)];
  }

  return [new Date(min), new Date(max)];
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
}): number {
  const primaryMax = Math.max(0, ...series.planned, ...series.actual, ...series.gpMean);
  const gpUpperMax = Math.max(0, ...series.gpUpper);
  const boundedGpUpper = primaryMax > 0 ? Math.min(gpUpperMax, primaryMax * 1.25) : gpUpperMax;
  const rawMax = Math.max(60, primaryMax, boundedGpUpper);
  return Math.ceil((rawMax * 1.08) / 30) * 30;
}

function deficitLabel(deficit: number): { text: string; color: string } {
  const abs = Math.abs(deficit);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const pad = String(m).padStart(2, '0');
  if (deficit < 0) {
    return { text: `–${h}h ${pad}m behind plan today`, color: C.rust };
  }
  if (deficit > 0) {
    return { text: `+${h}h ${pad}m ahead of plan today`, color: C.moss };
  }
  return { text: 'On track', color: C.moss };
}

/* ------------------------------------------------------------------ */
/*  Inner chart (receives width/height from ParentSize)                */
/* ------------------------------------------------------------------ */

const MARGIN = { top: 12, right: 20, bottom: 40, left: 48 };

interface InnerProps {
  data: BurnUpData;
  width: number;
  height: number;
}

function BurnUpChartInner({ data, width, height }: InnerProps) {
  const { planned, actual, gpCurve, today } = data;

  /* ---- Derived data ---- */
  const todayDate = parseISODateUTC(today);
  const isBehind = data.deficit < 0;
  const accentColor = isBehind ? C.rust : C.moss;

  const plannedParsed = useMemo(
    () => planned.map((d) => ({ date: parseISODateUTC(d.date), minutes: d.minutes })),
    [planned],
  );
  const actualParsed = useMemo(
    () => actual.map((d) => ({ date: parseISODateUTC(d.date), minutes: d.minutes })),
    [actual],
  );
  const gpParsed = useMemo(
    () => gpCurve.map((d) => ({ date: parseISODateUTC(d.date), mean: d.mean, lower: d.lower, upper: d.upper })),
    [gpCurve],
  );

  /* ---- Scales ---- */
  const allDates = [
    ...plannedParsed.map((d) => d.date),
    ...actualParsed.map((d) => d.date),
    ...gpParsed.map((d) => d.date),
  ];
  const dateDomain = buildBurnUpDateDomain(data, allDates);
  const yDomainMax = buildBurnUpYDomainMax({
    planned: plannedParsed.map((d) => d.minutes),
    actual: actualParsed.map((d) => d.minutes),
    gpMean: gpParsed.map((d) => d.mean),
    gpUpper: gpParsed.map((d) => d.upper),
  });
  const minuteTickValues = buildMinuteTickValues(yDomainMax);

  const xMax = width - MARGIN.left - MARGIN.right;
  const yMax = height - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(
    () =>
      scaleTime<number>({
        domain: dateDomain,
        range: [0, xMax],
      }),
    [xMax, dateDomain],
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, yDomainMax],
        range: [yMax, 0],
        nice: true,
      }),
    [yMax, yDomainMax],
  );

  const todayX = xScale(todayDate);

  /* ---- Build the "behind" polygon ---- */
  const behindPath = useMemo(() => {
    if (!isBehind || actualParsed.length < 2) return null;

    // Sample planned values at each actual data point's date
    // For behind-fill, we need the area between planned and actual
    // where actual < planned
    const segments: { date: Date; plannedMin: number; actualMin: number }[] = [];

    for (const ap of actualParsed) {
      // Find the planned value at this date (step function: last planned <= date)
      let pVal = 0;
      for (const pp of plannedParsed) {
        if (pp.date <= ap.date) pVal = pp.minutes;
        else break;
      }
      segments.push({ date: ap.date, plannedMin: pVal, actualMin: ap.minutes });
    }

    return segments;
  }, [isBehind, actualParsed, plannedParsed]);

  if (width < 10) return null;

  return (
    <svg width={width} height={height}>
      <rect x={0} y={0} width={width} height={height} fill={C.card} rx={0} />

      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* ---- Extrapolation background (after today) ---- */}
        <rect
          x={todayX}
          y={0}
          width={Math.max(0, xMax - todayX)}
          height={yMax}
          fill={C.paperDeep}
          opacity={0.45}
        />

        {/* ---- Behind fill ---- */}
        {behindPath && behindPath.length >= 2 && (
          <AreaClosed
            data={behindPath}
            x={(d) => xScale(d.date)}
            y0={(d) => yScale(d.actualMin)}
            y1={(d) => yScale(d.plannedMin)}
            yScale={yScale}
            fill={C.rust}
            opacity={0.1}
            curve={curveMonotoneX}
          />
        )}

        {/* ---- GP confidence band ---- */}
        <AreaClosed
          data={gpParsed}
          x={(d) => xScale(d.date)}
          y0={(d) => yScale(d.lower)}
          y1={(d) => yScale(d.upper)}
          yScale={yScale}
          fill={accentColor}
          opacity={0.12}
          curve={curveMonotoneX}
        />

        {/* ---- Planned line (dashed staircase) ---- */}
        <LinePath
          data={plannedParsed}
          x={(d) => xScale(d.date)}
          y={(d) => yScale(d.minutes)}
          stroke={C.inkFaint}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          curve={curveStepAfter}
        />

        {/* ---- GP mean curve ---- */}
        <LinePath
          data={gpParsed}
          x={(d) => xScale(d.date)}
          y={(d) => yScale(d.mean)}
          stroke={accentColor}
          strokeWidth={1.5}
          strokeDasharray="3 3"
          curve={curveMonotoneX}
        />

        {/* ---- Actual line ---- */}
        <LinePath
          data={actualParsed}
          x={(d) => xScale(d.date)}
          y={(d) => yScale(d.minutes)}
          stroke={accentColor}
          strokeWidth={2}
          curve={curveMonotoneX}
        />

        {/* ---- Actual dots ---- */}
        {actualParsed.map((d, i) => (
          <circle
            key={i}
            cx={xScale(d.date)}
            cy={yScale(d.minutes)}
            r={3}
            fill={accentColor}
            stroke={C.card}
            strokeWidth={1.5}
          />
        ))}

        {/* ---- Today vertical line ---- */}
        <Line
          from={{ x: todayX, y: 0 }}
          to={{ x: todayX, y: yMax }}
          stroke={C.inkSoft}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text
          x={todayX}
          y={-4}
          textAnchor="middle"
          fill={C.inkSoft}
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
          }}
        >
          TODAY
        </text>

        {/* ---- Axes ---- */}
        <AxisBottom
          top={yMax}
          scale={xScale}
          numTicks={Math.min(6, Math.floor(xMax / 80))}
          tickFormat={(v) => format(v as Date, 'MMM dd')}
          stroke={C.ruleSoft}
          tickStroke={C.ruleSoft}
          tickLabelProps={() => ({
            fill: C.inkFaint,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: '0.03em',
            textAnchor: 'middle' as const,
            dy: '0.3em',
          })}
        />
        <AxisLeft
          scale={yScale}
          tickValues={minuteTickValues}
          tickFormat={(v) => minutesToLabel(v as number)}
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
          })}
        />
      </Group>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

function Legend({ isBehind }: { isBehind: boolean }) {
  const accentColor = isBehind ? C.rust : C.moss;
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Actual */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={20} height={10}>
          <line x1={0} y1={5} x2={20} y2={5} stroke={accentColor} strokeWidth={2} />
        </svg>
        <span
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10,
            color: 'var(--text-tertiary, #8B7B6B)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Actual
        </span>
      </div>

      {/* Planned */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={20} height={10}>
          <line x1={0} y1={5} x2={20} y2={5} stroke={C.inkFaint} strokeWidth={1.5} strokeDasharray="4 3" />
        </svg>
        <span
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 10,
            color: 'var(--text-tertiary, #8B7B6B)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Planned
        </span>
      </div>

      {/* Behind/Ahead fill */}
      {isBehind && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={14} height={10}>
            <rect x={0} y={0} width={14} height={10} fill={C.rust} opacity={0.18} rx={2} />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 10,
              color: 'var(--text-tertiary, #8B7B6B)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Behind
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Public component                                                   */
/* ------------------------------------------------------------------ */

export function BurnUpChart({ data }: { data: BurnUpData }) {
  const isBehind = data.deficit < 0;
  const { text: defText, color: defColor } = deficitLabel(data.deficit);
  const hasData = hasMeaningfulBurnUpData(data.planned, data.actual);

  return (
    <div
      style={{
        background: 'var(--surface-card, #FBF7EE)',
        border: '1px solid var(--border-subtle, #E6DCC8)',
        borderRadius: 'var(--radius-md, 10px)',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {!hasData ? (
        <div
          style={{
            padding: '24px 20px',
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
      {/* ---- Header ---- */}
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

      {/* ---- Chart ---- */}
      <div style={{ width: '100%', height: 280 }}>
        <ParentSize>
          {({ width, height }) => (
            <BurnUpChartInner data={data} width={width} height={height} />
          )}
        </ParentSize>
      </div>

      {/* ---- Footer ---- */}
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
        {/* Deficit stat */}
        <div>
          <span
            style={{
              fontFamily: "var(--font-display, 'Fraunces', Georgia, serif)",
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: defColor,
              lineHeight: 1,
              fontFeatureSettings: "'tnum'",
            }}
          >
            {defText}
          </span>
        </div>

        {/* Legend */}
        <Legend isBehind={isBehind} />
      </div>
        </>
      )}
    </div>
  );
}

export default BurnUpChart;
