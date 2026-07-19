from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import statistics
from pathlib import Path
from typing import Any

from research_comparison.progress_log import ProgressLogger

PROXY_MAPPING = (
    "Aggregate OULAD studentVle.sum_click by learner/course/day; treat daily clicks as "
    "engagement intensity, a bounded proxy for minutes toward a roadmap."
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _stable_bucket(key: tuple[str, str, str], sample_mod: int) -> int:
    if sample_mod <= 1:
        return 0
    digest = hashlib.sha256("|".join(key).encode("utf-8")).hexdigest()
    return int(digest[:12], 16) % sample_mod


def _quantile(values: list[float], q: float) -> float:
    if not values:
        return math.nan
    ordered = sorted(values)
    position = (len(ordered) - 1) * q
    low = math.floor(position)
    high = math.ceil(position)
    if low == high:
        return float(ordered[low])
    weight = position - low
    return float(ordered[low] * (1.0 - weight) + ordered[high] * weight)


def _bounded_range(
    values: list[float],
    *,
    fallback: tuple[float, float],
    q_low: float = 0.10,
    q_high: float = 0.90,
    floor: float | None = None,
    ceiling: float | None = None,
    min_width: float = 0.01,
) -> dict[str, float]:
    if values:
        low = _quantile(values, q_low)
        high = _quantile(values, q_high)
    else:
        low, high = fallback
    if floor is not None:
        low = max(floor, low)
        high = max(floor, high)
    if ceiling is not None:
        low = min(ceiling, low)
        high = min(ceiling, high)
    if high < low + min_width:
        midpoint = (low + high) / 2.0
        low = midpoint - min_width / 2.0
        high = midpoint + min_width / 2.0
        if floor is not None:
            low = max(floor, low)
        if ceiling is not None:
            high = min(ceiling, high)
    return {"low": round(float(low), 6), "high": round(float(high), 6)}


def _lag1_autocorrelation(values: list[float]) -> float | None:
    if len(values) < 3:
        return None
    mean = statistics.fmean(values)
    numerator = sum((left - mean) * (right - mean) for left, right in zip(values, values[1:]))
    denominator = sum((value - mean) ** 2 for value in values)
    if denominator <= 1e-12:
        return None
    return float(numerator / denominator)


def _mad(values: list[float], center: float) -> float:
    if not values:
        return 0.0
    return float(statistics.median(abs(value - center) for value in values))


def _shift_frequency_per_100_days(values: list[float]) -> float | None:
    if len(values) < 6:
        return None
    logged = [math.log1p(max(0.0, value)) for value in values]
    diffs = [abs(right - left) for left, right in zip(logged, logged[1:])]
    if not diffs:
        return None
    center = statistics.median(diffs)
    scale = _mad(diffs, center) * 1.4826
    threshold = max(0.75, center + 3.0 * scale)
    large_changes = sum(1 for diff in diffs if diff >= threshold)
    return float(large_changes / max(1, len(values) - 1) * 100.0)


def _dense_clicks(days: dict[int, float]) -> list[float]:
    if not days:
        return []
    start = min(days)
    end = max(days)
    return [float(days.get(day, 0.0)) for day in range(start, end + 1)]


def _read_withdrawal_keys(registration_path: Path) -> set[tuple[str, str, str]]:
    if not registration_path.exists():
        return set()
    withdrawals: set[tuple[str, str, str]] = set()
    with registration_path.open("r", encoding="utf-8", newline="") as file:
        for row in csv.DictReader(file):
            if row.get("date_unregistration") and row["date_unregistration"] != "?":
                withdrawals.add((row["code_module"], row["code_presentation"], row["id_student"]))
    return withdrawals


def moment_bounds_hash(moment_bounds: dict[str, Any]) -> str:
    encoded = json.dumps(moment_bounds.get("bounds", moment_bounds), sort_keys=True).encode(
        "utf-8"
    )
    return hashlib.sha256(encoded).hexdigest()[:12]


def derive_oulad_moment_bounds(
    dataset_dir: str | Path,
    *,
    max_series: int = 5000,
    sample_mod: int = 17,
    min_points: int = 8,
    include_prestart: bool = False,
    progress: ProgressLogger | None = None,
) -> dict[str, Any]:
    root = Path(dataset_dir)
    vle_path = root / "studentVle.csv"
    if not vle_path.exists():
        raise FileNotFoundError(f"Missing OULAD studentVle.csv at {vle_path}")
    if progress:
        progress.log(0, "oulad_moments.start", str(vle_path))

    series_by_key: dict[tuple[str, str, str], dict[int, float]] = {}
    rows_seen = 0
    rows_kept = 0
    with vle_path.open("r", encoding="utf-8", newline="") as file:
        for row in csv.DictReader(file):
            rows_seen += 1
            key = (row["code_module"], row["code_presentation"], row["id_student"])
            if key not in series_by_key:
                if len(series_by_key) >= max_series or _stable_bucket(key, sample_mod) != 0:
                    continue
                series_by_key[key] = {}
            day = int(row["date"])
            if day < 0 and not include_prestart:
                continue
            series_by_key[key][day] = series_by_key[key].get(day, 0.0) + float(row["sum_click"])
            rows_kept += 1
            if progress and rows_seen % 1_000_000 == 0:
                progress.log(
                    min(80, rows_seen / 10_655_280 * 80),
                    "oulad_moments.rows",
                    f"seen={rows_seen} sampled_series={len(series_by_key)}",
                )

    withdrawals = _read_withdrawal_keys(root / "studentRegistration.csv")
    phis: list[float] = []
    shift_rates: list[float] = []
    gaps: list[float] = []
    active_day_counts: list[float] = []
    withdrawal_flags: list[float] = []

    for key, days in series_by_key.items():
        active_days = sorted(day for day, clicks in days.items() if clicks > 0)
        if len(active_days) >= 2:
            gaps.extend(float(right - left) for left, right in zip(active_days, active_days[1:]))
        if len(active_days) >= min_points:
            dense = _dense_clicks(days)
            logged_dense = [math.log1p(value) for value in dense]
            phi = _lag1_autocorrelation(logged_dense)
            if phi is not None and math.isfinite(phi):
                phis.append(phi)
            shift_rate = _shift_frequency_per_100_days(dense)
            if shift_rate is not None and math.isfinite(shift_rate):
                shift_rates.append(shift_rate)
            active_day_counts.append(float(len(active_days)))
            withdrawal_flags.append(1.0 if key in withdrawals else 0.0)

    dropout_rate = statistics.fmean(withdrawal_flags) if withdrawal_flags else 0.0
    gap_p75 = _quantile(gaps, 0.75) if gaps else 7.0
    gap_p90 = _quantile(gaps, 0.90) if gaps else 14.0
    gap_p95 = _quantile(gaps, 0.95) if gaps else 21.0
    bounds = {
        "ar1_phi": _bounded_range(
            phis,
            fallback=(0.15, 0.55),
            floor=0.0,
            ceiling=0.85,
            min_width=0.05,
        ),
        "shift_frequency_per_100_days": _bounded_range(
            shift_rates,
            fallback=(1.0, 5.0),
            floor=0.25,
            ceiling=20.0,
            min_width=0.5,
        ),
        "gap_days": {
            "p50": round(_quantile(gaps, 0.50) if gaps else 3.0, 6),
            "p75": round(gap_p75, 6),
            "p90": round(gap_p90, 6),
            "p95": round(gap_p95, 6),
        },
        "dropout_probability": {
            "low": round(max(0.05, dropout_rate - 0.05), 6),
            "high": round(min(0.85, dropout_rate + 0.10), 6),
        },
    }
    output = {
        "bounds_version": "oulad-engagement-v1",
        "source": {
            "dataset": "OULAD",
            "license": "CC-BY 4.0",
            "student_vle": str(vle_path),
            "student_registration": str(root / "studentRegistration.csv"),
            "rows_seen": rows_seen,
            "rows_kept": rows_kept,
            "sample_mod": sample_mod,
            "max_series": max_series,
            "sampled_series": len(series_by_key),
            "usable_series": len(active_day_counts),
            "prestart_days": "included" if include_prestart else "excluded",
        },
        "proxy_mapping": PROXY_MAPPING,
        "bounds": bounds,
        "summary": {
            "active_days_median": round(_quantile(active_day_counts, 0.50), 6)
            if active_day_counts
            else 0.0,
            "ar1_phi_median": round(_quantile(phis, 0.50), 6) if phis else 0.0,
            "shift_frequency_median": round(_quantile(shift_rates, 0.50), 6)
            if shift_rates
            else 0.0,
            "dropout_rate_sample": round(float(dropout_rate), 6),
        },
    }
    output["moment_bounds_hash"] = moment_bounds_hash(output)
    if progress:
        progress.log(
            90,
            "oulad_moments.bounds",
            f"usable_series={len(active_day_counts)} hash={output['moment_bounds_hash']}",
        )
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset-dir",
        default=str(_repo_root() / "research/datasets/oulad"),
    )
    parser.add_argument("--out", default=None)
    parser.add_argument("--max-series", type=int, default=5000)
    parser.add_argument("--sample-mod", type=int, default=17)
    parser.add_argument("--include-prestart", action="store_true")
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="oulad-moments", enabled=not args.quiet)

    output = derive_oulad_moment_bounds(
        args.dataset_dir,
        max_series=args.max_series,
        sample_mod=args.sample_mod,
        include_prestart=args.include_prestart,
        progress=logger,
    )
    encoded = json.dumps(output, indent=2, sort_keys=True)
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(encoded + "\n", encoding="utf-8")
        logger.log(100, "oulad_moments.write", str(path))
        print(path)
        return
    logger.log(100, "oulad_moments.print")
    print(encoded)


if __name__ == "__main__":
    main()
