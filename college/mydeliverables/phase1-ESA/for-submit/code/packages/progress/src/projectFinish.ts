export const COLD_START_N = 5

export interface FinishProjection {
  finishDate: string | null
  confidenceInterval: [string, string] | null
  basis: 'gp' | 'analytic'
  provisional: true
}

interface GPPointLike {
  date: string
  mean: number
  lower: number
  upper: number
}

function dateToMs(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getTime()
}

function daysBetween(start: string, end: string): number {
  return Math.round((dateToMs(end) - dateToMs(start)) / 86_400_000)
}

function addDaysISO(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function firstCrossing(
  gpCurve: GPPointLike[],
  selector: (point: GPPointLike) => number,
  target: number,
): string | null {
  return gpCurve.find((point) => selector(point) >= target)?.date ?? null
}

function analyticProjection(args: {
  consumedActualMin: number
  remainingActualMin: number
  startDate: string
  today: string
}): FinishProjection {
  const elapsedDays = Math.max(1, daysBetween(args.startDate, args.today))
  const dailyRate = args.consumedActualMin / elapsedDays
  if (dailyRate <= 0 || args.remainingActualMin <= 0) {
    return {
      finishDate: args.remainingActualMin <= 0 ? args.today : null,
      confidenceInterval: null,
      basis: 'analytic',
      provisional: true,
    }
  }

  return {
    finishDate: addDaysISO(args.today, Math.ceil(args.remainingActualMin / dailyRate)),
    confidenceInterval: null,
    basis: 'analytic',
    provisional: true,
  }
}

export function projectFinish(args: {
  sessionCount: number
  consumedActualMin: number
  remainingActualMin: number
  startDate: string
  today: string
  horizonEnd: string
  gpCurve: GPPointLike[]
  totalPlanned: number
}): FinishProjection {
  if (args.sessionCount === 0 || args.consumedActualMin <= 0) {
    return {
      finishDate: null,
      confidenceInterval: null,
      basis: 'analytic',
      provisional: true,
    }
  }

  const analytic = () => analyticProjection({
    consumedActualMin: args.consumedActualMin,
    remainingActualMin: args.remainingActualMin,
    startDate: args.startDate,
    today: args.today,
  })

  if (args.sessionCount < COLD_START_N) {
    return analytic()
  }

  if (args.gpCurve.length === 0 || args.totalPlanned <= 0) {
    return analytic()
  }

  const gpFinish = firstCrossing(args.gpCurve, (point) => point.mean, args.totalPlanned)
  if (gpFinish === null || gpFinish >= args.horizonEnd) {
    return analytic()
  }

  const ciUpper = firstCrossing(args.gpCurve, (point) => point.upper, args.totalPlanned)
  const ciLower = firstCrossing(args.gpCurve, (point) => point.lower, args.totalPlanned)

  return {
    finishDate: gpFinish,
    confidenceInterval: ciUpper && ciLower ? [ciUpper, ciLower] : null,
    basis: 'gp',
    provisional: true,
  }
}
