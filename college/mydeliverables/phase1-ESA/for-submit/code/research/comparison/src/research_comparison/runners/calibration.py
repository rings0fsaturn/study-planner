from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import numpy as np

from research_comparison.baselines.calibration import (
    ArchetypeRouterHardCalibrator,
    ArchetypeSoftCalibrator,
    CalibrationCandidate,
    ENRICHED_FEATURE_NAMES,
    FINGERPRINT_NAMES,
    DualPriorWeightedCalibrator,
    EnrichedShrinkageCalibrator,
    behavioral_fingerprint,
    calibration_candidates,
)
from research_comparison.metrics.aggregate import cell_summary, winner_per_band
from research_comparison.metrics.coverage import credible_interval_coverage
from research_comparison.metrics.prequential import (
    context_prediction_absolute_errors,
    prequential_absolute_errors,
)
from research_comparison.metrics.recovery import recovery_mae, recovery_rmse
from research_comparison.oracles.calibration import calibration_oracle_estimate
from research_comparison.progress_log import ProgressLogger, run_with_heartbeat
from research_comparison.runners.rigour import (
    DEFAULT_SEED_COUNT,
    annotate_archetype_split,
    archetype_split_for_rows,
    attach_rigour_provenance,
    mc_correction_block,
    paired_by_group,
    paired_metric_result,
    read_jsonl,
    reporting_rows,
    resolve_dataset_dir,
)
from research_comparison.runners.rigour import (
    latest_dataset_dir as _latest_dataset_dir,
)
from research_comparison.writers.results import manifest_from_dataset, write_stamped_json


FROZEN_REFERENCE_DATASET_ID = "synthetic-21c2cdabfa91-seed0-n5400"
REALITY_REFERENCE_DATASET_ID = "synthetic-reality-c545404bcacf-seed0-n5400"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def write_stub() -> Path:
    from research_comparison.manifest import build_manifest, stamp

    manifest = build_manifest(seed=0, archetype_mix={"stub": 1}, n_learners=1)
    output = stamp({"status": "stub", "stage": "compare"}, manifest)
    out_path = _repo_root() / "research/results/compare_stub.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, sort_keys=True), encoding="utf-8")
    return out_path


def prequential_calibration(
    sessions: list[dict],
    candidate: CalibrationCandidate,
    t_grid: list[int],
) -> list[tuple[int, float]]:
    """Return list of (t, estimate) where estimate is the global pace multiplier at history 1..t."""
    out = []
    for t in t_grid:
        hist = sessions[:t]
        out.append((t, candidate.fit_global(hist)))
    return out


def default_t_grid(n_sessions: int) -> list[int]:
    base = [3, 5, 8, 13, 21, 34, 55, 89, 144, n_sessions]
    return sorted({value for value in base if 1 <= value <= n_sessions})


def latest_dataset_dir(root: Path | None = None) -> Path:
    repo_root = _repo_root()
    if root is None:
        return _latest_dataset_dir(repo_root)
    candidates = [path for path in root.iterdir() if (path / "learners.jsonl").exists()]
    if not candidates:
        raise FileNotFoundError("No generated dataset found under research/datasets")
    return max(candidates, key=lambda path: path.stat().st_mtime)


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return read_jsonl(path)


def _active_sessions_with_targets(
    sessions: list[dict[str, Any]],
    r_star: list[float],
) -> tuple[list[dict[str, Any]], list[float]]:
    active_sessions: list[dict[str, Any]] = []
    active_targets: list[float] = []
    for session, target in zip(sessions, r_star, strict=True):
        if session["source"] == "active":
            active_sessions.append(session)
            active_targets.append(float(target))
    return active_sessions, active_targets


def _mean(values: list[float]) -> float:
    return float(sum(values) / len(values)) if values else math.nan


def _context_of(session: dict[str, Any]) -> dict[str, Any]:
    return {
        "materialRole": session.get("materialRole") or "foundation",
        "startedAt": session.get("startedAt") or session.get("date"),
        "planned_horizon": session.get("planned_horizon"),
        "session_index": session.get("session_index"),
    }


def _active_visible_sessions(sessions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        session
        for session in sessions
        if session.get("source") == "active"
        and session.get("plannedMinutes") is not None
        and session.get("activeMinutes") is not None
        and float(session["plannedMinutes"]) > 0
        and float(session["activeMinutes"]) > 0
    ]


def _with_observable_context(
    sessions: list[dict[str, Any]],
    learner: dict[str, Any],
) -> list[dict[str, Any]]:
    horizon = learner.get("planned_horizon")
    return [
        {
            **session,
            "planned_horizon": horizon,
            "session_index": index,
        }
        for index, session in enumerate(sessions)
    ]


def _fit_enriched_population_prior(
    learners: list[dict[str, Any]],
    train_archetypes: set[str],
) -> tuple[float, ...]:
    coefficient_rows: list[tuple[float, ...]] = []
    for learner in learners:
        if str(learner["archetype"]) not in train_archetypes:
            continue
        if int(learner["seed"]) >= 20:
            continue
        active = _with_observable_context(_active_visible_sessions(learner["sessions"]), learner)
        if len(active) < 4:
            continue
        coefficient_rows.append(
            EnrichedShrinkageCalibrator(shrink=0.0).fit_coefficients(active).coefficients
        )
    if not coefficient_rows:
        return EnrichedShrinkageCalibrator()._prior()
    return tuple(float(value) for value in np.mean(np.asarray(coefficient_rows), axis=0))


def _fit_reference_enriched_population_prior(
    root: Path,
    dataset_id: str,
    train_archetypes: set[str],
) -> tuple[float, ...] | None:
    dataset_path = root / "research/datasets" / dataset_id
    learners_path = dataset_path / "learners.jsonl"
    if not learners_path.exists():
        return None
    return _fit_enriched_population_prior(_read_jsonl(learners_path), train_archetypes)


def _reference_or_current_prior(
    *,
    root: Path,
    current_dataset_id: str,
    reference_dataset_id: str,
    current_prior: tuple[float, ...],
    train_archetypes: set[str],
) -> tuple[tuple[float, ...], dict[str, Any]]:
    if current_dataset_id == reference_dataset_id:
        return current_prior, {
            "dataset_id": current_dataset_id,
            "source": "current_dataset",
            "fallback": False,
        }
    if current_dataset_id in {FROZEN_REFERENCE_DATASET_ID, REALITY_REFERENCE_DATASET_ID}:
        reference_prior = _fit_reference_enriched_population_prior(
            root,
            reference_dataset_id,
            train_archetypes,
        )
        if reference_prior is not None:
            return reference_prior, {
                "dataset_id": reference_dataset_id,
                "source": "reference_dataset",
                "fallback": False,
            }
    return current_prior, {
        "dataset_id": current_dataset_id,
        "source": "current_dataset_fallback",
        "fallback": True,
    }


def _dual_prior_weight_summary(
    learners: list[dict[str, Any]],
    candidate: DualPriorWeightedCalibrator,
) -> dict[str, Any]:
    by_band: dict[str, list[np.ndarray]] = {}
    for learner in learners:
        if int(learner["seed"]) >= 5:
            continue
        active = _with_observable_context(_active_visible_sessions(learner["sessions"]), learner)
        if not active:
            continue
        by_band.setdefault(str(learner["band"]), []).append(candidate._weights(active))

    summary: dict[str, Any] = {}
    for band, weights in sorted(by_band.items()):
        arr = np.vstack(weights)
        summary[band] = {
            "n_learners": int(arr.shape[0]),
            "mean_reality_weight": float(np.mean(arr[:, 0])),
            "mean_frozen_weight": float(np.mean(arr[:, 1])),
            "p10_reality_weight": float(np.quantile(arr[:, 0], 0.10)),
            "p90_reality_weight": float(np.quantile(arr[:, 0], 0.90)),
        }
    return {
        "method": "weights_on_observable_histories_seed_lt_5_by_band",
        "by_band": summary,
    }


def _fit_archetype_prior_bundle(
    learners: list[dict[str, Any]],
    train_archetypes: set[str],
) -> dict[str, Any]:
    coefficients_by_type: dict[str, list[tuple[float, ...]]] = {}
    fingerprints_by_type: dict[str, list[tuple[float, ...]]] = {}
    all_fingerprints: list[tuple[float, ...]] = []
    for learner in learners:
        archetype = str(learner["archetype"])
        if archetype not in train_archetypes:
            continue
        if int(learner["seed"]) >= 20:
            continue
        active = _with_observable_context(_active_visible_sessions(learner["sessions"]), learner)
        if len(active) < 4:
            continue
        coefficients_by_type.setdefault(archetype, []).append(
            EnrichedShrinkageCalibrator(shrink=0.0).fit_coefficients(active).coefficients
        )
        fingerprint = behavioral_fingerprint(active)
        fingerprints_by_type.setdefault(archetype, []).append(fingerprint)
        all_fingerprints.append(fingerprint)

    if all_fingerprints:
        raw = np.asarray(all_fingerprints, dtype=float)
        center = np.mean(raw, axis=0)
        scale = np.std(raw, axis=0)
        scale = np.where(np.abs(scale) < 1e-9, 1.0, scale)
    else:
        center = np.zeros(len(FINGERPRINT_NAMES), dtype=float)
        scale = np.ones(len(FINGERPRINT_NAMES), dtype=float)

    type_priors = {
        archetype: tuple(float(value) for value in np.mean(np.asarray(rows), axis=0))
        for archetype, rows in sorted(coefficients_by_type.items())
    }
    prototypes = {}
    for archetype, rows in sorted(fingerprints_by_type.items()):
        mean_fingerprint = np.mean(np.asarray(rows, dtype=float), axis=0)
        prototypes[archetype] = tuple(float(value) for value in (mean_fingerprint - center) / scale)
    return {
        "type_priors": type_priors,
        "prototype_fingerprints": prototypes,
        "fingerprint_center": tuple(float(value) for value in center),
        "fingerprint_scale": tuple(float(value) for value in scale),
    }


def _score_enriched_option(
    learners: list[dict[str, Any]],
    train_archetypes: set[str],
    *,
    population_prior: tuple[float, ...],
    ridge: float,
    shrink: float,
) -> float:
    candidate = EnrichedShrinkageCalibrator(
        ridge=ridge,
        shrink=shrink,
        population_prior=population_prior,
    )
    errors: list[float] = []
    for learner in learners:
        if str(learner["archetype"]) not in train_archetypes:
            continue
        if int(learner["seed"]) >= 5:
            continue
        active = _with_observable_context(_active_visible_sessions(learner["sessions"]), learner)
        if len(active) < 4:
            continue
        split_index = max(3, len(active) // 2)
        if split_index >= len(active):
            continue
        target = float(active[split_index]["activeMinutes"]) / float(
            active[split_index]["plannedMinutes"]
        )
        estimate = candidate.predict_next(active[:split_index], _context_of(active[split_index]))
        errors.append(abs(estimate - target))
    return _mean(errors)


def _score_soft_temperature(
    learners: list[dict[str, Any]],
    train_archetypes: set[str],
    *,
    population_prior: tuple[float, ...],
    archetype_bundle: dict[str, Any],
    ridge: float,
    shrink: float,
    temperature: float,
) -> float:
    candidate = ArchetypeSoftCalibrator(
        ridge=ridge,
        shrink=shrink,
        temperature=temperature,
        population_prior=population_prior,
        type_priors=archetype_bundle["type_priors"],
        prototype_fingerprints=archetype_bundle["prototype_fingerprints"],
        fingerprint_center=archetype_bundle["fingerprint_center"],
        fingerprint_scale=archetype_bundle["fingerprint_scale"],
    )
    errors: list[float] = []
    for learner in learners:
        if str(learner["archetype"]) not in train_archetypes:
            continue
        if int(learner["seed"]) >= 5:
            continue
        active = _with_observable_context(_active_visible_sessions(learner["sessions"]), learner)
        if len(active) < 4:
            continue
        split_index = max(3, len(active) // 2)
        if split_index >= len(active):
            continue
        target = float(active[split_index]["activeMinutes"]) / float(
            active[split_index]["plannedMinutes"]
        )
        estimate = candidate.predict_next(active[:split_index], _context_of(active[split_index]))
        errors.append(abs(estimate - target))
    return _mean(errors)


def _prepare_calibration_candidates(
    learners: list[dict[str, Any]],
    dataset_archetypes: set[str],
    progress: ProgressLogger | None,
    *,
    root: Path | None = None,
    raw_manifest: dict[str, Any] | None = None,
) -> tuple[list[CalibrationCandidate], dict[str, Any]]:
    def prepare() -> tuple[list[CalibrationCandidate], dict[str, Any]]:
        split = archetype_split_for_rows(
            [{"archetype": archetype} for archetype in dataset_archetypes],
            archetypes=dataset_archetypes,
        )
        train_archetypes = set(split["train"])
        repo_root = root or _repo_root()
        current_dataset_id = str((raw_manifest or {}).get("dataset_id") or "")
        population_prior = _fit_enriched_population_prior(learners, train_archetypes)
        reality_prior, reality_prior_source = _reference_or_current_prior(
            root=repo_root,
            current_dataset_id=current_dataset_id,
            reference_dataset_id=REALITY_REFERENCE_DATASET_ID,
            current_prior=population_prior,
            train_archetypes=train_archetypes,
        )
        frozen_prior, frozen_prior_source = _reference_or_current_prior(
            root=repo_root,
            current_dataset_id=current_dataset_id,
            reference_dataset_id=FROZEN_REFERENCE_DATASET_ID,
            current_prior=population_prior,
            train_archetypes=train_archetypes,
        )
        archetype_bundle = _fit_archetype_prior_bundle(learners, train_archetypes)
        grid: list[dict[str, float]] = []
        for ridge in [1.0, 2.0]:
            for shrink in [2.0, 6.0]:
                score = _score_enriched_option(
                    learners,
                    train_archetypes,
                    population_prior=population_prior,
                    ridge=ridge,
                    shrink=shrink,
                )
                grid.append({"ridge": ridge, "shrink": shrink, "score": score})
        finite = [row for row in grid if math.isfinite(row["score"])]
        selected = min(finite, key=lambda row: row["score"]) if finite else {
            "ridge": 2.0,
            "shrink": 6.0,
            "score": math.inf,
        }
        temperature_grid = []
        for temperature in [0.5, 1.0, 2.0]:
            temperature_grid.append(
                {
                    "temperature": temperature,
                    "score": _score_soft_temperature(
                        learners,
                        train_archetypes,
                        population_prior=population_prior,
                        archetype_bundle=archetype_bundle,
                        ridge=float(selected["ridge"]),
                        shrink=float(selected["shrink"]),
                        temperature=temperature,
                    ),
                }
            )
        finite_temperature = [
            row for row in temperature_grid if math.isfinite(float(row["score"]))
        ]
        selected_temperature = (
            min(finite_temperature, key=lambda row: row["score"])
            if finite_temperature
            else {"temperature": 1.0, "score": math.inf}
        )
        dual_prior_candidate = DualPriorWeightedCalibrator(
            ridge=float(selected["ridge"]),
            shrink=float(selected["shrink"]),
            reality_prior=reality_prior,
            frozen_prior=frozen_prior,
        )
        candidates: list[CalibrationCandidate] = []
        for candidate in calibration_candidates():
            if isinstance(candidate, EnrichedShrinkageCalibrator):
                candidates.append(
                    EnrichedShrinkageCalibrator(
                        ridge=float(selected["ridge"]),
                        shrink=float(selected["shrink"]),
                        population_prior=population_prior,
                    )
                )
            elif isinstance(candidate, DualPriorWeightedCalibrator):
                candidates.append(dual_prior_candidate)
            elif isinstance(candidate, ArchetypeRouterHardCalibrator):
                candidates.append(
                    ArchetypeRouterHardCalibrator(
                        ridge=float(selected["ridge"]),
                        shrink=float(selected["shrink"]),
                        population_prior=population_prior,
                        type_priors=archetype_bundle["type_priors"],
                        prototype_fingerprints=archetype_bundle["prototype_fingerprints"],
                        fingerprint_center=archetype_bundle["fingerprint_center"],
                        fingerprint_scale=archetype_bundle["fingerprint_scale"],
                    )
                )
            elif isinstance(candidate, ArchetypeSoftCalibrator):
                candidates.append(
                    ArchetypeSoftCalibrator(
                        ridge=float(selected["ridge"]),
                        shrink=float(selected["shrink"]),
                        temperature=float(selected_temperature["temperature"]),
                        population_prior=population_prior,
                        type_priors=archetype_bundle["type_priors"],
                        prototype_fingerprints=archetype_bundle["prototype_fingerprints"],
                        fingerprint_center=archetype_bundle["fingerprint_center"],
                        fingerprint_scale=archetype_bundle["fingerprint_scale"],
                    )
                )
            else:
                candidates.append(candidate)
        audit = {
            "method": "fit_on_train_archetypes_only",
            "population_prior_sample": "train_archetypes_seed_lt_20_per_learner_average",
            "tuning_method": "grid_search_train_archetypes_seed_lt_5_midpoint_next_session",
            "train_archetypes": sorted(train_archetypes),
            "feature_names": list(ENRICHED_FEATURE_NAMES),
            "selected": {
                "ridge": float(selected["ridge"]),
                "shrink": float(selected["shrink"]),
                "score": float(selected["score"]),
            },
            "archetype_variants": {
                "method": "per_train_type_prior_and_fingerprint_centroid",
                "fingerprint_names": list(FINGERPRINT_NAMES),
                "temperature_tuning_method": (
                    "grid_search_train_archetypes_seed_lt_5_midpoint_next_session"
                ),
                "selected_temperature": {
                    "temperature": float(selected_temperature["temperature"]),
                    "score": float(selected_temperature["score"]),
                },
                "temperature_grid_scores": temperature_grid,
                "type_priors": {
                    key: list(value)
                    for key, value in archetype_bundle["type_priors"].items()
                },
                "prototype_fingerprints": {
                    key: list(value)
                    for key, value in archetype_bundle["prototype_fingerprints"].items()
                },
                "fingerprint_center": list(archetype_bundle["fingerprint_center"]),
                "fingerprint_scale": list(archetype_bundle["fingerprint_scale"]),
            },
            "grid_scores": grid,
            "population_prior": list(population_prior),
            "dual_prior_audit": {
                "method": "per_learner_leave_one_out_log_pace_weighting",
                "reality_prior": {
                    **reality_prior_source,
                    "population_prior": list(reality_prior),
                },
                "frozen_prior": {
                    **frozen_prior_source,
                    "population_prior": list(frozen_prior),
                },
                "static_weights": list(dual_prior_candidate.static_weights),
                "temperature": "loo_sse_mean_scale",
                "weight_summary": _dual_prior_weight_summary(
                    learners,
                    dual_prior_candidate,
                ),
            },
        }
        return candidates, audit

    if progress:
        progress.log(12, "calibration.enriched_prior_start")
        return run_with_heartbeat(
            prepare,
            logger=progress,
            percent=12,
            state="calibration.enriched_prior",
            detail="fit train-archetype population prior and tune grid",
            heartbeat_seconds=15,
        )
    return prepare()


def _paired_metric_result(
    challenger: list[float],
    baseline: list[float],
) -> dict[str, float]:
    return paired_metric_result(challenger, baseline)


def _prefixed_metric_result(
    metric: str,
    result: dict[str, float],
) -> dict[str, float]:
    return {f"{metric}_{key}": value for key, value in result.items()}


def _paired_by_candidate(
    rows: list[dict[str, Any]],
    baseline_candidate: str = "hierarchical_bayes",
) -> dict[str, dict[str, dict[str, float]]]:
    metrics = ["recovery_mae", "context_pred_mae"]
    by_band_seed_candidate_metric: dict[tuple[str, int, str, str], list[float]] = {}
    for row in rows:
        for metric in metrics:
            if metric not in row:
                continue
            key = (row["band"], int(row["seed"]), row["candidate"], metric)
            by_band_seed_candidate_metric.setdefault(key, []).append(float(row[metric]))

    bands = sorted({row["band"] for row in rows})
    candidates = sorted(
        {row["candidate"] for row in rows if row["candidate"] != baseline_candidate}
    )
    paired: dict[str, dict[str, dict[str, float]]] = {}
    for band in bands:
        paired[band] = {}
        seeds = sorted({int(row["seed"]) for row in rows if row["band"] == band})
        for candidate in candidates:
            result: dict[str, float] = {}
            for metric in metrics:
                baseline = [
                    _mean(
                        by_band_seed_candidate_metric[
                            (band, seed, baseline_candidate, metric)
                        ]
                    )
                    for seed in seeds
                    if (band, seed, baseline_candidate, metric)
                    in by_band_seed_candidate_metric
                ]
                challenger = [
                    _mean(by_band_seed_candidate_metric[(band, seed, candidate, metric)])
                    for seed in seeds
                    if (band, seed, candidate, metric) in by_band_seed_candidate_metric
                ]
                if len(challenger) != len(baseline):
                    continue
                metric_result = _paired_metric_result(challenger, baseline)
                if metric == "recovery_mae":
                    result.update(metric_result)
                result.update(_prefixed_metric_result(metric, metric_result))
            if result:
                paired[band][candidate] = result
    return paired


def run_calibration_track(
    dataset_dir: str | None = None,
    out_dir: str | None = None,
    seed_count: int | None = DEFAULT_SEED_COUNT,
    progress: ProgressLogger | None = None,
) -> Path:
    root = _repo_root()
    dataset_path = resolve_dataset_dir(root, dataset_dir, seed_count, progress=progress)
    result_root = Path(out_dir) if out_dir else root / "research/results/calibration"
    if progress:
        progress.log(0, "calibration.start", f"dataset={dataset_path}")
    raw_manifest = json.loads((dataset_path / "manifest.json").read_text(encoding="utf-8"))
    manifest = manifest_from_dataset(raw_manifest)
    learners = _read_jsonl(dataset_path / "learners.jsonl")
    sidecars = {
        row["learner_id"]: row["ground_truth"]
        for row in _read_jsonl(dataset_path / "sidecars.jsonl")
    }

    rows: list[dict[str, Any]] = []
    convergence: list[dict[str, Any]] = []
    dataset_archetypes = {str(learner["archetype"]) for learner in learners}
    total_learners = len(learners)
    if progress:
        progress.log(10, "calibration.loaded", f"learners={total_learners}")
    candidates, enriched_prior_audit = _prepare_calibration_candidates(
        learners,
        dataset_archetypes,
        progress,
        root=root,
        raw_manifest=raw_manifest,
    )
    if progress:
        progress.log(
            15,
            "calibration.candidates_ready",
            f"learners={total_learners} candidates={len(candidates) + 1}",
        )
    for learner_index, learner in enumerate(learners, start=1):
        truth = sidecars[learner["learner_id"]]
        active_sessions, active_targets = _active_sessions_with_targets(
            learner["sessions"], truth["r_star"]
        )
        active_sessions = _with_observable_context(active_sessions, learner)
        if len(active_sessions) < 4:
            continue
        t_grid = default_t_grid(len(active_sessions))
        oracle_estimate = calibration_oracle_estimate(truth)
        rows.append(
            {
                "learner_id": learner["learner_id"],
                "band": learner["band"],
                "archetype": learner["archetype"],
                "seed": learner["seed"],
                "candidate": "oracle_calibration",
                "recovery_mae": recovery_mae([oracle_estimate], truth["m_global"]),
                "recovery_rmse": recovery_rmse([oracle_estimate], truth["m_global"]),
                "prequential_mae": 0.0,
                "context_pred_mae": 0.0,
                "coverage": 1.0,
                "n_active": len(active_sessions),
            }
        )
        convergence.extend(
            {
                "band": learner["band"],
                "archetype": learner["archetype"],
                "seed": learner["seed"],
                "candidate": "oracle_calibration",
                "t": t,
                "recovery_error": 0.0,
            }
            for t in t_grid
        )
        for candidate in candidates:
            estimates = prequential_calibration(active_sessions, candidate, t_grid)
            estimate_values = [estimate for _t, estimate in estimates]
            intervals = [candidate.fit_interval(active_sessions[:t]) for t in t_grid]
            next_contexts = [_context_of(session) for session in active_sessions]
            prequential_errors = prequential_absolute_errors(
                active_sessions, candidate, active_targets, t_grid
            )
            context_prediction_errors = context_prediction_absolute_errors(
                active_sessions,
                candidate,
                active_targets,
                t_grid,
                next_contexts=next_contexts,
            )
            row = {
                "learner_id": learner["learner_id"],
                "band": learner["band"],
                "archetype": learner["archetype"],
                "seed": learner["seed"],
                "candidate": candidate.name,
                "recovery_mae": recovery_mae([estimate_values[-1]], truth["m_global"]),
                "recovery_rmse": recovery_rmse([estimate_values[-1]], truth["m_global"]),
                "prequential_mae": _mean(prequential_errors),
                "context_pred_mae": _mean(context_prediction_errors),
                "coverage": credible_interval_coverage(intervals, truth["m_global"]),
                "n_active": len(active_sessions),
            }
            rows.append(row)
            convergence.extend(
                {
                    "band": learner["band"],
                    "archetype": learner["archetype"],
                    "seed": learner["seed"],
                    "candidate": candidate.name,
                    "t": t,
                    "recovery_error": abs(estimate - truth["m_global"]),
                }
                for t, estimate in estimates
            )
        if progress and (
            learner_index == 1
            or learner_index == total_learners
            or learner_index % max(1, total_learners // 20) == 0
        ):
            progress.log(
                15 + (learner_index / max(1, total_learners)) * 75,
                "calibration.learners",
                f"processed={learner_index}/{total_learners} rows={len(rows)}",
            )

    annotate_archetype_split(rows, archetypes=dataset_archetypes)
    scored_rows, scored_split = reporting_rows(rows)
    recovery_cells = paired_by_group(
        scored_rows,
        metric="recovery_mae",
        baseline_candidate="hierarchical_bayes",
        group_fields=["band", "archetype"],
    )
    reference_baseline_corrections: dict[str, dict[str, Any]] = {}
    for baseline_candidate in ["pooled_bayes", "ewma", "enriched_shrink"]:
        simple_recovery_cells = paired_by_group(
            scored_rows,
            metric="recovery_mae",
            baseline_candidate=baseline_candidate,
            group_fields=["band", "archetype"],
        )
        simple_context_cells = paired_by_group(
            scored_rows,
            metric="context_pred_mae",
            baseline_candidate=baseline_candidate,
            group_fields=["band", "archetype"],
        )
        reference_baseline_corrections[baseline_candidate] = {
            "recovery_mae": mc_correction_block(
                simple_recovery_cells,
                metric="recovery_mae",
                baseline_candidate=baseline_candidate,
            ),
            "context_pred_mae": mc_correction_block(
                simple_context_cells,
                metric="context_pred_mae",
                baseline_candidate=baseline_candidate,
            ),
        }
    context_cells = paired_by_group(
        scored_rows,
        metric="context_pred_mae",
        baseline_candidate="hierarchical_bayes",
        group_fields=["band", "archetype"],
    )
    manifest = attach_rigour_provenance(
        manifest,
        raw_manifest,
        rows,
        archetypes=dataset_archetypes,
    )
    payload = {
        "dataset_id": raw_manifest["dataset_id"],
        "scored_split": scored_split,
        "rows": rows,
        "convergence": convergence,
        "cell_summary": cell_summary(scored_rows),
        "winner_per_band": winner_per_band(scored_rows),
        "context_pred_cell_summary": cell_summary(scored_rows, metric="context_pred_mae"),
        "context_pred_winner_per_band": winner_per_band(scored_rows, metric="context_pred_mae"),
        "paired_vs_incumbent": _paired_by_candidate(scored_rows),
        "paired_vs_pooled_bayes": _paired_by_candidate(
            scored_rows,
            baseline_candidate="pooled_bayes",
        ),
        "population_prior": {
            "enriched_shrink": enriched_prior_audit,
            "dual_prior_audit": enriched_prior_audit["dual_prior_audit"],
        },
        "paired_by_cell": {
            "recovery_mae": recovery_cells,
            "context_pred_mae": context_cells,
        },
        "mc_correction": {
            "recovery_mae": mc_correction_block(
                recovery_cells,
                metric="recovery_mae",
                baseline_candidate="hierarchical_bayes",
            ),
            "context_pred_mae": mc_correction_block(
                context_cells,
                metric="context_pred_mae",
                baseline_candidate="hierarchical_bayes",
            ),
        },
        "mc_correction_simple_baselines": {
            baseline: reference_baseline_corrections[baseline]
            for baseline in ["pooled_bayes", "ewma"]
        },
        "mc_correction_reference_baselines": reference_baseline_corrections,
    }
    if progress:
        progress.log(95, "calibration.write", f"rows={len(rows)} convergence={len(convergence)}")
    out_path = write_stamped_json(result_root / "calibration_results.json", payload, manifest)
    if progress:
        progress.log(100, "calibration.complete", str(out_path))
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stub", action="store_true")
    parser.add_argument("--dataset-dir", default=None)
    parser.add_argument("--out-dir", default=None)
    parser.add_argument("--seeds", type=int, default=DEFAULT_SEED_COUNT)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-calibration", enabled=not args.quiet)
    if args.stub:
        logger.log(0, "calibration.stub_start")
        path = write_stub()
        logger.log(100, "calibration.stub_complete", str(path))
        print(path)
        return
    print(
        run_calibration_track(
            dataset_dir=args.dataset_dir,
            out_dir=args.out_dir,
            seed_count=args.seeds,
            progress=logger,
        )
    )


if __name__ == "__main__":
    main()
