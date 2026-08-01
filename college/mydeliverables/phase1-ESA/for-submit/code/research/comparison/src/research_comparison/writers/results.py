from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from research_comparison.manifest import Manifest, stamp


def write_stamped_json(path: Path, payload: dict[str, Any], manifest: Manifest) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(stamp(payload, manifest), indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return path


def manifest_from_dataset(raw: dict[str, Any]) -> Manifest:
    return Manifest(
        seed=int(raw["seed"]),
        generator_version=str(raw["generator_version"]),
        params_version_hash=str(raw["params_version_hash"]),
        archetype_mix=dict(raw["archetype_mix"]),
        n_learners=int(raw["n_learners"]),
        seed_count=len(raw.get("seeds", [])) or None,
        bands=list(raw.get("bands", [])) or None,
    )


def manifest_dict(manifest: Manifest) -> dict[str, Any]:
    return asdict(manifest)
