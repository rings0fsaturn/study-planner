#!/usr/bin/env python3
"""
gc-memory.py — garbage-collect stale rows from .codex/memory/index.jsonl.

Removes rows whose path no longer points to an indexable file: file gone,
newly gitignored, extension no longer allowed, deny-pattern now matches.

Does NOT re-verify hashes (that's the hook's job on next read).
Does NOT delete flow files (those are history; survive deletions).
"""

import fcntl
import json
import os
import subprocess
import sys
import time
from pathlib import Path

# Re-use the same filter rules as update-index.py. Kept in sync via the
# duplicated-script convention. If you edit one, edit the other.
ALLOW_EXTS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs",
    ".java", ".kt", ".kts", ".scala", ".clj", ".cljs",
    ".go", ".rs", ".rb", ".php", ".cs", ".fs", ".vb",
    ".cpp", ".cc", ".cxx", ".c", ".h", ".hpp", ".hh",
    ".swift", ".m", ".mm",
    ".ex", ".exs", ".erl", ".hrl",
    ".sql", ".proto", ".graphql", ".gql",
    ".xml", ".yaml", ".yml", ".toml", ".json5",
    ".sh", ".bash", ".zsh", ".fish",
    ".lua", ".pl", ".pm", ".r", ".jl", ".dart",
    ".tf", ".hcl", ".nix", ".gradle", ".sbt",
}

DENY_NAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock",
    "Gemfile.lock", "Pipfile.lock", "poetry.lock", "Cargo.lock", "go.sum",
}

DENY_DIR_SEGMENTS = {
    "node_modules", "dist", "build", "target", ".next", ".nuxt",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".tox",
    "vendor", "venv", ".venv", "env", ".env.d",
    ".gradle", ".idea", ".vscode-test", "coverage",
    "out", "bin", "obj",
}

import re
DENY_NAME_PATTERNS = [
    re.compile(r"\.min\.[a-zA-Z0-9]+$"),
    re.compile(r"\.bundle\.[a-zA-Z0-9]+$"),
    re.compile(r"\.generated\.[a-zA-Z0-9]+$"),
]


def repo_root() -> Path:
    return Path.cwd()


def memory_dir() -> Path:
    return repo_root() / ".codex" / "memory"


def hooks_dir() -> Path:
    return repo_root() / ".codex" / "hooks"


def classify_stale(rel: str) -> str:
    """Return '' if row should survive, else a short reason it's stale."""
    path = repo_root() / rel
    if not path.is_file():
        return "deleted"
    parts = set(path.parts)
    if parts & DENY_DIR_SEGMENTS:
        return "in-deny-dir"
    if path.name in DENY_NAMES:
        return "deny-name"
    for pat in DENY_NAME_PATTERNS:
        if pat.search(path.name):
            return "deny-pattern"
    if path.suffix.lower() not in ALLOW_EXTS:
        return "extension-disallowed"

    if (repo_root() / ".git").exists():
        try:
            result = subprocess.run(
                ["git", "check-ignore", "-q", str(path)],
                cwd=str(repo_root()),
                capture_output=True,
                timeout=2,
            )
            if result.returncode == 0:
                return "gitignored"
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

    return ""


def main():
    idx = memory_dir() / "index.jsonl"
    lock = memory_dir() / ".index.lock"
    if not idx.exists():
        print("gc-memory: no index.jsonl, nothing to do.")
        return 0
    lock.parent.mkdir(parents=True, exist_ok=True)
    lock.touch(exist_ok=True)

    survivors = []
    removed = {
        "deleted": 0,
        "gitignored": 0,
        "extension-disallowed": 0,
        "in-deny-dir": 0,
        "deny-name": 0,
        "deny-pattern": 0,
    }
    total = 0

    with open(lock, "w") as lf:
        deadline = time.time() + 5.0
        while True:
            try:
                fcntl.flock(lf, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.time() >= deadline:
                    print("gc-memory: could not acquire lock; aborting", file=sys.stderr)
                    return 1
                time.sleep(0.05)

        try:
            with open(idx, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        r = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    total += 1
                    reason = classify_stale(r.get("path", ""))
                    if reason:
                        removed[reason] = removed.get(reason, 0) + 1
                    else:
                        survivors.append(r)

            survivors.sort(key=lambda r: r.get("path", ""))
            tmp = idx.with_suffix(".jsonl.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                for r in survivors:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
            os.replace(tmp, idx)
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)

    total_removed = sum(removed.values())
    print(f"gc-memory: scanned {total} rows; removed {total_removed}; "
          f"{len(survivors)} survive")
    for reason, n in removed.items():
        if n:
            print(f"  - {reason}: {n}")

    if total > 0 and total_removed / total > 0.3:
        print(
            f"gc-memory: NOTE — removed {total_removed}/{total} "
            f"({total_removed/total*100:.0f}%) of rows. That's a lot. "
            "Worth checking whether a big refactor or .gitignore change "
            "happened recently."
        )

    # Regen ToC.
    regen = hooks_dir() / "regen-toc.py"
    if regen.exists():
        subprocess.run([sys.executable, str(regen)],
                       cwd=str(repo_root()), check=False, capture_output=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
