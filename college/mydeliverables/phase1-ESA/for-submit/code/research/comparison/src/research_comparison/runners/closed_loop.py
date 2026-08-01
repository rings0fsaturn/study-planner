from __future__ import annotations

import argparse
import json
import statistics
from dataclasses import replace
from pathlib import Path
from typing import Any

from py_progress import compute_calibration
from py_roadmap_engine import Material, Pin, RoadmapInput, RoadmapOutput, regenerate_roadmap

from research_comparison.metrics.closed_loop import (
    adherence_score,
    compare_closed_vs_open,
    finish_date_drift_days,
)
from research_comparison.metrics.scheduling import planned_slots
from research_comparison.progress_log import ProgressLogger
from research_comparison.runners.calibration import latest_dataset_dir
from research_comparison.runners.detection import detect_cusum
from research_comparison.runners.scheduling import scenario_from_learner, schedule_greedy
from research_comparison.writers.results import manifest_from_dataset, write_stamped_json


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def _plan_signature(output: RoadmapOutput) -> list[tuple[str, str, float]]:
    return [
        (
            slot.date,
            ",".join(slot.candidateMaterialIds),
            round(float(slot.plannedMinutes), 3),
        )
        for slot in planned_slots(output)
    ]


def _finish_date(output: RoadmapOutput, deadline: str) -> str:
    slots = planned_slots(output)
    if not slots:
        return deadline
    return max(slot.date for slot in slots)


def _active_ratios(sessions: list[dict[str, Any]]) -> list[float]:
    return [
        float(session["activeMinutes"]) / float(session["plannedMinutes"])
        for session in sessions
        if session.get("source") == "active"
        and session.get("plannedMinutes") not in {None, 0}
        and session.get("activeMinutes") is not None
    ]


def _scaled_input(input_data: RoadmapInput, multiplier: float) -> RoadmapInput:
    scale = max(0.50, min(1.75, multiplier))
    materials = [
        Material(
            id=material.id,
            title=material.title,
            totalMinutes=round(float(material.totalMinutes) * scale, 3),
            role=material.role,
            additionOrder=material.additionOrder,
        )
        for material in input_data.materials
    ]
    return replace(input_data, materials=materials)


def _pins_from_completed(output: RoadmapOutput, through_index: int) -> list[Pin]:
    slots = planned_slots(output)[: max(0, through_index)]
    return [
        Pin(
            weekIndex=slot.weekIndex,
            dayOfWeek=slot.dayOfWeek,
            materialId=slot.candidateMaterialIds[0] if slot.candidateMaterialIds else None,
            sessionTitle=slot.sessionTitle,
            plannedMinutes=slot.plannedMinutes,
            reason="completed",
        )
        for slot in slots
    ]


def _shift_detected(ratios: list[float], last_breakpoint: int) -> int | None:
    if len(ratios) < 8:
        return None
    baseline = ratios[: min(8, len(ratios))]
    reference = statistics.fmean(baseline)
    std = statistics.stdev(baseline) if len(baseline) > 1 else 0.05
    breakpoints = detect_cusum(ratios, reference_mean=reference, std=max(std, 0.05))
    new_breakpoints = [point for point in breakpoints if point > last_breakpoint]
    return new_breakpoints[-1] if new_breakpoints else None


def run_closed_loop_for_scenario(
    scenario_id: str,
    input_data: RoadmapInput,
    sessions: list[dict[str, Any]],
    deadline: str,
    *,
    closed_loop: bool,
) -> dict[str, Any]:
    initial_plan = schedule_greedy(input_data)
    current_plan = initial_plan
    replans = 0
    last_breakpoint = -1
    calibration_multiplier = 1.0

    if closed_loop:
        for index in range(8, len(sessions) + 1):
            history = sessions[:index]
            ratios = _active_ratios(history)
            breakpoint = _shift_detected(ratios, last_breakpoint)
            if breakpoint is None:
                continue
            state = compute_calibration(history, [], [])
            calibration_multiplier = float(state.globalMultiplier)
            current_plan = regenerate_roadmap(
                _scaled_input(input_data, calibration_multiplier),
                _pins_from_completed(current_plan, breakpoint),
            )
            replans += 1
            last_breakpoint = breakpoint

    finish = _finish_date(current_plan, deadline)
    mode = "closed" if closed_loop else "open"
    return {
        "scenario_id": scenario_id,
        "mode": mode,
        "replans": replans,
        "calibration_multiplier": calibration_multiplier,
        "adherence": adherence_score(sessions),
        "finish_date": finish,
        "finish_date_drift_days": finish_date_drift_days(finish, deadline),
        "initial_plan_signature": _plan_signature(initial_plan),
        "final_plan_signature": _plan_signature(current_plan),
    }


def run_closed_loop_archive(
    dataset_dir: str | None = None,
    out_dir: str | None = None,
    progress: ProgressLogger | None = None,
) -> Path:
    root = _repo_root()
    dataset_path = Path(dataset_dir) if dataset_dir else latest_dataset_dir()
    result_root = Path(out_dir) if out_dir else root / "research/results/closed_loop"
    if progress:
        progress.log(0, "closed_loop.start", f"dataset={dataset_path}")
    raw_manifest = json.loads((dataset_path / "manifest.json").read_text(encoding="utf-8"))
    manifest = manifest_from_dataset(raw_manifest)
    sidecars = {
        row["learner_id"]: row["ground_truth"]
        for row in _read_jsonl(dataset_path / "sidecars.jsonl")
    }

    rows: list[dict[str, Any]] = []
    comparisons: list[dict[str, Any]] = []
    learners = _read_jsonl(dataset_path / "learners.jsonl")[:24]
    total_learners = len(learners)
    if progress:
        progress.log(10, "closed_loop.loaded", f"scenarios={total_learners}")
    for learner_index, learner in enumerate(learners, start=1):
        scenario = scenario_from_learner(learner, sidecars[learner["learner_id"]])
        open_result = run_closed_loop_for_scenario(
            scenario.scenario_id,
            scenario.input_data,
            learner["sessions"],
            scenario.deadline,
            closed_loop=False,
        )
        closed_result = run_closed_loop_for_scenario(
            scenario.scenario_id,
            scenario.input_data,
            learner["sessions"],
            scenario.deadline,
            closed_loop=True,
        )
        rows.extend([open_result, closed_result])
        comparisons.append(
            {
                "scenario_id": scenario.scenario_id,
                **compare_closed_vs_open(open_result, closed_result),
            }
        )
        if progress and (
            learner_index == 1
            or learner_index == total_learners
            or learner_index % max(1, total_learners // 20) == 0
        ):
            progress.log(
                10 + (learner_index / max(1, total_learners)) * 80,
                "closed_loop.scenarios",
                f"processed={learner_index}/{total_learners} rows={len(rows)}",
            )

    payload = {
        "dataset_id": raw_manifest["dataset_id"],
        "archive_only": True,
        "rows": rows,
        "comparisons": comparisons,
    }
    if progress:
        progress.log(95, "closed_loop.write", f"rows={len(rows)} comparisons={len(comparisons)}")
    out_path = write_stamped_json(result_root / "closed_loop_results.json", payload, manifest)
    if progress:
        progress.log(100, "closed_loop.complete", str(out_path))
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--closed-loop", action="store_true")
    parser.add_argument("--dataset-dir", default=None)
    parser.add_argument("--out-dir", default=None)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-closed-loop", enabled=not args.quiet)
    print(run_closed_loop_archive(dataset_dir=args.dataset_dir, out_dir=args.out_dir, progress=logger))


if __name__ == "__main__":
    main()
