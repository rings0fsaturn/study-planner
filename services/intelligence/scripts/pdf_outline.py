"""Analyse a PDF and print its outline (chapters with PDF page numbers).

The logic lives in `app.ingestion.outline` (P3 runs the same code at
ingestion); this script is only the operator probe for running it over a PDF
on disk and for comparing layouts across publishers.

Usage:
    uv run --package intelligence python scripts/pdf_outline.py <pdf> [--llm] [--json]

Exit code 0 when an outline was found. Without `--llm` the deterministic
contents-page parse is the only source (no provider call).
"""

from __future__ import annotations

import argparse
import json
import os
import os.path as op
import sys

from app.ingestion.outline import build_outline


def load_env(path: str) -> None:
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> int:
    parser = argparse.ArgumentParser(description="List a PDF's outline")
    parser.add_argument("pdf", nargs="?")
    parser.add_argument("--llm", action="store_true", help="enable the DeepSeek fallback")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    if not args.pdf:
        parser.error("a PDF path is required")

    load_env(op.join(op.dirname(op.abspath(__file__)), "..", ".env"))
    from pypdf import PdfReader

    reader = PdfReader(args.pdf)
    pages = [(reader.pages[index].extract_text() or "") for index in range(len(reader.pages))]
    # build_outline defaults to the provider fallback; this probe is
    # deterministic unless it is explicitly asked for.
    outline = build_outline(pages, llm=None if args.llm else (lambda _pages, _count: None))

    print(f"{op.basename(args.pdf)}: {len(pages)} pages")
    if outline is None:
        print("  no outline found")
        return 1
    print(
        f"  source={outline.source} pageCount={outline.page_count} "
        f"pageOffset={outline.page_offset} entries={len(outline.entries)}"
    )
    for entry in outline.entries:
        print(f"  {str(entry['title'])[:80]:<82} pdf page {entry['page']}")
    if args.json:
        print(json.dumps(outline.to_json()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
