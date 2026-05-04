// Bayesian model
export const BAYESIAN_PRIOR_MEAN = 1.0
export const BAYESIAN_PRIOR_VARIANCE = 0.1
export const MIN_SESSIONS_PER_BUCKET = 3

// CUSUM
export const CUSUM_SLACK_FACTOR = 0.5
export const CUSUM_THRESHOLD_FACTOR = 4.5

// Kalman Filter
export const KALMAN_LEVEL_NOISE = 0.01
export const KALMAN_SLOPE_NOISE = 0.0001

// Gaussian Process
export const GP_LENGTH_SCALE = 7.0
export const GP_NOISE_RATIO = 0.20
export const GP_EXTRAPOLATION_CI_INFLATION = 1.5
export const GP_EXTRAPOLATION_DAYS = 14

// Streak
export const STREAK_LEVEL_THRESHOLDS = [0, 0.01, 0.50, 1.00] as const
