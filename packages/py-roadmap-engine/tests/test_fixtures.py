from __future__ import annotations

import math
from dataclasses import asdict, is_dataclass
from typing import Any

from py_roadmap_engine import (
    add_material_to_roadmap,
    generate_roadmap,
    infer_role,
    regenerate_roadmap,
    remove_material_from_roadmap,
)

TOLERANCE = 1e-6


def _to_json_value(obj: Any) -> Any:
    if is_dataclass(obj) and not isinstance(obj, type):
        return {k: _to_json_value(v) for k, v in asdict(obj).items()}
    if isinstance(obj, dict):
        return {k: _to_json_value(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_json_value(v) for v in obj]
    if isinstance(obj, tuple):
        return [_to_json_value(v) for v in obj]
    return obj


def _dispatch(inp: dict) -> Any:
    fn = inp["fn"]

    if fn == "generateRoadmap":
        return generate_roadmap(inp)

    if fn == "inferRole":
        return infer_role(inp["title"], inp["totalMinutes"], inp.get("existing", []))

    if fn == "addMaterialToRoadmap":
        return add_material_to_roadmap(inp["roadmap"], inp["newMaterial"], inp.get("pins", []))

    if fn == "removeMaterialFromRoadmap":
        return remove_material_from_roadmap(inp["roadmap"], inp["materialId"], inp.get("pins", []))

    if fn == "regenerateRoadmap":
        return regenerate_roadmap(inp["input"], inp.get("pins", []))

    raise ValueError(f"Unknown fixture function: {fn}")


def _assert_close(actual: Any, expected: Any, path: str = "") -> None:
    if actual is None and expected is None:
        return
    if isinstance(expected, bool):
        assert actual == expected, f"{path}: {actual!r} != {expected!r}"
        return
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        if isinstance(expected, int) and isinstance(actual, int) and not isinstance(
            expected, bool
        ):
            assert actual == expected, f"{path}: {actual!r} != {expected!r}"
            return
        if not math.isclose(float(actual), float(expected), rel_tol=TOLERANCE, abs_tol=TOLERANCE):
            raise AssertionError(f"{path}: {actual!r} != {expected!r} (tol={TOLERANCE})")
        return
    if isinstance(expected, str):
        assert actual == expected, f"{path}: {actual!r} != {expected!r}"
        return
    if isinstance(expected, list):
        assert isinstance(actual, list), f"{path}: expected list, got {type(actual)}"
        assert len(actual) == len(expected), f"{path}: length {len(actual)} != {len(expected)}"
        for i, (a, e) in enumerate(zip(actual, expected, strict=True)):
            _assert_close(a, e, f"{path}[{i}]")
        return
    if isinstance(expected, dict):
        assert isinstance(actual, dict), f"{path}: expected dict, got {type(actual)}"
        for key in expected:
            assert key in actual, f"{path}: missing key {key!r}"
            _assert_close(actual[key], expected[key], f"{path}.{key}")
        return
    assert actual == expected, f"{path}: {actual!r} != {expected!r}"


def test_fixture_parity(case_name: str, fixture_input: dict, fixture_expected) -> None:
    actual = _to_json_value(_dispatch(fixture_input))
    _assert_close(actual, fixture_expected, case_name)
