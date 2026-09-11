"""Analyse a PDF, find its contents page, and list the chapters.

Deterministic first (regex over the front pages); DeepSeek via the service's
own OpenRouter adapter only as a fallback when the deterministic pass finds
nothing usable. The model never parses the document: it only reads a handful of
front-page excerpts and returns the entries as JSON.

Usage:
    uv run --package intelligence python scripts/pdf_outline.py <pdf> [--llm] [--front 40]

Exit code 0 with a printed outline; `--llm` enables the fallback.
"""

from __future__ import annotations

import argparse
import json
import os
import os.path as op
import re
import sys

FRONT_WINDOW = 40
# "1.1 The Elements of Programming . . . . . 6" (dots may be space-separated)
DOTS_ENTRY = re.compile(r"^(?P<label>.{3,90}?)\s*(?:\.\s*){3,}(?P<page>\d{1,4})\s*$")
# "Chapter 5 Budgeting and control 123" / "1 Building Abstractions with Procedures 1"
NUMBERED_ENTRY = re.compile(
    r"^(?P<num>\d{1,2})\s+(?P<label>[A-Z][^.]{3,80}?)\s+(?P<page>\d{1,4})\s*$"
)
# "Foreword xiii"-style and column layouts: label, run of spaces, page
PLAIN_ENTRY = re.compile(r"^(?P<label>[A-Z][^.]{5,80}?)\s{2,}(?P<page>\d{1,4})\s*$")
# Permissive form used ONLY on a page already identified as a contents page:
# "1.1 Information Is Bits + Context 39" (single space before the page).
PERMISSIVE_ENTRY = re.compile(
    r"^(?P<label>(?:\d{1,2}\.){1,3}\d{0,2}\s*[A-Z].*?)\s+(?P<page>\d{1,4})\s*$"
)
CHAPTER_ENTRY = re.compile(
    r"Chapter\s+(?P<num>\d{1,2})\s+(?P<label>.+?)\s+(?P<page>\d{1,4})$"
)
CONTENTS_WORD = re.compile(r"^\s*(table of )?contents\b", re.IGNORECASE)

OUTLINE_SCHEMA = {
    "type": "object",
    "properties": {
        "entries": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "page": {"type": "integer", "minimum": 1},
                },
                "required": ["title", "page"],
                "additionalProperties": False,
            },
        },
        "contentsPageIndex": {"type": "integer", "minimum": 1},
    },
    "required": ["entries", "contentsPageIndex"],
    "additionalProperties": False,
}

SYSTEM = (
    "You read the first pages of a book and return its table of contents. "
    "Use only the page excerpts given; invent nothing. `page` is the number "
    "printed on the page, not the PDF page order. Return at most 40 entries, "
    "the top-level chapters or parts only, and `contentsPageIndex` = the PDF "
    "page number (1-based) that carries the contents list."
)


def load_env(path: str) -> None:
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def logical_lines(text: str) -> list[str]:
    """Merge wrapped contents lines into one line per entry.

    Publishers wrap long titles, so an entry and its page number land on
    different lines ("Chapter 6 Business structure and performance" /
    "management" / "181"). A line that does not end in a digit continues onto
    the next; the merge stops at 140 chars so a digit-free page cannot grow
    without bound.
    """
    merged: list[str] = []
    buffer = ""
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        buffer = f"{buffer} {line}".strip() if buffer else line
        if buffer[-1:].isdigit() or len(buffer) > 140:
            merged.append(buffer)
            buffer = ""
    if buffer:
        merged.append(buffer)
    return merged


def parse_entries(text: str, permissive: bool = False) -> list[dict]:
    """Generic contents parse over one page's logical lines.

    `permissive` adds the single-space "1.1 Title 39" rule and is only enabled
    once the page is known to be a contents page (it would over-match prose).
    """
    entries: list[dict] = []
    for line in logical_lines(text):
        if len(line) < 6 or len(line) > 140:
            continue
        match = (
            CHAPTER_ENTRY.search(line)
            or DOTS_ENTRY.match(line)
            or NUMBERED_ENTRY.match(line)
            or PLAIN_ENTRY.match(line)
            or (PERMISSIVE_ENTRY.match(line) if permissive else None)
        )
        if not match:
            continue
        groups = match.groupdict()
        label = groups["label"].strip(" .\u00b7")
        page = int(groups["page"])
        if groups.get("num"):
            label = f"Chapter {groups['num']} {label}"
        if len(label) < 3 or page < 1:
            continue
        entries.append({"title": label, "page": page})
    return entries


def score_page(text: str, index: int) -> tuple[int, list[dict]]:
    entries = parse_entries(text, permissive=bool(CONTENTS_WORD.search(text[:400])))
    score = len(entries)
    if CONTENTS_WORD.search(text[:400]):
        score += 5
    # contents pages sit near the front; nudge earlier pages
    score += max(0, 4 - index // 6)
    return score, entries


def find_contents(pages: list[str]) -> tuple[int | None, list[dict], int]:
    """Best contents page, its entries, and the winning score.

    Once a page wins, contiguous neighbours that also parse are merged in, so a
    contents list spanning several pages comes back whole.
    """
    best_score, best_index, best_entries = 0, None, []
    for index, text in enumerate(pages[:FRONT_WINDOW]):
        score, entries = score_page(text, index)
        if score > best_score:
            best_score, best_index, best_entries = score, index, entries
    if best_index is None:
        return None, [], 0

    entries = list(best_entries)
    start = best_index
    # A contents list can start before the best-scoring page (some publishers
    # split the top-level list from the per-chapter detail), so walk back first.
    for step in (1, 2, 3, 4, 5):
        previous = best_index - step
        if previous < 0:
            break
        earlier = parse_entries(pages[previous], permissive=True)
        if len(earlier) < 3:
            break
        entries = earlier + entries
        start = previous
    for step in (1, 2, 3, 4, 5):
        following = best_index + step
        if following >= len(pages):
            break
        more = parse_entries(pages[following], permissive=True)
        if len(more) < 3:
            break
        entries.extend(more)
    return start, entries, best_score


def llm_outline(pages: list[str], front: int) -> tuple[int | None, list[dict], str]:
    """Fallback: one DeepSeek call over front-page excerpts (reuses the app's adapter)."""
    from app.generation.openrouter_client import OpenRouterGenerationClient

    excerpts = [
        f"<page index=\"{index + 1}\">\n{' '.join(pages[index].split())[:1200]}\n</page>"
        for index in range(min(front, len(pages)))
    ]
    client = OpenRouterGenerationClient(
        api_key=os.environ.get("OPENROUTER_API_KEY", "").strip(),
        timeout_ms=120000,
        max_output_tokens=4000,
        schema_name="pdf_outline",
    )
    response = client.generate(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "\n\n".join(excerpts)},
        ],
        OUTLINE_SCHEMA,
        correlation_id="pdf-outline-probe",
    )
    if response.outcome != "ok" or not response.structured_output:
        return None, [], f"{response.outcome}: {(response.error or {}).get('message', '')}"
    data = response.structured_output
    return int(data["contentsPageIndex"]) - 1, list(data["entries"]), "ok"


SELF_CHECK_SAMPLES: list[tuple[str, list[str]]] = [
    # wrapped chapter title + page number on its own line (APM layout)
    (
        "Chapter 6 Business structure and performance\nmanagement\n181\n",
        ["Chapter 6 Business structure and performance management 181"],
    ),
    # dotted sub-entries (SICP layout)
    (
        "1.1 The Elements of Programming . . . . . . . . 6\n",
        ["1.1 The Elements of Programming . . . . . . . . 6"],
    ),
    # single space before the page number (CSAPP layout) needs permissive
    ("1.1 Information Is Bits + Context 39\n", ["1.1 Information Is Bits + Context 39"]),
]


def self_check() -> int:
    """Smallest runnable check: fails loudly if the line/entry logic breaks."""
    for text, expected in SELF_CHECK_SAMPLES:
        merged = logical_lines(text)
        assert merged == expected, f"logical_lines: {merged!r} != {expected!r}"
    wrapped = parse_entries(SELF_CHECK_SAMPLES[0][0])
    assert wrapped == [
        {"title": "Chapter 6 Business structure and performance management", "page": 181}
    ], wrapped
    dotted = parse_entries(SELF_CHECK_SAMPLES[1][0])
    assert dotted == [{"title": "1.1 The Elements of Programming", "page": 6}], dotted
    # the permissive rule must stay off unless the page is a known contents page
    assert parse_entries(SELF_CHECK_SAMPLES[2][0]) == []
    assert parse_entries(SELF_CHECK_SAMPLES[2][0], permissive=True) == [
        {"title": "1.1 Information Is Bits + Context", "page": 39}
    ]
    print("self-check: ok (3 layouts, permissive gating)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Find and list a PDF's contents page")
    parser.add_argument("pdf", nargs="?", default="")
    parser.add_argument("--llm", action="store_true", help="enable the DeepSeek fallback")
    parser.add_argument(
        "--force-llm", action="store_true", help="skip the deterministic pass (smoke test)"
    )
    parser.add_argument("--front", type=int, default=FRONT_WINDOW)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--self-check", action="store_true", help="run the built-in checks")
    args = parser.parse_args()

    if args.self_check:
        return self_check()
    if not args.pdf:
        parser.error("a PDF path is required (or pass --self-check)")

    load_env(op.join(op.dirname(op.abspath(__file__)), "..", ".env"))
    from pypdf import PdfReader

    reader = PdfReader(args.pdf)
    total = len(reader.pages)
    pages = [(reader.pages[index].extract_text() or "") for index in range(min(total, args.front))]

    if args.force_llm:
        index, entries, score = None, [], 0
    else:
        index, entries, score = find_contents(pages)
    source = "deterministic"
    detail = f"score={score}"
    if not entries and (args.llm or args.force_llm):
        index, entries, detail = llm_outline(pages, args.front)
        source = "llm"

    print(f"{op.basename(args.pdf)}: {total} pages, {len(pages)} scanned, "
          f"contents={('pdf page ' + str(index + 1)) if index is not None else 'not found'}, "
          f"{len(entries)} entries, source={source} ({detail})")
    for entry in entries:
        print(f"  {entry['title'][:80]:<82} page {entry['page']}")
    if args.json:
        print(json.dumps({"entries": entries, "contentsPageIndex": (index or 0) + 1}))
    return 0 if entries else 1


if __name__ == "__main__":
    sys.exit(main())
