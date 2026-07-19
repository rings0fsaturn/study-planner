from __future__ import annotations

from pathlib import Path

from py_roadmap_engine import Material, RoadmapInput

from research_comparison.metrics.closed_loop import compare_closed_vs_open
from research_comparison.runners.closed_loop import run_closed_loop_for_scenario


def _input() -> RoadmapInput:
    return RoadmapInput(
        materials=[
            Material("anchor", "Anchor", 180, "anchor", 0),
            Material("practice", "Practice", 120, "practice", 1),
        ],
        weeks=3,
        startDate="2026-05-04",
        selectedStudyDays=["Mon", "Wed", "Sat"],
        weekdayHours=3.0,
        weekendHours=2.0,
    )


def _shift_sessions() -> list[dict]:
    ratios = [1.0] * 10 + [1.36] * 12
    return [
        {
            "date": f"2026-05-{index + 4:02d}",
            "source": "active",
            "plannedMinutes": 50.0,
            "activeMinutes": 50.0 * ratio,
            "duration": 50.0 * ratio,
            "materialRole": "foundation",
            "startedAt": f"2026-05-{index + 4:02d}T08:00:00Z",
            "sessionId": f"closed-loop-{index}",
        }
        for index, ratio in enumerate(ratios)
    ]


def test_closed_loop_run_regenerates_when_shift_is_detected():
    result = run_closed_loop_for_scenario(
        "fixture",
        _input(),
        _shift_sessions(),
        deadline="2026-05-24",
        closed_loop=True,
    )

    assert result["mode"] == "closed"
    assert result["replans"] >= 1


def test_open_loop_run_leaves_plan_unchanged():
    result = run_closed_loop_for_scenario(
        "fixture",
        _input(),
        _shift_sessions(),
        deadline="2026-05-24",
        closed_loop=False,
    )

    assert result["mode"] == "open"
    assert result["replans"] == 0
    assert result["initial_plan_signature"] == result["final_plan_signature"]


def test_closed_vs_open_metrics_include_adherence_and_finish_drift():
    open_result = run_closed_loop_for_scenario(
        "fixture",
        _input(),
        _shift_sessions(),
        deadline="2026-05-24",
        closed_loop=False,
    )
    closed_result = run_closed_loop_for_scenario(
        "fixture",
        _input(),
        _shift_sessions(),
        deadline="2026-05-24",
        closed_loop=True,
    )
    metrics = compare_closed_vs_open(open_result, closed_result)

    assert set(metrics) == {"open", "closed"}
    assert "adherence" in metrics["open"]
    assert "finish_date_drift_days" in metrics["closed"]


def test_closed_loop_artifacts_do_not_leak_to_phase_i_report_outputs():
    generated = Path("college/mydeliverables/1st-Review/report/generated")
    leaked = [
        path
        for pattern in ("*closed*", "*loop*")
        for path in generated.glob(pattern)
    ]

    assert leaked == []
