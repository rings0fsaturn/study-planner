import type { CumulativePoint, GPPoint } from './types'
import {
  GP_LENGTH_SCALE,
  GP_NOISE_RATIO,
  GP_EXTRAPOLATION_CI_INFLATION,
  GP_EXTRAPOLATION_DAYS,
} from './config'

export function rbfKernel(
  x1: number,
  x2: number,
  lengthScale: number,
  signalVariance: number,
): number {
  const diff = x1 - x2
  return signalVariance * Math.exp(-0.5 * (diff / lengthScale) ** 2)
}

function computeKernelMatrix(
  xs: number[],
  lengthScale: number,
  signalVariance: number,
  noiseVariance: number,
): number[][] {
  const n = xs.length
  const K: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      K[i][j] = rbfKernel(xs[i], xs[j], lengthScale, signalVariance)
      if (i === j) K[i][j] += noiseVariance
    }
  }
  return K
}

function crossKernelMatrix(
  xs1: number[],
  xs2: number[],
  lengthScale: number,
  signalVariance: number,
): number[][] {
  const n = xs1.length
  const m = xs2.length
  const K: number[][] = Array.from({ length: n }, () => new Array(m).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      K[i][j] = rbfKernel(xs1[i], xs2[j], lengthScale, signalVariance)
    }
  }
  return K
}

export function choleskyDecompose(A: number[][]): number[][] {
  const n = A.length
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  const JITTER = 1e-8

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k]
      }
      if (i === j) {
        const val = A[i][i] + JITTER - sum
        L[i][j] = Math.sqrt(Math.max(val, 1e-12))
      } else {
        L[i][j] = (A[i][j] - sum) / L[j][j]
      }
    }
  }
  return L
}

function forwardSolve(L: number[][], b: number[]): number[] {
  const n = b.length
  const y = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let j = 0; j < i; j++) {
      sum += L[i][j] * y[j]
    }
    y[i] = (b[i] - sum) / L[i][i]
  }
  return y
}

function backSolve(L: number[][], y: number[]): number[] {
  const n = y.length
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0
    for (let j = i + 1; j < n; j++) {
      sum += L[j][i] * x[j]
    }
    x[i] = (y[i] - sum) / L[i][i]
  }
  return x
}

export function choleskySolve(L: number[][], b: number[]): number[] {
  const y = forwardSolve(L, b)
  return backSolve(L, y)
}

function linearFit(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 }
  const xMean = xs.reduce((s, x) => s + x, 0) / n
  const yMean = ys.reduce((s, y) => s + y, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean)
    den += (xs[i] - xMean) ** 2
  }
  const slope = den > 0 ? num / den : 0
  const intercept = yMean - slope * xMean
  return { slope, intercept }
}

export function gpRegression(
  trainX: number[],
  trainY: number[],
  testX: number[],
): { mean: number[]; variance: number[] } {
  const n = trainX.length
  if (n === 0) {
    return {
      mean: new Array(testX.length).fill(0),
      variance: new Array(testX.length).fill(10000),
    }
  }
  if (n === 1) {
    return {
      mean: new Array(testX.length).fill(trainY[0]),
      variance: new Array(testX.length).fill(10000),
    }
  }

  // Detrend: fit linear model
  const { slope, intercept } = linearFit(trainX, trainY)
  const residuals = trainY.map((y, i) => y - (slope * trainX[i] + intercept))

  const residualVariance = Math.max(
    residuals.reduce((s, r) => s + r ** 2, 0) / residuals.length,
    10.0,
  )
  const signalVariance = residualVariance
  const noiseVariance = GP_NOISE_RATIO * signalVariance

  // K(X, X) + noise
  const K = computeKernelMatrix(trainX, GP_LENGTH_SCALE, signalVariance, noiseVariance)
  const Ks = crossKernelMatrix(trainX, testX, GP_LENGTH_SCALE, signalVariance)
  const Kss = computeKernelMatrix(testX, GP_LENGTH_SCALE, signalVariance, 0)

  const L = choleskyDecompose(K)
  const alpha = choleskySolve(L, residuals)

  // Mean: Ks^T * alpha
  const m = testX.length
  const muResid = new Array(m).fill(0)
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      muResid[j] += Ks[i][j] * alpha[i]
    }
  }

  // Variance: diag(Kss) - diag(Ks^T K^-1 Ks)
  // Solve L * v = Ks for each test column
  const variance = new Array(m).fill(0)
  for (let j = 0; j < m; j++) {
    const ksCol = trainX.map((_, i) => Ks[i][j])
    const v = forwardSolve(L, ksCol)
    const vSquaredSum = v.reduce((s, vi) => s + vi ** 2, 0)
    variance[j] = Math.max(Kss[j][j] - vSquaredSum, 0)
  }

  // Add trend back
  const mean = muResid.map(
    (r, j) => r + slope * testX[j] + intercept,
  )

  return { mean, variance }
}

function dateToDayIndex(date: string, startDate: string): number {
  const d = new Date(date)
  const s = new Date(startDate)
  return Math.round((d.getTime() - s.getTime()) / (24 * 60 * 60 * 1000))
}

function dayIndexToDate(dayIndex: number, startDate: string): string {
  const s = new Date(startDate)
  const d = new Date(s.getTime() + dayIndex * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export function fitBurnUpGP(
  actualPoints: CumulativePoint[],
  startDate: string,
  endDate: string,
  today: string,
): GPPoint[] {
  if (actualPoints.length === 0) return []

  const trainX = actualPoints.map((p) => dateToDayIndex(p.date, startDate))
  const trainY = actualPoints.map((p) => p.minutes)

  const todayIndex = dateToDayIndex(today, startDate)
  const endIndex = dateToDayIndex(endDate, startDate)
  const extraEnd = Math.max(endIndex, todayIndex) + GP_EXTRAPOLATION_DAYS

  const testXValues: number[] = []
  for (let d = 0; d <= extraEnd; d++) {
    testXValues.push(d)
  }

  const { mean, variance } = gpRegression(trainX, trainY, testXValues)

  return testXValues.map((x, i) => {
    const std = Math.sqrt(variance[i])
    const isExtrapolation = x > todayIndex
    const inflatedStd = isExtrapolation
      ? std * GP_EXTRAPOLATION_CI_INFLATION
      : std
    return {
      date: dayIndexToDate(x, startDate),
      mean: Math.max(mean[i], 0),
      lower: Math.max(mean[i] - 1.96 * inflatedStd, 0),
      upper: mean[i] + 1.96 * inflatedStd,
    }
  })
}
