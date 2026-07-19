#!/usr/bin/env python3
"""
ML Algorithm Visualization for Study Tracker
Tests four algorithms on synthetic user session data:
  1. Hierarchical Bayesian (Normal-Normal conjugate)
  2. CUSUM (Cumulative Sum Control Chart)
  3. Kalman Filter (per-phase after CUSUM breakpoints)
  4. Gaussian Process (burn-up chart extrapolation)
"""

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime, timedelta, timezone
import os
import sys
import time

_PROGRESS_STARTED_AT = time.monotonic()


def log_progress(percent, state, detail=""):
    pct = max(0, min(100, int(round(percent))))
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    elapsed = int(time.monotonic() - _PROGRESS_STARTED_AT)
    suffix = f" detail={detail}" if detail else ""
    print(
        f"[algo-test-progress] {timestamp} {pct:03d}% state={state} elapsed={elapsed}s{suffix}",
        file=sys.stderr,
        flush=True,
    )

# ---------------------------------------------------------------------------
# 1. Synthetic Data Generation
# ---------------------------------------------------------------------------

def generate_sessions(profile_name, rng, n_sessions=40):
    """Generate synthetic session data for a given user profile."""
    base_date = datetime(2026, 3, 1)
    dates = []
    day = 0
    for _ in range(n_sessions):
        day += int(rng.choice([1, 1, 1, 2, 2, 3]))  # daily-ish with gaps
        dates.append(base_date + timedelta(days=int(day)))

    planned = rng.integers(40, 91, size=n_sessions)
    roles = rng.choice(['anchor', 'foundation', 'practice'], size=n_sessions)

    if profile_name == 'steady':
        pace = 1.0 + rng.normal(0, 0.08, n_sessions)
    elif profile_name == 'improver':
        pace = np.linspace(1.2, 0.85, n_sessions) + rng.normal(0, 0.06, n_sessions)
    elif profile_name == 'fatiguer':
        pace = np.linspace(0.9, 1.3, n_sessions) + rng.normal(0, 0.06, n_sessions)
    elif profile_name == 'erratic':
        pace = 1.0 + rng.normal(0, 0.25, n_sessions)
    elif profile_name == 'regime_shift':
        n1 = 20
        n2 = n_sessions - n1
        pace = np.concatenate([
            1.0 + rng.normal(0, 0.07, n1),
            0.75 + rng.normal(0, 0.07, n2),
        ])
    else:
        raise ValueError(f"Unknown profile: {profile_name}")

    pace = np.clip(pace, 0.3, 2.0)
    active = np.round(planned * pace).astype(int)

    return {
        'dates': dates,
        'planned': planned,
        'active': active,
        'pace': active / planned,
        'roles': roles,
        'profile': profile_name,
    }


# ---------------------------------------------------------------------------
# 2a. Hierarchical Bayesian (Normal-Normal conjugate)
# ---------------------------------------------------------------------------

def run_bayesian(sessions):
    """
    Two-level Normal-Normal conjugate Bayesian update.
    Level 0 (global): prior mu=1.0, precision tau=10 (sigma^2=0.1).
    Level 1 (per-role): inherits global posterior as prior each step.
    Returns posterior mean and 95% CI over time for global and per-role.
    """
    pace = sessions['pace']
    roles = sessions['roles']
    n = len(pace)

    # Global level
    mu0, tau0 = 1.0, 10.0  # prior: mean=1.0, precision=10 => var=0.1
    likelihood_precision = 1.0 / 0.1  # assume known obs variance = 0.1

    global_mu = np.zeros(n)
    global_ci_lo = np.zeros(n)
    global_ci_hi = np.zeros(n)

    mu_n, tau_n = mu0, tau0
    for i in range(n):
        # conjugate update
        tau_n_new = tau_n + likelihood_precision
        mu_n_new = (tau_n * mu_n + likelihood_precision * pace[i]) / tau_n_new
        mu_n, tau_n = mu_n_new, tau_n_new

        sigma_n = 1.0 / np.sqrt(tau_n)
        global_mu[i] = mu_n
        global_ci_lo[i] = mu_n - 1.96 * sigma_n
        global_ci_hi[i] = mu_n + 1.96 * sigma_n

    # Per-role level
    role_results = {}
    for role in ['anchor', 'foundation', 'practice']:
        r_mu, r_tau = mu0, tau0
        r_mus = []
        r_ci_lo = []
        r_ci_hi = []
        r_indices = []
        for i in range(n):
            if roles[i] == role:
                # Use current global posterior as prior for this step
                prior_mu = global_mu[i]
                prior_tau = tau_n  # use final global precision as prior precision
                r_tau_new = r_tau + likelihood_precision
                r_mu_new = (r_tau * r_mu + likelihood_precision * pace[i]) / r_tau_new
                r_mu, r_tau = r_mu_new, r_tau_new

                sigma_r = 1.0 / np.sqrt(r_tau)
                r_mus.append(r_mu)
                r_ci_lo.append(r_mu - 1.96 * sigma_r)
                r_ci_hi.append(r_mu + 1.96 * sigma_r)
                r_indices.append(i)

        role_results[role] = {
            'indices': np.array(r_indices),
            'mu': np.array(r_mus),
            'ci_lo': np.array(r_ci_lo),
            'ci_hi': np.array(r_ci_hi),
        }

    return {
        'global_mu': global_mu,
        'global_ci_lo': global_ci_lo,
        'global_ci_hi': global_ci_hi,
        'roles': role_results,
    }


# ---------------------------------------------------------------------------
# 2b. CUSUM (Cumulative Sum Control Chart)
# ---------------------------------------------------------------------------

def run_cusum(sessions, bayesian):
    """
    CUSUM with reference = Bayesian posterior mean at that point.
    k = 0.5 * std(pace), h = 4.0 * std(pace).
    Returns upper/lower accumulators and breakpoint indices.
    """
    pace = sessions['pace']
    n = len(pace)
    std_pace = np.std(pace)
    k = 0.5 * std_pace
    h = 4.0 * std_pace

    s_upper = np.zeros(n)
    s_lower = np.zeros(n)
    breakpoints = []

    for i in range(n):
        ref = bayesian['global_mu'][i]
        z = pace[i] - ref

        s_upper[i] = max(0, (s_upper[i-1] if i > 0 else 0) + z - k)
        s_lower[i] = min(0, (s_lower[i-1] if i > 0 else 0) + z + k)

        if s_upper[i] > h or s_lower[i] < -h:
            breakpoints.append(i)
            s_upper[i] = 0
            s_lower[i] = 0

    return {
        's_upper': s_upper,
        's_lower': s_lower,
        'h': h,
        'breakpoints': breakpoints,
    }


# ---------------------------------------------------------------------------
# 2c. Kalman Filter (per-phase, after CUSUM breakpoints)
# ---------------------------------------------------------------------------

def run_kalman(sessions, cusum_result):
    """
    Kalman filter with state = [level, slope].
    Run within each CUSUM-detected phase.
    """
    pace = sessions['pace']
    n = len(pace)
    breakpoints = cusum_result['breakpoints']

    # Define phases
    phase_starts = [0] + [bp + 1 for bp in breakpoints if bp + 1 < n]
    phase_ends = [bp for bp in breakpoints if bp < n] + [n - 1]
    # Deduplicate and clean
    phases = []
    for s, e in zip(phase_starts, phase_ends):
        if s <= e and s < n:
            phases.append((s, e))
    # If no breakpoints, single phase
    if not phases:
        phases = [(0, n - 1)]

    Q = np.array([[0.01, 0.0], [0.0, 0.001]])
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

        # Initialize state
        x = np.array([phase_pace[0], 0.0])
        P = np.array([[0.1, 0.0], [0.0, 0.05]])

        levels = np.zeros(phase_n)
        slopes = np.zeros(phase_n)
        level_stds = np.zeros(phase_n)
        slope_stds = np.zeros(phase_n)

        for j in range(phase_n):
            # Predict
            x_pred = F @ x
            P_pred = F @ P @ F.T + Q

            # Update
            y_res = phase_pace[j] - H @ x_pred
            S = H @ P_pred @ H.T + R
            K = P_pred @ H.T / S[0, 0]
            x = x_pred + K.flatten() * y_res[0]
            P = (np.eye(2) - K @ H) @ P_pred

            levels[j] = x[0]
            slopes[j] = x[1]
            level_stds[j] = np.sqrt(P[0, 0])
            slope_stds[j] = np.sqrt(P[1, 1])

        all_phases.append({
            'start': start, 'end': end,
            'level': levels,
            'slope': slopes,
            'level_std': level_stds,
            'slope_std': slope_stds,
        })

    return all_phases


# ---------------------------------------------------------------------------
# 2d. Gaussian Process (burn-up chart)
# ---------------------------------------------------------------------------

def gp_kernel(X1, X2, length_scale, signal_var):
    """Linear + RBF kernel."""
    # RBF
    sq_dist = np.subtract.outer(X1, X2) ** 2
    rbf = signal_var * np.exp(-0.5 * sq_dist / length_scale ** 2)
    # Linear
    linear = np.outer(X1, X2) * 0.01
    return rbf + linear


def run_gp(sessions):
    """
    GP regression on cumulative actual minutes.
    Extrapolate 14 days beyond last session.
    """
    dates = sessions['dates']
    planned = sessions['planned']
    active = sessions['active']

    # Convert dates to days from start
    t0 = dates[0]
    days = np.array([(d - t0).days for d in dates], dtype=float)

    cum_planned = np.cumsum(planned).astype(float)
    cum_actual = np.cumsum(active).astype(float)

    # Residuals for kernel parameters
    residuals = cum_actual - cum_planned
    length_scale = 7.0
    signal_var = max(np.var(residuals), 1.0)
    noise_var = 0.1 * signal_var

    # Training data
    X_train = days
    y_train = cum_actual
    n_train = len(X_train)

    # Test points: existing days + 14-day extrapolation
    last_day = days[-1]
    X_extra = np.arange(last_day + 1, last_day + 15)
    X_test = np.concatenate([days, X_extra])

    # GP posterior
    K = gp_kernel(X_train, X_train, length_scale, signal_var)
    K += noise_var * np.eye(n_train)
    K_s = gp_kernel(X_train, X_test, length_scale, signal_var)
    K_ss = gp_kernel(X_test, X_test, length_scale, signal_var)

    # Cholesky decomposition for numerical stability
    try:
        L = np.linalg.cholesky(K + 1e-6 * np.eye(n_train))
    except np.linalg.LinAlgError:
        K += 1e-4 * np.eye(n_train)
        L = np.linalg.cholesky(K)

    alpha = np.linalg.solve(L.T, np.linalg.solve(L, y_train))
    mu_star = K_s.T @ alpha

    v = np.linalg.solve(L, K_s)
    var_star = np.diag(K_ss) - np.sum(v ** 2, axis=0)
    var_star = np.maximum(var_star, 0)
    std_star = np.sqrt(var_star)

    # Planned staircase for extrapolation (extend at avg rate)
    avg_planned_per_day = cum_planned[-1] / (days[-1] + 1)
    cum_planned_ext = np.concatenate([
        cum_planned,
        cum_planned[-1] + avg_planned_per_day * np.arange(1, 15)
    ])

    # Convert test days back to dates
    test_dates = [t0 + timedelta(days=int(d)) for d in X_test]

    return {
        'train_dates': dates,
        'train_days': days,
        'cum_planned': cum_planned,
        'cum_actual': cum_actual,
        'test_dates': test_dates,
        'test_days': X_test,
        'gp_mean': mu_star,
        'gp_std': std_star,
        'cum_planned_ext': cum_planned_ext,
        'last_train_day': last_day,
        'extrapolation_start_idx': n_train,
    }


# ---------------------------------------------------------------------------
# 3. Plotting
# ---------------------------------------------------------------------------

def plot_profile(sessions, bayesian, cusum, kalman_phases, gp, output_path):
    """Generate 4-panel figure for one user profile."""
    try:
        plt.style.use('seaborn-v0_8-whitegrid')
    except Exception:
        plt.style.use('seaborn-whitegrid')

    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle(f"Algorithm Test: {sessions['profile'].upper()} Profile",
                 fontsize=16, fontweight='bold', y=0.98)

    pace = sessions['pace']
    n = len(pace)
    idx = np.arange(n)
    dates = sessions['dates']

    # --- Top-left: Bayesian + CUSUM triggers ---
    ax = axes[0, 0]
    ax.scatter(idx, pace, c='#555555', s=20, alpha=0.6, label='Observed pace', zorder=3)
    ax.plot(idx, bayesian['global_mu'], color='#2563EB', linewidth=2,
            label='Bayesian posterior mean')
    ax.fill_between(idx, bayesian['global_ci_lo'], bayesian['global_ci_hi'],
                     color='#2563EB', alpha=0.15, label='95% CI')
    for bp in cusum['breakpoints']:
        ax.axvline(bp, color='#DC2626', linewidth=1.5, linestyle='--', alpha=0.8)
    if cusum['breakpoints']:
        ax.axvline(cusum['breakpoints'][0], color='#DC2626', linewidth=1.5,
                   linestyle='--', alpha=0.8, label='CUSUM trigger')
    ax.axhline(1.0, color='#94A3B8', linewidth=0.8, linestyle=':')
    ax.set_title('Bayesian Posterior + CUSUM Triggers', fontweight='bold')
    ax.set_xlabel('Session index')
    ax.set_ylabel('Pace ratio (active / planned)')
    ax.legend(loc='best', fontsize=8)
    ax.set_ylim(max(0.3, pace.min() - 0.15), min(2.0, pace.max() + 0.15))

    # --- Top-right: CUSUM accumulator ---
    ax = axes[0, 1]
    ax.plot(idx, cusum['s_upper'], color='#DC2626', linewidth=1.5, label='S+ (upper)')
    ax.plot(idx, cusum['s_lower'], color='#2563EB', linewidth=1.5, label='S- (lower)')
    ax.axhline(cusum['h'], color='#DC2626', linewidth=1, linestyle='--',
               alpha=0.6, label=f'Threshold h={cusum["h"]:.3f}')
    ax.axhline(-cusum['h'], color='#2563EB', linewidth=1, linestyle='--', alpha=0.6)
    ax.axhline(0, color='#94A3B8', linewidth=0.8, linestyle=':')
    for bp in cusum['breakpoints']:
        ax.axvline(bp, color='#F59E0B', linewidth=1.5, linestyle='-', alpha=0.7)
    if cusum['breakpoints']:
        ax.axvline(cusum['breakpoints'][0], color='#F59E0B', linewidth=1.5,
                   linestyle='-', alpha=0.7, label='Reset point')
    ax.set_title('CUSUM Accumulator', fontweight='bold')
    ax.set_xlabel('Session index')
    ax.set_ylabel('Cumulative sum')
    ax.legend(loc='best', fontsize=8)

    # --- Bottom-left: Kalman phases ---
    ax = axes[1, 0]
    colors_phase = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626']
    for pi, phase in enumerate(kalman_phases):
        s, e = phase['start'], phase['end']
        phase_idx = np.arange(s, e + 1)
        c = colors_phase[pi % len(colors_phase)]

        # Level
        ax.plot(phase_idx, phase['level'], color=c, linewidth=2,
                label=f'Phase {pi+1} level')
        ax.fill_between(phase_idx,
                         phase['level'] - 1.96 * phase['level_std'],
                         phase['level'] + 1.96 * phase['level_std'],
                         color=c, alpha=0.12)

        # Show slope as annotation at midpoint
        mid = len(phase['slope']) // 2
        slope_val = phase['slope'][mid]
        slope_label = f'slope={slope_val:+.4f}/session'
        ax.annotate(slope_label,
                    xy=(phase_idx[mid], phase['level'][mid]),
                    xytext=(0, 15), textcoords='offset points',
                    fontsize=7, color=c, fontweight='bold',
                    ha='center',
                    arrowprops=dict(arrowstyle='->', color=c, lw=0.8))

    ax.scatter(idx, pace, c='#555555', s=15, alpha=0.4, zorder=2, label='Observed')
    ax.axhline(1.0, color='#94A3B8', linewidth=0.8, linestyle=':')
    ax.set_title('Kalman Filter: Level + Trend per Phase', fontweight='bold')
    ax.set_xlabel('Session index')
    ax.set_ylabel('Pace ratio')
    ax.legend(loc='best', fontsize=7)

    # --- Bottom-right: GP burn-up chart ---
    ax = axes[1, 1]
    test_days = gp['test_days']
    n_train = len(gp['train_days'])

    # Planned staircase
    ax.step(test_days, gp['cum_planned_ext'], where='post',
            color='#94A3B8', linewidth=1.5, linestyle='--', label='Planned cumulative')

    # Actual cumulative dots
    ax.scatter(gp['train_days'], gp['cum_actual'], c='#2563EB', s=25, zorder=4,
               label='Actual cumulative')

    # GP mean + CI
    ax.plot(test_days, gp['gp_mean'], color='#059669', linewidth=2,
            label='GP mean')
    ax.fill_between(test_days,
                     gp['gp_mean'] - 1.96 * gp['gp_std'],
                     gp['gp_mean'] + 1.96 * gp['gp_std'],
                     color='#059669', alpha=0.15, label='GP 95% CI')

    # Mark extrapolation boundary
    ax.axvline(gp['last_train_day'], color='#F59E0B', linewidth=1.2,
               linestyle=':', label='Extrapolation start')

    ax.set_title('Burn-Up Chart (GP Extrapolation)', fontweight='bold')
    ax.set_xlabel('Days from start')
    ax.set_ylabel('Cumulative minutes')
    ax.legend(loc='upper left', fontsize=7)

    plt.tight_layout(rect=[0, 0, 1, 0.96])
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"  Saved: {output_path}")


# ---------------------------------------------------------------------------
# 4. Main
# ---------------------------------------------------------------------------

def main():
    rng = np.random.default_rng(42)
    output_dir = os.path.dirname(os.path.abspath(__file__))

    profiles = ['steady', 'improver', 'fatiguer', 'erratic', 'regime_shift']
    total_profiles = len(profiles)
    log_progress(0, "algo_test.start", f"profiles={total_profiles} output_dir={output_dir}")

    for profile_index, profile in enumerate(profiles, 1):
        base_percent = 5 + ((profile_index - 1) / total_profiles) * 90
        profile_span = 90 / total_profiles
        log_progress(base_percent, "algo_test.profile.start", f"profile={profile} index={profile_index}/{total_profiles}")
        print(f"\n{'='*60}")
        print(f"Profile: {profile.upper()}")
        print(f"{'='*60}")

        # Generate data
        n_sessions = rng.integers(30, 51)
        sessions = generate_sessions(profile, rng, n_sessions)
        log_progress(base_percent + profile_span * 0.15, "algo_test.profile.generated", f"profile={profile} sessions={n_sessions}")
        print(f"  Sessions: {n_sessions}")
        print(f"  Pace range: [{sessions['pace'].min():.3f}, {sessions['pace'].max():.3f}]")
        print(f"  Pace mean: {sessions['pace'].mean():.3f}, std: {sessions['pace'].std():.3f}")

        # Run algorithms
        bayesian = run_bayesian(sessions)
        log_progress(base_percent + profile_span * 0.35, "algo_test.profile.bayesian_done", f"profile={profile}")
        print(f"  Bayesian final global mu: {bayesian['global_mu'][-1]:.4f}")
        for role, rd in bayesian['roles'].items():
            if len(rd['mu']) > 0:
                print(f"    {role}: mu={rd['mu'][-1]:.4f} (n={len(rd['mu'])})")

        cusum = run_cusum(sessions, bayesian)
        log_progress(base_percent + profile_span * 0.50, "algo_test.profile.cusum_done", f"profile={profile}")
        print(f"  CUSUM breakpoints: {cusum['breakpoints'] if cusum['breakpoints'] else 'None'}")
        print(f"  CUSUM threshold h: {cusum['h']:.4f}")

        kalman = run_kalman(sessions, cusum)
        log_progress(base_percent + profile_span * 0.65, "algo_test.profile.kalman_done", f"profile={profile}")
        print(f"  Kalman phases: {len(kalman)}")
        for pi, phase in enumerate(kalman):
            final_level = phase['level'][-1]
            final_slope = phase['slope'][-1]
            print(f"    Phase {pi+1} [{phase['start']}-{phase['end']}]: "
                  f"level={final_level:.4f}, slope={final_slope:+.5f}/session")

        gp = run_gp(sessions)
        log_progress(base_percent + profile_span * 0.80, "algo_test.profile.gp_done", f"profile={profile}")
        # GP prediction at end of extrapolation
        extrap_mean = gp['gp_mean'][-1]
        extrap_std = gp['gp_std'][-1]
        planned_end = gp['cum_planned_ext'][-1]
        print(f"  GP 14-day forecast: {extrap_mean:.0f} min "
              f"(95% CI: [{extrap_mean - 1.96*extrap_std:.0f}, "
              f"{extrap_mean + 1.96*extrap_std:.0f}])")
        print(f"  Planned at +14 days: {planned_end:.0f} min")
        diff_pct = (extrap_mean - planned_end) / planned_end * 100
        print(f"  GP vs planned delta: {diff_pct:+.1f}%")

        # Plot
        output_path = os.path.join(output_dir, f"algo_test_{profile}.png")
        plot_profile(sessions, bayesian, cusum, kalman, gp, output_path)
        log_progress(base_percent + profile_span, "algo_test.profile.complete", f"profile={profile} output={output_path}")

    log_progress(100, "algo_test.complete", f"figures={total_profiles}")
    print(f"\nAll 5 figures saved to {output_dir}/")


if __name__ == '__main__':
    main()
