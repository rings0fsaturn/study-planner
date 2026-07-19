import { describe, it, expect } from 'vitest'
import {
  initKalman,
  kalmanPredict,
  kalmanUpdate,
  runKalmanOnPhase,
} from '../src/kalman'

describe('initKalman', () => {
  it('initializes state with given level and zero slope', () => {
    const state = initKalman(1.0, 0.1)
    expect(state.x[0]).toBe(1.0)
    expect(state.x[1]).toBe(0)
    expect(state.P[0][0]).toBe(0.1)
  })
})

describe('kalmanPredict + kalmanUpdate', () => {
  it('prediction advances level by slope', () => {
    const state = initKalman(1.0, 0.1)
    state.x[1] = 0.05
    const predicted = kalmanPredict(state)
    expect(predicted.x[0]).toBeCloseTo(1.05, 5)
    expect(predicted.x[1]).toBeCloseTo(0.05, 5)
  })

  it('update adjusts level toward observation', () => {
    const state = initKalman(1.0, 0.1)
    const predicted = kalmanPredict(state)
    const updated = kalmanUpdate(predicted, 0.8, 0.05)
    expect(updated.x[0]).toBeLessThan(1.0)
    expect(updated.x[0]).toBeGreaterThan(0.8)
  })
})

describe('runKalmanOnPhase', () => {
  it('tracks constant input to that constant', () => {
    const ratios = Array.from({ length: 20 }, () => 0.9)
    const result = runKalmanOnPhase(ratios, 1.0, 0.1, 0.01)
    expect(result.finalLevel).toBeCloseTo(0.9, 1)
    expect(Math.abs(result.finalSlope)).toBeLessThan(0.05)
  })

  it('detects negative slope for decreasing trend', () => {
    const ratios = Array.from({ length: 20 }, (_, i) => 1.0 - i * 0.02)
    const result = runKalmanOnPhase(ratios, 1.0, 0.1, 0.01)
    expect(result.finalSlope).toBeLessThan(0)
  })

  it('detects positive slope for increasing trend', () => {
    const ratios = Array.from({ length: 20 }, (_, i) => 0.7 + i * 0.02)
    const result = runKalmanOnPhase(ratios, 0.7, 0.1, 0.01)
    expect(result.finalSlope).toBeGreaterThan(0)
  })

  it('handles short sequence with wide uncertainty', () => {
    const ratios = [0.9, 0.85]
    const result = runKalmanOnPhase(ratios, 1.0, 0.1, 0.05)
    expect(result.levelUncertainty).toBeGreaterThan(0)
    expect(result.slopeUncertainty).toBeGreaterThan(0)
  })

  it('handles empty input gracefully', () => {
    const result = runKalmanOnPhase([], 1.0, 0.1, 0.01)
    expect(result.finalLevel).toBe(1.0)
    expect(result.finalSlope).toBe(0)
  })
})
