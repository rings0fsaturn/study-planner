from __future__ import annotations

from datetime import date, timedelta


def forecast_projection_oracle(true_finish_date: str) -> dict[str, str | float]:
    finish = date.fromisoformat(true_finish_date)
    return {
        "candidate": "oracle_projection",
        "predicted_finish_date": true_finish_date,
        "interval_low": (finish - timedelta(days=1)).isoformat(),
        "interval_high": (finish + timedelta(days=1)).isoformat(),
        "sharpness_days": 2.0,
    }
