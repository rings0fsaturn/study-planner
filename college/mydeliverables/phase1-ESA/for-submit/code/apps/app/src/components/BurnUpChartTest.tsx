import { BurnUpChart, BurnUpPlot } from './BurnUpChart';
import type { BurnUpData } from '@study-tracker/progress';
import { addDays, format } from 'date-fns';

/* ------------------------------------------------------------------ */
/*  Synthetic data generator                                           */
/*  8-week (56-day) plan, user is at day 28 and ~4h behind             */
/* ------------------------------------------------------------------ */

function generateTestData(): BurnUpData {
  const startDate = new Date('2026-04-06'); // a Monday
  const totalDays = 56;
  const dayNumber = 28;
  const todayDate = addDays(startDate, dayNumber - 1); // day 28

  // Schedule: Mon(1), Wed(3), Fri(5), Sat(6) — 90min per session = 6h/week
  const sessionDays = new Set([1, 3, 5, 6]); // day-of-week (0=Sun)
  const sessionMinutes = 90;

  /* ---- Planned (cumulative staircase) ---- */
  const planned: { date: string; minutes: number }[] = [];
  let cumPlanned = 0;
  // Add the starting point
  planned.push({ date: format(startDate, 'yyyy-MM-dd'), minutes: 0 });

  for (let d = 0; d < totalDays; d++) {
    const date = addDays(startDate, d);
    const dow = date.getDay();
    if (sessionDays.has(dow)) {
      cumPlanned += sessionMinutes;
      planned.push({ date: format(date, 'yyyy-MM-dd'), minutes: cumPlanned });
    }
  }

  /* ---- Actual (cumulative, with variation, ~4h behind at day 28) ---- */
  // Seed a deterministic pseudo-random for reproducibility
  let seed = 42;
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  const actual: { date: string; minutes: number }[] = [];
  let cumActual = 0;
  actual.push({ date: format(startDate, 'yyyy-MM-dd'), minutes: 0 });

  for (let d = 1; d < dayNumber; d++) {
    const date = addDays(startDate, d);
    const dow = date.getDay();
    if (sessionDays.has(dow)) {
      // User studies with variation: sometimes skips, sometimes does more
      const roll = rand();
      let studied: number;
      if (roll < 0.15) {
        // Skip day entirely (15% chance)
        studied = 0;
      } else if (roll < 0.3) {
        // Short session
        studied = Math.round(45 + rand() * 30);
      } else if (roll < 0.85) {
        // Normal-ish session
        studied = Math.round(65 + rand() * 40);
      } else {
        // Extra long session
        studied = Math.round(100 + rand() * 30);
      }
      cumActual += studied;
      actual.push({ date: format(date, 'yyyy-MM-dd'), minutes: cumActual });
    }
  }

  // Calculate the deficit (negative = behind)
  // Find planned value at day 28
  let plannedAtToday = 0;
  for (const p of planned) {
    if (p.date <= format(todayDate, 'yyyy-MM-dd')) {
      plannedAtToday = p.minutes;
    }
  }
  const deficit = cumActual - plannedAtToday;

  /* ---- GP (Gaussian Process prediction) ---- */
  // Smooth curve through actual data, extrapolating into the future
  // CI band widens in the future
  const gpPoints: { date: string; mean: number; lower: number; upper: number }[] = [];
  const totalGPDays = 70; // extend past plan end for extrapolation

  // Simple GP-like: linear interpolation through actual, then project trend
  // Trend: average minutes per study day so far
  const studyDaysSoFar = actual.length - 1; // exclude the 0 point
  const avgPerStudyDay = studyDaysSoFar > 0 ? cumActual / studyDaysSoFar : 0;

  // Estimate total study days per week: 4 (Mon/Wed/Fri/Sat)
  const studyDaysPerWeek = 4;

  for (let d = 0; d <= totalGPDays; d++) {
    const date = addDays(startDate, d);
    const dateStr = format(date, 'yyyy-MM-dd');

    let meanVal: number;

    if (d < dayNumber) {
      // Historical: interpolate through actual data
      const matching = actual.find((a) => a.date === dateStr);
      if (matching) {
        meanVal = matching.minutes;
      } else {
        // Interpolate between surrounding actuals
        let before = actual[0];
        let after = actual[actual.length - 1];
        for (let i = 0; i < actual.length - 1; i++) {
          if (actual[i].date <= dateStr && actual[i + 1].date > dateStr) {
            before = actual[i];
            after = actual[i + 1];
            break;
          }
        }
        const bDate = new Date(before.date).getTime();
        const aDate = new Date(after.date).getTime();
        const cDate = new Date(dateStr).getTime();
        const t = aDate !== bDate ? (cDate - bDate) / (aDate - bDate) : 0;
        meanVal = before.minutes + t * (after.minutes - before.minutes);
      }
    } else {
      // Future projection: continue at current rate
      const futureDays = d - dayNumber + 1;
      const futureWeeks = futureDays / 7;
      const futureStudyDays = futureWeeks * studyDaysPerWeek;
      meanVal = cumActual + futureStudyDays * avgPerStudyDay;
    }

    // CI widens with distance from today
    const distFromToday = Math.abs(d - dayNumber + 1);
    const baseUncertainty = 15; // minutes
    const growthRate = d >= dayNumber ? 12 : 3; // wider in future
    const uncertainty = baseUncertainty + distFromToday * growthRate;

    gpPoints.push({
      date: dateStr,
      mean: Math.max(0, meanVal),
      lower: Math.max(0, meanVal - uncertainty),
      upper: meanVal + uncertainty,
    });
  }

  return {
    planned,
    actual,
    gpCurve: gpPoints,
    today: format(todayDate, 'yyyy-MM-dd'),
    startDate: format(startDate, 'yyyy-MM-dd'),
    deadline: format(addDays(startDate, totalDays - 1), 'yyyy-MM-dd'),
    deficit,
    dayNumber,
    totalDays,
  };
}

/* ------------------------------------------------------------------ */
/*  Test page                                                          */
/* ------------------------------------------------------------------ */

const testData = generateTestData();
const totalPlannedMinutes = Math.max(0, ...testData.planned.map((point) => point.minutes));
const scenarioFinishISO = format(addDays(new Date(`${testData.today}T00:00:00.000Z`), 35), 'yyyy-MM-dd');
const forecastFinishISO = format(addDays(new Date(`${testData.today}T00:00:00.000Z`), 42), 'yyyy-MM-dd');
const actualAtToday = Math.max(0, ...testData.actual.map((point) => point.minutes));

export default function BurnUpChartTest() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--surface-page, #F5EFE4)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 800 }}>
        <BurnUpChart data={testData} />

        <div style={{ marginTop: 24 }}>
          <BurnUpPlot
            data={testData}
            deadlineISO={testData.deadline}
            forecastFinishISO={forecastFinishISO}
            scenarioFinishISO={scenarioFinishISO}
            totalPlannedMinutes={totalPlannedMinutes}
            scenarioPoints={[
              { date: testData.today, minutes: actualAtToday },
              { date: scenarioFinishISO, minutes: totalPlannedMinutes },
            ]}
            style={{ height: 400 }}
          />
        </div>

        {/* Debug info */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: 'var(--surface-card, #FBF7EE)',
            border: '1px solid var(--border-subtle, #E6DCC8)',
            borderRadius: 'var(--radius-md, 10px)',
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 11,
            color: 'var(--text-secondary, #5C4D40)',
            lineHeight: 1.8,
          }}
        >
          <div style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-tertiary, #8B7B6B)',
            marginBottom: 8,
            fontWeight: 500,
          }}>
            Debug info
          </div>
          <div>Planned points: {testData.planned.length}</div>
          <div>Actual points: {testData.actual.length}</div>
          <div>GP points: {testData.gpCurve.length}</div>
          <div>Today: {testData.today}</div>
          <div>Deficit: {testData.deficit} min ({Math.round(testData.deficit / 60 * 10) / 10}h)</div>
          <div>Day: {testData.dayNumber} / {testData.totalDays}</div>
        </div>
      </div>
    </div>
  );
}
