#!/usr/bin/env python3
"""
update-index.py — upsert one file's row in .codex/memory/index.jsonl.

Called by the post-read-index.sh hook with a single file path argument.
Also usable directly by Codex in instruction-mode fallback:
    python3 .codex/hooks/update-index.py <path>

Pipeline:
  1. Resolve path, ensure file is inside repo and indexable.
  2. Run gitignore/allow/deny filters.
  3. Hash file (sha1).
  4. Extract symbols via ctags.
  5. Generate heuristic provisional summary.
  6. Upsert JSONL row under flock.
  7. Trigger regen-toc.py.

On any error, writes a degraded row with an "error" field rather than
silently failing.
"""

import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ----- Filters (Decision: gitignore-aware + allow + deny) -----

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
    "Gemfile.lock", "Pipfile.lock", "poetry.lock", "Cargo.lock",
    "go.sum",
}

DENY_DIR_SEGMENTS = {
    "node_modules", "dist", "build", "target", ".next", ".nuxt",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".tox",
    "vendor", "venv", ".venv", "env", ".env.d",
    ".gradle", ".idea", ".vscode-test", "coverage",
    "out", "bin", "obj",
}

DENY_NAME_PATTERNS = [
    re.compile(r"\.min\.[a-zA-Z0-9]+$"),
    re.compile(r"\.bundle\.[a-zA-Z0-9]+$"),
    re.compile(r"\.generated\.[a-zA-Z0-9]+$"),
]


# ----- Paths -----

def repo_root() -> Path:
    return Path.cwd()


def memory_dir() -> Path:
    return repo_root() / ".codex" / "memory"


def index_path() -> Path:
    return memory_dir() / "index.jsonl"


def lock_path() -> Path:
    return memory_dir() / ".index.lock"


def hooks_dir() -> Path:
    return repo_root() / ".codex" / "hooks"


# ----- Filter logic -----

def is_indexable(path: Path) -> tuple[bool, str]:
    """Return (indexable, reason_if_not)."""
    if not path.exists() or not path.is_file():
        return False, "file does not exist"

    # Reject deny-list directory segments.
    parts = set(path.parts)
    deny_hit = parts & DENY_DIR_SEGMENTS
    if deny_hit:
        return False, f"deny dir segment: {sorted(deny_hit)[0]}"

    # Reject deny-list names.
    if path.name in DENY_NAMES:
        return False, f"deny name: {path.name}"
    for pat in DENY_NAME_PATTERNS:
        if pat.search(path.name):
            return False, f"deny pattern: {pat.pattern}"

    # Allow-list extension check.
    ext = path.suffix.lower()
    if ext not in ALLOW_EXTS:
        return False, f"extension not in allow-list: {ext or '(none)'}"

    # Gitignore check (only if we're in a git repo).
    if (repo_root() / ".git").exists():
        try:
            result = subprocess.run(
                ["git", "check-ignore", "-q", str(path)],
                cwd=str(repo_root()),
                capture_output=True,
                timeout=2,
            )
            if result.returncode == 0:
                return False, "gitignored"
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass  # git missing or slow — proceed without gitignore filter

    return True, ""


# ----- File processing -----

def hash_file(path: Path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def lang_for(path: Path) -> str:
    return path.suffix.lstrip(".").lower()


def run_ctags(path: Path) -> list[dict]:
    """Run universal-ctags on the file, return list of {name, kind, lines:[s,e]}."""
    if not shutil.which("ctags"):
        return []
    try:
        result = subprocess.run(
            ["ctags",
             "--output-format=json",
             "--fields=+ne",
             "-f", "-",
             str(path)],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except subprocess.TimeoutExpired:
        return []

    symbols = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            tag = json.loads(line)
        except json.JSONDecodeError:
            continue
        name = tag.get("name")
        kind = tag.get("kind", "symbol")
        start = tag.get("line")
        end = tag.get("end", start)
        if not name or not isinstance(start, int):
            continue
        symbols.append({
            "name": name,
            "kind": kind,
            "lines": [start, end if isinstance(end, int) else start],
        })
    return symbols


def heuristic_summary(path: Path, symbols: list[dict]) -> str:
    """Cheap provisional summary from comments/docstring/symbol names."""
    # Try first docstring or comment in the first ~30 lines.
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            head = [next(f, "") for _ in range(40)]
    except OSError:
        return f"{path.name} (could not read)"

    # Python docstring
    text = "".join(head)
    m = re.search(r'^\s*(?:"""|\'\'\')(.+?)(?:"""|\'\'\')', text, re.S | re.M)
    if m:
        first_line = m.group(1).strip().splitlines()[0].strip()
        if 5 <= len(first_line) <= 120:
            return first_line

    # First non-shebang, non-empty comment-ish line
    for raw in head:
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#!"):
            continue
        # Strip common comment markers
        for marker in ("// ", "# ", "/* ", "* ", "-- ", "<!-- "):
            if line.startswith(marker):
                cleaned = line[len(marker):].rstrip("*/-> ")
                if 5 <= len(cleaned) <= 120:
                    return cleaned
                break
        else:
            break  # first non-empty line is code, not a comment

    # Fall back to symbol summary
    if symbols:
        top = [s["name"] for s in symbols[:3]]
        kind = symbols[0]["kind"]
        n = len(symbols)
        return f"{n} {kind}{'s' if n != 1 else ''} including {', '.join(top)}"

    return f"{path.name} (no symbols extracted)"


# ----- JSONL upsert under lock -----

def upsert_row(row: dict):
    mem = memory_dir()
    mem.mkdir(parents=True, exist_ok=True)
    idx = index_path()
    idx.touch(exist_ok=True)
    lock = lock_path()
    lock.touch(exist_ok=True)

    with open(lock, "w") as lf:
        # Acquire exclusive lock with timeout.
        deadline = time.time() + 2.0
        while True:
            try:
                fcntl.flock(lf, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.time() >= deadline:
                    raise TimeoutError("flock timeout")
                time.sleep(0.05)

        try:
            existing = []
            target_path = row["path"]
            with open(idx, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        r = json.loads(line)
                    except json.JSONDecodeError:
                        continue  # drop corrupt line
                    if r.get("path") != target_path:
                        existing.append(r)
            existing.append(row)
            # Sort by path for deterministic output.
            existing.sort(key=lambda r: r.get("path", ""))
            tmp = idx.with_suffix(".jsonl.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                for r in existing:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
            os.replace(tmp, idx)
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)


def trigger_toc_regen():
    script = hooks_dir() / "regen-toc.py"
    if not script.exists():
        return
    try:
        subprocess.run(
            [sys.executable, str(script)],
            cwd=str(repo_root()),
            timeout=15,
            check=False,
            capture_output=True,
        )
    except subprocess.TimeoutExpired:
        pass


# ----- Main -----

def main(argv):
    if len(argv) < 2:
        print("usage: update-index.py <path>", file=sys.stderr)
        return 1

    raw_path = argv[1]
    path = Path(raw_path)
    if not path.is_absolute():
        path = (repo_root() / path).resolve()
    else:
        path = path.resolve()

    # Compute path relative to repo root for storage.
    try:
        rel_path = str(path.relative_to(repo_root()))
    except ValueError:
        # File outside repo — skip.
        return 0

    indexable, reason = is_indexable(path)
    if not indexable:
        # Not an error — just not something we index.
        return 0

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        h = hash_file(path)
        symbols = run_ctags(path)
        summary = heuristic_summary(path, symbols)
        row = {
            "path": rel_path,
            "hash": h,
            "lang": lang_for(path),
            "symbols": symbols,
            "summary": summary,
            "summary_provisional": True,
            "indexed_at": now,
        }
        if not symbols:
            row["needs_symbol_population"] = True
        upsert_row(row)
    except Exception as e:
        # Degraded row, per Decision 7a.
        try:
            upsert_row({
                "path": rel_path,
                "hash": "",
                "lang": lang_for(path),
                "symbols": [],
                "summary": f"(indexing error)",
                "summary_provisional": True,
                "indexed_at": now,
                "error": f"{type(e).__name__}: {e}",
            })
        except Exception:
            pass
        return 1

    trigger_toc_regen()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
