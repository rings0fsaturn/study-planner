#!/usr/bin/env python3
"""
regen-toc.py — rebuild .codex/memory/toc.md from index.jsonl.

Picks flat mode below FLAT_THRESHOLD rows, directory-index mode above.
Also writes per-directory ToCs to .codex/memory/toc/<dirname>.md when
in directory-index mode.

Appends the Flows section from .codex/memory/flows/*.md frontmatter.

Adds a "stale notice" header if a quick scan suggests >=10% rows are stale
(file no longer on disk).
"""

import json
import os
import re
from pathlib import Path

FLAT_THRESHOLD = 400  # rows above this -> directory-index mode
STALE_NOTICE_PCT = 10  # surface notice if at least this % of rows are stale


def repo_root() -> Path:
    return Path.cwd()


def memory_dir() -> Path:
    return repo_root() / ".codex" / "memory"


def read_index() -> list[dict]:
    idx = memory_dir() / "index.jsonl"
    rows = []
    if not idx.exists():
        return rows
    with open(idx, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def count_stale(rows: list[dict]) -> int:
    """Cheap stale count: rows whose path no longer exists on disk."""
    n = 0
    root = repo_root()
    for r in rows:
        p = root / r.get("path", "")
        if not p.is_file():
            n += 1
    return n


def fmt_line(row: dict) -> str:
    """One ToC line for a row. Provisional summaries end with ~."""
    summary = row.get("summary", "").strip()
    if row.get("summary_provisional"):
        summary = summary + " ~"
    if row.get("error"):
        summary = f"(indexing error: {row['error']})"
    path = row.get("path", "?")
    return f"- `{path}` — {summary}"


def read_flow_headers() -> list[dict]:
    """Read frontmatter from each flow file."""
    flows_dir = memory_dir() / "flows"
    if not flows_dir.exists():
        return []
    out = []
    for fp in sorted(flows_dir.glob("*.md")):
        try:
            with open(fp, "r", encoding="utf-8") as f:
                head = []
                in_fm = False
                for i, line in enumerate(f):
                    if i == 0 and line.strip() == "---":
                        in_fm = True
                        continue
                    if in_fm and line.strip() == "---":
                        break
                    if in_fm:
                        head.append(line.rstrip("\n"))
                    if i > 30:
                        break
        except OSError:
            continue
        meta = parse_simple_yaml(head)
        meta["__file"] = fp.name
        out.append(meta)
    return out


def parse_simple_yaml(lines: list[str]) -> dict:
    """Tiny yaml-ish parser for our known frontmatter keys. Stdlib only."""
    out = {}
    current_key = None
    for line in lines:
        if not line.strip():
            continue
        if line.startswith("  - ") and current_key:
            out.setdefault(current_key, []).append(line[4:].strip())
            continue
        m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$", line)
        if m:
            key, val = m.group(1), m.group(2).strip()
            if val == "":
                current_key = key
                out[key] = []
            else:
                current_key = None
                # Strip surrounding quotes.
                if (val.startswith('"') and val.endswith('"')) or \
                   (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                out[key] = val
    return out


def write_flat_toc(rows: list[dict], flows: list[dict], stale_pct: float):
    out = memory_dir() / "toc.md"
    parts = []
    parts.append("# Code Memory — Table of Contents")
    parts.append("")
    if stale_pct >= STALE_NOTICE_PCT:
        parts.append(
            f"> **Note:** ~{stale_pct:.0f}% of index rows may be stale "
            "(files no longer on disk). Consider running `gc-memory`."
        )
        parts.append("")
    parts.append(f"_{len(rows)} files indexed. Trailing `~` = provisional summary._")
    parts.append("")
    if not rows:
        parts.append("(empty — index grows as Codex reads files)")
        parts.append("")
    else:
        # Group by top-level dir for human-ish ordering, but flat list overall.
        by_dir: dict[str, list[dict]] = {}
        for r in rows:
            top = r.get("path", "").split("/", 1)[0] or "(root)"
            by_dir.setdefault(top, []).append(r)
        for top in sorted(by_dir.keys()):
            parts.append(f"### `{top}/`")
            for r in sorted(by_dir[top], key=lambda x: x.get("path", "")):
                parts.append(fmt_line(r))
            parts.append("")
    parts.append("## Flows")
    parts.append("")
    if not flows:
        parts.append("(no flow files yet)")
    else:
        for fl in flows:
            slug = fl.get("slug", fl.get("__file", "?").replace(".md", ""))
            title = fl.get("title", "(no title)")
            parts.append(f"- `{slug}` — {title}")
    parts.append("")
    out.write_text("\n".join(parts), encoding="utf-8")

    # Clean per-directory toc/ if it exists from a previous directory-index run.
    toc_dir = memory_dir() / "toc"
    if toc_dir.exists():
        for f in toc_dir.glob("*.md"):
            f.unlink()


def write_directory_index_toc(rows: list[dict], flows: list[dict], stale_pct: float):
    """Top-level toc.md lists directories; per-directory ToCs hold the detail."""
    out = memory_dir() / "toc.md"
    toc_dir = memory_dir() / "toc"
    toc_dir.mkdir(exist_ok=True)

    # Group by top-level directory.
    by_dir: dict[str, list[dict]] = {}
    for r in rows:
        top = r.get("path", "").split("/", 1)[0] or "(root)"
        by_dir.setdefault(top, []).append(r)

    # Per-directory ToCs.
    existing_files = set()
    for top, group in by_dir.items():
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", top) or "root"
        path = toc_dir / f"{safe_name}.md"
        existing_files.add(path.name)
        lines = [f"# ToC: `{top}/`", "", f"_{len(group)} files indexed._", ""]
        for r in sorted(group, key=lambda x: x.get("path", "")):
            lines.append(fmt_line(r))
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Remove stale per-dir ToCs.
    for f in toc_dir.glob("*.md"):
        if f.name not in existing_files:
            f.unlink()

    # Top-level toc.md
    parts = ["# Code Memory — Table of Contents (directory index)"]
    parts.append("")
    if stale_pct >= STALE_NOTICE_PCT:
        parts.append(
            f"> **Note:** ~{stale_pct:.0f}% of index rows may be stale "
            "(files no longer on disk). Consider running `gc-memory`."
        )
        parts.append("")
    parts.append(
        f"_{len(rows)} files indexed across {len(by_dir)} top-level dirs. "
        f"For details on a dir, read `.codex/memory/toc/<dir>.md`._"
    )
    parts.append("")
    parts.append("## Directories")
    parts.append("")
    for top in sorted(by_dir.keys()):
        group = by_dir[top]
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", top) or "root"
        # One-line directory summary: first 3 summaries' top terms.
        sample_summaries = [g.get("summary", "") for g in group[:3] if g.get("summary")]
        hint = "; ".join(s[:50] for s in sample_summaries if s)
        if len(hint) > 120:
            hint = hint[:117] + "..."
        parts.append(f"- `{top}/` — {len(group)} files. (toc: `toc/{safe_name}.md`) — {hint}")
    parts.append("")
    parts.append("## Flows")
    parts.append("")
    if not flows:
        parts.append("(no flow files yet)")
    else:
        for fl in flows:
            slug = fl.get("slug", fl.get("__file", "?").replace(".md", ""))
            title = fl.get("title", "(no title)")
            parts.append(f"- `{slug}` — {title}")
    parts.append("")
    out.write_text("\n".join(parts), encoding="utf-8")


def main():
    rows = read_index()
    flows = read_flow_headers()
    stale = count_stale(rows) if rows else 0
    stale_pct = (stale / len(rows) * 100) if rows else 0.0

    if len(rows) <= FLAT_THRESHOLD:
        write_flat_toc(rows, flows, stale_pct)
    else:
        write_directory_index_toc(rows, flows, stale_pct)


if __name__ == "__main__":
    main()
