"""Derive a material's outline (chapters with page numbers) at ingestion.

Deterministic first: PDF bookmarks, then a parse of the printed contents page.
One DeepSeek call over front-page excerpts is the fallback when neither yields
entries. The model never parses the document; it only reads a handful of
front-page excerpts and returns the entries as JSON (D-04).

Everything here works in **PDF page numbers** (what the viewer shows and what
`content_chunks.page_start`/`page_end` hold). The contents page prints the
book's own page numbers, so the printed->PDF offset is derived from the body's
running headers and applied to every entry. When that offset cannot be
measured the outline is refused outright: a chapter range off by the offset
would scope the right chapter's pages to the wrong chunks, and a typed range
against `page_count` is still available to the learner.
"""

from __future__ import annotations

import logging
import os
import re
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass

logger = logging.getLogger("ingestion.outline")

FRONT_WINDOW = 40
# A contents page with fewer entries than this is not a usable outline.
MIN_ENTRIES = 3
# Offset derivation: a page votes when every standalone number on its running
# header agrees on one delta. 20 voting pages and 60% agreement filter out
# page-number lookalikes in titles and body text.
OFFSET_MIN_PAGES = 20
OFFSET_MIN_AGREEMENT = 0.6
HEAD_LINES = 2
HEAD_MAX_WORDS = 6

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
CHAPTER_ENTRY = re.compile(r"Chapter\s+(?P<num>\d{1,2})\s+(?P<label>.+?)\s+(?P<page>\d{1,4})$")
CONTENTS_WORD = re.compile(r"^\s*(table of )?contents\b", re.IGNORECASE)
# A standalone page number: not part of "3.2", "P.5" or "20X9".
STANDALONE_NUMBER = re.compile(r"(?<![\d.])(\d{1,4})(?![\d.])")

LLM_SCHEMA = {
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

LLM_SYSTEM = (
    "You read the first pages of a book and return its table of contents. "
    "Use only the page excerpts given; invent nothing. `page` is the number "
    "printed on the page, not the PDF page order. Return at most 40 entries, "
    "the top-level chapters or parts only, and `contentsPageIndex` = the PDF "
    "page number (1-based) that carries the contents list."
)

# A fallback takes the front-page texts and the PDF page count, and returns
# entries whose `page` is the *printed* page number, or None when it fails.
OutlineFallback = Callable[[list[str], int], list[dict] | None]


@dataclass(frozen=True)
class Outline:
    """A material's chapter list, in PDF page numbers."""

    entries: tuple[dict[str, object], ...]
    page_count: int
    page_offset: int | None
    source: str  # "bookmarks" | "contents" | "llm"

    def to_json(self) -> dict[str, object]:
        """The `materials.outline` payload (page_count/page_offset are columns)."""
        return {"entries": [dict(entry) for entry in self.entries], "source": self.source}


def to_pdf_page(printed_page: int, page_offset: int | None) -> int:
    """Convert a printed page number to its PDF page (offset = printed - pdf)."""
    return printed_page - (page_offset or 0)


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
        if len(earlier) < MIN_ENTRIES:
            break
        entries = earlier + entries
        start = previous
    for step in (1, 2, 3, 4, 5):
        following = best_index + step
        if following >= len(pages):
            break
        more = parse_entries(pages[following], permissive=True)
        if len(more) < MIN_ENTRIES:
            break
        entries.extend(more)
    return start, entries, best_score


def _header_numbers(page_text: str, page_count: int) -> set[int]:
    """Standalone numbers on a page's running header, filtered to plausible pages."""
    lines = [line.strip() for line in (page_text or "").splitlines() if line.strip()]
    numbers: set[int] = set()
    for line in lines[:HEAD_LINES]:
        if len(line.split()) > HEAD_MAX_WORDS:
            continue
        numbers.update(
            number
            for number in (int(m.group(1)) for m in STANDALONE_NUMBER.finditer(line))
            if 1 <= number <= page_count
        )
    return numbers


def derive_page_offset(pages: list[str]) -> int | None:
    """Measure `printed - pdf_page` from the body's running headers.

    A page votes only when its header numbers all agree on one delta, which
    drops title/body digits ("Chapter 5" on a page whose header says 68). The
    offset is per-document and must never be hardcoded.
    """
    votes: Counter[int] = Counter()
    for index, text in enumerate(pages, start=1):
        deltas = {number - index for number in _header_numbers(text, len(pages))}
        if len(deltas) == 1:
            votes[deltas.pop()] += 1
    total = sum(votes.values())
    if total < OFFSET_MIN_PAGES:
        return None
    offset, agreeing = votes.most_common(1)[0]
    if agreeing / total < OFFSET_MIN_AGREEMENT:
        return None
    return offset


def _convert(entries: list[dict], offset: int, page_count: int) -> list[dict]:
    """Printed-page entries -> PDF-page entries, dropping implausible rows."""
    converted: list[dict] = []
    seen: set[int] = set()
    for entry in entries:
        title = str(entry.get("title") or "").strip()
        try:
            page = to_pdf_page(int(entry["page"]), offset)
        except (KeyError, TypeError, ValueError):
            continue
        if not title or page < 1 or page > page_count or page in seen:
            continue
        seen.add(page)
        converted.append({"title": title, "page": page})
    return converted


def _safe_fallback(
    fallback: OutlineFallback, pages: list[str], page_count: int
) -> list[dict] | None:
    """A provider failure must never fail ingestion; the outline is best-effort."""
    try:
        return fallback(pages, page_count)
    except Exception:
        logger.warning("outline LLM fallback failed", exc_info=True)
        return None


def _openrouter_entries(pages: list[str], page_count: int) -> list[dict] | None:
    """One DeepSeek call over front-page excerpts, through the app's adapter."""
    from app.generation.openrouter_client import OpenRouterGenerationClient

    excerpts = [
        f'<page index="{index + 1}">\n{" ".join(pages[index].split())[:1200]}\n</page>'
        for index in range(min(FRONT_WINDOW, len(pages)))
    ]
    client = OpenRouterGenerationClient(
        api_key=os.environ.get("OPENROUTER_API_KEY", "").strip(),
        timeout_ms=120000,
        max_output_tokens=4000,
        schema_name="material_outline",
    )
    response = client.generate(
        [
            {"role": "system", "content": LLM_SYSTEM},
            {"role": "user", "content": "\n\n".join(excerpts)},
        ],
        LLM_SCHEMA,
        correlation_id="material-outline",
    )
    if response.outcome != "ok" or not response.structured_output:
        logger.info("outline fallback returned %s", response.outcome)
        return None
    return list(response.structured_output.get("entries") or [])


def build_outline(
    pages: Sequence[str],
    *,
    bookmarks: Sequence[tuple[str, int]] = (),
    page_count: int | None = None,
    llm: OutlineFallback | None = None,
) -> Outline | None:
    """Best available outline for one material, or None when there is none."""
    page_list = list(pages)
    count = page_count if page_count is not None else len(page_list)
    if not count:
        return None

    # Bookmarks already carry PDF page numbers and need no offset.
    if bookmarks:
        entries = _convert([{"title": title, "page": page} for title, page in bookmarks], 0, count)
        if len(entries) >= MIN_ENTRIES:
            return Outline(tuple(entries), count, None, "bookmarks")

    offset = derive_page_offset(page_list)
    if offset is None:
        # Without the offset a printed page number cannot be mapped onto the
        # chunks, and a wrong range is worse than no chapter list.
        return None

    _index, parsed, _score = find_contents(page_list)
    if len(parsed) >= MIN_ENTRIES:
        entries = _convert(parsed, offset, count)
        if len(entries) >= MIN_ENTRIES:
            return Outline(tuple(entries), count, offset, "contents")

    fallback = llm or _openrouter_entries
    raw = _safe_fallback(fallback, page_list, count)
    entries = _convert(list(raw or []), offset, count)
    if len(entries) < MIN_ENTRIES:
        return None
    return Outline(tuple(entries), count, offset, "llm")
