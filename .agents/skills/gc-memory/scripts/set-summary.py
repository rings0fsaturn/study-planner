#!/usr/bin/env python3
"""
set-summary.py — replace one file's row summary with a real one-line description.

Usage:
    python3 .claude/hooks/set-summary.py <path> "<summary sentence>"

Called by Claude after reading a file whose index row has
summary_provisional=true. The new summary should be <=15 words and describe
the file's *purpose*, not its contents.
"""

import fcntl
import json
import os
import subprocess
import sys
import time
from pathlib import Path


def repo_root() -> Path:
    return Path.cwd()


def memory_dir() -> Path:
    return repo_root() / ".claude" / "memory"


def index_path() -> Path:
    return memory_dir() / "index.jsonl"


def lock_path() -> Path:
    return memory_dir() / ".index.lock"


def hooks_dir() -> Path:
    return repo_root() / ".claude" / "hooks"


def main(argv):
    if len(argv) < 3:
        print("usage: set-summary.py <path> \"<summary>\"", file=sys.stderr)
        return 1

    raw_path = argv[1]
    summary = " ".join(argv[2:]).strip()
    if not summary:
        print("set-summary: empty summary, refusing", file=sys.stderr)
        return 1

    # Length sanity check.
    word_count = len(summary.split())
    if word_count > 25:
        print(f"set-summary: summary is {word_count} words (>25), refusing. "
              "Keep it under 15 words and focused on purpose.", file=sys.stderr)
        return 1

    path = Path(raw_path)
    if path.is_absolute():
        try:
            rel_path = str(path.resolve().relative_to(repo_root()))
        except ValueError:
            print(f"set-summary: path {path} is outside repo root", file=sys.stderr)
            return 1
    else:
        rel_path = str(path)

    idx = index_path()
    lock = lock_path()
    if not idx.exists():
        print("set-summary: no index.jsonl yet", file=sys.stderr)
        return 1
    lock.parent.mkdir(parents=True, exist_ok=True)
    lock.touch(exist_ok=True)

    with open(lock, "w") as lf:
        deadline = time.time() + 2.0
        while True:
            try:
                fcntl.flock(lf, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.time() >= deadline:
                    print("set-summary: could not acquire lock", file=sys.stderr)
                    return 1
                time.sleep(0.05)

        try:
            rows = []
            found = False
            with open(idx, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        r = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if r.get("path") == rel_path:
                        r["summary"] = summary
                        r["summary_provisional"] = False
                        found = True
                    rows.append(r)
            if not found:
                print(f"set-summary: no row for {rel_path} — read the file first "
                      "so the hook creates a row.", file=sys.stderr)
                return 1
            tmp = idx.with_suffix(".jsonl.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                for r in rows:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
            os.replace(tmp, idx)
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)

    # Regenerate ToC so this summary is reflected.
    regen = hooks_dir() / "regen-toc.py"
    if regen.exists():
        subprocess.run([sys.executable, str(regen)],
                       cwd=str(repo_root()), check=False, capture_output=True)

    print(f"set-summary: updated {rel_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
