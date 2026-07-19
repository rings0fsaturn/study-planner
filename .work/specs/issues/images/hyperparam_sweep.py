#!/usr/bin/env python3
"""
Hyperparameter Sweep for Study Tracker ML Algorithms
=====================================================
Systematic sweep of CUSUM, Kalman Filter, and GP hyperparameters
across 5 realistic synthetic user profiles (20 seeds each).

Outputs:
  - cusum_sweep.png: Detection delay vs false alarm rate
  - kalman_sweep.png: 1-step MAE + slope accuracy heatmaps
  - gp_sweep.png: CI calibration + extrapolation RMSE heatmaps
  - best_params_{name}.png: 4-panel diagnostic for each profile
"""

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from datetime import datetime, timedelta, timezone
import os
import sys
import time
import warnings
warnings.filterwarnings('ignore')

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
SEEDS_PER_PROFILE = 20
N_WEEKS = 10
_PROGRESS_STARTED_AT = time.monotonic()


def log_progress(percent, state, detail=""):
    pct = max(0, min(100, int(round(percent))))
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    elapsed = int(time.monotonic() - _PROGRESS_STARTED_AT)
    suffix = f" detail={detail}" if detail else ""
    print(
        f"[hyperparam-sweep-progress] {timestamp} {pct:03d}% state={state} elapsed={elapsed}s{suffix}",
        file=sys.stderr,
        flush=True,
    )

# ============================================================================
# 1. Realistic Synthetic Data Generation
# ============================================================================

def build_weekly_schedule(rng, week_idx, profile):
    """Build a realistic weekly schedule of (day_of_week, planned_minutes).

    Base pattern: Mon(0), Wed(2), Fri(4), Sat(5) with occasional shifts.
    Returns list of (day_offset_in_week, planned_minutes, time_of_day).
    """
    base_weekdays = [0, 2, 4]  # Mon, Wed, Fri
    base_weekend = [5]          # Sat

    # Occasional day shift: swap one weekday for an adjacent day
    weekdays = list(base_weekdays)
    if rng.random() < 0.15:
        shift_idx = int(rng.integers(0, len(weekdays)))
        shift = int(rng.choice([-1, 1]))
        new_day = weekdays[shift_idx] + shift
        if 0 <= new_day <= 4 and new_day not in weekdays:
            weekdays[shift_idx] = new_day
    weekdays.sort()

    # Determine which sessions happen based on profile + week
    miss_prob_wd, miss_prob_we = _miss_probability(profile, week_idx)
    bonus_prob = _bonus_probability(profile, week_idx)

    sessions = []
    for d in weekdays:
        if rng.random() >= miss_prob_wd:
            planned = int(rng.integers(80, 101))
            tod = rng.choice(['evening', 'evening', 'evening', 'afternoon'])
            sessions.append((d, planned, tod))
    for d in base_weekend:
        if rng.random() >= miss_prob_we:
            planned = int(rng.integers(60, 91))
            tod = rng.choice(['morning', 'morning', 'afternoon'])
            sessions.append((d, planned, tod))

    # Bonus session
    if rng.random() < bonus_prob:
        bonus_day = int(rng.choice([1, 3, 6]))  # Tue, Thu, or Sun
        planned = int(rng.integers(40, 70))
        tod = 'evening' if bonus_day < 5 else rng.choice(['morning', 'afternoon'])
        sessions.append((bonus_day, planned, tod))

    sessions.sort(key=lambda x: x[0])
    return sessions


def _miss_probability(profile, week_idx):
    """Return (weekday_miss_prob, weekend_miss_prob) for a profile at a given week."""
    if profile == 'carla':
        return (0.1, 0.1)
    elif profile == 'ian':
        # More misses early, fewer late
        p = max(0.05, 1/6 - (week_idx / N_WEEKS) * 0.08)
        return (p, p)
    elif profile == 'fiona':
        # Few misses early, many late
        p = min(0.25, 1/12 + (week_idx / N_WEEKS) * 0.17)
        return (p, p * 1.2)
    elif profile == 'carlos':
        # Random miss rate per week
        return (0.2, 0.2)
    elif profile == 'riley':
        return (0.08, 0.08)
    return (0.1, 0.1)


def _bonus_probability(profile, week_idx):
    if profile == 'carla':
        return 0.08
    elif profile == 'carlos':
        return 0.2
    return 0.05


def pace_ratio(profile, week_idx, session_in_week, rng):
    """Return the pace ratio for a session (actual/planned time)."""
    noise = rng.normal(0, 0.05)

    if profile == 'carla':
        base = rng.uniform(0.95, 1.05)
        return max(0.5, base + noise)

    elif profile == 'ian':
        t = week_idx / (N_WEEKS - 1)
        # 1.2 early -> 0.9 late (linear improvement)
        base = 1.2 - 0.35 * t
        return max(0.5, base + rng.normal(0, 0.07))

    elif profile == 'fiona':
        t = week_idx / (N_WEEKS - 1)
        if week_idx < 4:
            base = rng.uniform(0.85, 0.95)
        else:
            base = 0.95 + (t - 0.4) * 0.58  # drift up to ~1.3
        return max(0.5, base + rng.normal(0, 0.06))

    elif profile == 'carlos':
        # Wild swings
        base = rng.uniform(0.6, 1.5)
        return max(0.4, base + rng.normal(0, 0.12))

    elif profile == 'riley':
        # Abrupt shift around session ~20 (week 5)
        if week_idx < 5:
            base = rng.uniform(0.97, 1.03)
        else:
            base = rng.uniform(0.72, 0.78)
        return max(0.5, base + noise)

    return 1.0 + noise


def material_role(session_global_idx, total_sessions):
    """Cycle through roles with phase weighting."""
    t = session_global_idx / max(total_sessions - 1, 1)
    if t < 0.33:
        return np.random.choice(['foundation', 'foundation', 'anchor'])
    elif t < 0.66:
        return np.random.choice(['anchor', 'anchor', 'practice'])
    else:
        return np.random.choice(['practice', 'practice', 'anchor'])


DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


def generate_sessions(profile, seed):
    """Generate realistic study sessions for a profile with a given seed."""
    rng = np.random.default_rng(seed)
    base_date = datetime(2026, 3, 2)  # A Monday

    all_sessions = []
    for week_idx in range(N_WEEKS):
        week_start = base_date + timedelta(weeks=week_idx)
        schedule = build_weekly_schedule(rng, week_idx, profile)

        # Carlos: some weeks he crushes it, some barely shows
        if profile == 'carlos':
            mood = rng.random()
            if mood < 0.25:
                # Crush week: keep all + maybe add
                pass
            elif mood > 0.75:
                # Slack week: keep 1-2 sessions
                if len(schedule) > 2:
                    keep = int(rng.integers(1, 3))
                    indices = sorted(int(x) for x in rng.choice(len(schedule), size=min(keep, len(schedule)), replace=False))
                    schedule = [schedule[i] for i in indices]

        for day_offset, planned_min, tod in schedule:
            session_date = week_start + timedelta(days=int(day_offset))
            pace = pace_ratio(profile, week_idx, len(all_sessions), rng)
            active_min = max(10, int(round(planned_min * pace)))

            all_sessions.append({
                'date': session_date,
                'plannedMinutes': planned_min,
                'activeMinutes': active_min,
                'pace': active_min / planned_min,
                'materialRole': material_role(len(all_sessions), 40),
                'timeOfDay': tod,
                'dayOfWeek': DAY_NAMES[day_offset],
                'week_idx': week_idx,
            })

    if not all_sessions:
        # Fallback: at least a few sessions
        for i in range(5):
            all_sessions.append({
                'date': base_date + timedelta(days=i * 2),
                'plannedMinutes': 60,
                'activeMinutes': 60,
                'pace': 1.0,
                'materialRole': 'anchor',
                'timeOfDay': 'evening',
                'dayOfWeek': 'Monday',
                'week_idx': 0,
            })

    # Convert to arrays for algorithm consumption
    dates = [s['date'] for s in all_sessions]
    planned = np.array([s['plannedMinutes'] for s in all_sessions], dtype=float)
    active = np.array([s['activeMinutes'] for s in all_sessions], dtype=float)
    pace_arr = active / np.maximum(planned, 1.0)
    roles = np.array([s['materialRole'] for s in all_sessions])

    return {
        'dates': dates,
        'planned': planned,
        'active': active,
        'pace': pace_arr,
        'roles': roles,
        'profile': profile,
        'sessions': all_sessions,
        'n': len(all_sessions),
    }


# ============================================================================
# 2. Algorithm Implementations
# ============================================================================

# --- 2a. CUSUM ---

def run_cusum(pace, h_sigma, k_sigma=0.5):
    """Run CUSUM on pace ratios.

    h and k are in units of sigma (std of pace).
    Returns (breakpoints, s_upper, s_lower).
    """
    n = len(pace)
    if n < 3:
        return [], np.zeros(n), np.zeros(n)

    sigma = np.std(pace)
    if sigma < 1e-6:
        sigma = 0.05
    k = k_sigma * sigma
    h = h_sigma * sigma

    mu = np.mean(pace[:min(5, n)])  # initial reference from first few sessions

    s_upper = np.zeros(n)
    s_lower = np.zeros(n)
    breakpoints = []

    for i in range(n):
        z = pace[i] - mu
        s_upper[i] = max(0, (s_upper[i-1] if i > 0 else 0) + z - k)
        s_lower[i] = min(0, (s_lower[i-1] if i > 0 else 0) + z + k)

        if s_upper[i] > h or s_lower[i] < -h:
            breakpoints.append(i)
            s_upper[i] = 0
            s_lower[i] = 0
            # Update reference to recent mean after breakpoint
            start = max(0, i - 4)
            mu = np.mean(pace[start:i+1])

    return breakpoints, s_upper, s_lower


# --- 2b. Kalman Filter ---

def run_kalman_filter(pace, q_level, q_slope):
    """Run Kalman filter with state = [level, slope].

    Returns (levels, slopes, level_stds, predictions).
    predictions[i] = 1-step-ahead prediction for pace[i].
    """
    n = len(pace)
    if n < 2:
        return np.full(n, pace[0] if n > 0 else 1.0), np.zeros(n), np.full(n, 0.1), np.full(n, 1.0)

    Q = np.array([[q_level, 0.0], [0.0, q_slope]])
    R = np.var(pace) if np.var(pace) > 0.001 else 0.01
    F = np.array([[1.0, 1.0], [0.0, 1.0]])
    H = np.array([[1.0, 0.0]])

    x = np.array([pace[0], 0.0])
    P = np.array([[0.1, 0.0], [0.0, 0.05]])

    levels = np.zeros(n)
    slopes = np.zeros(n)
    level_stds = np.zeros(n)
    predictions = np.zeros(n)

    for i in range(n):
        # Predict
        x_pred = F @ x
        P_pred = F @ P @ F.T + Q
        predictions[i] = x_pred[0]  # 1-step-ahead prediction

        # Update
        y_res = pace[i] - H @ x_pred
        S = H @ P_pred @ H.T + R
        K = P_pred @ H.T / S[0, 0]
        x = x_pred + K.flatten() * y_res[0]
        P = (np.eye(2) - K @ H) @ P_pred

        levels[i] = x[0]
        slopes[i] = x[1]
        level_stds[i] = np.sqrt(max(P[0, 0], 0))

    return levels, slopes, level_stds, predictions


# --- 2c. Kalman per-phase (for best-params visualization) ---

def run_kalman_phased(pace, breakpoints, q_level, q_slope):
    """Run Kalman filter within each CUSUM-detected phase."""
    n = len(pace)
    phase_starts = [0] + [bp + 1 for bp in breakpoints if bp + 1 < n]
    phase_ends = [bp for bp in breakpoints if bp < n] + [n - 1]

    phases = []
    for s, e in zip(phase_starts, phase_ends):
        if s <= e and s < n:
            phases.append((s, e))
    if not phases:
        phases = [(0, n - 1)]

    Q = np.array([[q_level, 0.0], [0.0, q_slope]])
    R = np.var(pace) if np.var(pace) > 0.001 else 0.01
    F = np.array([[1.0, 1.0], [0.0, 1.0]])
    H = np.array([[1.0, 0.0]])

    all_phases = []
    for phase_idx, (start, end) in enumerate(phases):
        phase_pace = pace[start:end+1]
        phase_n = len(phase_pace)
        if phase_n < 2:
            all_phases.append({
                'start': start, 'end': end,
                'level': np.full(phase_n, phase_pace[0] if phase_n > 0 else 1.0),
                'slope': np.zeros(phase_n),
                'level_std': np.full(phase_n, 0.1),
                'slope_std': np.full(phase_n, 0.05),
            })
            continue

        x = np.array([phase_pace[0], 0.0])
        P = np.array([[0.1, 0.0], [0.0, 0.05]])

        levels = np.zeros(phase_n)
        slopes_arr = np.zeros(phase_n)
        level_stds = np.zeros(phase_n)
        slope_stds = np.zeros(phase_n)

        for j in range(phase_n):
            x_pred = F @ x
            P_pred = F @ P @ F.T + Q
            y_res = phase_pace[j] - H @ x_pred
            S = H @ P_pred @ H.T + R
            K = P_pred @ H.T / S[0, 0]
            x = x_pred + K.flatten() * y_res[0]
            P = (np.eye(2) - K @ H) @ P_pred
            levels[j] = x[0]
            slopes_arr[j] = x[1]
            level_stds[j] = np.sqrt(max(P[0, 0], 0))
            slope_stds[j] = np.sqrt(max(P[1, 1], 0))

        all_phases.append({
            'start': start, 'end': end,
            'level': levels, 'slope': slopes_arr,
            'level_std': level_stds, 'slope_std': slope_stds,
        })

    return all_phases


# --- 2d. Bayesian (for visualization) ---

def run_bayesian(pace, roles):
    """Normal-Normal conjugate Bayesian update."""
    n = len(pace)
    mu0, tau0 = 1.0, 10.0
    likelihood_precision = 1.0 / 0.1

    global_mu = np.zeros(n)
    global_ci_lo = np.zeros(n)
    global_ci_hi = np.zeros(n)

    mu_n, tau_n = mu0, tau0
    for i in range(n):
        tau_n_new = tau_n + likelihood_precision
        mu_n_new = (tau_n * mu_n + likelihood_precision * pace[i]) / tau_n_new
        mu_n, tau_n = mu_n_new, tau_n_new
        sigma_n = 1.0 / np.sqrt(tau_n)
        global_mu[i] = mu_n
        global_ci_lo[i] = mu_n - 1.96 * sigma_n
        global_ci_hi[i] = mu_n + 1.96 * sigma_n

    return {
        'global_mu': global_mu,
        'global_ci_lo': global_ci_lo,
        'global_ci_hi': global_ci_hi,
    }


# --- 2e. Gaussian Process ---

def gp_kernel_rbf(X1, X2, length_scale, signal_var):
    """RBF + linear kernel."""
    sq_dist = np.subtract.outer(X1, X2) ** 2
    rbf = signal_var * np.exp(-0.5 * sq_dist / length_scale ** 2)
    linear = np.outer(X1, X2) * 0.01
    return rbf + linear


def run_gp(days, cum_actual, length_scale, noise_ratio, signal_var=None,
           predict_days=None):
    """GP regression on cumulative actual minutes.

    Detrends with a linear fit first, then applies RBF GP on residuals,
    and adds the trend back. This lets the RBF kernel capture deviations
    from the linear growth trend rather than fighting the monotonic growth.

    Returns (mu_star, std_star) at predict_days.
    """
    X_train = days.astype(float)
    y_train = cum_actual.astype(float)
    n_train = len(X_train)

    if n_train < 2:
        if predict_days is None:
            predict_days = X_train
        return np.full(len(predict_days), y_train[0] if n_train > 0 else 0), \
               np.full(len(predict_days), 100.0)

    # Detrend: fit a linear model y = a*x + b
    A = np.vstack([X_train, np.ones(n_train)]).T
    coeffs, _, _, _ = np.linalg.lstsq(A, y_train, rcond=None)
    trend_slope, trend_intercept = coeffs[0], coeffs[1]
    trend_train = trend_slope * X_train + trend_intercept
    residuals = y_train - trend_train

    if signal_var is None:
        signal_var = max(np.var(residuals), 10.0)

    noise_var = noise_ratio * signal_var

    if predict_days is None:
        last_day = X_train[-1]
        X_extra = np.arange(last_day + 1, last_day + 15)
        predict_days = np.concatenate([X_train, X_extra])

    # GP on residuals (pure RBF, no linear kernel since trend is removed)
    def rbf_kernel(X1, X2):
        sq_dist = np.subtract.outer(X1, X2) ** 2
        return signal_var * np.exp(-0.5 * sq_dist / length_scale ** 2)

    K = rbf_kernel(X_train, X_train) + noise_var * np.eye(n_train)
    K_s = rbf_kernel(X_train, predict_days)
    K_ss = rbf_kernel(predict_days, predict_days)

    # Cholesky with jitter for numerical stability
    jitter = 1e-6
    for attempt in range(5):
        try:
            L = np.linalg.cholesky(K + jitter * np.eye(n_train))
            break
        except np.linalg.LinAlgError:
            jitter *= 10
    else:
        alpha = np.linalg.lstsq(K, residuals, rcond=None)[0]
        mu_resid = K_s.T @ alpha
        var_star = np.maximum(np.diag(K_ss) - np.diag(
            K_s.T @ np.linalg.lstsq(K, K_s, rcond=None)[0]), 0)
        trend_pred = trend_slope * predict_days + trend_intercept
        return mu_resid + trend_pred, np.sqrt(var_star)

    alpha = np.linalg.solve(L.T, np.linalg.solve(L, residuals))
    mu_resid = K_s.T @ alpha

    v = np.linalg.solve(L, K_s)
    var_star = np.diag(K_ss) - np.sum(v ** 2, axis=0)
    var_star = np.maximum(var_star, 0)

    # Add trend back
    trend_pred = trend_slope * predict_days + trend_intercept
    return mu_resid + trend_pred, np.sqrt(var_star)


def run_gp_full(sessions, length_scale, noise_ratio):
    """Full GP run for visualization, with extrapolation."""
    dates = sessions['dates']
    active = sessions['active']
    planned = sessions['planned']

    t0 = dates[0]
    days = np.array([(d - t0).days for d in dates], dtype=float)
    cum_actual = np.cumsum(active).astype(float)
    cum_planned = np.cumsum(planned).astype(float)

    last_day = days[-1]
    X_extra = np.arange(last_day + 1, last_day + 15)
    X_test = np.concatenate([days, X_extra])

    mu_star, std_star = run_gp(days, cum_actual, length_scale, noise_ratio,
                                predict_days=X_test)

    avg_planned_per_day = cum_planned[-1] / max(days[-1] + 1, 1)
    cum_planned_ext = np.concatenate([
        cum_planned,
        cum_planned[-1] + avg_planned_per_day * np.arange(1, 15)
    ])

    return {
        'train_days': days,
        'cum_planned': cum_planned,
        'cum_actual': cum_actual,
        'test_days': X_test,
        'gp_mean': mu_star,
        'gp_std': std_star,
        'cum_planned_ext': cum_planned_ext,
        'last_train_day': last_day,
    }


# ============================================================================
# 3. Sweep Functions
# ============================================================================

def sweep_cusum(all_data, h_values):
    """Sweep CUSUM threshold h across all profiles and seeds.

    Returns dict: {profile: {h: {metric: value}}}
    """
    results = {}
    for profile in all_data:
        results[profile] = {}
        for h in h_values:
            delays = []
            false_alarms_list = []
            drift_triggered = []

            for data in all_data[profile]:
                pace = data['pace']
                breakpoints, _, _ = run_cusum(pace, h)

                if profile == 'riley':
                    # Find the true shift point (~session 20, around week 5)
                    # The shift is at the boundary between week 4 and week 5
                    true_shift = None
                    for i, s in enumerate(data['sessions']):
                        if s['week_idx'] >= 5 and true_shift is None:
                            true_shift = i
                    if true_shift is None:
                        true_shift = len(pace) // 2

                    # Detection delay: first breakpoint after true_shift
                    detected = False
                    for bp in breakpoints:
                        if bp >= true_shift - 2:  # allow 2-session tolerance
                            delays.append(bp - true_shift)
                            detected = True
                            break
                    if not detected:
                        delays.append(len(pace))  # missed = max delay

                elif profile in ('carla', 'carlos'):
                    false_alarms_list.append(len(breakpoints))

                elif profile in ('ian', 'fiona'):
                    drift_triggered.append(1 if len(breakpoints) > 0 else 0)

            metrics = {}
            if profile == 'riley':
                metrics['detection_delay'] = np.mean(delays)
                metrics['detection_delay_std'] = np.std(delays)
            elif profile in ('carla', 'carlos'):
                metrics['false_alarm_count'] = np.mean(false_alarms_list)
                metrics['false_alarm_std'] = np.std(false_alarms_list)
            elif profile in ('ian', 'fiona'):
                metrics['drift_trigger_rate'] = np.mean(drift_triggered)

            results[profile][h] = metrics

    return results


def sweep_kalman(all_data, q_levels, q_slopes):
    """Sweep Kalman Q parameters across all profiles.

    Returns dict of metrics per (q_level, q_slope) pair.
    """
    results = {}
    for ql in q_levels:
        for qs in q_slopes:
            key = (ql, qs)
            profile_metrics = {}

            for profile in all_data:
                maes = []
                slope_errors = []
                convergence_sessions = []

                for data in all_data[profile]:
                    pace = data['pace']
                    levels, slopes, _, predictions = run_kalman_filter(pace, ql, qs)
                    n = len(pace)

                    # 1-step-ahead MAE (skip first prediction which has no prior)
                    if n > 1:
                        mae = np.mean(np.abs(predictions[1:] - pace[1:]))
                        maes.append(mae)

                    # Slope accuracy
                    if profile == 'ian':
                        # True slope ~ -0.01 per session (from 1.2 to 0.85 over ~40 sessions)
                        true_slope = -0.35 / max(n - 1, 1)
                        # Use mean of last 10 slope estimates
                        est_slope = np.mean(slopes[-min(10, n):])
                        slope_errors.append(abs(est_slope - true_slope))

                    elif profile == 'carla':
                        # True slope ~ 0
                        est_slope = np.mean(slopes[-min(10, n):])
                        slope_errors.append(abs(est_slope))

                    # Level convergence for Riley
                    if profile == 'riley':
                        # After shift, how fast does level converge to ~0.75?
                        shift_idx = None
                        for i, s in enumerate(data['sessions']):
                            if s['week_idx'] >= 5 and shift_idx is None:
                                shift_idx = i
                        if shift_idx is not None and shift_idx < n:
                            post_shift = levels[shift_idx:]
                            converged = np.where(np.abs(post_shift - 0.75) < 0.05)[0]
                            if len(converged) > 0:
                                convergence_sessions.append(converged[0])
                            else:
                                convergence_sessions.append(len(post_shift))

                pm = {}
                if maes:
                    pm['mae'] = np.mean(maes)
                if slope_errors:
                    pm['slope_error'] = np.mean(slope_errors)
                if convergence_sessions:
                    pm['convergence'] = np.mean(convergence_sessions)

                profile_metrics[profile] = pm

            results[key] = profile_metrics

    return results


def sweep_gp(all_data, length_scales, noise_ratios):
    """Sweep GP hyperparameters across all profiles.

    Returns dict of metrics per (length_scale, noise_ratio) pair.
    """
    results = {}
    total = len(length_scales) * len(noise_ratios)
    count = 0

    for ls in length_scales:
        for nr in noise_ratios:
            count += 1
            key = (ls, nr)
            profile_metrics = {}

            for profile in all_data:
                ci_calibrations = []
                extrap_rmses = []
                ci_widths = []

                for data in all_data[profile]:
                    dates = data['dates']
                    active = data['active']
                    n = len(active)

                    if n < 6:
                        continue

                    t0 = dates[0]
                    days = np.array([(d - t0).days for d in dates], dtype=float)
                    cum_actual = np.cumsum(active).astype(float)

                    # Hold out last 2 weeks (roughly last 8 sessions)
                    holdout_count = min(8, n // 3)
                    train_n = n - holdout_count

                    if train_n < 4:
                        continue

                    train_days = days[:train_n]
                    train_cum = cum_actual[:train_n]
                    test_days_ho = days[train_n:]
                    test_cum = cum_actual[train_n:]

                    # CI calibration via held-out test points
                    # Predict at test (held-out) points and check coverage
                    mu_test_ci, std_test_ci = run_gp(train_days, train_cum, ls, nr,
                                                      predict_days=test_days_ho)
                    in_ci = np.sum(np.abs(test_cum - mu_test_ci) <= 1.96 * std_test_ci)
                    ci_calibrations.append(in_ci / len(test_cum) * 100)

                    # Extrapolation RMSE on held-out data
                    mu_test, std_test = run_gp(train_days, train_cum, ls, nr,
                                                predict_days=test_days_ho)
                    rmse = np.sqrt(np.mean((test_cum - mu_test) ** 2))
                    extrap_rmses.append(rmse)

                    # CI width at 14-day extrapolation
                    extrap_14 = train_days[-1] + 14
                    _, std_14 = run_gp(train_days, train_cum, ls, nr,
                                        predict_days=np.array([extrap_14]))
                    ci_widths.append(2 * 1.96 * std_14[0])

                pm = {}
                if ci_calibrations:
                    pm['ci_calibration'] = np.mean(ci_calibrations)
                if extrap_rmses:
                    pm['extrap_rmse'] = np.mean(extrap_rmses)
                if ci_widths:
                    pm['ci_width'] = np.mean(ci_widths)

                profile_metrics[profile] = pm

            results[key] = profile_metrics

    return results


# ============================================================================
# 4. Plotting Functions
# ============================================================================

def plot_cusum_sweep(cusum_results, h_values, output_path):
    """Dual-axis plot: detection delay (Riley) vs false alarms (Carla + Carlos)."""
    try:
        plt.style.use('seaborn-v0_8-whitegrid')
    except Exception:
        plt.style.use('seaborn-whitegrid')

    fig, ax1 = plt.subplots(figsize=(12, 7))

    # Left axis: detection delay for Riley
    delays = [cusum_results['riley'][h]['detection_delay'] for h in h_values]
    delay_stds = [cusum_results['riley'][h].get('detection_delay_std', 0) for h in h_values]

    color_delay = '#2563EB'
    ax1.plot(h_values, delays, 'o-', color=color_delay, linewidth=2.5,
             markersize=8, label='Riley: Detection delay', zorder=5)
    ax1.fill_between(h_values,
                      np.array(delays) - np.array(delay_stds),
                      np.array(delays) + np.array(delay_stds),
                      color=color_delay, alpha=0.15)
    ax1.set_xlabel('CUSUM threshold h (multiples of $\\sigma$)', fontsize=13, fontweight='bold')
    ax1.set_ylabel('Detection delay (sessions)', fontsize=13, fontweight='bold',
                    color=color_delay)
    ax1.tick_params(axis='y', labelcolor=color_delay, labelsize=11)
    ax1.tick_params(axis='x', labelsize=11)

    # Also show drift trigger rates for Ian and Fiona on left axis annotations
    ian_rates = [cusum_results['ian'][h].get('drift_trigger_rate', 0) for h in h_values]
    fiona_rates = [cusum_results['fiona'][h].get('drift_trigger_rate', 0) for h in h_values]

    # Right axis: false alarms for Carla and Carlos
    ax2 = ax1.twinx()
    bar_width = 0.15
    x_pos = np.arange(len(h_values))

    carla_fa = [cusum_results['carla'][h]['false_alarm_count'] for h in h_values]
    carlos_fa = [cusum_results['carlos'][h]['false_alarm_count'] for h in h_values]
    carla_std = [cusum_results['carla'][h].get('false_alarm_std', 0) for h in h_values]
    carlos_std = [cusum_results['carlos'][h].get('false_alarm_std', 0) for h in h_values]

    color_carla = '#059669'
    color_carlos = '#DC2626'

    bars1 = ax2.bar(x_pos - bar_width/2, carla_fa, bar_width, yerr=carla_std,
                    color=color_carla, alpha=0.7, label='Carla: False alarms',
                    capsize=3, edgecolor='white', linewidth=0.5)
    bars2 = ax2.bar(x_pos + bar_width/2, carlos_fa, bar_width, yerr=carlos_std,
                    color=color_carlos, alpha=0.7, label='Carlos: False alarms',
                    capsize=3, edgecolor='white', linewidth=0.5)

    ax2.set_ylabel('False alarm count (mean)', fontsize=13, fontweight='bold',
                    color='#555555')
    ax2.tick_params(axis='y', labelcolor='#555555', labelsize=11)

    # Set x-ticks to h values
    ax1.set_xticks(x_pos)
    ax1.set_xticklabels([f'{h:.1f}' for h in h_values])

    # Combined legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper right',
               fontsize=11, framealpha=0.9)

    # Add drift trigger info as text annotation
    best_h_idx = np.argmin(np.array(delays) + 2 * np.array(carla_fa) + 2 * np.array(carlos_fa))
    ax1.annotate(f'Ian drift trigger: {ian_rates[best_h_idx]:.0%}\n'
                 f'Fiona drift trigger: {fiona_rates[best_h_idx]:.0%}',
                 xy=(0.02, 0.98), xycoords='axes fraction',
                 fontsize=10, va='top', ha='left',
                 bbox=dict(boxstyle='round,pad=0.5', facecolor='lightyellow',
                           edgecolor='#D4A574', alpha=0.9))

    ax1.set_title('CUSUM Threshold Selection\n'
                  'Detection delay vs. false alarm rate across user profiles',
                  fontsize=15, fontweight='bold', pad=15)

    fig.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  Saved: {output_path}")


def plot_kalman_sweep(kalman_results, q_levels, q_slopes, output_path):
    """Two heatmaps: 1-step MAE and slope accuracy on Ian."""
    try:
        plt.style.use('seaborn-v0_8-whitegrid')
    except Exception:
        plt.style.use('seaborn-whitegrid')

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    nl = len(q_levels)
    ns = len(q_slopes)

    # Aggregate MAE across all profiles
    mae_grid = np.zeros((nl, ns))
    slope_grid = np.zeros((nl, ns))

    for i, ql in enumerate(q_levels):
        for j, qs in enumerate(q_slopes):
            key = (ql, qs)
            # Average MAE across all profiles
            maes = [kalman_results[key][p].get('mae', np.nan)
                    for p in kalman_results[key]]
            mae_grid[i, j] = np.nanmean(maes)

            # Slope error on Ian
            slope_grid[i, j] = kalman_results[key].get('ian', {}).get('slope_error', np.nan)

    # Heatmap 1: MAE
    im1 = ax1.imshow(mae_grid, cmap='viridis_r', aspect='auto',
                      origin='lower')
    ax1.set_xticks(range(ns))
    ax1.set_xticklabels([f'{qs:.4f}' for qs in q_slopes], rotation=45, ha='right', fontsize=9)
    ax1.set_yticks(range(nl))
    ax1.set_yticklabels([f'{ql:.3f}' for ql in q_levels], fontsize=9)
    ax1.set_xlabel('Q[1,1] (slope noise)', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Q[0,0] (level noise)', fontsize=12, fontweight='bold')
    ax1.set_title('1-Step-Ahead MAE\n(averaged across all profiles)',
                  fontsize=13, fontweight='bold')
    cbar1 = fig.colorbar(im1, ax=ax1, shrink=0.8)
    cbar1.set_label('MAE', fontsize=11)

    # Annotate cells
    for i in range(nl):
        for j in range(ns):
            val = mae_grid[i, j]
            if not np.isnan(val):
                text_color = 'white' if val > np.nanmedian(mae_grid) else 'black'
                ax1.text(j, i, f'{val:.3f}', ha='center', va='center',
                        fontsize=7, color=text_color, fontweight='bold')

    # Mark best cell
    best_idx = np.unravel_index(np.nanargmin(mae_grid), mae_grid.shape)
    ax1.add_patch(plt.Rectangle((best_idx[1]-0.5, best_idx[0]-0.5), 1, 1,
                                 fill=False, edgecolor='red', linewidth=3))

    # Heatmap 2: Slope accuracy on Ian
    im2 = ax2.imshow(slope_grid, cmap='magma_r', aspect='auto',
                      origin='lower')
    ax2.set_xticks(range(ns))
    ax2.set_xticklabels([f'{qs:.4f}' for qs in q_slopes], rotation=45, ha='right', fontsize=9)
    ax2.set_yticks(range(nl))
    ax2.set_yticklabels([f'{ql:.3f}' for ql in q_levels], fontsize=9)
    ax2.set_xlabel('Q[1,1] (slope noise)', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Q[0,0] (level noise)', fontsize=12, fontweight='bold')
    ax2.set_title('Slope Accuracy on Ian\n(|estimated - true slope|)',
                  fontsize=13, fontweight='bold')
    cbar2 = fig.colorbar(im2, ax=ax2, shrink=0.8)
    cbar2.set_label('Slope error', fontsize=11)

    # Annotate cells
    for i in range(nl):
        for j in range(ns):
            val = slope_grid[i, j]
            if not np.isnan(val):
                text_color = 'white' if val > np.nanmedian(slope_grid) else 'black'
                ax2.text(j, i, f'{val:.4f}', ha='center', va='center',
                        fontsize=7, color=text_color, fontweight='bold')

    # Mark best cell
    valid_slope = slope_grid.copy()
    valid_slope[np.isnan(valid_slope)] = np.inf
    best_idx2 = np.unravel_index(np.argmin(valid_slope), slope_grid.shape)
    ax2.add_patch(plt.Rectangle((best_idx2[1]-0.5, best_idx2[0]-0.5), 1, 1,
                                 fill=False, edgecolor='cyan', linewidth=3))

    fig.suptitle('Kalman Filter Hyperparameter Sweep', fontsize=16,
                 fontweight='bold', y=1.02)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  Saved: {output_path}")


def plot_gp_sweep(gp_results, length_scales, noise_ratios, output_path):
    """Two heatmaps: CI calibration error and extrapolation RMSE."""
    try:
        plt.style.use('seaborn-v0_8-whitegrid')
    except Exception:
        plt.style.use('seaborn-whitegrid')

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    nls = len(length_scales)
    nnr = len(noise_ratios)

    ci_grid = np.zeros((nls, nnr))
    rmse_grid = np.zeros((nls, nnr))

    for i, ls in enumerate(length_scales):
        for j, nr in enumerate(noise_ratios):
            key = (ls, nr)
            # Average CI calibration across all profiles
            cals = [gp_results[key][p].get('ci_calibration', np.nan)
                    for p in gp_results[key]]
            ci_grid[i, j] = abs(np.nanmean(cals) - 95.0)

            # Average extrapolation RMSE across all profiles
            rmses = [gp_results[key][p].get('extrap_rmse', np.nan)
                     for p in gp_results[key]]
            rmse_grid[i, j] = np.nanmean(rmses)

    # Heatmap 1: CI calibration error
    im1 = ax1.imshow(ci_grid, cmap='YlOrRd', aspect='auto', origin='lower')
    ax1.set_xticks(range(nnr))
    ax1.set_xticklabels([f'{nr:.2f}' for nr in noise_ratios], fontsize=10)
    ax1.set_yticks(range(nls))
    ax1.set_yticklabels([f'{ls}' for ls in length_scales], fontsize=10)
    ax1.set_xlabel('$\\sigma^2_n / \\sigma^2_f$ (noise ratio)', fontsize=12, fontweight='bold')
    ax1.set_ylabel('$\\ell$ (RBF length scale, days)', fontsize=12, fontweight='bold')
    ax1.set_title('CI Calibration Error\n|actual coverage% - 95%|',
                  fontsize=13, fontweight='bold')
    cbar1 = fig.colorbar(im1, ax=ax1, shrink=0.8)
    cbar1.set_label('Calibration error (%)', fontsize=11)

    for i in range(nls):
        for j in range(nnr):
            val = ci_grid[i, j]
            if not np.isnan(val):
                text_color = 'white' if val > np.nanmedian(ci_grid) else 'black'
                ax1.text(j, i, f'{val:.1f}', ha='center', va='center',
                        fontsize=9, color=text_color, fontweight='bold')

    best_ci = np.unravel_index(np.nanargmin(ci_grid), ci_grid.shape)
    ax1.add_patch(plt.Rectangle((best_ci[1]-0.5, best_ci[0]-0.5), 1, 1,
                                 fill=False, edgecolor='blue', linewidth=3))

    # Heatmap 2: Extrapolation RMSE
    im2 = ax2.imshow(rmse_grid, cmap='YlOrRd', aspect='auto', origin='lower')
    ax2.set_xticks(range(nnr))
    ax2.set_xticklabels([f'{nr:.2f}' for nr in noise_ratios], fontsize=10)
    ax2.set_yticks(range(nls))
    ax2.set_yticklabels([f'{ls}' for ls in length_scales], fontsize=10)
    ax2.set_xlabel('$\\sigma^2_n / \\sigma^2_f$ (noise ratio)', fontsize=12, fontweight='bold')
    ax2.set_ylabel('$\\ell$ (RBF length scale, days)', fontsize=12, fontweight='bold')
    ax2.set_title('Extrapolation RMSE\n(held-out last 2 weeks)',
                  fontsize=13, fontweight='bold')
    cbar2 = fig.colorbar(im2, ax=ax2, shrink=0.8)
    cbar2.set_label('RMSE (minutes)', fontsize=11)

    for i in range(nls):
        for j in range(nnr):
            val = rmse_grid[i, j]
            if not np.isnan(val):
                text_color = 'white' if val > np.nanmedian(rmse_grid) else 'black'
                ax2.text(j, i, f'{val:.0f}', ha='center', va='center',
                        fontsize=9, color=text_color, fontweight='bold')

    valid_rmse = rmse_grid.copy()
    valid_rmse[np.isnan(valid_rmse)] = np.inf
    best_rmse = np.unravel_index(np.argmin(valid_rmse), rmse_grid.shape)
    ax2.add_patch(plt.Rectangle((best_rmse[1]-0.5, best_rmse[0]-0.5), 1, 1,
                                 fill=False, edgecolor='blue', linewidth=3))

    fig.suptitle('Gaussian Process Hyperparameter Sweep', fontsize=16,
                 fontweight='bold', y=1.02)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  Saved: {output_path}")


def plot_best_params(sessions, best_h, best_ql, best_qs, best_ls, best_nr,
                     output_path):
    """4-panel diagnostic plot for one profile with best parameters."""
    try:
        plt.style.use('seaborn-v0_8-whitegrid')
    except Exception:
        plt.style.use('seaborn-whitegrid')

    fig, axes = plt.subplots(2, 2, figsize=(16, 12))

    profile_names = {
        'carla': 'Consistent Carla',
        'ian': 'Improving Ian',
        'fiona': 'Fading Fiona',
        'carlos': 'Chaotic Carlos',
        'riley': 'Regime-Shift Riley',
    }
    fig.suptitle(f"Best Parameters: {profile_names.get(sessions['profile'], sessions['profile'])}",
                 fontsize=16, fontweight='bold', y=0.98)

    pace = sessions['pace']
    n = len(pace)
    idx = np.arange(n)

    # Run algorithms with best params
    bayesian = run_bayesian(pace, sessions['roles'])
    breakpoints, s_upper, s_lower = run_cusum(pace, best_h)
    kalman_phases = run_kalman_phased(pace, breakpoints, best_ql, best_qs)
    gp = run_gp_full(sessions, best_ls, best_nr)

    sigma = np.std(pace)
    if sigma < 1e-6:
        sigma = 0.05
    h_abs = best_h * sigma

    # --- Panel 1: Bayesian + CUSUM triggers ---
    ax = axes[0, 0]
    ax.scatter(idx, pace, c='#555555', s=20, alpha=0.6, label='Observed pace', zorder=3)
    ax.plot(idx, bayesian['global_mu'], color='#2563EB', linewidth=2,
            label='Bayesian posterior mean')
    ax.fill_between(idx, bayesian['global_ci_lo'], bayesian['global_ci_hi'],
                     color='#2563EB', alpha=0.15, label='95% CI')
    for bp in breakpoints:
        ax.axvline(bp, color='#DC2626', linewidth=1.5, linestyle='--', alpha=0.8)
    if breakpoints:
        ax.axvline(breakpoints[0], color='#DC2626', linewidth=1.5,
                   linestyle='--', alpha=0.8, label='CUSUM trigger')
    ax.axhline(1.0, color='#94A3B8', linewidth=0.8, linestyle=':')
    ax.set_title(f'Bayesian Posterior + CUSUM (h={best_h:.1f}$\\sigma$)', fontweight='bold')
    ax.set_xlabel('Session index')
    ax.set_ylabel('Pace ratio')
    ax.legend(loc='best', fontsize=8)
    ax.set_ylim(max(0.3, pace.min() - 0.15), min(2.0, pace.max() + 0.15))

    # --- Panel 2: CUSUM accumulator ---
    ax = axes[0, 1]
    ax.plot(idx, s_upper, color='#DC2626', linewidth=1.5, label='S+ (upper)')
    ax.plot(idx, s_lower, color='#2563EB', linewidth=1.5, label='S- (lower)')
    ax.axhline(h_abs, color='#DC2626', linewidth=1, linestyle='--',
               alpha=0.6, label=f'h = {h_abs:.3f}')
    ax.axhline(-h_abs, color='#2563EB', linewidth=1, linestyle='--', alpha=0.6)
    ax.axhline(0, color='#94A3B8', linewidth=0.8, linestyle=':')
    for bp in breakpoints:
        ax.axvline(bp, color='#F59E0B', linewidth=1.5, linestyle='-', alpha=0.7)
    ax.set_title('CUSUM Accumulator', fontweight='bold')
    ax.set_xlabel('Session index')
    ax.set_ylabel('Cumulative sum')
    ax.legend(loc='best', fontsize=8)

    # --- Panel 3: Kalman phases ---
    ax = axes[1, 0]
    colors_phase = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626']
    for pi, phase in enumerate(kalman_phases):
        s, e = phase['start'], phase['end']
        phase_idx = np.arange(s, e + 1)
        c = colors_phase[pi % len(colors_phase)]
        ax.plot(phase_idx, phase['level'], color=c, linewidth=2,
                label=f'Phase {pi+1} level')
        ax.fill_between(phase_idx,
                         phase['level'] - 1.96 * phase['level_std'],
                         phase['level'] + 1.96 * phase['level_std'],
                         color=c, alpha=0.12)
        mid = len(phase['slope']) // 2
        if mid < len(phase['slope']):
            slope_val = phase['slope'][mid]
            ax.annotate(f'slope={slope_val:+.4f}',
                        xy=(phase_idx[mid], phase['level'][mid]),
                        xytext=(0, 15), textcoords='offset points',
                        fontsize=7, color=c, fontweight='bold', ha='center',
                        arrowprops=dict(arrowstyle='->', color=c, lw=0.8))
    ax.scatter(idx, pace, c='#555555', s=15, alpha=0.4, zorder=2, label='Observed')
    ax.axhline(1.0, color='#94A3B8', linewidth=0.8, linestyle=':')
    ax.set_title(f'Kalman Filter (Q_level={best_ql:.3f}, Q_slope={best_qs:.4f})',
                 fontweight='bold')
    ax.set_xlabel('Session index')
    ax.set_ylabel('Pace ratio')
    ax.legend(loc='best', fontsize=7)

    # --- Panel 4: GP burn-up ---
    ax = axes[1, 1]
    test_days = gp['test_days']
    ax.step(test_days, gp['cum_planned_ext'][:len(test_days)], where='post',
            color='#94A3B8', linewidth=1.5, linestyle='--', label='Planned cumulative')
    ax.scatter(gp['train_days'], gp['cum_actual'], c='#2563EB', s=25, zorder=4,
               label='Actual cumulative')
    ax.plot(test_days, gp['gp_mean'], color='#059669', linewidth=2, label='GP mean')
    ax.fill_between(test_days,
                     gp['gp_mean'] - 1.96 * gp['gp_std'],
                     gp['gp_mean'] + 1.96 * gp['gp_std'],
                     color='#059669', alpha=0.15, label='GP 95% CI')
    ax.axvline(gp['last_train_day'], color='#F59E0B', linewidth=1.2,
               linestyle=':', label='Extrapolation start')
    ax.set_title(f'GP Burn-Up ($\\ell$={best_ls}d, noise={best_nr:.2f})',
                 fontweight='bold')
    ax.set_xlabel('Days from start')
    ax.set_ylabel('Cumulative minutes')
    ax.legend(loc='upper left', fontsize=7)

    plt.tight_layout(rect=[0, 0, 1, 0.96])
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  Saved: {output_path}")


# ============================================================================
# 5. Recommendation Logic
# ============================================================================

def find_best_cusum(cusum_results, h_values):
    """Find best h that balances detection delay and false alarms.

    Strategy: find the lowest h where Carla's false alarms are <= 0.5
    on average. Among candidates meeting this threshold, pick the one
    with lowest detection delay on Riley.
    If no h meets the Carla threshold, pick the h with lowest total score.
    """
    # First pass: find candidates where Carla FA <= 0.5
    candidates = []
    for i, h in enumerate(h_values):
        fa_carla = cusum_results['carla'][h]['false_alarm_count']
        if fa_carla <= 0.5:
            candidates.append(i)

    if candidates:
        # Among low-FA candidates, pick the one with lowest Riley delay
        best_idx = min(candidates,
                       key=lambda i: cusum_results['riley'][h_values[i]]['detection_delay'])
        return h_values[best_idx]
    else:
        # Fallback: minimize combined score
        scores = []
        for h in h_values:
            delay = cusum_results['riley'][h]['detection_delay']
            fa_carla = cusum_results['carla'][h]['false_alarm_count']
            fa_carlos = cusum_results['carlos'][h]['false_alarm_count']
            score = delay + 2 * (fa_carla + fa_carlos)
            scores.append(score)
        return h_values[np.argmin(scores)]


def find_best_kalman(kalman_results, q_levels, q_slopes):
    """Find best Q combo balancing MAE and slope accuracy."""
    best_score = np.inf
    best_ql, best_qs = q_levels[0], q_slopes[0]

    for ql in q_levels:
        for qs in q_slopes:
            key = (ql, qs)
            maes = [kalman_results[key][p].get('mae', np.nan)
                    for p in kalman_results[key]]
            mae = np.nanmean(maes)
            slope_err = kalman_results[key].get('ian', {}).get('slope_error', np.nan)
            if np.isnan(mae) or np.isnan(slope_err):
                continue
            # Normalize and combine
            score = mae + 2 * slope_err  # weight slope accuracy
            if score < best_score:
                best_score = score
                best_ql, best_qs = ql, qs

    return best_ql, best_qs


def find_best_gp(gp_results, length_scales, noise_ratios):
    """Find best GP params balancing CI calibration and RMSE."""
    best_score = np.inf
    best_ls, best_nr = length_scales[0], noise_ratios[0]

    for ls in length_scales:
        for nr in noise_ratios:
            key = (ls, nr)
            cals = [gp_results[key][p].get('ci_calibration', np.nan)
                    for p in gp_results[key]]
            rmses = [gp_results[key][p].get('extrap_rmse', np.nan)
                     for p in gp_results[key]]
            cal_err = abs(np.nanmean(cals) - 95.0)
            rmse = np.nanmean(rmses)
            if np.isnan(cal_err) or np.isnan(rmse):
                continue
            # Normalize: cal_err in [0, 50], rmse in [0, 5000]
            score = cal_err / 10 + rmse / 500
            if score < best_score:
                best_score = score
                best_ls, best_nr = ls, nr

    return best_ls, best_nr


# ============================================================================
# 6. Main
# ============================================================================

def main():
    print("=" * 70)
    print("  HYPERPARAMETER SWEEP: Study Tracker ML Algorithms")
    print("=" * 70)
    print(f"  Seeds per profile: {SEEDS_PER_PROFILE}")
    print(f"  Weeks simulated: {N_WEEKS}")
    print()

    profiles = ['carla', 'ian', 'fiona', 'carlos', 'riley']
    log_progress(0, "hyperparam_sweep.start", f"profiles={len(profiles)} seeds_per_profile={SEEDS_PER_PROFILE}")

    # --- Generate all synthetic data ---
    print("[1/6] Generating synthetic data...")
    log_progress(5, "hyperparam_sweep.generate.start")
    all_data = {}
    for p_idx, profile in enumerate(profiles):
        all_data[profile] = []
        for s_idx in range(SEEDS_PER_PROFILE):
            seed = 1000 + p_idx * 100 + s_idx
            data = generate_sessions(profile, seed)
            all_data[profile].append(data)
        log_progress(5 + ((p_idx + 1) / len(profiles)) * 10, "hyperparam_sweep.generate.profile_done", f"profile={profile}")
        print(f"  {profile}: {SEEDS_PER_PROFILE} datasets, "
              f"avg {np.mean([d['n'] for d in all_data[profile]]):.1f} sessions each")
    print()

    # --- CUSUM Sweep ---
    print("[2/6] CUSUM threshold sweep...")
    log_progress(20, "hyperparam_sweep.cusum.start")
    h_values = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0]
    cusum_results = sweep_cusum(all_data, h_values)
    log_progress(35, "hyperparam_sweep.cusum.complete", f"h_values={len(h_values)}")

    print("  Results by h:")
    for h in h_values:
        delay = cusum_results['riley'][h]['detection_delay']
        fa_carla = cusum_results['carla'][h]['false_alarm_count']
        fa_carlos = cusum_results['carlos'][h]['false_alarm_count']
        ian_drift = cusum_results['ian'][h].get('drift_trigger_rate', 0)
        fiona_drift = cusum_results['fiona'][h].get('drift_trigger_rate', 0)
        print(f"    h={h:.1f}: Riley delay={delay:.1f}, "
              f"Carla FA={fa_carla:.1f}, Carlos FA={fa_carlos:.1f}, "
              f"Ian drift={ian_drift:.0%}, Fiona drift={fiona_drift:.0%}")

    best_h = find_best_cusum(cusum_results, h_values)
    print(f"  >>> Best h = {best_h:.1f} sigma")
    print()

    # --- Kalman Sweep ---
    print("[3/6] Kalman filter process noise sweep...")
    log_progress(40, "hyperparam_sweep.kalman.start")
    q_levels = [0.001, 0.003, 0.005, 0.01, 0.02, 0.05]
    q_slopes = [0.0001, 0.0003, 0.0005, 0.001, 0.003, 0.005]

    kalman_results = sweep_kalman(all_data, q_levels, q_slopes)
    log_progress(55, "hyperparam_sweep.kalman.complete", f"q_levels={len(q_levels)} q_slopes={len(q_slopes)}")

    best_ql, best_qs = find_best_kalman(kalman_results, q_levels, q_slopes)
    print(f"  >>> Best Q[0,0] = {best_ql:.3f}, Q[1,1] = {best_qs:.4f}")

    # Print summary for best
    key = (best_ql, best_qs)
    for profile in profiles:
        pm = kalman_results[key].get(profile, {})
        parts = []
        if 'mae' in pm:
            parts.append(f"MAE={pm['mae']:.4f}")
        if 'slope_error' in pm:
            parts.append(f"slope_err={pm['slope_error']:.5f}")
        if 'convergence' in pm:
            parts.append(f"convergence={pm['convergence']:.1f}sess")
        print(f"    {profile}: {', '.join(parts)}")
    print()

    # --- GP Sweep ---
    print("[4/6] GP hyperparameter sweep...")
    log_progress(60, "hyperparam_sweep.gp.start")
    length_scales = [3, 5, 7, 10, 14, 21]
    noise_ratios = [0.01, 0.05, 0.1, 0.2, 0.5]

    gp_results = sweep_gp(all_data, length_scales, noise_ratios)
    log_progress(75, "hyperparam_sweep.gp.complete", f"length_scales={len(length_scales)} noise_ratios={len(noise_ratios)}")

    best_ls, best_nr = find_best_gp(gp_results, length_scales, noise_ratios)
    print(f"  >>> Best length_scale = {best_ls} days, noise_ratio = {best_nr:.2f}")

    # Print summary for best
    key = (best_ls, best_nr)
    for profile in profiles:
        pm = gp_results[key].get(profile, {})
        parts = []
        if 'ci_calibration' in pm:
            parts.append(f"CI={pm['ci_calibration']:.1f}%")
        if 'extrap_rmse' in pm:
            parts.append(f"RMSE={pm['extrap_rmse']:.0f}min")
        if 'ci_width' in pm:
            parts.append(f"CI_width={pm['ci_width']:.0f}min")
        print(f"    {profile}: {', '.join(parts)}")
    print()

    # --- Generate Sweep Plots ---
    print("[5/6] Generating sweep plots...")
    log_progress(80, "hyperparam_sweep.plots.start", f"output_dir={OUTPUT_DIR}")
    plot_cusum_sweep(cusum_results, h_values,
                      os.path.join(OUTPUT_DIR, 'cusum_sweep.png'))
    log_progress(84, "hyperparam_sweep.plots.cusum_written")
    plot_kalman_sweep(kalman_results, q_levels, q_slopes,
                       os.path.join(OUTPUT_DIR, 'kalman_sweep.png'))
    log_progress(88, "hyperparam_sweep.plots.kalman_written")
    plot_gp_sweep(gp_results, length_scales, noise_ratios,
                   os.path.join(OUTPUT_DIR, 'gp_sweep.png'))
    log_progress(90, "hyperparam_sweep.plots.gp_written")
    print()

    # --- Generate Best-Params Visualizations ---
    print("[6/6] Generating best-params diagnostic plots...")
    log_progress(92, "hyperparam_sweep.best_params.start")
    for profile in profiles:
        # Use seed 0 for the canonical visualization
        seed = 1000 + profiles.index(profile) * 100
        data = generate_sessions(profile, seed)
        output_path = os.path.join(OUTPUT_DIR, f'best_params_{profile}.png')
        plot_best_params(data, best_h, best_ql, best_qs, best_ls, best_nr,
                          output_path)
        log_progress(92 + ((profiles.index(profile) + 1) / len(profiles)) * 6, "hyperparam_sweep.best_params.profile_written", f"profile={profile}")
    print()

    # --- Print Final Recommendation Table ---
    print("=" * 70)
    print("  RECOMMENDED HYPERPARAMETERS")
    print("=" * 70)

    # Gather reasoning
    delay_best = cusum_results['riley'][best_h]['detection_delay']
    fa_carla_best = cusum_results['carla'][best_h]['false_alarm_count']
    fa_carlos_best = cusum_results['carlos'][best_h]['false_alarm_count']

    kalman_key = (best_ql, best_qs)
    mae_best = np.nanmean([kalman_results[kalman_key][p].get('mae', np.nan) for p in profiles])
    slope_err_best = kalman_results[kalman_key].get('ian', {}).get('slope_error', 0)

    gp_key = (best_ls, best_nr)
    ci_best = np.nanmean([gp_results[gp_key][p].get('ci_calibration', np.nan) for p in profiles])
    rmse_best = np.nanmean([gp_results[gp_key][p].get('extrap_rmse', np.nan) for p in profiles])

    table = [
        ('CUSUM', 'h (threshold)',
         f'{best_h:.1f} sigma',
         f'Riley delay={delay_best:.1f}sess, Carla FA={fa_carla_best:.1f}, Carlos FA={fa_carlos_best:.1f}'),
        ('CUSUM', 'k (slack)',
         '0.5 sigma',
         'Standard CUSUM slack; robust across all profiles'),
        ('Kalman', 'Q[0,0] (level)',
         f'{best_ql:.3f}',
         f'Overall MAE={mae_best:.4f}, responsive to level changes'),
        ('Kalman', 'Q[1,1] (slope)',
         f'{best_qs:.4f}',
         f'Ian slope err={slope_err_best:.5f}, tracks gradual trends'),
        ('GP', 'l (length scale)',
         f'{best_ls} days',
         f'CI calibration={ci_best:.1f}%, balances smooth fit vs. tracking'),
        ('GP', 'noise ratio',
         f'{best_nr:.2f}',
         f'Extrap RMSE={rmse_best:.0f}min, appropriate noise level'),
    ]

    print()
    print(f"{'Algorithm':<12} | {'Parameter':<20} | {'Recommended':<12} | {'Reasoning'}")
    print(f"{'-'*12}-+-{'-'*20}-+-{'-'*12}-+-{'-'*50}")
    for alg, param, rec, reason in table:
        print(f"{alg:<12} | {param:<20} | {rec:<12} | {reason}")

    print()
    print(f"Output directory: {OUTPUT_DIR}")
    print("Files generated:")
    print("  - cusum_sweep.png")
    print("  - kalman_sweep.png")
    print("  - gp_sweep.png")
    for profile in profiles:
        print(f"  - best_params_{profile}.png")
    print()
    print("Done.")
    log_progress(100, "hyperparam_sweep.complete")


if __name__ == '__main__':
    main()
