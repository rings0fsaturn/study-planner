from __future__ import annotations

import hashlib
from pathlib import Path

from research_comparison.params import PARAMS_VERSION_HASH

DECOUPLED_REGIME = "decoupled"

STUDY_DAY_COUNT_WEIGHTS = {
    3: 0.20,
    4: 0.35,
    5: 0.30,
    6: 0.15,
}

ADHOC_RATE_RANGE = (0.10, 0.20)
INTERRUPTION_RATE_RANGE = (0.15, 0.25)
PARTIAL_POSITION_FRACTION_RANGE = (0.25, 0.70)
ADHERENCE_BIAS_LOG_SIGMA = 0.12
ADHERENCE_BIAS_CLIP = (0.85, 1.20)

_PREREG = (
    Path(__file__).resolve().parents[4] / "college/scope/decoupled-session-preregistration.md"
)
DECOUPLED_PARAMS_HASH = hashlib.sha256(_PREREG.read_bytes()).hexdigest()[:12]
DECOUPLED_DATASET_HASH = hashlib.sha256(
    f"{PARAMS_VERSION_HASH}:{DECOUPLED_PARAMS_HASH}".encode("utf-8")
).hexdigest()[:12]
