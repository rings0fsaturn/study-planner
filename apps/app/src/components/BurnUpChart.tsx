import { useMemo } from 'react';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AreaClosed, LinePath, Line } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { curveStepAfter, curveBasis, curveMonotoneX } from '@visx/curve';
import { format, parseISO } from 'date-fns';

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

function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  return `${h}h`;
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
  const todayDate = parseISO(today);
  const isBehind = data.deficit < 0;
  const accentColor = isBehind ? C.rust : C.moss;

  const plannedParsed = useMemo(
    () => planned.map((d) => ({ date: parseISO(d.date), minutes: d.minutes })),
    [planned],
  );
  const actualParsed = useMemo(
    () => actual.map((d) => ({ date: parseISO(d.date), minutes: d.minutes })),
    [actual],
  );
  const gpParsed = useMemo(
    () => gpCurve.map((d) => ({ date: parseISO(d.date), mean: d.mean, lower: d.lower, upper: d.upper })),
    [gpCurve],
  );

  /* ---- Scales ---- */
  const allDates = [
    ...plannedParsed.map((d) => d.date),
    ...gpParsed.map((d) => d.date),
  ];
  const allMinutes = [
    ...plannedParsed.map((d) => d.minutes),
    ...gpParsed.map((d) => d.upper),
  ];

  const xMax = width - MARGIN.left - MARGIN.right;
  const yMax = height - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(
    () =>
      scaleTime<number>({
        domain: [
          new Date(Math.min(...allDates.map((d) => d.getTime()))),
          new Date(Math.max(...allDates.map((d) => d.getTime()))),
        ],
        range: [0, xMax],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [xMax, planned, gpCurve],
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, Math.max(...allMinutes) * 1.08],
        range: [yMax, 0],
        nice: true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yMax, planned, gpCurve],
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
          curve={curveBasis}
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
          curve={curveBasis}
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
          numTicks={5}
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
    </div>
  );
}

export default BurnUpChart;
