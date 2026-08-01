from __future__ import annotations

import hashlib
from pathlib import Path

# Convention (pre-reg §1): r = activeMinutes / plannedMinutes; r>1 over-runs, r<1 under budget.
CLIP_LOW, CLIP_HIGH = 0.55, 1.60  # pre-reg §1
AR1_PHI = 0.30  # pre-reg §2 [default->sweep]
ROLE_RHO = {"anchor": 1.10, "foundation": 1.00, "practice": 0.92}  # §3
TAU_GENERIC = {"morning": 0.97, "afternoon": 1.00, "evening": 1.05}  # §3
FATIGUE_PER_EXTRA_SESSION = 0.04  # §3

ARCHETYPES = {
    "steady": {"m_global": 1.00, "sigma_log": 0.15, "attempt_prob": 0.88},
    "morning_lark": {
        "m_global": 0.98,
        "sigma_log": 0.16,
        "attempt_prob": 0.85,
        "tau": {"morning": 0.85, "afternoon": 1.00, "evening": 1.20},
    },
    "fading_flame": {"m_global": 1.00, "sigma_log": 0.20, "drift_total": 0.20},
    "weekend_warrior": {
        "m_global": 1.02,
        "sigma_log": 0.18,
        "nu_weekend": 1.02,
        "attempt_prob_weekday": 0.45,
        "attempt_prob_weekend": 0.95,
    },
    "deadline_sprinter": {"m_global": 1.00, "sigma_log": 0.25, "deadline_ramp": 1.30},
    "marathon_runner": {
        "m_global": 1.05,
        "sigma_log": 0.18,
        "n_steps": (2, 3),
        "step_mag": (0.12, 0.18),
        "attempt_prob": 0.92,
    },
    "night_owl": {
        "m_global": 0.98,
        "sigma_log": 0.16,
        "tau": {"morning": 1.20, "afternoon": 1.00, "evening": 0.85},
    },
    "crammer": {
        "m_global": 1.00,
        "sigma_log": 0.22,
        "deadline_ramp": 1.35,
        "deadline_ramp_start": 0.90,
    },
    "steady_improver": {"m_global": 1.00, "sigma_log": 0.18, "trend_total": 0.20},
}
BANDS = {  # pre-reg §5 + build-plan §4
    "small": {"sessions": (8, 20), "shifts": (0, 1)},
    "medium": {"sessions": (35, 70), "shifts": (1, 2)},
    "max": {"sessions": (90, 160), "shifts": (2, 3)},
}
STEP_MAG_DEFAULT, STEP_MAG_RANGE = 0.15, (0.10, 0.22)  # §5
DRIFT_TOTAL_DEFAULT, DRIFT_WINDOW_FRAC = 0.20, (0.30, 0.45)  # §5
MANUAL_FRACTION = 0.15  # §6
SWEEP_GRID = {  # §8
    "sigma_log": [0.10, 0.14, 0.18, 0.23, 0.28],
    "step_mag": [0.08, 0.12, 0.16, 0.20, 0.24],
    "drift_total": [0.08, 0.14, 0.20, 0.26, 0.32],
    "manual_fraction": [0.00, 0.08, 0.15, 0.24, 0.32],
    "ar1_phi": [0.0, 0.20, 0.35, 0.50, 0.65],
}

_PREREG = Path(__file__).resolve().parents[4] / "college/scope/archetype-preregistration.md"
PARAMS_VERSION_HASH = hashlib.sha256(_PREREG.read_bytes()).hexdigest()[:12]
