import {
  updatePosterior,
  computeHierarchicalModel,
  inferTimeOfDay,
} from '../../packages/progress/src/bayesian'
import { runCUSUM, detectRegimeShifts } from '../../packages/progress/src/cusum'
import {
  initKalman,
  kalmanPredict,
  kalmanUpdate,
  runKalmanOnPhase,
} from '../../packages/progress/src/kalman'
import { gpRegression, fitBurnUpGP, choleskyDecompose, choleskySolve } from '../../packages/progress/src/gp'
import { analyzeTrend } from '../../packages/progress/src/trend'
import { calculateStreak, buildStreakGrid } from '../../packages/progress/src/streak'
import { computeCalibration, getPromptDetail } from '../../packages/progress/src/calibration'
import { computeProgress } from '../../packages/progress/src/progress'
import type {
  BayesianPosterior,
  ExceptionalTag,
  RecalibrationResolution,
  RoadmapInput,
} from '../../packages/progress/src/types'
import type { HierarchicalResult } from '../../packages/progress/src/bayesian'
import type { RegimeShiftResult } from '../../packages/progress/src/cusum'
import {
  type FixtureCase,
  makeSession,
  defaultCalibration,
  makeSlot,
  makeProgressRoadmap,
  mulberry32,
} from './helpers'

function defaultBayesian(): HierarchicalResult {
  return {
    globalPosterior: { mean: 1.0, variance: 0.1, sessionCount: 10 },
    globalMultiplier: 1.0,
    roleMultipliers: {},
    insights: [],
  }
}

function defaultCusum(breakpoints: number[] = []): RegimeShiftResult {
  return {
    breakpoints,
    promptNeeded: false,
    cusumState: { upper: 0, lower: 0 },
  }
}

export function progressCases(): FixtureCase[] {
  const prior: BayesianPosterior = { mean: 1.0, variance: 0.1, sessionCount: 0 }

  return [
    // bayesian.test.ts — updatePosterior
    {
      name: 'update-posterior-shifts-toward-observation',
      fn: 'updatePosterior',
      input: { prior, observation: 0.8, observationVariance: 0.1 },
      run: () => updatePosterior(prior, 0.8, 0.1),
    },
    {
      name: 'update-posterior-reduces-variance',
      fn: 'updatePosteriorChain',
      input: {
        prior: { mean: 1.0, variance: 0.1, sessionCount: 0 },
        observations: [1.0, 1.0],
        observationVariance: 0.1,
      },
      run: () => {
        let p: BayesianPosterior = { mean: 1.0, variance: 0.1, sessionCount: 0 }
        const variances: number[] = [p.variance]
        p = updatePosterior(p, 1.0, 0.1)
        variances.push(p.variance)
        p = updatePosterior(p, 1.0, 0.1)
        variances.push(p.variance)
        return { posterior: p, variances }
      },
    },
    // inferTimeOfDay
    {
      name: 'infer-time-of-day-morning',
      fn: 'inferTimeOfDayBatch',
      input: { timestamps: ['2026-01-15T08:00:00', '2026-01-15T11:59:00'] },
      run: () => ({
        results: ['2026-01-15T08:00:00', '2026-01-15T11:59:00'].map((t) => inferTimeOfDay(t)),
      }),
    },
    {
      name: 'infer-time-of-day-afternoon',
      fn: 'inferTimeOfDayBatch',
      input: { timestamps: ['2026-01-15T12:00:00', '2026-01-15T16:59:00'] },
      run: () => ({
        results: ['2026-01-15T12:00:00', '2026-01-15T16:59:00'].map((t) => inferTimeOfDay(t)),
      }),
    },
    {
      name: 'infer-time-of-day-evening',
      fn: 'inferTimeOfDayBatch',
      input: { timestamps: ['2026-01-15T17:00:00', '2026-01-15T22:00:00'] },
      run: () => ({
        results: ['2026-01-15T17:00:00', '2026-01-15T22:00:00'].map((t) => inferTimeOfDay(t)),
      }),
    },
    {
      name: 'infer-time-of-day-default-afternoon',
      fn: 'inferTimeOfDay',
      input: { timestamp: null },
      run: () => inferTimeOfDay(undefined),
    },
    // computeHierarchicalModel
    {
      name: 'hierarchical-empty-input',
      fn: 'computeHierarchicalModel',
      input: { sessions: [], exceptionalIds: [] },
      run: () => computeHierarchicalModel([], new Set()),
    },
    {
      name: 'hierarchical-converges-0-8x',
      fn: 'computeHierarchicalModel',
      input: {
        sessions: Array.from({ length: 10 }, (_, i) =>
          makeSession({
            activeMinutes: 48,
            plannedMinutes: 60,
            sessionId: `s-${i}`,
          }),
        ),
        exceptionalIds: [],
      },
      run: () => {
        const sessions = Array.from({ length: 10 }, (_, i) =>
          makeSession({ activeMinutes: 48, plannedMinutes: 60, sessionId: `s-${i}` }),
        )
        return computeHierarchicalModel(sessions, new Set())
      },
    },
    {
      name: 'hierarchical-per-role-multipliers',
      fn: 'computeHierarchicalModel',
      input: {
        sessions: [
          ...Array.from({ length: 5 }, (_, i) =>
            makeSession({
              activeMinutes: 72,
              plannedMinutes: 60,
              materialRole: 'anchor',
              sessionId: `a-${i}`,
            }),
          ),
          ...Array.from({ length: 5 }, (_, i) =>
            makeSession({
              activeMinutes: 48,
              plannedMinutes: 60,
              materialRole: 'practice',
              sessionId: `p-${i}`,
            }),
          ),
        ],
        exceptionalIds: [],
      },
      run: () => {
        const anchorSessions = Array.from({ length: 5 }, (_, i) =>
          makeSession({
            activeMinutes: 72,
            plannedMinutes: 60,
            materialRole: 'anchor',
            sessionId: `a-${i}`,
          }),
        )
        const practiceSessions = Array.from({ length: 5 }, (_, i) =>
          makeSession({
            activeMinutes: 48,
            plannedMinutes: 60,
            materialRole: 'practice',
            sessionId: `p-${i}`,
          }),
        )
        return computeHierarchicalModel([...anchorSessions, ...practiceSessions], new Set())
      },
    },
    {
      name: 'hierarchical-fallback-global-min-bucket',
      fn: 'computeHierarchicalModel',
      input: {
        sessions: [
          makeSession({
            activeMinutes: 72,
            plannedMinutes: 60,
            materialRole: 'anchor',
            sessionId: 'a-1',
          }),
          makeSession({
            activeMinutes: 72,
            plannedMinutes: 60,
            materialRole: 'anchor',
            sessionId: 'a-2',
          }),
        ],
        exceptionalIds: [],
      },
      run: () => {
        const sessions = [
          makeSession({
            activeMinutes: 72,
            plannedMinutes: 60,
            materialRole: 'anchor',
            sessionId: 'a-1',
          }),
          makeSession({
            activeMinutes: 72,
            plannedMinutes: 60,
            materialRole: 'anchor',
            sessionId: 'a-2',
          }),
        ]
        return computeHierarchicalModel(sessions, new Set())
      },
    },
    {
      name: 'hierarchical-excludes-exceptional',
      fn: 'computeHierarchicalModel',
      input: {
        sessions: Array.from({ length: 5 }, (_, i) =>
          makeSession({
            activeMinutes: i < 3 ? 60 : 30,
            plannedMinutes: 60,
            sessionId: `s-${i}`,
          }),
        ),
        exceptionalIds: ['s-3', 's-4'],
      },
      run: () => {
        const sessions = Array.from({ length: 5 }, (_, i) =>
          makeSession({
            activeMinutes: i < 3 ? 60 : 30,
            plannedMinutes: 60,
            sessionId: `s-${i}`,
          }),
        )
        return computeHierarchicalModel(sessions, new Set(['s-3', 's-4']))
      },
    },
    {
      name: 'hierarchical-excludes-manual',
      fn: 'computeHierarchicalModel',
      input: {
        sessions: [
          makeSession({ source: 'manual', duration: 120, sessionId: 's-1' }),
          makeSession({ source: 'manual', duration: 90, sessionId: 's-2' }),
        ],
        exceptionalIds: [],
      },
      run: () => {
        const sessions = [
          makeSession({ source: 'manual', duration: 120, sessionId: 's-1' }),
          makeSession({ source: 'manual', duration: 90, sessionId: 's-2' }),
        ]
        return computeHierarchicalModel(sessions, new Set())
      },
    },
    {
      name: 'hierarchical-excludes-no-planned-minutes',
      fn: 'computeHierarchicalModel',
      input: {
        sessions: [
          makeSession({ plannedMinutes: undefined, activeMinutes: 60, sessionId: 's-1' }),
        ],
        exceptionalIds: [],
      },
      run: () => {
        const sessions = [
          makeSession({ plannedMinutes: undefined, activeMinutes: 60, sessionId: 's-1' }),
        ]
        return computeHierarchicalModel(sessions, new Set())
      },
    },

    // cusum.test.ts
    {
      name: 'cusum-stable-signal',
      fn: 'runCUSUM',
      input: {
        signal: (() => {
          const rng = mulberry32(99)
          return Array.from({ length: 30 }, () => 1.0 + (rng() - 0.5) * 0.1)
        })(),
        mean: 1.0,
      },
      run: () => {
        const rng = mulberry32(99)
        const stable = Array.from({ length: 30 }, () => 1.0 + (rng() - 0.5) * 0.1)
        const mean = stable.reduce((s, r) => s + r, 0) / stable.length
        const std = Math.sqrt(
          stable.reduce((s, r) => s + (r - mean) ** 2, 0) / (stable.length - 1),
        )
        return runCUSUM(stable, mean, std)
      },
    },
    {
      name: 'cusum-abrupt-shift',
      fn: 'runCUSUM',
      input: {
        signal: [...Array.from({ length: 20 }, () => 1.0), ...Array.from({ length: 20 }, () => 0.7)],
        mean: 1.0,
      },
      run: () => {
        const signal = [...Array.from({ length: 20 }, () => 1.0), ...Array.from({ length: 20 }, () => 0.7)]
        const mean = 1.0
        const std = Math.sqrt(
          signal.reduce((s, r) => s + (r - mean) ** 2, 0) / (signal.length - 1),
        )
        return runCUSUM(signal, mean, std)
      },
    },
    {
      name: 'cusum-chaotic-carlos',
      fn: 'runCUSUM',
      input: { seed: 42 },
      run: () => {
        const rng = mulberry32(42)
        const chaotic = Array.from({ length: 40 }, () => 1.0 + (rng() - 0.5) * 0.6)
        const mean = chaotic.reduce((s, r) => s + r, 0) / chaotic.length
        const std = Math.sqrt(
          chaotic.reduce((s, r) => s + (r - mean) ** 2, 0) / (chaotic.length - 1),
        )
        return runCUSUM(chaotic, mean, std)
      },
    },
    {
      name: 'cusum-few-observations',
      fn: 'runCUSUM',
      input: { signal: [1.0, 0.9], mean: 1.0, std: 0.1 },
      run: () => runCUSUM([1.0, 0.9], 1.0, 0.1),
    },
    {
      name: 'detect-regime-too-few-sessions',
      fn: 'detectRegimeShifts',
      input: {
        sessions: [makeSession({ sessionId: 's-1' }), makeSession({ sessionId: 's-2' })],
        exceptionalIds: [],
        globalMultiplier: 1.0,
        resolutions: [],
      },
      run: () => detectRegimeShifts(
        [makeSession({ sessionId: 's-1' }), makeSession({ sessionId: 's-2' })],
        new Set(),
        1.0,
        [],
      ),
    },
    {
      name: 'detect-regime-shift-prompt',
      fn: 'detectRegimeShifts',
      input: {
        sessions: [
          ...Array.from({ length: 20 }, (_, i) =>
            makeSession({
              activeMinutes: 60,
              plannedMinutes: 60,
              date: `2026-01-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${i}`,
            }),
          ),
          ...Array.from({ length: 15 }, (_, i) =>
            makeSession({
              activeMinutes: 42,
              plannedMinutes: 60,
              date: `2026-01-${String(21 + i).padStart(2, '0')}`,
              sessionId: `s-${20 + i}`,
            }),
          ),
        ],
        exceptionalIds: [],
        globalMultiplier: 1.0,
        resolutions: [],
      },
      run: () => {
        const sessions = [
          ...Array.from({ length: 20 }, (_, i) =>
            makeSession({
              activeMinutes: 60,
              plannedMinutes: 60,
              date: `2026-01-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${i}`,
            }),
          ),
          ...Array.from({ length: 15 }, (_, i) =>
            makeSession({
              activeMinutes: 42,
              plannedMinutes: 60,
              date: `2026-01-${String(21 + i).padStart(2, '0')}`,
              sessionId: `s-${20 + i}`,
            }),
          ),
        ]
        return detectRegimeShifts(sessions, new Set(), 1.0, [])
      },
    },
    {
      name: 'detect-regime-resolved-prompt',
      fn: 'detectRegimeShifts',
      input: {
        sessions: [
          ...Array.from({ length: 20 }, (_, i) =>
            makeSession({
              activeMinutes: 60,
              plannedMinutes: 60,
              date: `2026-01-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${i}`,
            }),
          ),
          ...Array.from({ length: 15 }, (_, i) =>
            makeSession({
              activeMinutes: 42,
              plannedMinutes: 60,
              date: `2026-01-${String(21 + i).padStart(2, '0')}`,
              sessionId: `s-${20 + i}`,
            }),
          ),
        ],
        exceptionalIds: [],
        globalMultiplier: 1.0,
        resolutions: [{ resolution: 'acknowledged', resolvedAt: '2026-02-28T00:00:00Z' }],
      },
      run: () => {
        const sessions = [
          ...Array.from({ length: 20 }, (_, i) =>
            makeSession({
              activeMinutes: 60,
              plannedMinutes: 60,
              date: `2026-01-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${i}`,
            }),
          ),
          ...Array.from({ length: 15 }, (_, i) =>
            makeSession({
              activeMinutes: 42,
              plannedMinutes: 60,
              date: `2026-01-${String(21 + i).padStart(2, '0')}`,
              sessionId: `s-${20 + i}`,
            }),
          ),
        ]
        const resolutions: RecalibrationResolution[] = [
          { resolution: 'acknowledged', resolvedAt: '2026-02-28T00:00:00Z' },
        ]
        return detectRegimeShifts(sessions, new Set(), 1.0, resolutions)
      },
    },
    {
      name: 'detect-regime-excludes-exceptional',
      fn: 'detectRegimeShifts',
      input: {
        sessions: Array.from({ length: 20 }, (_, i) =>
          makeSession({
            activeMinutes: i < 15 ? 60 : 30,
            plannedMinutes: 60,
            sessionId: `s-${i}`,
          }),
        ),
        exceptionalIds: Array.from({ length: 5 }, (_, i) => `s-${15 + i}`),
        globalMultiplier: 1.0,
        resolutions: [],
      },
      run: () => {
        const sessions = Array.from({ length: 20 }, (_, i) =>
          makeSession({
            activeMinutes: i < 15 ? 60 : 30,
            plannedMinutes: 60,
            sessionId: `s-${i}`,
          }),
        )
        const exceptionalIds = new Set(Array.from({ length: 5 }, (_, i) => `s-${15 + i}`))
        return detectRegimeShifts(sessions, exceptionalIds, 1.0, [])
      },
    },

    // calibration.test.ts
    {
      name: 'compute-calibration-empty',
      fn: 'computeCalibration',
      input: { sessions: [], exceptionalTags: [], resolutions: [] },
      run: () => computeCalibration([], [], []),
    },
    {
      name: 'compute-calibration-30-sessions',
      fn: 'computeCalibration',
      input: {
        sessions: Array.from({ length: 30 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
            activeMinutes: 55 + Math.round(Math.sin(i) * 5),
          }),
        ),
        exceptionalTags: [],
        resolutions: [],
      },
      run: () => {
        const sessions = Array.from({ length: 30 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
            activeMinutes: 55 + Math.round(Math.sin(i) * 5),
          }),
        )
        return computeCalibration(sessions, [], [])
      },
    },
    {
      name: 'compute-calibration-regime-shift',
      fn: 'computeCalibration',
      input: {
        sessions: [
          ...Array.from({ length: 20 }, (_, i) =>
            makeSession({
              activeMinutes: 60,
              date: `2026-01-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${i}`,
            }),
          ),
          ...Array.from({ length: 15 }, (_, i) =>
            makeSession({
              activeMinutes: 42,
              date: `2026-02-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${20 + i}`,
            }),
          ),
        ],
        exceptionalTags: [],
        resolutions: [],
      },
      run: () => {
        const sessions = [
          ...Array.from({ length: 20 }, (_, i) =>
            makeSession({
              activeMinutes: 60,
              date: `2026-01-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${i}`,
            }),
          ),
          ...Array.from({ length: 15 }, (_, i) =>
            makeSession({
              activeMinutes: 42,
              date: `2026-02-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${20 + i}`,
            }),
          ),
        ]
        return computeCalibration(sessions, [], [])
      },
    },
    {
      name: 'compute-calibration-excludes-exceptional',
      fn: 'computeCalibration',
      input: {
        sessions: Array.from({ length: 10 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
            activeMinutes: i < 7 ? 60 : 20,
          }),
        ),
        exceptionalTags: [
          { sessionId: 's-7', exceptional: true },
          { sessionId: 's-8', exceptional: true },
          { sessionId: 's-9', exceptional: true },
        ] satisfies ExceptionalTag[],
        resolutions: [],
      },
      run: () => {
        const sessions = Array.from({ length: 10 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
            activeMinutes: i < 7 ? 60 : 20,
          }),
        )
        const tags: ExceptionalTag[] = [
          { sessionId: 's-7', exceptional: true },
          { sessionId: 's-8', exceptional: true },
          { sessionId: 's-9', exceptional: true },
        ]
        return computeCalibration(sessions, tags, [])
      },
    },
    {
      name: 'compute-calibration-resets-prompt',
      fn: 'computeCalibration',
      input: {
        sessions: [
          ...Array.from({ length: 20 }, (_, i) =>
            makeSession({
              activeMinutes: 60,
              date: `2026-01-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${i}`,
            }),
          ),
          ...Array.from({ length: 15 }, (_, i) =>
            makeSession({
              activeMinutes: 42,
              date: `2026-02-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${20 + i}`,
            }),
          ),
        ],
        exceptionalTags: [],
        resolutions: [{ resolution: 'acknowledged', resolvedAt: '2026-03-01T00:00:00Z' }],
      },
      run: () => {
        const sessions = [
          ...Array.from({ length: 20 }, (_, i) =>
            makeSession({
              activeMinutes: 60,
              date: `2026-01-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${i}`,
            }),
          ),
          ...Array.from({ length: 15 }, (_, i) =>
            makeSession({
              activeMinutes: 42,
              date: `2026-02-${String(i + 1).padStart(2, '0')}`,
              sessionId: `s-${20 + i}`,
            }),
          ),
        ]
        const resolutions: RecalibrationResolution[] = [
          { resolution: 'acknowledged', resolvedAt: '2026-03-01T00:00:00Z' },
        ]
        return computeCalibration(sessions, [], resolutions)
      },
    },
    {
      name: 'get-prompt-detail-empty',
      fn: 'getPromptDetail',
      input: { sessions: [], breakpoints: [] },
      run: () => getPromptDetail([], []),
    },
    {
      name: 'get-prompt-detail-breakpoint',
      fn: 'getPromptDetail',
      input: {
        sessions: Array.from({ length: 30 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
            activeMinutes: i < 20 ? 60 : 42,
          }),
        ),
        breakpoints: [19],
      },
      run: () => {
        const sessions = Array.from({ length: 30 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
            activeMinutes: i < 20 ? 60 : 42,
          }),
        )
        return getPromptDetail(sessions, [19])
      },
    },

    // gp.test.ts
    {
      name: 'cholesky-decompose-simple',
      fn: 'choleskyDecompose',
      input: { matrix: [[4, 2], [2, 3]] },
      run: () => choleskyDecompose([
        [4, 2],
        [2, 3],
      ]),
    },
    {
      name: 'cholesky-solve',
      fn: 'choleskySolve',
      input: { matrix: [[4, 2], [2, 3]], b: [8, 7] },
      run: () => {
        const A = [
          [4, 2],
          [2, 3],
        ]
        const L = choleskyDecompose(A)
        return choleskySolve(L, [8, 7])
      },
    },
    {
      name: 'gp-regression-linear',
      fn: 'gpRegression',
      input: {
        trainX: Array.from({ length: 10 }, (_, i) => i),
        trainY: Array.from({ length: 10 }, (_, i) => i * 30),
        testX: Array.from({ length: 12 }, (_, i) => i),
      },
      run: () => {
        const trainX = Array.from({ length: 10 }, (_, i) => i)
        const trainY = trainX.map((x) => x * 30)
        const testX = Array.from({ length: 12 }, (_, i) => i)
        return gpRegression(trainX, trainY, testX)
      },
    },
    {
      name: 'gp-regression-wider-ci-beyond-training',
      fn: 'gpRegression',
      input: {
        trainX: Array.from({ length: 7 }, (_, i) => i),
        trainY: Array.from({ length: 7 }, (_, i) => i * 20),
        testX: [3, 10, 15],
      },
      run: () => {
        const trainX = Array.from({ length: 7 }, (_, i) => i)
        const trainY = trainX.map((x) => x * 20)
        return gpRegression(trainX, trainY, [3, 10, 15])
      },
    },
    {
      name: 'gp-regression-single-point',
      fn: 'gpRegression',
      input: { trainX: [0], trainY: [100], testX: [0, 5] },
      run: () => gpRegression([0], [100], [0, 5]),
    },
    {
      name: 'gp-regression-empty',
      fn: 'gpRegression',
      input: { trainX: [], trainY: [], testX: [0, 1, 2] },
      run: () => gpRegression([], [], [0, 1, 2]),
    },
    {
      name: 'fit-burn-up-gp-empty',
      fn: 'fitBurnUpGP',
      input: {
        actualPoints: [],
        startDate: '2026-01-01',
        endDate: '2026-02-01',
        today: '2026-01-15',
      },
      run: () => fitBurnUpGP([], '2026-01-01', '2026-02-01', '2026-01-15'),
    },
    {
      name: 'fit-burn-up-gp-extrapolation',
      fn: 'fitBurnUpGP',
      input: {
        actualPoints: Array.from({ length: 10 }, (_, i) => ({
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          minutes: (i + 1) * 60,
        })),
        startDate: '2026-01-01',
        endDate: '2026-01-20',
        today: '2026-01-10',
      },
      run: () => {
        const actualPoints = Array.from({ length: 10 }, (_, i) => ({
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          minutes: (i + 1) * 60,
        }))
        return fitBurnUpGP(actualPoints, '2026-01-01', '2026-01-20', '2026-01-10')
      },
    },
    {
      name: 'gp-regression-detrending',
      fn: 'gpRegression',
      input: {
        trainX: Array.from({ length: 14 }, (_, i) => i),
        trainY: Array.from({ length: 14 }, (_, i) => i * 50 + Math.sin(i) * 15),
        testX: Array.from({ length: 14 }, (_, i) => i),
      },
      run: () => {
        const trainX = Array.from({ length: 14 }, (_, i) => i)
        const trainY = trainX.map((x) => x * 50 + Math.sin(x) * 15)
        const testX = Array.from({ length: 14 }, (_, i) => i)
        return gpRegression(trainX, trainY, testX)
      },
    },
    {
      name: 'fit-burn-up-gp-smooth-curve',
      fn: 'fitBurnUpGP',
      input: {
        actualPoints: Array.from({ length: 14 }, (_, i) => ({
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          minutes: (i + 1) * 45 + (i % 3) * 10,
        })),
        startDate: '2026-01-01',
        endDate: '2026-01-28',
        today: '2026-01-14',
      },
      run: () => {
        const actualPoints = Array.from({ length: 14 }, (_, i) => ({
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          minutes: (i + 1) * 45 + (i % 3) * 10,
        }))
        return fitBurnUpGP(actualPoints, '2026-01-01', '2026-01-28', '2026-01-14')
      },
    },

    // kalman.test.ts
    {
      name: 'kalman-init',
      fn: 'initKalman',
      input: { level: 1.0, variance: 0.1 },
      run: () => initKalman(1.0, 0.1),
    },
    {
      name: 'kalman-predict',
      fn: 'kalmanPredict',
      input: { level: 1.0, variance: 0.1, slope: 0.05 },
      run: () => {
        const state = initKalman(1.0, 0.1)
        state.x[1] = 0.05
        return kalmanPredict(state)
      },
    },
    {
      name: 'kalman-update',
      fn: 'kalmanUpdate',
      input: { level: 1.0, variance: 0.1, observation: 0.8, observationVariance: 0.05 },
      run: () => {
        const state = initKalman(1.0, 0.1)
        const predicted = kalmanPredict(state)
        return kalmanUpdate(predicted, 0.8, 0.05)
      },
    },
    {
      name: 'kalman-phase-constant',
      fn: 'runKalmanOnPhase',
      input: {
        ratios: Array.from({ length: 20 }, () => 0.9),
        initialLevel: 1.0,
        initialVariance: 0.1,
        observationVariance: 0.01,
      },
      run: () => runKalmanOnPhase(Array.from({ length: 20 }, () => 0.9), 1.0, 0.1, 0.01),
    },
    {
      name: 'kalman-phase-negative-slope',
      fn: 'runKalmanOnPhase',
      input: {
        ratios: Array.from({ length: 20 }, (_, i) => 1.0 - i * 0.02),
        initialLevel: 1.0,
        initialVariance: 0.1,
        observationVariance: 0.01,
      },
      run: () =>
        runKalmanOnPhase(
          Array.from({ length: 20 }, (_, i) => 1.0 - i * 0.02),
          1.0,
          0.1,
          0.01,
        ),
    },
    {
      name: 'kalman-phase-positive-slope',
      fn: 'runKalmanOnPhase',
      input: {
        ratios: Array.from({ length: 20 }, (_, i) => 0.7 + i * 0.02),
        initialLevel: 0.7,
        initialVariance: 0.1,
        observationVariance: 0.01,
      },
      run: () =>
        runKalmanOnPhase(
          Array.from({ length: 20 }, (_, i) => 0.7 + i * 0.02),
          0.7,
          0.1,
          0.01,
        ),
    },
    {
      name: 'kalman-phase-short-sequence',
      fn: 'runKalmanOnPhase',
      input: {
        ratios: [0.9, 0.85],
        initialLevel: 1.0,
        initialVariance: 0.1,
        observationVariance: 0.05,
      },
      run: () => runKalmanOnPhase([0.9, 0.85], 1.0, 0.1, 0.05),
    },
    {
      name: 'kalman-phase-empty',
      fn: 'runKalmanOnPhase',
      input: {
        ratios: [],
        initialLevel: 1.0,
        initialVariance: 0.1,
        observationVariance: 0.01,
      },
      run: () => runKalmanOnPhase([], 1.0, 0.1, 0.01),
    },

    // trend.test.ts
    {
      name: 'analyze-trend-no-sessions',
      fn: 'analyzeTrend',
      input: { sessions: [], exceptionalIds: [] },
      run: () => analyzeTrend([], new Set(), defaultBayesian(), defaultCusum()),
    },
    {
      name: 'analyze-trend-single-phase',
      fn: 'analyzeTrend',
      input: {
        sessions: Array.from({ length: 10 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
          }),
        ),
        exceptionalIds: [],
      },
      run: () => {
        const sessions = Array.from({ length: 10 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
          }),
        )
        return analyzeTrend(sessions, new Set(), defaultBayesian(), defaultCusum())
      },
    },
    {
      name: 'analyze-trend-two-phases',
      fn: 'analyzeTrend',
      input: {
        sessions: Array.from({ length: 20 }, (_, i) =>
          makeSession({
            activeMinutes: i < 10 ? 60 : 45,
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
          }),
        ),
        exceptionalIds: [],
        breakpoints: [9],
      },
      run: () => {
        const sessions = Array.from({ length: 20 }, (_, i) =>
          makeSession({
            activeMinutes: i < 10 ? 60 : 45,
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
          }),
        )
        return analyzeTrend(sessions, new Set(), defaultBayesian(), defaultCusum([9]))
      },
    },
    {
      name: 'analyze-trend-short-segment-fallback',
      fn: 'analyzeTrend',
      input: {
        sessions: Array.from({ length: 12 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
          }),
        ),
        exceptionalIds: [],
        breakpoints: [10],
      },
      run: () => {
        const sessions = Array.from({ length: 12 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
          }),
        )
        return analyzeTrend(sessions, new Set(), defaultBayesian(), defaultCusum([10]))
      },
    },
    {
      name: 'analyze-trend-excludes-exceptional',
      fn: 'analyzeTrend',
      input: {
        sessions: Array.from({ length: 10 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
            activeMinutes: i < 8 ? 60 : 10,
          }),
        ),
        exceptionalIds: ['s-8', 's-9'],
      },
      run: () => {
        const sessions = Array.from({ length: 10 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
            activeMinutes: i < 8 ? 60 : 10,
          }),
        )
        return analyzeTrend(sessions, new Set(['s-8', 's-9']), defaultBayesian(), defaultCusum())
      },
    },

    // streak.test.ts — calculateStreak
    {
      name: 'streak-no-sessions',
      fn: 'calculateStreak',
      input: { sessions: [], today: '2026-01-15' },
      run: () => calculateStreak([], '2026-01-15'),
    },
    {
      name: 'streak-five-consecutive-days',
      fn: 'calculateStreak',
      input: {
        sessions: Array.from({ length: 5 }, (_, i) =>
          makeSession({ date: `2026-01-${String(11 + i).padStart(2, '0')}`, sessionId: `s-${i}` }),
        ),
        today: '2026-01-15',
      },
      run: () => {
        const sessions = Array.from({ length: 5 }, (_, i) =>
          makeSession({ date: `2026-01-${String(11 + i).padStart(2, '0')}`, sessionId: `s-${i}` }),
        )
        return calculateStreak(sessions, '2026-01-15')
      },
    },
    {
      name: 'streak-resets-at-gap',
      fn: 'calculateStreak',
      input: {
        sessions: [
          makeSession({ date: '2026-01-10', sessionId: 's-1' }),
          makeSession({ date: '2026-01-11', sessionId: 's-2' }),
          makeSession({ date: '2026-01-13', sessionId: 's-3' }),
          makeSession({ date: '2026-01-14', sessionId: 's-4' }),
          makeSession({ date: '2026-01-15', sessionId: 's-5' }),
        ],
        today: '2026-01-15',
      },
      run: () =>
        calculateStreak(
          [
            makeSession({ date: '2026-01-10', sessionId: 's-1' }),
            makeSession({ date: '2026-01-11', sessionId: 's-2' }),
            makeSession({ date: '2026-01-13', sessionId: 's-3' }),
            makeSession({ date: '2026-01-14', sessionId: 's-4' }),
            makeSession({ date: '2026-01-15', sessionId: 's-5' }),
          ],
          '2026-01-15',
        ),
    },
    {
      name: 'streak-deduplicates-same-day',
      fn: 'calculateStreak',
      input: {
        sessions: [
          makeSession({ date: '2026-01-14', sessionId: 's-1' }),
          makeSession({ date: '2026-01-14', sessionId: 's-2' }),
          makeSession({ date: '2026-01-15', sessionId: 's-3' }),
        ],
        today: '2026-01-15',
      },
      run: () =>
        calculateStreak(
          [
            makeSession({ date: '2026-01-14', sessionId: 's-1' }),
            makeSession({ date: '2026-01-14', sessionId: 's-2' }),
            makeSession({ date: '2026-01-15', sessionId: 's-3' }),
          ],
          '2026-01-15',
        ),
    },
    {
      name: 'streak-current-zero-after-gap',
      fn: 'calculateStreak',
      input: {
        sessions: [
          makeSession({ date: '2026-01-10', sessionId: 's-1' }),
          makeSession({ date: '2026-01-11', sessionId: 's-2' }),
          makeSession({ date: '2026-01-12', sessionId: 's-3' }),
        ],
        today: '2026-01-15',
      },
      run: () =>
        calculateStreak(
          [
            makeSession({ date: '2026-01-10', sessionId: 's-1' }),
            makeSession({ date: '2026-01-11', sessionId: 's-2' }),
            makeSession({ date: '2026-01-12', sessionId: 's-3' }),
          ],
          '2026-01-15',
        ),
    },
    // buildStreakGrid
    {
      name: 'streak-grid-no-sessions',
      fn: 'buildStreakGrid',
      input: { sessions: [], today: '2026-01-15', plannedByDate: {}, defaultPlanned: 60 },
      run: () => buildStreakGrid([], '2026-01-15', {}, 60),
    },
    {
      name: 'streak-grid-level-3',
      fn: 'buildStreakGrid',
      input: {
        sessions: [makeSession({ date: '2026-01-15', duration: 60, sessionId: 's-1' })],
        today: '2026-01-15',
        plannedByDate: { '2026-01-15': 60 },
        defaultPlanned: 60,
      },
      run: () =>
        buildStreakGrid(
          [makeSession({ date: '2026-01-15', duration: 60, sessionId: 's-1' })],
          '2026-01-15',
          { '2026-01-15': 60 },
          60,
        ),
    },
    {
      name: 'streak-grid-level-2',
      fn: 'buildStreakGrid',
      input: {
        sessions: [makeSession({ date: '2026-01-15', duration: 36, sessionId: 's-1' })],
        today: '2026-01-15',
        plannedByDate: { '2026-01-15': 60 },
        defaultPlanned: 60,
      },
      run: () =>
        buildStreakGrid(
          [makeSession({ date: '2026-01-15', duration: 36, sessionId: 's-1' })],
          '2026-01-15',
          { '2026-01-15': 60 },
          60,
        ),
    },
    {
      name: 'streak-grid-level-1',
      fn: 'buildStreakGrid',
      input: {
        sessions: [makeSession({ date: '2026-01-15', duration: 18, sessionId: 's-1' })],
        today: '2026-01-15',
        plannedByDate: { '2026-01-15': 60 },
        defaultPlanned: 60,
      },
      run: () =>
        buildStreakGrid(
          [makeSession({ date: '2026-01-15', duration: 18, sessionId: 's-1' })],
          '2026-01-15',
          { '2026-01-15': 60 },
          60,
        ),
    },
    {
      name: 'streak-grid-rest-day-global-average',
      fn: 'buildStreakGrid',
      input: {
        sessions: [makeSession({ date: '2026-01-14', duration: 60, sessionId: 's-1' })],
        today: '2026-01-15',
        plannedByDate: {},
        defaultPlanned: 60,
      },
      run: () =>
        buildStreakGrid(
          [makeSession({ date: '2026-01-14', duration: 60, sessionId: 's-1' })],
          '2026-01-15',
          {},
          60,
        ),
    },
    {
      name: 'streak-grid-manual-no-duration',
      fn: 'buildStreakGrid',
      input: {
        sessions: [
          makeSession({ date: '2026-01-15', source: 'manual', duration: 0, sessionId: 's-1' }),
        ],
        today: '2026-01-15',
        plannedByDate: { '2026-01-15': 60 },
        defaultPlanned: 60,
      },
      run: () =>
        buildStreakGrid(
          [makeSession({ date: '2026-01-15', source: 'manual', duration: 0, sessionId: 's-1' })],
          '2026-01-15',
          { '2026-01-15': 60 },
          60,
        ),
    },
    {
      name: 'streak-grid-future-days-level-0',
      fn: 'buildStreakGrid',
      input: {
        sessions: [
          makeSession({ date: '2026-01-16', duration: 60, sessionId: 's-1' }),
          makeSession({ date: '2026-01-17', duration: 90, sessionId: 's-2' }),
        ],
        today: '2026-01-15',
        plannedByDate: { '2026-01-16': 60, '2026-01-17': 60 },
        defaultPlanned: 60,
      },
      run: () =>
        buildStreakGrid(
          [
            makeSession({ date: '2026-01-16', duration: 60, sessionId: 's-1' }),
            makeSession({ date: '2026-01-17', duration: 90, sessionId: 's-2' }),
          ],
          '2026-01-15',
          { '2026-01-16': 60, '2026-01-17': 60 },
          60,
        ),
    },

    // progress.test.ts
    {
      name: 'compute-progress-full-snapshot',
      fn: 'computeProgress',
      input: {
        sessions: Array.from({ length: 10 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
          }),
        ),
        roadmap: makeProgressRoadmap(
          Array.from({ length: 20 }, (_, i) =>
            makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
          ),
        ),
        calibration: defaultCalibration(),
        today: '2026-01-10',
      },
      run: () => {
        const slots = Array.from({ length: 20 }, (_, i) =>
          makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
        )
        const roadmap = makeProgressRoadmap(slots)
        const sessions = Array.from({ length: 10 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            sessionId: `s-${i}`,
          }),
        )
        return computeProgress(sessions, roadmap, defaultCalibration(), '2026-01-10')
      },
    },
    {
      name: 'compute-progress-empty-roadmap',
      fn: 'computeProgress',
      input: {
        sessions: [],
        roadmap: {
          startDate: '2026-01-01',
          deadline: '2026-01-31',
          weeks: 4,
          weeklyHours: 6,
          slots: [],
        } satisfies RoadmapInput,
        calibration: defaultCalibration(),
        today: '2026-01-15',
      },
      run: () => {
        const roadmap: RoadmapInput = {
          startDate: '2026-01-01',
          deadline: '2026-01-31',
          weeks: 4,
          weeklyHours: 6,
          slots: [],
        }
        return computeProgress([], roadmap, defaultCalibration(), '2026-01-15')
      },
    },
    {
      name: 'compute-progress-caps-completion',
      fn: 'computeProgress',
      input: {
        sessions: [makeSession({ date: '2026-01-01', duration: 120, sessionId: 's-1' })],
        roadmap: makeProgressRoadmap([makeSlot('2026-01-01', 60)]),
        calibration: defaultCalibration(),
        today: '2026-01-01',
      },
      run: () => {
        const roadmap = makeProgressRoadmap([makeSlot('2026-01-01', 60)])
        const sessions = [makeSession({ date: '2026-01-01', duration: 120, sessionId: 's-1' })]
        return computeProgress(sessions, roadmap, defaultCalibration(), '2026-01-01')
      },
    },
    {
      name: 'compute-progress-up-next',
      fn: 'computeProgress',
      input: {
        sessions: [makeSession({ date: '2026-01-10', sessionId: 's-1' })],
        roadmap: makeProgressRoadmap([
          makeSlot('2026-01-10', 60),
          makeSlot('2026-01-15', 60),
          makeSlot('2026-01-20', 60),
        ]),
        calibration: defaultCalibration(),
        today: '2026-01-12',
      },
      run: () => {
        const roadmap = makeProgressRoadmap([
          makeSlot('2026-01-10', 60),
          makeSlot('2026-01-15', 60),
          makeSlot('2026-01-20', 60),
        ])
        const sessions = [makeSession({ date: '2026-01-10', sessionId: 's-1' })]
        return computeProgress(sessions, roadmap, defaultCalibration(), '2026-01-12')
      },
    },
    {
      name: 'compute-progress-burn-up-deficit',
      fn: 'computeProgress',
      input: {
        sessions: Array.from({ length: 5 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            duration: 60,
            sessionId: `s-${i}`,
          }),
        ),
        roadmap: makeProgressRoadmap(
          Array.from({ length: 10 }, (_, i) =>
            makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
          ),
        ),
        calibration: defaultCalibration(),
        today: '2026-01-10',
      },
      run: () => {
        const slots = Array.from({ length: 10 }, (_, i) =>
          makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
        )
        const roadmap = makeProgressRoadmap(slots)
        const sessions = Array.from({ length: 5 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            duration: 60,
            sessionId: `s-${i}`,
          }),
        )
        return computeProgress(sessions, roadmap, defaultCalibration(), '2026-01-10')
      },
    },
    {
      name: 'compute-progress-gp-curve',
      fn: 'computeProgress',
      input: {
        sessions: Array.from({ length: 7 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            duration: 55,
            sessionId: `s-${i}`,
          }),
        ),
        roadmap: makeProgressRoadmap(
          Array.from({ length: 14 }, (_, i) =>
            makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
          ),
        ),
        calibration: defaultCalibration(),
        today: '2026-01-07',
      },
      run: () => {
        const slots = Array.from({ length: 14 }, (_, i) =>
          makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
        )
        const roadmap = makeProgressRoadmap(slots)
        const sessions = Array.from({ length: 7 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            duration: 55,
            sessionId: `s-${i}`,
          }),
        )
        return computeProgress(sessions, roadmap, defaultCalibration(), '2026-01-07')
      },
    },
    {
      name: 'compute-progress-drift-past-deadline',
      fn: 'computeProgress',
      input: {
        sessions: Array.from({ length: 5 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            duration: 30,
            sessionId: `s-${i}`,
          }),
        ),
        roadmap: makeProgressRoadmap(
          Array.from({ length: 30 }, (_, i) =>
            makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
          ),
        ),
        calibration: defaultCalibration(),
        today: '2026-01-15',
      },
      run: () => {
        const slots = Array.from({ length: 30 }, (_, i) =>
          makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
        )
        const roadmap = makeProgressRoadmap(slots)
        const sessions = Array.from({ length: 5 }, (_, i) =>
          makeSession({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            duration: 30,
            sessionId: `s-${i}`,
          }),
        )
        return computeProgress(sessions, roadmap, defaultCalibration(), '2026-01-15')
      },
    },
    {
      name: 'compute-progress-weekly-stats',
      fn: 'computeProgress',
      input: {
        sessions: [
          makeSession({ date: '2026-01-13', duration: 60, sessionId: 's-1' }),
          makeSession({ date: '2026-01-14', duration: 45, sessionId: 's-2' }),
          makeSession({ date: '2026-01-15', duration: 55, sessionId: 's-3' }),
        ],
        roadmap: makeProgressRoadmap(
          Array.from({ length: 20 }, (_, i) =>
            makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
          ),
        ),
        calibration: defaultCalibration(),
        today: '2026-01-15',
      },
      run: () => {
        const slots = Array.from({ length: 20 }, (_, i) =>
          makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
        )
        const roadmap = makeProgressRoadmap(slots)
        const sessions = [
          makeSession({ date: '2026-01-13', duration: 60, sessionId: 's-1' }),
          makeSession({ date: '2026-01-14', duration: 45, sessionId: 's-2' }),
          makeSession({ date: '2026-01-15', duration: 55, sessionId: 's-3' }),
        ]
        return computeProgress(sessions, roadmap, defaultCalibration(), '2026-01-15')
      },
    },
    {
      name: 'compute-progress-week-index',
      fn: 'computeProgress',
      input: {
        sessions: [
          makeSession({ date: '2026-01-13', duration: 60, sessionId: 's-1' }),
          makeSession({ date: '2026-01-14', duration: 45, sessionId: 's-2' }),
          makeSession({ date: '2026-01-15', duration: 55, sessionId: 's-3' }),
        ],
        roadmap: makeProgressRoadmap(
          Array.from({ length: 20 }, (_, i) =>
            makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
          ),
        ),
        calibration: defaultCalibration(),
        today: '2026-01-15',
      },
      run: () => {
        const slots = Array.from({ length: 20 }, (_, i) =>
          makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
        )
        const roadmap = makeProgressRoadmap(slots)
        const sessions = [
          makeSession({ date: '2026-01-13', duration: 60, sessionId: 's-1' }),
          makeSession({ date: '2026-01-14', duration: 45, sessionId: 's-2' }),
          makeSession({ date: '2026-01-15', duration: 55, sessionId: 's-3' }),
        ]
        return computeProgress(sessions, roadmap, defaultCalibration(), '2026-01-15')
      },
    },
  ]
}
