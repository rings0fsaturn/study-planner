/**
 * Concept-level BKT mastery engine (stateless projection), the TypeScript
 * mirror of `packages/py-progress/src/py_progress/mastery.py`.
 *
 * The engine is a pure forward-filter over per-skill binary observations.
 * It holds no state: every call rebuilds the projection from the full
 * observation sequence, so the same durable grades always produce the same
 * projection (rebuildable). Parameters are fixed defaults chosen by the #43
 * bake-off; `MODEL_VERSION` identifies them so a later bake-off can ship a
 * new parameter set without breaking stored projections.
 */

export const MODEL_VERSION = 'bkt-v1'

export interface BktParams {
  /** P(mastery) before any observation (the cold start). */
  pInit: number
  /** P(not-mastered -> mastered) after each observation. */
  pLearn: number
  /** P(incorrect | mastered). */
  pSlip: number
  /** P(correct | not mastered). */
  pGuess: number
}

export const DEFAULT_PARAMS: BktParams = { pInit: 0.15, pLearn: 0.1, pSlip: 0.05, pGuess: 0.2 }

export interface MasteryObservation {
  skillTag: string
  correct: boolean
  score?: number
}

export interface MasteryProjection {
  materialId: string
  skillTag: string
  mastery: number
  uncertainty: number
  confidence: number
  n: number
  modelVersion: string
  recentTrend?: number
}

export interface DifficultyRecommendation {
  materialId: string
  skillTag: string
  currentBand: number
  recommendedBand: number
  targetExpectedCorrectness: number
  modelVersion: string
}

export interface BktForwardResult {
  masteryAfter: number[]
  pCorrectBefore: number[]
}

export function bktForward(observations: MasteryObservation[], params: BktParams = DEFAULT_PARAMS): BktForwardResult {
  const masteryAfter: number[] = []
  const pCorrectBefore: number[] = []
  let belief = params.pInit
  for (const obs of observations) {
    pCorrectBefore.push((1 - params.pSlip) * belief + params.pGuess * (1 - belief))
    if (obs.correct) {
      const numerator = (1 - params.pSlip) * belief
      const denominator = numerator + params.pGuess * (1 - belief)
      belief = denominator > 0 ? numerator / denominator : belief
    } else {
      const numerator = params.pSlip * belief
      const denominator = numerator + (1 - params.pGuess) * (1 - belief)
      belief = denominator > 0 ? numerator / denominator : belief
    }
    belief += (1 - belief) * params.pLearn
    masteryAfter.push(clamp(belief, 0, 1))
  }
  return { masteryAfter, pCorrectBefore }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function entropy(p: number): number {
  if (p <= 0 || p >= 1) return 0
  return -(p * Math.log(p) + (1 - p) * Math.log(1 - p)) / Math.log(2)
}

export function projectMastery(
  materialId: string,
  observations: MasteryObservation[],
  params: BktParams = DEFAULT_PARAMS,
  modelVersion: string = MODEL_VERSION,
): MasteryProjection {
  let mastery: number
  let n: number
  let recentTrend: number | undefined
  if (observations.length === 0) {
    mastery = params.pInit
    n = 0
  } else {
    const { masteryAfter } = bktForward(observations, params)
    mastery = masteryAfter[masteryAfter.length - 1]
    n = observations.length
    recentTrend =
      n >= 2 ? masteryAfter[n - 1] - masteryAfter[n - 2] : masteryAfter[n - 1] - params.pInit
  }
  const uncertainty = entropy(mastery)
  return {
    materialId,
    skillTag: observations.length > 0 ? observations[0].skillTag : '',
    mastery,
    uncertainty,
    confidence: 1 - uncertainty,
    n,
    modelVersion,
    ...(recentTrend !== undefined ? { recentTrend } : {}),
  }
}

export interface RecommendBandOptions {
  targetExpectedCorrectness?: number
  upperBand?: number
  lowerBand?: number
}

export function recommendBand(
  projection: MasteryProjection,
  currentBand: number,
  options: RecommendBandOptions = {},
): DifficultyRecommendation {
  const target = options.targetExpectedCorrectness ?? 0.7
  const upper = options.upperBand ?? 5
  const lower = options.lowerBand ?? 1
  const margin = 0.05
  let band = Math.trunc(currentBand)
  if (projection.n === 0) {
    return {
      materialId: projection.materialId,
      skillTag: projection.skillTag,
      currentBand: Math.trunc(currentBand),
      recommendedBand: band,
      targetExpectedCorrectness: target,
      modelVersion: projection.modelVersion,
    }
  }
  if (projection.mastery >= target + margin) {
    band += 1
  } else if (projection.mastery <= target - margin) {
    band -= 1
  }
  band = clamp(band, lower, upper)
  return {
    materialId: projection.materialId,
    skillTag: projection.skillTag,
    currentBand: Math.trunc(currentBand),
    recommendedBand: band,
    targetExpectedCorrectness: target,
    modelVersion: projection.modelVersion,
  }
}