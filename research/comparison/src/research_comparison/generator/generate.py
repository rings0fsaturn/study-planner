from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np

from research_comparison.generator.adherence import attempt_probability, choose_source
from research_comparison.generator.archetypes import archetype_config
from research_comparison.generator.capacity import (
    DecoupledBooking,
    PlannedSlot,
    build_capacity_plan,
    build_decoupled_bookings,
    sample_study_days,
)
from research_comparison.generator.effects import delta_deadline, phi_fatigue, trend_multiplier
from research_comparison.generator.materials import Material, sample_chunk_minutes, sample_material_mix
from research_comparison.generator.noise import apply_lognormal_ar1
from research_comparison.generator.pace import latent_base
from research_comparison.generator.reality import (
    REALITY_REGIME,
    build_reality_regime_series,
    collect_reality_slots,
    draw_reality_logged_ratios,
    normalise_moment_bounds,
    reality_params_hash,
    sample_continuous_config,
)
from research_comparison.generator.regimes import build_regime_series
from research_comparison.generator.types import GroundTruth, SessionEvent
from research_comparison.manifest import build_manifest, stamp
from research_comparison.params import (
    AR1_PHI,
    BANDS,
    CLIP_HIGH,
    CLIP_LOW,
    MANUAL_FRACTION,
    PARAMS_VERSION_HASH,
    ROLE_RHO,
)
from research_comparison.params_decoupled import (
    ADHERENCE_BIAS_CLIP,
    ADHERENCE_BIAS_LOG_SIGMA,
    ADHOC_RATE_RANGE,
    DECOUPLED_DATASET_HASH,
    DECOUPLED_PARAMS_HASH,
    DECOUPLED_REGIME,
    INTERRUPTION_RATE_RANGE,
    PARTIAL_POSITION_FRACTION_RANGE,
    STUDY_DAY_COUNT_WEIGHTS,
)
from research_comparison.progress_log import ProgressLogger

DEFAULT_ARCHETYPE_MIX = {
    "steady": 1,
    "morning_lark": 1,
    "fading_flame": 1,
    "weekend_warrior": 1,
    "deadline_sprinter": 1,
    "marathon_runner": 1,
    "night_owl": 1,
    "crammer": 1,
    "steady_improver": 1,
}
DEFAULT_BANDS = ["small", "medium", "max"]
DEFAULT_SEEDS = list(range(40))
FROZEN_REGIME = "frozen"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _json_default(value):
    if hasattr(value, "item"):
        return value.item()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _target_sessions(band: str, rng: np.random.Generator) -> int:
    low, high = BANDS[band]["sessions"]
    return int(rng.integers(low, high + 1))


def _collect_attempted_slots(
    archetype: str,
    config: dict,
    materials: list[Material],
    target_sessions: int,
    rng: np.random.Generator,
    manual_fraction: float,
) -> list[tuple[PlannedSlot, str]]:
    slots_needed = max(target_sessions * 4, target_sessions + 12)
    emitted: list[tuple[PlannedSlot, str]] = []
    while len(emitted) < target_sessions:
        slots = build_capacity_plan(materials, slots_needed, rng, start_date=date(2026, 1, 5))
        for slot in slots:
            if len(emitted) >= target_sessions:
                break
            prob = attempt_probability(archetype, config, slot, len(emitted), target_sessions)
            if float(rng.random()) <= prob:
                emitted.append((slot, choose_source(rng, manual_fraction=manual_fraction)))
        slots_needed *= 2
    return emitted[:target_sessions]


def _context_multipliers(config: dict) -> dict[str, float]:
    return {
        "morning": float(config["tau"].get("morning", 1.0)),
        "afternoon": float(config["tau"].get("afternoon", 1.0)),
        "evening": float(config["tau"].get("evening", 1.0)),
        "weekday": 1.0,
        "weekend": float(config.get("nu_weekend", 1.0)),
    }


def _true_finish_date(
    emitted_slots: list[tuple[PlannedSlot, str]],
    materials: list[Material],
    r_star: list[float],
) -> str:
    target_minutes = sum(material.total_minutes for material in materials)
    cumulative = 0.0
    for (slot, _source), latent in zip(emitted_slots, r_star, strict=True):
        cumulative += slot.planned_minutes * latent
        if cumulative >= target_minutes:
            return slot.date.isoformat()
    return emitted_slots[-1][0].date.isoformat()


def _event_for_slot(
    archetype: str,
    band: str,
    seed: int,
    index: int,
    slot: PlannedSlot,
    source: str,
    ratio: float,
) -> SessionEvent:
    base: SessionEvent = {
        "date": slot.date.isoformat(),
        "source": source,  # type: ignore[typeddict-item]
        "duration": round(
            slot.planned_minutes if source == "manual" else slot.planned_minutes * ratio,
            6,
        ),
        "materialRole": slot.material_role,
        "startedAt": slot.started_at,
        "sessionId": f"{archetype}-{band}-{seed}-{index:04d}",
    }
    if source == "active":
        base["plannedMinutes"] = round(slot.planned_minutes, 6)
        base["activeMinutes"] = round(slot.planned_minutes * ratio, 6)
    return base


def _bounded_count(target_sessions: int, target_rate: float, low: float, high: float) -> int:
    lower = int(np.ceil(target_sessions * low))
    upper = int(np.floor(target_sessions * high))
    if upper < lower:
        upper = lower
    count = int(round(target_sessions * target_rate))
    return max(lower, min(upper, count))


def _interruption_indices(
    target_sessions: int,
    target_rate: float,
    rng: np.random.Generator,
) -> set[int]:
    if target_sessions <= 0:
        return set()
    count = _bounded_count(
        target_sessions,
        target_rate,
        INTERRUPTION_RATE_RANGE[0],
        INTERRUPTION_RATE_RANGE[1],
    )
    count = min(target_sessions, count)
    return {int(value) for value in rng.choice(np.arange(target_sessions), size=count, replace=False)}


def _material_for_progress(
    materials: list[Material],
    progress_by_material: dict[str, float],
    fallback_index: int,
) -> Material:
    for material in materials:
        if progress_by_material[material.material_id] < material.total_minutes - 1e-6:
            return material
    return materials[fallback_index % len(materials)]


def _true_finish_date_from_events(
    sessions: list[SessionEvent],
    materials: list[Material],
    r_star: list[float],
) -> str:
    target_minutes = sum(material.total_minutes for material in materials)
    cumulative = 0.0
    for event, latent in zip(sessions, r_star, strict=True):
        planned = event.get("plannedMinutes")
        consumed_estimate = float(planned) if planned is not None else float(event["duration"])
        cumulative += consumed_estimate * latent
        if cumulative >= target_minutes:
            return str(event["date"])
    return str(sessions[-1]["date"])


def _event_for_decoupled_booking(
    archetype: str,
    band: str,
    seed: int,
    index: int,
    booking: DecoupledBooking,
    material: Material,
    source: str,
    ratio: float,
    planned_material_minutes: float,
    material_chunk_minutes: float,
    planned_session_minutes: float,
    material_position: float,
    resolution: str,
) -> SessionEvent:
    planned_value = round(planned_material_minutes, 12)
    active_minutes = planned_value * ratio
    duration = active_minutes if source == "active" else planned_material_minutes
    base: SessionEvent = {
        "date": booking.date.isoformat(),
        "source": source,  # type: ignore[typeddict-item]
        "duration": round(duration, 12),
        "materialRole": material.role,
        "materialId": material.material_id,
        "materialChunkMinutes": round(material_chunk_minutes, 12),
        "plannedSessionMinutes": round(max(planned_session_minutes, 1e-6), 12),
        "resolution": resolution,  # type: ignore[typeddict-item]
        "materialPosition": round(material_position, 12),
        "bookingId": booking.booking_id,
        "isAdHoc": booking.is_adhoc,
        "startedAt": booking.started_at,
        "sessionId": f"{archetype}-{band}-{seed}-decoupled-{index:04d}",
    }
    if source == "active":
        base["plannedMinutes"] = planned_value
        base["activeMinutes"] = round(active_minutes, 12)
    return base


def _planned_horizon_from_sessions(
    sessions: list[SessionEvent],
    planned_total_sessions: int,
) -> dict[str, Any]:
    if not sessions:
        raise ValueError("planned horizon requires at least one session")
    return {
        "deadline": str(sessions[-1]["date"]),
        "planned_total_sessions": int(planned_total_sessions),
    }


def _draw_emitted_ratios_under_clip_guard(
    r_star: list[float],
    emitted_slots: list[tuple[PlannedSlot, str]],
    sigma_log: float,
    rng: np.random.Generator,
    ar1_phi: float,
) -> tuple[list[float], float]:
    active_indices = [
        index for index, (_slot, source) in enumerate(emitted_slots) if source == "active"
    ]
    best_ratios: list[float] = []
    best_clip_rate = 1.0

    for _attempt in range(20):
        emitted_ratios, _clip_rate = apply_lognormal_ar1(r_star, sigma_log, rng, phi=ar1_phi)
        active_clip_count = sum(
            1
            for index in active_indices
            if emitted_ratios[index] <= CLIP_LOW or emitted_ratios[index] >= CLIP_HIGH
        )
        clip_rate = active_clip_count / max(1, len(active_indices))
        if clip_rate < best_clip_rate:
            best_ratios = emitted_ratios
            best_clip_rate = clip_rate
        if clip_rate < 0.02:
            return emitted_ratios, clip_rate

    return best_ratios, best_clip_rate


def generate_learner(
    archetype: str,
    band: str,
    seed: int,
    overrides: dict[str, float] | None = None,
) -> tuple[list[SessionEvent], GroundTruth]:
    selected_overrides = overrides or {}
    rng = np.random.default_rng(seed)
    config = archetype_config(archetype)
    if "sigma_log" in selected_overrides:
        config["sigma_log"] = float(selected_overrides["sigma_log"])
    target_sessions = _target_sessions(band, rng)
    materials = sample_material_mix(band, rng)
    emitted_slots = _collect_attempted_slots(
        archetype,
        config,
        materials,
        target_sessions,
        rng,
        manual_fraction=float(selected_overrides.get("manual_fraction", MANUAL_FRACTION)),
    )
    regime, shifts = build_regime_series(
        archetype,
        band,
        len(emitted_slots),
        rng,
        step_magnitude=selected_overrides.get("step_mag"),
        drift_total=selected_overrides.get("drift_total"),
    )

    r_star: list[float] = []
    for index, ((slot, _source), regime_multiplier) in enumerate(
        zip(emitted_slots, regime, strict=True)
    ):
        latent = (
            latent_base(
                float(config["m_global"]),
                slot.material_role,
                slot.time_of_day,
                slot.day_of_week,
                config,
            )
            * regime_multiplier
            * phi_fatigue(slot.same_day_count)
            * delta_deadline(index, len(emitted_slots), config)
            * trend_multiplier(index, len(emitted_slots), config)
        )
        r_star.append(round(float(latent), 6))

    emitted_ratios, clip_rate = _draw_emitted_ratios_under_clip_guard(
        r_star,
        emitted_slots,
        float(config["sigma_log"]),
        rng,
        ar1_phi=float(selected_overrides.get("ar1_phi", AR1_PHI)),
    )
    events = [
        _event_for_slot(archetype, band, seed, index, slot, source, emitted_ratios[index])
        for index, (slot, source) in enumerate(emitted_slots)
    ]
    truth = GroundTruth(
        m_global=float(config["m_global"]),
        role_multipliers=dict(ROLE_RHO),
        context_multipliers=_context_multipliers(config),
        regime_schedule=shifts,
        r_star=r_star,
        true_finish_date=_true_finish_date(emitted_slots, materials, r_star),
        is_faker=False,
        clip_rate=round(float(clip_rate), 6),
    )
    return events, truth


def generate_reality_matched_learner(
    archetype: str,
    band: str,
    seed: int,
    moment_bounds: dict[str, Any] | None = None,
    overrides: dict[str, float] | None = None,
) -> tuple[list[SessionEvent], GroundTruth, dict[str, Any]]:
    selected_overrides = overrides or {}
    bounds = normalise_moment_bounds(moment_bounds)
    rng = np.random.default_rng(seed)
    base_config = archetype_config(archetype)
    config, continuous_traits = sample_continuous_config(base_config, bounds, rng)
    if "sigma_log" in selected_overrides:
        config["sigma_log"] = float(selected_overrides["sigma_log"])
    target_sessions = _target_sessions(band, rng)
    materials = sample_material_mix(band, rng)
    emitted_slots, missingness = collect_reality_slots(
        archetype,
        config,
        materials,
        target_sessions,
        rng,
        bounds,
        manual_fraction=float(selected_overrides.get("manual_fraction", MANUAL_FRACTION)),
    )
    regime, shifts, annotations = build_reality_regime_series(len(emitted_slots), rng, bounds)

    r_star: list[float] = []
    for index, ((slot, _source), regime_multiplier) in enumerate(
        zip(emitted_slots, regime, strict=True)
    ):
        latent = (
            latent_base(
                float(config["m_global"]),
                slot.material_role,
                slot.time_of_day,
                slot.day_of_week,
                config,
            )
            * regime_multiplier
            * phi_fatigue(slot.same_day_count)
            * delta_deadline(index, len(emitted_slots), config)
            * trend_multiplier(index, len(emitted_slots), config)
        )
        r_star.append(round(float(latent), 6))

    logged_ratios, true_ratios, clip_rate, misreport_factors = draw_reality_logged_ratios(
        r_star,
        emitted_slots,
        float(config["sigma_log"]),
        rng,
        ar1_phi=float(selected_overrides.get("ar1_phi", config["ar1_phi"])),
    )
    events = [
        _event_for_slot(archetype, band, seed, index, slot, source, logged_ratios[index])
        for index, (slot, source) in enumerate(emitted_slots)
    ]
    truth = GroundTruth(
        m_global=float(config["m_global"]),
        role_multipliers=dict(config.get("role_rho", ROLE_RHO)),
        context_multipliers=_context_multipliers(config),
        regime_schedule=shifts,
        r_star=r_star,
        true_finish_date=_true_finish_date(emitted_slots, materials, r_star),
        is_faker=False,
        clip_rate=round(float(clip_rate), 6),
    )
    misreporting = []
    for index, (event, (slot, source)) in enumerate(zip(events, emitted_slots, strict=True)):
        if source != "active":
            continue
        misreporting.append(
            {
                "sessionId": event["sessionId"],
                "true_active_minutes": round(slot.planned_minutes * true_ratios[index], 6),
                "reported_active_minutes": event["activeMinutes"],
                "misreport_factor": misreport_factors[index],
            }
        )
    metadata = {
        "generator_regime": REALITY_REGIME,
        "continuous_traits": continuous_traits,
        "reality_params_hash": reality_params_hash(bounds),
        "moment_bounds_hash": bounds.get("moment_bounds_hash", reality_params_hash(bounds)),
        "moment_bounds_source": {
            "bounds_version": bounds.get("bounds_version"),
            "proxy_mapping": bounds.get("proxy_mapping"),
        },
        "reality_annotations": [
            *annotations,
            {
                "label": "illness_holiday_gap",
                "hiatus_start": missingness.get("hiatus_start"),
                "hiatus_end": missingness.get("hiatus_end"),
                "hiatus_days": missingness.get("hiatus_days"),
            },
        ],
        "missingness": missingness,
        "planned_horizon": {
            "deadline": missingness["planned_deadline"],
            "planned_total_sessions": missingness["planned_total_sessions"],
        },
        "logged_time_misreporting": {
            "hidden_from_candidate_inputs": True,
            "entries": misreporting,
        },
        "noise_model": "heavy_tailed_session_length_dependent_ar1",
    }
    return events, truth, metadata


def generate_decoupled_learner(
    archetype: str,
    band: str,
    seed: int,
    overrides: dict[str, float] | None = None,
) -> tuple[list[SessionEvent], GroundTruth, dict[str, Any]]:
    selected_overrides = overrides or {}
    rng = np.random.default_rng(seed)
    config = archetype_config(archetype)
    if "sigma_log" in selected_overrides:
        config["sigma_log"] = float(selected_overrides["sigma_log"])
    target_sessions = _target_sessions(band, rng)
    materials = sample_material_mix(band, rng)
    study_days = sample_study_days(rng, STUDY_DAY_COUNT_WEIGHTS)
    target_adhoc_rate = float(rng.uniform(*ADHOC_RATE_RANGE))
    target_interruption_rate = float(rng.uniform(*INTERRUPTION_RATE_RANGE))
    adherence_bias = float(
        np.clip(
            rng.lognormal(mean=0.0, sigma=ADHERENCE_BIAS_LOG_SIGMA),
            ADHERENCE_BIAS_CLIP[0],
            ADHERENCE_BIAS_CLIP[1],
        )
    )
    bookings = build_decoupled_bookings(
        target_sessions,
        rng,
        study_days,
        target_adhoc_rate,
        start_date=date(2026, 1, 5),
    )
    regime, shifts = build_regime_series(
        archetype,
        band,
        len(bookings),
        rng,
        step_magnitude=selected_overrides.get("step_mag"),
        drift_total=selected_overrides.get("drift_total"),
    )
    interrupted_indices = _interruption_indices(
        len(bookings),
        target_interruption_rate,
        rng,
    )

    progress_by_material = {material.material_id: 0.0 for material in materials}
    planned_rows: list[dict[str, Any]] = []
    for index, booking in enumerate(bookings):
        material = _material_for_progress(materials, progress_by_material, index)
        current_progress = progress_by_material[material.material_id]
        remaining = max(0.0, material.total_minutes - current_progress)
        raw_chunk = sample_chunk_minutes(material.material_type, rng)
        material_chunk_minutes = raw_chunk if remaining <= 1e-6 else min(raw_chunk, remaining)
        material_chunk_minutes = max(1e-6, float(material_chunk_minutes))
        is_interrupted = index in interrupted_indices
        if is_interrupted:
            fraction = float(rng.uniform(*PARTIAL_POSITION_FRACTION_RANGE))
            planned_material_minutes = max(1e-6, material_chunk_minutes * fraction)
            resolution = "interrupted"
            source = "active"
        else:
            fraction = 1.0
            planned_material_minutes = material_chunk_minutes
            resolution = "complete"
            source = choose_source(
                rng,
                manual_fraction=float(selected_overrides.get("manual_fraction", MANUAL_FRACTION)),
            )
        if remaining > 1e-6:
            progress_by_material[material.material_id] = min(
                material.total_minutes,
                current_progress + planned_material_minutes,
            )
        material_position = (
            progress_by_material[material.material_id] / material.total_minutes
            if material.total_minutes > 0
            else 1.0
        )
        planned_rows.append(
            {
                "booking": booking,
                "material": material,
                "source": source,
                "planned_material_minutes": planned_material_minutes,
                "material_chunk_minutes": material_chunk_minutes,
                "partial_fraction": fraction,
                "resolution": resolution,
                "material_position": min(1.0, material_position),
            }
        )

    r_star: list[float] = []
    for index, (row, regime_multiplier) in enumerate(zip(planned_rows, regime, strict=True)):
        booking = row["booking"]
        material = row["material"]
        latent = (
            latent_base(
                float(config["m_global"]),
                material.role,
                booking.time_of_day,
                booking.day_of_week,
                config,
            )
            * regime_multiplier
            * phi_fatigue(booking.same_day_count)
            * delta_deadline(index, len(planned_rows), config)
            * trend_multiplier(index, len(planned_rows), config)
        )
        r_star.append(round(float(latent), 6))

    emitted_ratios = list(r_star)
    clip_rate = 0.0
    events = []
    for index, row in enumerate(planned_rows):
        ratio = emitted_ratios[index]
        planned_session_minutes = row["material_chunk_minutes"] * ratio / adherence_bias
        events.append(
            _event_for_decoupled_booking(
                archetype,
                band,
                seed,
                index,
                row["booking"],
                row["material"],
                row["source"],
                ratio,
                row["planned_material_minutes"],
                row["material_chunk_minutes"],
                planned_session_minutes,
                row["material_position"],
                row["resolution"],
            )
        )

    observed_interruption_rate = sum(
        1 for event in events if event.get("resolution") == "interrupted"
    ) / max(1, len(events))
    observed_adhoc_rate = sum(1 for event in events if event.get("isAdHoc")) / max(1, len(events))
    truth = GroundTruth(
        m_global=float(config["m_global"]),
        role_multipliers=dict(ROLE_RHO),
        context_multipliers=_context_multipliers(config),
        regime_schedule=shifts,
        r_star=r_star,
        true_finish_date=_true_finish_date_from_events(events, materials, r_star),
        is_faker=False,
        clip_rate=round(float(clip_rate), 6),
        study_days=study_days,
        adherence_bias=round(adherence_bias, 6),
        interruption_rate=round(float(observed_interruption_rate), 6),
        adhoc_rate=round(float(observed_adhoc_rate), 6),
    )
    metadata = {
        "generator_regime": DECOUPLED_REGIME,
        "decoupled_params_hash": DECOUPLED_PARAMS_HASH,
        "base_params_version_hash": PARAMS_VERSION_HASH,
        "decoupled_targets": {
            "adhoc_rate": round(target_adhoc_rate, 6),
            "interruption_rate": round(target_interruption_rate, 6),
            "adherence_bias": round(adherence_bias, 6),
        },
        "planned_horizon": {
            "deadline": events[-1]["date"],
            "planned_total_sessions": len(events),
        },
    }
    return events, truth, metadata


def generate_dataset(
    archetype_mix: dict[str, int] | None = None,
    bands: list[str] | None = None,
    seeds: list[int] | None = None,
    out_dir: str | None = None,
    progress: ProgressLogger | None = None,
    generator_regime: str = FROZEN_REGIME,
    moment_bounds: dict[str, Any] | None = None,
) -> str:
    mix = archetype_mix or DEFAULT_ARCHETYPE_MIX
    selected_bands = bands or DEFAULT_BANDS
    selected_seeds = seeds or DEFAULT_SEEDS
    out_root = Path(out_dir) if out_dir else _repo_root() / "research/datasets"
    n_learners = sum(mix.values()) * len(selected_bands) * len(selected_seeds)
    if generator_regime == FROZEN_REGIME:
        dataset_hash = PARAMS_VERSION_HASH
        dataset_id = f"synthetic-{PARAMS_VERSION_HASH}-seed{selected_seeds[0]}-n{n_learners}"
        selected_moment_bounds = None
    elif generator_regime == DECOUPLED_REGIME:
        dataset_hash = DECOUPLED_DATASET_HASH
        dataset_id = f"synthetic-decoupled-{dataset_hash}-seed{selected_seeds[0]}-n{n_learners}"
        selected_moment_bounds = None
    elif generator_regime == REALITY_REGIME:
        selected_moment_bounds = normalise_moment_bounds(moment_bounds)
        dataset_hash = reality_params_hash(selected_moment_bounds)
        dataset_id = f"synthetic-reality-{dataset_hash}-seed{selected_seeds[0]}-n{n_learners}"
    else:
        raise ValueError(f"Unknown generator_regime: {generator_regime}")
    dataset_dir = out_root / dataset_id
    dataset_dir.mkdir(parents=True, exist_ok=True)
    if progress:
        progress.log(0, "dataset.start", f"dataset_id={dataset_id} learners={n_learners}")

    learners_path = dataset_dir / "learners.jsonl"
    sidecars_path = dataset_dir / "sidecars.jsonl"
    with learners_path.open("w", encoding="utf-8") as learner_file, sidecars_path.open(
        "w", encoding="utf-8"
    ) as sidecar_file:
        learner_index = 0
        for seed in selected_seeds:
            for band in selected_bands:
                for archetype, count in mix.items():
                    for replicate in range(count):
                        learner_seed = int(seed * 10_000 + learner_index + replicate)
                        sidecar_extras: dict[str, Any] = {}
                        if generator_regime == REALITY_REGIME:
                            sessions, truth, sidecar_extras = generate_reality_matched_learner(
                                archetype,
                                band,
                                learner_seed,
                                moment_bounds=selected_moment_bounds,
                            )
                        elif generator_regime == DECOUPLED_REGIME:
                            sessions, truth, sidecar_extras = generate_decoupled_learner(
                                archetype,
                                band,
                                learner_seed,
                            )
                        else:
                            sessions, truth = generate_learner(archetype, band, learner_seed)
                        planned_horizon = sidecar_extras.pop("planned_horizon", None)
                        if planned_horizon is None:
                            planned_horizon = _planned_horizon_from_sessions(
                                sessions,
                                len(sessions),
                            )
                        metadata = {
                            "learner_id": f"{archetype}-{band}-{seed}-{learner_index:05d}",
                            "archetype": archetype,
                            "band": band,
                            "seed": seed,
                        }
                        learner_file.write(
                            json.dumps(
                                {
                                    **metadata,
                                    "planned_horizon": planned_horizon,
                                    "sessions": sessions,
                                },
                                sort_keys=True,
                                default=_json_default,
                            )
                            + "\n"
                        )
                        ground_truth = {
                            key: value
                            for key, value in asdict(truth).items()
                            if value is not None
                        }
                        sidecar_file.write(
                            json.dumps(
                                {**metadata, "ground_truth": ground_truth, **sidecar_extras},
                                sort_keys=True,
                                default=_json_default,
                            )
                            + "\n"
                        )
                        learner_index += 1
                        if progress and (
                            learner_index == 1
                            or learner_index == n_learners
                            or learner_index % max(1, n_learners // 20) == 0
                        ):
                            percent = 5 + (learner_index / n_learners) * 75
                            progress.log(
                                percent,
                                "dataset.learners",
                                f"generated={learner_index}/{n_learners} seed={seed} "
                                f"band={band} archetype={archetype}",
                            )

    manifest = build_manifest(seed=selected_seeds[0], archetype_mix=mix, n_learners=n_learners)
    manifest_dict = {
        **asdict(manifest),
        "params_version_hash": dataset_hash,
        "base_params_version_hash": PARAMS_VERSION_HASH,
        "dataset_id": dataset_id,
        "generator_regime": generator_regime,
        "bands": selected_bands,
        "seeds": selected_seeds,
        "seed_count": len(selected_seeds),
        "n_learners_formula": (
            f"{sum(mix.values())} archetypes x {len(selected_bands)} bands x "
            f"{len(selected_seeds)} seeds"
        ),
    }
    if generator_regime == REALITY_REGIME:
        manifest_dict["moment_bounds"] = {
            "reality_params_hash": dataset_hash,
            "moment_bounds_hash": selected_moment_bounds.get("moment_bounds_hash", dataset_hash),
            "bounds_version": selected_moment_bounds.get("bounds_version"),
            "source": selected_moment_bounds.get("source"),
            "proxy_mapping": selected_moment_bounds.get("proxy_mapping"),
            "bounds": selected_moment_bounds.get("bounds"),
        }
    if generator_regime == DECOUPLED_REGIME:
        manifest_dict["decoupled_params_hash"] = DECOUPLED_PARAMS_HASH
        manifest_dict["decoupled_dataset_hash_source"] = (
            "sha256(PARAMS_VERSION_HASH ':' DECOUPLED_PARAMS_HASH)[:12]"
        )
    (dataset_dir / "manifest.json").write_text(
        json.dumps(manifest_dict, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    if progress:
        progress.log(85, "dataset.manifest_written", str(dataset_dir / "manifest.json"))
    export_face_validity(str(dataset_dir))
    if progress:
        progress.log(100, "dataset.complete", str(dataset_dir))
    return dataset_id


def export_face_validity(dataset_dir: str) -> None:
    dataset_path = Path(dataset_dir)
    pace_ratio: list[float] = []
    duration: list[float] = []
    gaps_days: list[int] = []
    planned_session_minutes: list[float] = []
    material_position: list[float] = []
    adherence_ratio: list[float] = []
    partial_fraction: list[float] = []
    is_adhoc: list[bool] = []
    resolution: list[str] = []
    for line in (dataset_path / "learners.jsonl").read_text(encoding="utf-8").splitlines():
        learner = json.loads(line)
        previous_date: date | None = None
        for event in learner["sessions"]:
            current_date = date.fromisoformat(event["date"])
            if previous_date is not None:
                gaps_days.append((current_date - previous_date).days)
            previous_date = current_date
            duration.append(float(event["duration"]))
            if event["source"] == "active":
                pace_ratio.append(float(event["activeMinutes"]) / float(event["plannedMinutes"]))
                if event.get("plannedSessionMinutes"):
                    adherence_ratio.append(
                        float(event["activeMinutes"]) / float(event["plannedSessionMinutes"])
                    )
            if event.get("plannedSessionMinutes") is not None:
                planned_session_minutes.append(float(event["plannedSessionMinutes"]))
            if event.get("materialPosition") is not None:
                material_position.append(float(event["materialPosition"]))
            if event.get("isAdHoc") is not None:
                is_adhoc.append(bool(event["isAdHoc"]))
            if event.get("resolution") is not None:
                resolution.append(str(event["resolution"]))
            if event.get("resolution") == "interrupted" and event.get("materialChunkMinutes"):
                partial_fraction.append(
                    float(event["plannedMinutes"]) / float(event["materialChunkMinutes"])
                )

    output = {
        "pace_ratio": pace_ratio,
        "duration": duration,
        "gaps_days": gaps_days,
        "planned_session_minutes": planned_session_minutes,
        "material_position": material_position,
        "adherence_ratio": adherence_ratio,
        "partial_fraction": partial_fraction,
        "is_adhoc": is_adhoc,
        "resolution": resolution,
    }
    (dataset_path / "face_validity.json").write_text(
        json.dumps(output, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def write_stub() -> Path:
    manifest = build_manifest(seed=0, archetype_mix={"stub": 1}, n_learners=1)
    output = stamp({"status": "stub", "stage": "dataset"}, manifest)
    out_path = _repo_root() / "research/results/dataset_stub.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, sort_keys=True), encoding="utf-8")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stub", action="store_true")
    parser.add_argument("--out-dir", default=None)
    parser.add_argument(
        "--regime",
        choices=[FROZEN_REGIME, REALITY_REGIME, DECOUPLED_REGIME],
        default=FROZEN_REGIME,
    )
    parser.add_argument("--moment-bounds-file", default=None)
    parser.add_argument("--seeds", type=int, default=None)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-dataset", enabled=not args.quiet)
    if args.stub:
        logger.log(0, "dataset.stub_start")
        path = write_stub()
        logger.log(100, "dataset.stub_complete", str(path))
        print(path)
        return
    moment_bounds = None
    if args.moment_bounds_file:
        moment_bounds = json.loads(Path(args.moment_bounds_file).read_text(encoding="utf-8"))
    seeds = list(range(args.seeds)) if args.seeds is not None else None
    print(
        generate_dataset(
            out_dir=args.out_dir,
            progress=logger,
            generator_regime=args.regime,
            moment_bounds=moment_bounds,
            seeds=seeds,
        )
    )


if __name__ == "__main__":
    main()
