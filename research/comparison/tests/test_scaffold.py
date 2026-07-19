from __future__ import annotations

import py_progress
import py_roadmap_engine
from research_comparison.manifest import build_manifest, stamp
from research_comparison.params import ARCHETYPES, PARAMS_VERSION_HASH


def test_engines_importable():
    assert hasattr(py_progress, "compute_calibration")
    assert hasattr(py_roadmap_engine, "generate_roadmap")


def test_params_hash_stable_and_prereg_found():
    assert len(PARAMS_VERSION_HASH) == 12
    assert set(ARCHETYPES) >= {"steady", "fading_flame", "deadline_sprinter"}


def test_stamp_attaches_provenance():
    m = build_manifest(seed=7, archetype_mix={"steady": 1}, n_learners=1)
    out = stamp({"x": 1}, m)
    assert out["_provenance"]["params_version_hash"] == PARAMS_VERSION_HASH
    assert out["_provenance"]["seed"] == 7
