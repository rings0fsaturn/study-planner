from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from datetime import date

from py_progress import MIN_SESSIONS_PER_BUCKET, compute_hierarchical_model
from research_comparison.generator.generate import (
    DECOUPLED_REGIME,
    generate_dataset,
    generate_decoupled_learner,
    generate_learner,
    generate_reality_matched_learner,
)
from research_comparison.generator.archetypes import archetype_config
from research_comparison.generator.effects import delta_deadline, trend_multiplier
from research_comparison.generator.oulad_moments import derive_oulad_moment_bounds
from research_comparison.generator.pace import latent_base
from research_comparison.params import ARCHETYPES, BANDS, PARAMS_VERSION_HASH
from research_comparison.params_decoupled import DECOUPLED_PARAMS_HASH


def _canonical(events, truth) -> str:
    truth_dict = {key: value for key, value in asdict(truth).items() if value is not None}
    return json.dumps({"events": events, "truth": truth_dict}, sort_keys=True)


def _moment_bounds_fixture():
    return {
        "bounds_version": "test-oulad-bounds",
        "proxy_mapping": "daily clicks -> minutes toward a roadmap",
        "bounds": {
            "ar1_phi": {"low": 0.25, "high": 0.35},
            "shift_frequency_per_100_days": {"low": 4.0, "high": 7.0},
            "gap_days": {"p50": 2.0, "p75": 5.0, "p90": 11.0, "p95": 16.0},
            "dropout_probability": {"low": 0.25, "high": 0.40},
        },
    }


def test_generate_learner_emits_session_event_shape():
    events, truth = generate_learner("steady", "small", 101)

    assert events
    assert len(truth.r_star) == len(events)
    for event in events:
        assert {"date", "source", "duration", "materialRole", "startedAt", "sessionId"} <= set(
            event
        )
        assert event["materialRole"] in {"anchor", "foundation", "practice"}
        if event["source"] == "active":
            assert event["plannedMinutes"] > 0
            assert event["activeMinutes"] > 0
        else:
            assert event["source"] == "manual"
            assert event.get("plannedMinutes") is None
            assert event.get("activeMinutes") is None


def test_generate_learner_is_deterministic_by_seed():
    first = generate_learner("steady", "medium", 42)
    second = generate_learner("steady", "medium", 42)

    assert _canonical(*first) == _canonical(*second)


def test_frozen_generator_byte_hash_is_unchanged():
    events, truth = generate_learner("steady", "medium", 42)
    digest = hashlib.sha256(_canonical(events, truth).encode("utf-8")).hexdigest()

    assert digest == "62addf4b4d019c505d0781a37736b020bea58931730272c2791e540c5c1bbce1"


def test_oracle_recovers_planted_pace_for_steady_learner():
    events, truth = generate_learner("steady", "medium", 7)
    active = [event for event in events if event["source"] == "active"]

    result = compute_hierarchical_model(active, set())

    assert abs(result.globalPosterior.mean - truth.m_global) < 0.12
    for role, multiplier in truth.role_multipliers.items():
        role_count = sum(1 for event in active if event["materialRole"] == role)
        if role_count >= MIN_SESSIONS_PER_BUCKET:
            assert role in result.roleMultipliers
            assert abs(result.roleMultipliers[role].multiplier - truth.m_global * multiplier) < 0.18


def test_shift_labels_match_band_schedule():
    for band, band_config in BANDS.items():
        _, truth = generate_learner("marathon_runner", band, 11)
        assert band_config["shifts"][0] <= len(truth.regime_schedule) <= band_config["shifts"][1]
        for shift in truth.regime_schedule:
            assert shift.type in {"step", "drift"}
            assert shift.onset_index >= 4
            assert shift.onset_index <= len(truth.r_star) - 4
            assert 0.20 <= shift.onset_index / len(truth.r_star) <= 0.80


def test_clip_rate_under_two_percent_for_each_archetype():
    for index, archetype in enumerate(ARCHETYPES):
        _, truth = generate_learner(archetype, "medium", 900 + index)
        assert truth.clip_rate < 0.02


def test_phase2_archetype_shapes_are_pre_registered():
    assert {"night_owl", "crammer", "steady_improver"} <= set(ARCHETYPES)

    night_owl = archetype_config("night_owl")
    morning_pace = latent_base(
        float(night_owl["m_global"]),
        "foundation",
        "morning",
        "monday",
        night_owl,
    )
    evening_pace = latent_base(
        float(night_owl["m_global"]),
        "foundation",
        "evening",
        "monday",
        night_owl,
    )
    assert evening_pace < morning_pace

    crammer = archetype_config("crammer")
    assert delta_deadline(8, 11, crammer) == 1.0
    assert delta_deadline(9, 11, crammer) == 1.0
    assert delta_deadline(10, 11, crammer) > 1.30

    improver = archetype_config("steady_improver")
    assert trend_multiplier(0, 10, improver) == 1.0
    assert trend_multiplier(9, 10, improver) > trend_multiplier(1, 10, improver)


def test_phase2_dataset_emits_observable_planned_horizon_without_sidecar_leakage(tmp_path):
    dataset_dir = generate_dataset(
        archetype_mix={"steady": 1},
        bands=["small"],
        seeds=[1],
        out_dir=str(tmp_path),
    )

    dataset_path = tmp_path / dataset_dir
    learner = json.loads((dataset_path / "learners.jsonl").read_text().splitlines()[0])
    sidecar = json.loads((dataset_path / "sidecars.jsonl").read_text().splitlines()[0])

    assert set(learner["planned_horizon"]) == {"deadline", "planned_total_sessions"}
    assert learner["planned_horizon"]["planned_total_sessions"] >= len(learner["sessions"])
    assert date.fromisoformat(learner["planned_horizon"]["deadline"])
    assert "planned_horizon" not in sidecar


def test_generate_dataset_writes_manifest_sidecar_and_face_validity(tmp_path):
    dataset_dir = generate_dataset(
        archetype_mix={"steady": 1, "morning_lark": 1},
        bands=["small"],
        seeds=[1],
        out_dir=str(tmp_path),
    )

    dataset_path = tmp_path / dataset_dir
    manifest = json.loads((dataset_path / "manifest.json").read_text())
    learner_lines = (dataset_path / "learners.jsonl").read_text().splitlines()
    sidecar_lines = (dataset_path / "sidecars.jsonl").read_text().splitlines()
    face_validity = json.loads((dataset_path / "face_validity.json").read_text())

    assert manifest["params_version_hash"] == PARAMS_VERSION_HASH
    assert manifest["n_learners"] == 2
    assert len(learner_lines) == 2
    assert len(sidecar_lines) == 2
    assert face_validity["pace_ratio"]


def test_decoupled_generator_preserves_throughput_and_event_invariants():
    events, truth, metadata = generate_decoupled_learner("steady", "medium", 20260630)

    assert events
    assert metadata["generator_regime"] == DECOUPLED_REGIME
    assert metadata["decoupled_params_hash"] == DECOUPLED_PARAMS_HASH
    assert len(truth.r_star) == len(events)
    assert 3 <= len(truth.study_days) <= 6
    assert 0.10 <= truth.adhoc_rate <= 0.20
    assert 0.15 <= truth.interruption_rate <= 0.25

    active_pairs = [
        (event, target)
        for event, target in zip(events, truth.r_star, strict=True)
        if event["source"] == "active"
    ]
    assert active_pairs
    assert all(float(event["duration"]) > 0 for event in events)
    assert all("plannedSessionMinutes" in event for event in events)
    assert all("bookingId" in event for event in events)
    assert all(0.0 <= float(event["materialPosition"]) <= 1.0 for event in events)

    for event, target in active_pairs:
        assert event["plannedMinutes"] > 0
        assert event["activeMinutes"] > 0
        assert abs((event["activeMinutes"] / event["plannedMinutes"]) - target) < 1e-6

    partials = [event for event in events if event.get("resolution") == "interrupted"]
    assert partials
    for event in partials:
        assert event["source"] == "active"
        assert 0 < event["plannedMinutes"] < event["materialChunkMinutes"]

    study_days = set(truth.study_days)
    adhoc_events = [event for event in events if event.get("isAdHoc")]
    assert adhoc_events
    for event in adhoc_events:
        day_name = date.fromisoformat(event["date"]).strftime("%A").lower()
        assert day_name not in study_days


def test_decoupled_dataset_uses_separate_hash_manifest_and_face_validity(tmp_path):
    dataset_dir = generate_dataset(
        archetype_mix={"steady": 1},
        bands=["small"],
        seeds=[1],
        out_dir=str(tmp_path),
        generator_regime=DECOUPLED_REGIME,
    )

    dataset_path = tmp_path / dataset_dir
    manifest = json.loads((dataset_path / "manifest.json").read_text())
    sidecar = json.loads((dataset_path / "sidecars.jsonl").read_text().splitlines()[0])
    face_validity = json.loads((dataset_path / "face_validity.json").read_text())

    assert dataset_dir.startswith("synthetic-decoupled-")
    assert manifest["generator_regime"] == DECOUPLED_REGIME
    assert manifest["generator_version"] == "0.2.0"
    assert manifest["params_version_hash"] != PARAMS_VERSION_HASH
    assert manifest["base_params_version_hash"] == PARAMS_VERSION_HASH
    assert manifest["decoupled_params_hash"] == DECOUPLED_PARAMS_HASH
    assert sidecar["generator_regime"] == DECOUPLED_REGIME
    assert sidecar["ground_truth"]["study_days"]
    assert face_validity["planned_session_minutes"]
    assert face_validity["material_position"]
    assert face_validity["adherence_ratio"]
    assert face_validity["partial_fraction"]
    assert face_validity["is_adhoc"]


def test_oulad_moment_extractor_returns_bounds_not_point_fits(tmp_path):
    oulad = tmp_path / "oulad"
    oulad.mkdir()
    (oulad / "studentRegistration.csv").write_text(
        "\n".join(
            [
                '"code_module","code_presentation","id_student","date_registration","date_unregistration"',
                '"AAA","2013J","1","-10","?"',
                '"AAA","2013J","2","-10","40"',
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (oulad / "studentVle.csv").write_text(
        "\n".join(
            [
                '"code_module","code_presentation","id_student","id_site","date","sum_click"',
                '"AAA","2013J","1","10","0","3"',
                '"AAA","2013J","1","10","1","8"',
                '"AAA","2013J","1","10","3","2"',
                '"AAA","2013J","1","10","10","20"',
                '"AAA","2013J","2","10","0","1"',
                '"AAA","2013J","2","10","2","1"',
                '"AAA","2013J","2","10","9","12"',
                '"AAA","2013J","2","10","10","1"',
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    result = derive_oulad_moment_bounds(oulad, max_series=10, sample_mod=1, min_points=3)

    assert result["source"]["dataset"] == "OULAD"
    assert "daily clicks" in result["proxy_mapping"]
    assert result["bounds"]["ar1_phi"]["low"] <= result["bounds"]["ar1_phi"]["high"]
    assert result["bounds"]["shift_frequency_per_100_days"]["low"] <= result["bounds"][
        "shift_frequency_per_100_days"
    ]["high"]
    assert result["bounds"]["gap_days"]["p90"] >= result["bounds"]["gap_days"]["p50"]
    assert result["bounds"]["dropout_probability"]["high"] > result["bounds"][
        "dropout_probability"
    ]["low"]
    assert result["moment_bounds_hash"]


def test_reality_matched_generator_plants_richer_structure_hidden_from_events():
    events, truth, metadata = generate_reality_matched_learner(
        "marathon_runner",
        "medium",
        2026,
        moment_bounds=_moment_bounds_fixture(),
    )
    active_events = [event for event in events if event["source"] == "active"]

    assert len(truth.regime_schedule) >= 2
    labels = {row["label"] for row in metadata["reality_annotations"]}
    assert {"relapse", "recovery", "exam_crunch_seasonality", "illness_holiday_gap"} <= labels
    assert metadata["continuous_traits"]["ar1_phi"] >= 0.25
    assert metadata["missingness"]["hiatus_days"] >= 7
    assert metadata["logged_time_misreporting"]["hidden_from_candidate_inputs"] is True
    assert metadata["logged_time_misreporting"]["entries"]
    assert active_events
    assert all("true_active_minutes" not in event for event in active_events)
    assert all("misreport_factor" not in event for event in active_events)


def test_reality_matched_dataset_uses_new_hash_and_sidecar_metadata(tmp_path):
    dataset_dir = generate_dataset(
        archetype_mix={"marathon_runner": 1},
        bands=["medium"],
        seeds=[1],
        out_dir=str(tmp_path),
        generator_regime="reality_matched",
        moment_bounds=_moment_bounds_fixture(),
    )

    dataset_path = tmp_path / dataset_dir
    manifest = json.loads((dataset_path / "manifest.json").read_text())
    sidecar = json.loads((dataset_path / "sidecars.jsonl").read_text().splitlines()[0])
    learner = json.loads((dataset_path / "learners.jsonl").read_text().splitlines()[0])
    dates = [event["date"] for event in learner["sessions"]]

    assert dataset_dir.startswith("synthetic-reality-")
    assert manifest["params_version_hash"] != PARAMS_VERSION_HASH
    assert manifest["base_params_version_hash"] == PARAMS_VERSION_HASH
    assert manifest["generator_regime"] == "reality_matched"
    assert sidecar["generator_regime"] == "reality_matched"
    assert sidecar["logged_time_misreporting"]["entries"]
    assert max(
        (date.fromisoformat(right) - date.fromisoformat(left)).days
        for left, right in zip(dates, dates[1:])
    ) >= 7
