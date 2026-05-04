import { describe, it, expect } from 'vitest'
import { gpRegression, fitBurnUpGP, choleskyDecompose, choleskySolve } from '../src/gp'

describe('choleskyDecompose', () => {
  it('decomposes a simple positive-definite matrix', () => {
    const A = [
      [4, 2],
      [2, 3],
    ]
    const L = choleskyDecompose(A)
    expect(L[0][0]).toBeCloseTo(2, 5)
    expect(L[1][0]).toBeCloseTo(1, 5)
    expect(L[1][1]).toBeCloseTo(Math.sqrt(2), 4)
    expect(L[0][1]).toBe(0)
  })
})

describe('choleskySolve', () => {
  it('solves L L^T x = b correctly', () => {
    const A = [
      [4, 2],
      [2, 3],
    ]
    const L = choleskyDecompose(A)
    const b = [8, 7]
    const x = choleskySolve(L, b)
    // A * x should equal b
    const result0 = A[0][0] * x[0] + A[0][1] * x[1]
    const result1 = A[1][0] * x[0] + A[1][1] * x[1]
    expect(result0).toBeCloseTo(b[0], 3)
    expect(result1).toBeCloseTo(b[1], 3)
  })
})

describe('gpRegression', () => {
  it('tracks linear data closely', () => {
    const trainX = Array.from({ length: 10 }, (_, i) => i)
    const trainY = trainX.map((x) => x * 30)
    const testX = Array.from({ length: 12 }, (_, i) => i)

    const { mean, variance } = gpRegression(trainX, trainY, testX)

    for (let i = 0; i < 10; i++) {
      expect(mean[i]).toBeCloseTo(i * 30, 0)
    }
    for (let i = 0; i < 10; i++) {
      expect(variance[i]).toBeLessThan(variance[11])
    }
  })

  it('has wider CI beyond training data', () => {
    const trainX = Array.from({ length: 7 }, (_, i) => i)
    const trainY = trainX.map((x) => x * 20)
    const testX = [3, 10, 15]

    const { variance } = gpRegression(trainX, trainY, testX)
    expect(variance[2]).toBeGreaterThan(variance[0])
  })

  it('returns wide variance for single point', () => {
    const { variance } = gpRegression([0], [100], [0, 5])
    expect(variance[0]).toBeGreaterThan(1000)
    expect(variance[1]).toBeGreaterThan(1000)
  })

  it('returns zeros for empty input', () => {
    const { mean, variance } = gpRegression([], [], [0, 1, 2])
    expect(mean).toEqual([0, 0, 0])
    expect(variance.every((v) => v > 0)).toBe(true)
  })
})

describe('fitBurnUpGP', () => {
  it('returns empty for no actual points', () => {
    const result = fitBurnUpGP([], '2026-01-01', '2026-02-01', '2026-01-15')
    expect(result).toEqual([])
  })

  it('produces GPPoints with extrapolation CI inflation', () => {
    const actualPoints = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      minutes: (i + 1) * 60,
    }))

    const result = fitBurnUpGP(
      actualPoints,
      '2026-01-01',
      '2026-01-20',
      '2026-01-10',
    )

    expect(result.length).toBeGreaterThan(0)
    expect(result[0].date).toBe('2026-01-01')

    const todayPoint = result.find((p) => p.date === '2026-01-10')
    const futurePoint = result.find((p) => p.date === '2026-01-15')
    expect(todayPoint).toBeDefined()
    expect(futurePoint).toBeDefined()

    if (todayPoint && futurePoint) {
      const todayWidth = todayPoint.upper - todayPoint.lower
      const futureWidth = futurePoint.upper - futurePoint.lower
      expect(futureWidth).toBeGreaterThan(todayWidth)
    }
  })

  it('produces smooth curve through data', () => {
    const actualPoints = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      minutes: (i + 1) * 45 + (i % 3) * 10,
    }))

    const result = fitBurnUpGP(
      actualPoints,
      '2026-01-01',
      '2026-01-28',
      '2026-01-14',
    )

    const meansInTraining = result
      .filter((p) => p.date <= '2026-01-14')
      .map((p) => p.mean)

    // Means should be monotonically non-decreasing (cumulative data)
    for (let i = 1; i < meansInTraining.length; i++) {
      expect(meansInTraining[i]).toBeGreaterThanOrEqual(meansInTraining[i - 1] - 5)
    }
  })
})
