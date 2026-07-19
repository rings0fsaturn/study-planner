from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def _is_visible_entrypoint(path: Path, source: str) -> bool:
    rel = path.relative_to(REPO_ROOT)
    if any(part.startswith(".") for part in rel.parts):
        return False
    if "tests" in rel.parts:
        return False
    if source.startswith("#!"):
        return True
    if "argparse.ArgumentParser" in source:
        return True
    return 'if __name__ == "__main__"' in source or "if __name__ == '__main__'" in source


def test_visible_python_entrypoints_emit_progress_logs() -> None:
    missing_progress = []
    for path in sorted(REPO_ROOT.rglob("*.py")):
        rel = path.relative_to(REPO_ROOT)
        if any(part in {".venv", "node_modules"} for part in rel.parts):
            continue
        source = path.read_text(encoding="utf-8")
        if not _is_visible_entrypoint(path, source):
            continue
        if "ProgressLogger" not in source and "log_progress(" not in source:
            missing_progress.append(str(rel))

    assert not missing_progress, "Python entrypoints missing progress logs: " + ", ".join(missing_progress)
