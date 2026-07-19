from __future__ import annotations

import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "pillar-a" / "roadmap"


def _fixture_cases() -> list[str]:
    return sorted(p.stem.replace(".input", "") for p in FIXTURE_DIR.glob("*.input.json"))


def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
    if "case_name" in metafunc.fixturenames:
        metafunc.parametrize("case_name", _fixture_cases())


@pytest.fixture
def fixture_input(case_name: str) -> dict:
    path = FIXTURE_DIR / f"{case_name}.input.json"
    return json.loads(path.read_text())


@pytest.fixture
def fixture_expected(case_name: str):
    path = FIXTURE_DIR / f"{case_name}.expected.json"
    return json.loads(path.read_text())
