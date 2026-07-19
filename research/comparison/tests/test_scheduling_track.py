from __future__ import annotations

import json

from py_roadmap_engine import Material, RoadmapInput, RoadmapOutput, RoadmapWeek, Slot
from research_comparison.generator.generate import DEFAULT_ARCHETYPE_MIX, generate_dataset
from research_comparison.metrics.scheduling import (
    capacity_violation_rate,
    prereq_order_correctness,
    winner_by_material_mix,
)
from research_comparison.runners.scheduling import (
    run_scheduling_for_scenario,
    run_scheduling_track,
    schedule_greedy,
    scheduling_candidates,
    skipped_scheduling_candidates,
)


def _materials() -> list[Material]:
    return [
        Material("anchor", "Main playlist", 120, "anchor", 0),
        Material("practice", "Practice set", 90, "practice", 1),
    ]


def _input(weeks: int = 2, weekday_hours: float = 3.0) -> RoadmapInput:
    return RoadmapInput(
        materials=_materials(),
        weeks=weeks,
        startDate="2026-04-06",
        selectedStudyDays=["Mon", "Wed", "Sat"],
        weekdayHours=weekday_hours,
        weekendHours=2.0,
    )


def _reversed_prereq_input() -> RoadmapInput:
    return RoadmapInput(
        materials=[
            Material("practice", "Practice set", 90, "practice", 0),
            Material("anchor", "Main playlist", 120, "anchor", 1),
            Material("foundation", "Foundation notes", 80, "foundation", 2),
        ],
        weeks=2,
        startDate="2026-04-06",
        selectedStudyDays=["Mon", "Wed", "Sat"],
        weekdayHours=3.0,
        weekendHours=2.0,
    )


def test_generate_roadmap_runs_on_two_material_scenario():
    output = schedule_greedy(_input())

    assert output.weeks
    assert output.capacityCheck.totalMaterialMinutes == 210
    assert isinstance(output.warnings, list)


def test_a4_greedy_prereq_tweak_restores_role_order_on_reversed_mix():
    output = schedule_greedy(_reversed_prereq_input())

    assert prereq_order_correctness(output) == 1.0


def test_a4_scheduling_candidates_include_new_deployables_and_optional_cpsat():
    candidates = scheduling_candidates()
    names = {candidate.name for candidate in candidates}

    assert {"topological_prereq", "local_search_repair"} <= names
    if "cpsat_optimum" in names:
        cpsat = next(candidate for candidate in candidates if candidate.name == "cpsat_optimum")
        assert cpsat.candidate_kind == "upper_bound"
    else:
        skipped = skipped_scheduling_candidates()
        assert skipped and skipped[0]["candidate"] == "cpsat_optimum"


def test_capacity_violation_metric_detects_over_capacity_plan():
    fits = schedule_greedy(_input(weeks=3, weekday_hours=4.0))
    assert capacity_violation_rate(fits) == 0.0

    bad = RoadmapOutput(
        weeks=[
            RoadmapWeek(
                weekIndex=0,
                startDate="2026-04-06",
                slots=[
                    Slot(0, "Mon", "2026-04-06", 60, "anchor", ["anchor"], 90, "bad")
                ],
            )
        ],
        warnings=[],
        capacityCheck=fits.capacityCheck,
    )
    assert capacity_violation_rate(bad) > 0.0


def test_prereq_order_metric_flags_practice_before_anchor():
    bad = RoadmapOutput(
        weeks=[
            RoadmapWeek(
                weekIndex=0,
                startDate="2026-04-06",
                slots=[
                    Slot(0, "Mon", "2026-04-06", 60, "practice", ["practice"], 60, "p"),
                    Slot(0, "Wed", "2026-04-08", 60, "anchor", ["anchor"], 60, "a"),
                ],
            )
        ],
        warnings=[],
        capacityCheck=schedule_greedy(_input()).capacityCheck,
    )

    assert prereq_order_correctness(bad) == 0.0


def test_runner_records_gen_time_and_material_mix():
    rows = run_scheduling_for_scenario(
        scenario_id="fixture",
        material_mix="anchor+practice",
        input_data=_input(),
        deadline="2026-04-19",
    )

    assert rows
    assert all(row["gen_time_ms"] >= 0.0 for row in rows)
    assert {row["material_mix"] for row in rows} == {"anchor+practice"}


def test_a4_scheduling_rows_shape_and_upper_bounds_excluded_from_winner():
    rows = run_scheduling_for_scenario(
        scenario_id="fixture-a4",
        material_mix="anchor+foundation+practice",
        input_data=_reversed_prereq_input(),
        deadline="2026-04-19",
    )
    seen = {row["candidate"] for row in rows}

    assert {"topological_prereq", "local_search_repair"} <= seen
    assert all("candidate_kind" in row for row in rows)
    winners = winner_by_material_mix(
        [
            {
                "candidate": "cpsat_optimum",
                "candidate_kind": "upper_bound",
                "material_mix": "anchor+practice",
                "deadline_drift_days": 0.0,
                "capacity_violation_rate": 0.0,
                "prereq_order_correctness": 1.0,
                "gen_time_ms": 1.0,
            },
            {
                "candidate": "greedy_incumbent",
                "candidate_kind": "deployable",
                "material_mix": "anchor+practice",
                "deadline_drift_days": 2.0,
                "capacity_violation_rate": 0.0,
                "prereq_order_correctness": 1.0,
                "gen_time_ms": 1.0,
            },
        ]
    )
    assert winners["anchor+practice"]["winner"] == "greedy_incumbent"


def test_a3_scheduling_result_carries_ci_correction_and_heldout_split(tmp_path):
    dataset_id = generate_dataset(
        archetype_mix=DEFAULT_ARCHETYPE_MIX,
        bands=["small"],
        seeds=[0],
        out_dir=str(tmp_path / "datasets"),
    )
    result_path = run_scheduling_track(
        dataset_dir=str(tmp_path / "datasets" / dataset_id),
        out_dir=str(tmp_path / "results" / "scheduling"),
    )

    payload = json.loads(result_path.read_text())
    split = payload["_provenance"]["archetype_split"]
    first_cell = next(iter(payload["paired_vs_incumbent"].values()))
    first_result = next(iter(first_cell.values()))

    assert set(split["train"]).isdisjoint(split["held_out"])
    assert payload["scored_split"] == "held_out"
    assert {"delta_ci_low", "delta_ci_high"} <= set(first_result)
    assert payload["mc_correction"]["comparisons"]
